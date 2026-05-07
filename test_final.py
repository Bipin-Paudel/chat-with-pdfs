import os
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_openai import AzureChatOpenAI

print("Testing local HuggingFace embeddings...")
embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
res = embeddings.embed_query("This is a test document.")
print(f"Embeddings generated successfully. Length: {len(res)}")

print("Testing AzureChatOpenAI...")
base_url = os.getenv("AZURE_OPENAI_BASE_URL", "")
if base_url.endswith("/openai/v1/"):
    base_url = base_url.replace("/openai/v1/", "/")
elif base_url.endswith("/openai/v1"):
    base_url = base_url.replace("/openai/v1", "/")

llm = AzureChatOpenAI(
    azure_deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-5.4-mini"),
    openai_api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
    azure_endpoint=base_url,
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    temperature=0.3
)
chat_res = llm.invoke("Hello, Azure!")
print(f"Chat Response: {chat_res.content}")
print("All local tests passed!")
