"""
System Health Check Endpoint
"""

import os
from datetime import datetime
try:
    import psutil
except ImportError:
    psutil = None
from fastapi import APIRouter, HTTPException, status
from src.models.models import HealthResponse, ServiceStatus

router = APIRouter()


@router.get("", response_model=dict)
async def health_check():
    """Health check endpoint"""
    try:
        # Check API keys
        openrouter_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
        murf_ai_key = os.getenv("MURF_API_KEY", "")
        
        openrouter_status = "operational" if openrouter_key and openrouter_key != "your_openrouter_api_key_here" else "not_configured"
        murf_ai_status = "operational" if murf_ai_key and murf_ai_key != "your_murf_api_key_here" else "not_configured"
        
        health_data = HealthResponse(
            status="healthy",
            timestamp=datetime.now().isoformat(),
            version="1.0.0",
            services=ServiceStatus(
                openRouter=openrouter_status,
                murfAI=murf_ai_status,
                database="operational",
            ),
            uptime=psutil.Process().create_time() if psutil else None,  # Process creation time (for uptime, calculate: time.time() - create_time())
            memory={
                "rss": psutil.Process().memory_info().rss if psutil else None,
                "vms": psutil.Process().memory_info().vms if psutil else None,
            } if psutil else None,
        )

        return {
            "success": True,
            "data": health_data.model_dump(by_alias=True)
        }
    except Exception as e:
        return {
            "success": False,
            "error": "Health check failed",
            "status": "unhealthy",
            "timestamp": datetime.now().isoformat(),
        }
