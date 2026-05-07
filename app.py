import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import main as core

app = FastAPI(title="Chat with PDF API")

# Global state for the vector store
# In a real production app, you would use a persistent database or session-based storage
vector_db = None

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

class ChatRequest(BaseModel):
    message: str

@app.get("/")
async def read_landing():
    return FileResponse('static/landing.html')

@app.get("/app")
async def read_app():
    return FileResponse('static/index.html')

from fastapi import FastAPI, UploadFile, File, HTTPException, Header

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    global vector_db
        
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    file_path = os.path.join(core.PDFS_DIRECTORY, file.filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Process the PDF and update the global vector store
        vector_db = core.process_pdf(file_path)
        
        return {"filename": file.filename, "status": "success", "message": "PDF processed and indexed."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(request: ChatRequest):
    global vector_db        
    if vector_db is None:
        raise HTTPException(status_code=400, detail="Please upload a PDF first.")
    
    try:
        answer = core.ask_question(request.message, vector_db)
        return {"answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
