# GUARD Platform — Multi-stage Docker build
# Single container: FastAPI serves both API and built frontend on port 8000

# Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /build
COPY guard-ui/package*.json ./
RUN npm ci
COPY guard-ui/ ./
RUN npm run build

# Stage 2: Runtime
FROM python:3.11-slim AS runtime
WORKDIR /app

# System deps for BioPython, matplotlib, ViennaRNA
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libffi-dev && \
    rm -rf /var/lib/apt/lists/*

# Python deps
COPY pyproject.toml README.md ./
COPY guard/ ./guard/
RUN pip install --no-cache-dir -e ".[all]"

# API code
COPY api/ ./api/
COPY configs/ ./configs/
COPY data/ ./data/

# Frontend build output
COPY --from=frontend /build/dist ./guard-ui/dist

# Results directory
RUN mkdir -p results/api results/panels results/validation

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')"

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
