import os
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings, ChatOpenAI

load_dotenv()

api_key = os.getenv("AZURE_OPENAI_API_KEY")
base_url = os.getenv("AZURE_OPENAI_BASE_URL", "https://your-resource.openai.azure.com/openai/v1/")

try:
    embeddings = OpenAIEmbeddings(
        model="text-embedding-ada-002",
        openai_api_base=base_url,
        openai_api_key=api_key
    )
    res = embeddings.embed_query("test")
    print("Test Embed success")
except Exception as e:
    print(f"Test Embed failed: {e}")

try:
    llm = ChatOpenAI(
        model="gpt-5.4-mini",
        openai_api_base=base_url,
        openai_api_key=api_key,
        temperature=0.3
    )
    res = llm.invoke("hello")
    print("Test LLM success")
except Exception as e:
    print(f"Test LLM failed: {e}")
