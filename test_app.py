import os
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

# Create a dummy PDF file for testing
with open("test.pdf", "wb") as f:
    f.write(b"%PDF-1.4\n%EOF\n")

print("Testing /upload...")
with open("test.pdf", "rb") as f:
    response = client.post("/upload", files={"file": ("test.pdf", f, "application/pdf")})

print(f"Upload status: {response.status_code}")
print(f"Upload response: {response.json()}")

if response.status_code == 200:
    print("Testing /chat...")
    chat_response = client.post("/chat", json={"message": "What is this document about?"})
    print(f"Chat status: {chat_response.status_code}")
    print(f"Chat response: {chat_response.json()}")
