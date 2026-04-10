"""
FastAPI Backend for Auralis AI
Main application entry point
"""

# Load environment variables FIRST, before importing routers
# Load from project root (parent of backend/) so one .env works for both Next.js and FastAPI
from pathlib import Path
from dotenv import load_dotenv

_root = Path(__file__).resolve().parent.parent.parent
load_dotenv(_root / ".env")
load_dotenv(_root / ".env.local")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from src.api import (
    agents,
    ai_services,
    analytics,
    conversations,
    voices,
    health,
)

app = FastAPI(
    title="Auralis AI API",
    description="Backend API for Auralis AI - Voice AI Platform",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(agents.router, prefix="/api/agents", tags=["Agents"])
app.include_router(ai_services.router, prefix="/api", tags=["AI Services"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(conversations.router, prefix="/api/conversations", tags=["Conversations"])
app.include_router(voices.router, prefix="/api/voices", tags=["Voices"])
app.include_router(health.router, prefix="/api/health", tags=["System"])


@app.get("/")
async def root():
    return {
        "message": "Auralis AI API",
        "version": "1.0.0",
        "docs": "/docs",
    }
