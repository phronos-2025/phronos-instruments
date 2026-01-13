"""
INS-001 Semantic Associations - API Server

Entry point for the FastAPI application.
"""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
import sys

# Import routes
from app.routes import games, embeddings, users, share


# ============================================
# INITIALIZATION
# ============================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    print("Starting INS-001 API...")
    
    # Initialize Sentry if configured
    sentry_dsn = os.environ.get("SENTRY_DSN")
    if sentry_dsn:
        sentry_sdk.init(
            dsn=sentry_dsn,
            integrations=[FastApiIntegration()],
            traces_sample_rate=0.1,
        )
        print("Sentry initialized")
    
    yield
    
    # Shutdown
    print("Shutting down INS-001 API...")


# ============================================
# APP
# ============================================

app = FastAPI(
    title="INS-001 Semantic Associations",
    description="Cognitive assessment instrument measuring semantic creativity and communicability",
    version="2.5.0",
    lifespan=lifespan,
)

# CORS - adjust origins for production
from app.config import FRONTEND_URL, APP_ENV

# Build CORS origins list
cors_origins = [
    "http://localhost:3000",  # Local dev
    "http://localhost:4321",  # Astro dev
    "https://instruments.phronos.org",  # Production frontend (custom domain)
]

# Add frontend URL from env if set
if FRONTEND_URL and FRONTEND_URL not in cors_origins:
    cors_origins.append(FRONTEND_URL)

# Debug middleware to log incoming requests
class DebugMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        auth_header = request.headers.get("Authorization")
        print(f"[DEBUG] Incoming request | path={request.url.path} | method={request.method} | hasAuthHeader={bool(auth_header)} | authPrefix={auth_header[:30] if auth_header else None} | hypothesisId=I", file=sys.stderr, flush=True)
        response = await call_next(request)
        print(f"[DEBUG] Response | path={request.url.path} | status={response.status_code} | hypothesisId=I", file=sys.stderr, flush=True)
        return response

app.add_middleware(DebugMiddleware)

# For MVP: Allow all origins to avoid CORS issues
# TODO: Restrict to specific domains in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for MVP - restrict later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# ROUTES
# ============================================

# Mount route modules
app.include_router(games.router, prefix="/api/v1/games", tags=["games"])
app.include_router(embeddings.router, prefix="/api/v1/embeddings", tags=["embeddings"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(share.router, prefix="/api/v1", tags=["share"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "2.5.0"}


@app.get("/")
async def root():
    """Root endpoint with API info."""
    return {
        "name": "INS-001 Semantic Associations API",
        "version": "2.5.0",
        "docs": "/docs",
    }


# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
        reload=os.environ.get("APP_ENV") == "development",
    )
