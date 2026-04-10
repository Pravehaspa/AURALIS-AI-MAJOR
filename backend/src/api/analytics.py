"""
Analytics Endpoints
"""

from fastapi import APIRouter, HTTPException, status
from src.models.models import Analytics, AnalyticsUpdate
from src.storage.database import get_all_agents, get_conversations

router = APIRouter()

# Mock analytics data (in production, calculate from database)
mock_analytics = Analytics(
    totalConversations=456,
    totalMessages=2847,
    averageResponseTime=0.8,
    mostUsedAgent="Stress-Buster Buddy",
    voiceUsage={
        "en-US-terrell": 234,
        "en-US-natalie": 156,
        "en-US-ken": 45,
        "en-US-julia": 21,
    },
    dailyStats=[
        {"date": "2024-01-01", "conversations": 12, "messages": 89},
        {"date": "2024-01-02", "conversations": 18, "messages": 134},
        {"date": "2024-01-03", "conversations": 15, "messages": 112},
        {"date": "2024-01-04", "conversations": 22, "messages": 167},
        {"date": "2024-01-05", "conversations": 19, "messages": 145},
        {"date": "2024-01-06", "conversations": 25, "messages": 189},
        {"date": "2024-01-07", "conversations": 28, "messages": 203},
    ],
)


@router.get("", response_model=dict)
async def get_analytics():
    """Get analytics data"""
    try:
        # In production, calculate from actual database
        # For now, return mock data
        import asyncio
        await asyncio.sleep(0.5)  # Simulate API delay
        
        return {
            "success": True,
            "data": mock_analytics.model_dump(by_alias=True)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch analytics"
        )


@router.post("", response_model=dict)
async def update_analytics(analytics_update: AnalyticsUpdate):
    """Update analytics (track conversation, message, etc.)"""
    try:
        # In a real application, this would update analytics in a database
        update_data = analytics_update.model_dump(by_alias=True, exclude_none=True)
        print(f"Analytics update: {update_data}")
        
        return {"success": True, "message": "Analytics updated"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update analytics"
        )
