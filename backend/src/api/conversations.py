"""
Conversation Management Endpoints
"""

from datetime import datetime
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from src.models.models import Conversation, ConversationCreate, ConversationSummary
from src.storage.database import get_conversations, create_conversation

router = APIRouter()


@router.get("", response_model=dict)
async def get_conversations_list(agent_id: Optional[str] = Query(None, alias="agentId")):
    """Get conversations, optionally filtered by agent_id"""
    try:
        conversations = get_conversations(agent_id)
        
        # Return conversation summaries (without full messages for performance)
        summaries = [
            ConversationSummary(
                id=conv.id,
                agentId=conv.agentId,
                startedAt=conv.startedAt,
                messageCount=conv.messageCount,
                lastMessageAt=(
                    conv.messages[-1].timestamp.isoformat() 
                    if conv.messages and conv.messages[-1].timestamp 
                    else conv.startedAt
                ),
            )
            for conv in conversations
        ]
        
        return {
            "success": True,
            "data": [summary.model_dump(by_alias=True) for summary in summaries]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch conversations"
        )


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_new_conversation(conversation_data: ConversationCreate):
    """Create a new conversation"""
    try:
        if not conversation_data.agent_id or not conversation_data.messages:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required fields"
            )

        # Create conversation
        new_conversation = Conversation(
            id=str(int(datetime.now().timestamp() * 1000)),
            agentId=conversation_data.agent_id,
            messages=conversation_data.messages,
            startedAt=datetime.now().isoformat(),
            messageCount=len(conversation_data.messages),
        )

        created_conversation = create_conversation(new_conversation)
        return {
            "success": True,
            "data": {"id": created_conversation.id}
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create conversation"
        )
