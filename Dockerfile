FROM python:3.11-slim

ENV PYTHONUNBUFFERED=True
ENV APP_HOME=/app
ENV HF_HOME=/tmp/hf_cache
ENV TRANSFORMERS_CACHE=/tmp/hf_cache
ENV SENTENCE_TRANSFORMERS_HOME=/tmp/sentence_transformers

WORKDIR $APP_HOME
COPY . ./

# System dependencies (libgomp1 required by faiss-cpu)
RUN apt-get update && apt-get install -y \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch first (much smaller image, no CUDA)
RUN pip install --no-cache-dir torch==2.2.1 \
    --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download embedding model at build time (avoids cold-start timeout on Cloud Run)
RUN python -c "\
from sentence_transformers import SentenceTransformer; \
import os; \
os.makedirs('/tmp/hf_cache', exist_ok=True); \
SentenceTransformer('all-MiniLM-L6-v2', cache_folder='/tmp/hf_cache'); \
print('Model pre-downloaded successfully')"

# Create pdfs directory
RUN mkdir -p /app/pdfs

CMD exec uvicorn app:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1
