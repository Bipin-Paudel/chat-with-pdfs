import os
import uuid
import shutil
from datetime import datetime, timezone
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import main as core

app = FastAPI(title="ChatDoc AI API", version="2.0.0")

# CORS — allow all for dev/prod
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# ── In-memory state ─────────────────────────────────────────────────────────
# { doc_id: {"db": FAISS, "filename": str, "pages": int, "uploaded_at": str, "file_path": str} }
documents_store: dict = {}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB

# ── Models ───────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    doc_id: Optional[str] = None


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
async def read_landing():
    return FileResponse("static/landing.html")


@app.get("/app")
async def read_app():
    return FileResponse("static/index.html")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4"),
        "documents_loaded": len(documents_store),
    }


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    """Upload and index a PDF document."""
    # Validate extension
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    # Read and validate size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 20MB.")

    # Generate unique doc ID and save file
    doc_id = str(uuid.uuid4())
    safe_name = f"{doc_id}_{file.filename}"
    file_path = os.path.join(core.PDFS_DIRECTORY, safe_name)

    with open(file_path, "wb") as f:
        f.write(contents)

    # Process PDF → FAISS vector store
    try:
        db, page_count = core.process_pdf(file_path)
    except Exception as e:
        # Clean up file on failure
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")

    # Store in memory
    documents_store[doc_id] = {
        "db": db,
        "filename": file.filename,
        "pages": page_count,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "file_path": file_path,
    }

    return {
        "doc_id": doc_id,
        "filename": file.filename,
        "pages": page_count,
        "status": "success",
        "message": f"Successfully indexed {page_count} pages.",
    }


@app.post("/chat")
async def chat(request: ChatRequest):
    """Ask a question about one or all uploaded documents."""
    if not documents_store:
        raise HTTPException(status_code=400, detail="Please upload a PDF document first.")

    # Determine which DB(s) to query
    if request.doc_id:
        if request.doc_id not in documents_store:
            raise HTTPException(status_code=404, detail="Document not found. It may have been deleted.")
        dbs = [documents_store[request.doc_id]["db"]]
    else:
        # Query across all documents
        dbs = [doc["db"] for doc in documents_store.values()]

    try:
        result = core.ask_question(request.message, dbs, k=4)
        return {"answer": result["answer"], "sources": result["sources"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat error: {str(e)}")


@app.get("/documents")
async def list_documents():
    """Return list of all uploaded documents."""
    return [
        {
            "doc_id": doc_id,
            "filename": meta["filename"],
            "pages": meta["pages"],
            "uploaded_at": meta["uploaded_at"],
        }
        for doc_id, meta in documents_store.items()
    ]


@app.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a document from memory and disk."""
    if doc_id not in documents_store:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Remove file from disk
    file_path = documents_store[doc_id].get("file_path", "")
    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    # Remove from memory
    del documents_store[doc_id]

    return {"status": "deleted", "doc_id": doc_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8080)))
