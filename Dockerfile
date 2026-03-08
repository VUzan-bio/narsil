# GUARD Platform — Slim Docker build for Railway (4GB image limit)
# Single container: FastAPI serves both API and built frontend

# Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /build
COPY guard-ui/package*.json ./
RUN npm ci
COPY guard-ui/ ./
RUN npm run build

# Stage 2: Build Python packages that need compilers
FROM python:3.11-slim AS builder
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libffi-dev && \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY guard/ ./guard/
RUN pip install --no-cache-dir -e ".[primers,api,viz,disc]"

# Stage 3: Lean runtime (no compilers)
FROM python:3.11-slim
WORKDIR /app

# Only bowtie2 at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    bowtie2 && \
    rm -rf /var/lib/apt/lists/*

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Application code
COPY pyproject.toml README.md ./
COPY guard/ ./guard/
COPY api/ ./api/
COPY configs/ ./configs/
COPY data/ ./data/

# Discrimination model checkpoint + supporting modules
COPY guard-net/checkpoints/disc_xgb.pkl ./guard-net/checkpoints/disc_xgb.pkl
COPY guard-net/checkpoints/disc_cv_results.json ./guard-net/checkpoints/disc_cv_results.json
COPY guard-net/models/ ./guard-net/models/
COPY guard-net/features/ ./guard-net/features/
COPY guard-net/data/thermo_discrimination_features.py ./guard-net/data/thermo_discrimination_features.py
COPY guard-net/data/__init__.py ./guard-net/data/__init__.py

# Editable install (egg-link only, no downloads)
RUN pip install --no-cache-dir --no-deps -e .

# Build Bowtie2 index
RUN bowtie2-build data/references/H37Rv.fasta data/references/H37Rv

# Frontend
COPY --from=frontend /build/dist ./guard-ui/dist

RUN mkdir -p results/api results/panels results/validation

# Railway sets $PORT dynamically via env var
ENV PORT=8000
EXPOSE 8000
CMD sh -c "uvicorn api.main:app --host 0.0.0.0 --port $PORT"
