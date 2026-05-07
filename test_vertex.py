import os
import vertexai
from vertexai.generative_models import GenerativeModel

vertexai.init(project="cloud-run-trial-9626", location="us-central1")
model = GenerativeModel("gemini-1.5-flash-001")
try:
    response = model.generate_content("Hello")
    print("SUCCESS:", response.text)
except Exception as e:
    print("FAILED:", str(e))
