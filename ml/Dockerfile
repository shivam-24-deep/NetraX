# NetraX ML inference API (Render, or any Docker host).
# Build context is this folder:  docker build -f ml/Dockerfile ml
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN useradd -m -u 1000 user
WORKDIR /app

COPY --chown=user requirements-serve.txt .
RUN pip install -r requirements-serve.txt

COPY --chown=user api ./api
COPY --chown=user src ./src
COPY --chown=user models ./models

USER user

# Render provides PORT (10000); fall back to 7860 elsewhere.
EXPOSE 10000
CMD ["sh", "-c", "uvicorn api.server:app --host 0.0.0.0 --port ${PORT:-7860}"]
