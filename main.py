import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_openai import AzureChatOpenAI
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()

# ── Config ───────────────────────────────────────────────────────────────────
PDFS_DIRECTORY = "pdfs/"
HF_CACHE = os.getenv("HF_HOME", "/tmp/hf_cache")

if not os.path.exists(PDFS_DIRECTORY):
    os.makedirs(PDFS_DIRECTORY)

# ── Embedding model (loaded once, cached) ────────────────────────────────────
_embeddings = None

def get_embeddings():
    """Lazy-load embeddings model once and reuse."""
    global _embeddings
    if _embeddings is None:
        _embeddings = HuggingFaceEmbeddings(
            model_name="all-MiniLM-L6-v2",
            cache_folder=HF_CACHE,
            model_kwargs={"device": "cpu"},
            encode_kwargs={"normalize_embeddings": True},
        )
    return _embeddings


# ── Prompt Template ──────────────────────────────────────────────────────────
TEMPLATE = """You are ChatDoc AI, an expert document analyst.
Answer questions based ONLY on the provided document context.
If the answer is not in the context, say: "I couldn't find that in the document."
Format your response using markdown: use **bold** for key terms,
numbered lists for steps/findings, and clear paragraph breaks.

Context:
{context}

Question: {question}

Answer:"""


def _fix_azure_url(url: str) -> str:
    """Strip /openai/v1/ suffix from Azure base URL."""
    suffixes = ["/openai/v1/", "/openai/v1", "/openai/"]
    for suffix in suffixes:
        if url.endswith(suffix):
            return url[: -len(suffix)] + "/"
    if not url.endswith("/"):
        url += "/"
    return url


def process_pdf(file_path: str) -> tuple:
    """
    Load a PDF, split into chunks, embed with HuggingFace, build FAISS index.
    Returns: (faiss_db, total_page_count)
    """
    loader = PyPDFLoader(file_path)
    documents = loader.load()
    page_count = len(documents)

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=200,
        add_start_index=True,
    )
    chunks = text_splitter.split_documents(documents)

    embeddings = get_embeddings()
    db = FAISS.from_documents(chunks, embeddings)
    return db, page_count


def ask_question(question: str, dbs: list, k: int = 4) -> dict:
    """
    Query one or more FAISS databases and generate an answer.
    Returns: {"answer": str, "sources": [{"page": int, "snippet": str}]}
    """
    # Gather top-k docs from each DB
    all_docs = []
    for db in dbs:
        try:
            results = db.similarity_search_with_score(question, k=k)
            all_docs.extend(results)
        except Exception:
            pass

    # Sort by score (lower = more relevant in FAISS L2) and take top-k
    all_docs.sort(key=lambda x: x[1])
    top_docs = all_docs[:k]

    if not top_docs:
        return {
            "answer": "I couldn't find relevant information in the uploaded documents.",
            "sources": [],
        }

    # Build context
    context = "\n\n---\n\n".join(doc.page_content for doc, _ in top_docs)

    # Build sources list
    sources = []
    seen_pages = set()
    for doc, score in top_docs:
        page = doc.metadata.get("page", 0) + 1  # 1-indexed
        if page not in seen_pages:
            seen_pages.add(page)
            snippet = doc.page_content[:200].replace("\n", " ").strip()
            sources.append({"page": page, "snippet": snippet + "..."})

    # Init Azure LLM
    base_url = _fix_azure_url(os.getenv("AZURE_OPENAI_BASE_URL", ""))
    llm = AzureChatOpenAI(
        azure_deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4"),
        openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
        azure_endpoint=base_url,
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        temperature=0.3,
        # max_completion_tokens for o-series / newer models; fallback silently ignored
        model_kwargs={"max_completion_tokens": 1024},
    )

    prompt = ChatPromptTemplate.from_template(TEMPLATE)
    chain = prompt | llm
    response = chain.invoke({"question": question, "context": context})

    return {"answer": response.content, "sources": sources}
