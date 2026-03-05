"""GUARD Platform — FastAPI application factory.

Single entry point: uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import json
import logging
import math
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from api.state import AppState


class SafeJSONResponse(JSONResponse):
    """JSONResponse that converts inf/nan to null instead of crashing."""

    def _sanitize(self, obj: Any) -> Any:
        if isinstance(obj, float) and (math.isinf(obj) or math.isnan(obj)):
            return None
        if isinstance(obj, dict):
            return {k: self._sanitize(v) for k, v in obj.items()}
        if isinstance(obj, (list, tuple)):
            return [self._sanitize(v) for v in obj]
        return obj

    def render(self, content: Any) -> bytes:
        return json.dumps(
            self._sanitize(content),
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)-30s %(levelname)-8s %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Global state — initialized in lifespan
_state: AppState | None = None


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Initialize AppState on startup, clean up on shutdown."""
    global _state

    _state = AppState(results_dir="results/api")
    logger.info("GUARD Platform starting — results at %s", _state.results_dir)

    # Wire state into route modules
    from api.routes import figures, pipeline, results
    from api import ws

    pipeline.init(_state)
    results.init(_state)
    figures.init(_state)
    ws.init(_state)

    yield

    _state.shutdown()
    logger.info("GUARD Platform shutdown complete")


app = FastAPI(
    title="GUARD Platform",
    description="Guide RNA Automated Resistance Diagnostics — CRISPR-Cas12a diagnostic panel design",
    version="0.2.0",
    lifespan=lifespan,
    default_response_class=SafeJSONResponse,
)

# CORS for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
from api.routes import figures, panels, pipeline, results, scoring, validation
from api import ws

app.include_router(pipeline.router)
app.include_router(results.router)
app.include_router(panels.router)
app.include_router(figures.router)
app.include_router(scoring.router)
app.include_router(validation.router)
app.include_router(ws.router)

@app.get("/api/health")
async def health() -> dict:
    return {
        "status": "ok",
        "version": "0.2.0",
        "pipeline": "GUARD",
    }


# Serve frontend static files if built.
STATIC_DIR = Path("guard-ui/dist")
if STATIC_DIR.exists():
    from starlette.requests import Request
    from starlette.responses import FileResponse, Response

    @app.middleware("http")
    async def spa_middleware(request: Request, call_next: object) -> Response:
        """Serve API routes normally; fall back to static/SPA for everything else."""
        if request.url.path.startswith("/api") or request.url.path.startswith("/ws"):
            return await call_next(request)  # type: ignore[operator]

        # Try to serve the exact static file
        file_path = STATIC_DIR / request.url.path.lstrip("/")
        if file_path.is_file():
            return FileResponse(str(file_path))

        # SPA fallback — serve index.html for all other routes
        return FileResponse(str(STATIC_DIR / "index.html"))
