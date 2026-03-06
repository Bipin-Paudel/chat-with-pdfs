# Chat with PDFs

Interactively chat with your PDF documents using advanced language models and vector search! This project leverages Streamlit for the UI, LangChain for document processing, and Ollama for LLM and embeddings.

## Features

- Upload a PDF and ask questions about its content.
- Uses chunked document retrieval and semantic search for accurate answers.
- Powered by local LLMs (Ollama) and FAISS vector store for fast similarity search.

## Demo

![Demo Screenshot](demo_screenshot.png)  
_Upload a PDF and start chatting!_

## Getting Started

### Prerequisites

- Python 3.8+
- Ollama (for local LLM and embeddings)
- Streamlit

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/chat-with-pdf.git
   cd chat-with-pdf
   ```

2. (Recommended) Create and activate a virtual environment:

   ```bash
   python -m venv venv
   source venv/bin/activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Make sure Ollama is running and the required model (`deepseek-r1:7b`) is available.

### Usage

1. Start the Streamlit app:

   ```bash
   streamlit run streamlit.py
   ```

2. Open the provided local URL in your browser.

3. Upload a PDF and start chatting!

## Project Structure

- `main.py` — Core logic for PDF loading, chunking, vector store, and LLM interaction.
- `streamlit.py` — Streamlit UI for file upload and chat interface.
- `requirements.txt` — Python dependencies.
- `pdfs/` — Directory for uploaded PDFs.

## How it Works

- **PDF Upload:** User uploads a PDF via the web interface.
- **Chunking & Embedding:** The PDF is split into chunks and embedded using Ollama.
- **Vector Search:** FAISS is used to find the most relevant chunks for a user’s question.
- **LLM Response:** The context is sent to a local LLM (Ollama) to generate a concise answer.

## Dependencies

- streamlit
- langchain
- langchain_core
- langchain_community
- langchain_ollama
- pypdf
- faiss-cpu

## Acknowledgements

- [LangChain](https://github.com/langchain-ai/langchain)
- [Ollama](https://ollama.com/)
- [Streamlit](https://streamlit.io/)

## License

MIT License
