import os
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_openai import AzureChatOpenAI
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()

# Configuration
PDFS_DIRECTORY = 'pdfs/'
if not os.path.exists(PDFS_DIRECTORY):
    os.makedirs(PDFS_DIRECTORY)

TEMPLATE = """
You are a highly capable AI assistant specializing in document analysis. 
Use the following pieces of retrieved context to answer the user's question accurately. 

If the answer is not contained within the context, politely state that you don't know based on the document provided. 
Maintain a professional and helpful tone.

Context:
{context}

Question: {question}

Answer (concise and structured):
"""

def process_pdf(file_path):
    """Loads a PDF, splits it into chunks, and creates a FAISS vector store using Azure OpenAI."""
    loader = PyPDFLoader(file_path)
    documents = loader.load()

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1500,
        chunk_overlap=200,
        add_start_index=True
    )

    chunked_docs = text_splitter.split_documents(documents)
    
    # Initialize Local HuggingFace Embeddings (Free & No Azure Deployment Required)
    embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    
    db = FAISS.from_documents(chunked_docs, embeddings)
    return db

def ask_question(question, db, k=4):
    """Retrieves relevant documents and generates an answer using Azure OpenAI."""
    # Retrieve relevant documents
    related_documents = db.similarity_search(question, k=k)
    context = "\n\n".join(doc.page_content for doc in related_documents)
    
    # Fix Base URL if it contains /openai/v1/
    base_url = os.getenv("AZURE_OPENAI_BASE_URL", "")
    if base_url.endswith("/openai/v1/"):
        base_url = base_url.replace("/openai/v1/", "/")
    elif base_url.endswith("/openai/v1"):
        base_url = base_url.replace("/openai/v1", "/")
        
    # Initialize Azure OpenAI LLM
    llm = AzureChatOpenAI(
        azure_deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-5.4-mini"),
        openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
        azure_endpoint=base_url,
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        temperature=0.3
    )
    
    # Create chain
    prompt = ChatPromptTemplate.from_template(TEMPLATE)
    chain = prompt | llm
    
    # Invoke chain
    response = chain.invoke({"question": question, "context": context})
    return response.content
