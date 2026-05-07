import main as core
import os

print("Testing core.process_pdf with local HuggingFace embeddings...")
# Create a dummy pdf
with open("test.pdf", "wb") as f:
    f.write(b"%PDF-1.4\n%EOF\n")

db = core.process_pdf("test.pdf")
if db:
    print("Process PDF successful. Testing core.ask_question with Azure OpenAI...")
    try:
        answer = core.ask_question("Hello", db)
        print(f"Answer: {answer}")
        print("Success! Everything works perfectly.")
    except Exception as e:
        print(f"Chat failed: {e}")
else:
    print("Failed to process PDF.")
