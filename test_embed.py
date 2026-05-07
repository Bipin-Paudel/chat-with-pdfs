import os
from dotenv import load_dotenv
from langchain_openai import AzureOpenAIEmbeddings

load_dotenv()

api_key = os.getenv("AZURE_OPENAI_API_KEY")
api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01")

try:
    embeddings = AzureOpenAIEmbeddings(
        azure_deployment="gpt-5.4-mini",
        openai_api_version=api_version,
        azure_endpoint="https://skinpalai-resource.openai.azure.com/",
        api_key=api_key
    )
    res = embeddings.embed_query("test")
    print("Test success")
except Exception as e:
    print(f"Test failed: {e}")
