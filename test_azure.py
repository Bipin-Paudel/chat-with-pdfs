import os
from dotenv import load_dotenv
from langchain_openai import AzureOpenAIEmbeddings, AzureChatOpenAI

load_dotenv()

api_key = os.getenv("AZURE_OPENAI_API_KEY")
api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01")

# Test 1: Using the provided base URL
try:
    embeddings1 = AzureOpenAIEmbeddings(
        azure_deployment="text-embedding-ada-002",
        openai_api_version=api_version,
        azure_endpoint="https://skinpalai-resource.openai.azure.com/openai/v1/",
        api_key=api_key,
    )
    res = embeddings1.embed_query("test")
    print("Test 1 success")
except Exception as e:
    print(f"Test 1 failed: {e}")

# Test 2: Using just the base domain
try:
    embeddings2 = AzureOpenAIEmbeddings(
        azure_deployment="text-embedding-ada-002",
        openai_api_version=api_version,
        azure_endpoint="https://skinpalai-resource.openai.azure.com/",
        api_key=api_key,
    )
    res = embeddings2.embed_query("test")
    print("Test 2 success")
except Exception as e:
    print(f"Test 2 failed: {e}")

# Test 3: What if the embedding model is named something else?
try:
    embeddings3 = AzureOpenAIEmbeddings(
        azure_deployment="text-embedding-3-small",
        openai_api_version=api_version,
        azure_endpoint="https://skinpalai-resource.openai.azure.com/",
        api_key=api_key,
    )
    res = embeddings3.embed_query("test")
    print("Test 3 success")
except Exception as e:
    print(f"Test 3 failed: {e}")

# Test LLM
try:
    llm = AzureChatOpenAI(
        azure_deployment="gpt-5.4-mini",  # wait, maybe they meant gpt-4o-mini?
        openai_api_version=api_version,
        azure_endpoint="https://skinpalai-resource.openai.azure.com/",
        api_key=api_key,
        temperature=0.3,
    )
    res = llm.invoke("hello")
    print("Test LLM success")
except Exception as e:
    print(f"Test LLM failed: {e}")
