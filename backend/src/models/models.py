"""
Pydantic models matching TypeScript types
"""

from datetime import datetime
from typing import Optional, List, Dict
from pydantic import BaseModel, Field


# Agent Models
class AgentBase(BaseModel):
    name: str
    description: str
    category: str
    voice_id: str = Field(..., alias="voiceId")
    prompt: str
    first_message: str = Field(..., alias="firstMessage")
    template_type: Optional[str] = Field(None, alias="templateType")  # e.g. 'custom' or preset name


class AgentCreate(AgentBase):
    is_active: bool = Field(True, alias="isActive")


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    voice_id: Optional[str] = Field(None, alias="voiceId")
    prompt: Optional[str] = None
    first_message: Optional[str] = Field(None, alias="firstMessage")
    is_active: Optional[bool] = Field(None, alias="isActive")
    template_type: Optional[str] = Field(None, alias="templateType")


class Agent(AgentBase):
    id: str
    is_active: bool = Field(..., alias="isActive")
    conversations: int = 0
    last_used: str = Field(..., alias="lastUsed")
    created_at: str = Field(..., alias="createdAt")
    updated_at: str = Field(..., alias="updatedAt")

    class Config:
        populate_by_name = True
        json_schema_extra = {
            "example": {
                "id": "1",
                "name": "Stress-Buster Buddy",
                "description": "Your empathetic companion",
                "category": "Wellness",
                "voiceId": "en-US-terrell",
                "isActive": True,
                "conversations": 127,
                "lastUsed": "2 hours ago",
                "prompt": "You are a talkative assistant...",
                "firstMessage": "Hey there!",
                "createdAt": "2024-01-01T00:00:00Z",
                "updatedAt": "2024-01-01T00:00:00Z",
            }
        }


# Chat Message Models
class ChatMessage(BaseModel):
    id: str
    text: str
    is_user: bool = Field(..., alias="isUser")
    audio_url: Optional[str] = Field(None, alias="audioUrl")
    timestamp: datetime

    class Config:
        populate_by_name = True


# Conversation Models
class ConversationCreate(BaseModel):
    agent_id: str = Field(..., alias="agentId")
    messages: List[ChatMessage]


class Conversation(BaseModel):
    id: str
    agent_id: str = Field(..., alias="agentId")
    messages: List[ChatMessage]
    started_at: str = Field(..., alias="startedAt")
    ended_at: Optional[str] = Field(None, alias="endedAt")
    message_count: int = Field(..., alias="messageCount")

    class Config:
        populate_by_name = True


class ConversationSummary(BaseModel):
    id: str
    agent_id: str = Field(..., alias="agentId")
    started_at: str = Field(..., alias="startedAt")
    message_count: int = Field(..., alias="messageCount")
    last_message_at: Optional[str] = Field(None, alias="lastMessageAt")

    class Config:
        populate_by_name = True


# AI Services Models
class GenerateResponseRequest(BaseModel):
    message: str
    agent_prompt: Optional[str] = Field(None, alias="agentPrompt")
    model: Optional[str] = None  # Optional: try this Gemini model first (e.g. gemini-2.0-flash)


class GenerateResponseResponse(BaseModel):
    text: str


class TextToSpeechRequest(BaseModel):
    text: str
    voice_id: str = Field(..., alias="voiceId")


class TextToSpeechResponse(BaseModel):
    audio_url: str = Field(..., alias="audioUrl")


# Analytics Models
class DailyStat(BaseModel):
    date: str
    conversations: int
    messages: int
    unique_users: Optional[int] = Field(None, alias="uniqueUsers")

    class Config:
        populate_by_name = True


class Analytics(BaseModel):
    total_conversations: int = Field(..., alias="totalConversations")
    total_messages: int = Field(..., alias="totalMessages")
    average_response_time: float = Field(..., alias="averageResponseTime")
    most_used_agent: str = Field(..., alias="mostUsedAgent")
    voice_usage: Dict[str, int] = Field(..., alias="voiceUsage")
    daily_stats: List[DailyStat] = Field(..., alias="dailyStats")

    class Config:
        populate_by_name = True


class AnalyticsUpdate(BaseModel):
    conversation_id: Optional[str] = Field(None, alias="conversationId")
    agent_id: Optional[str] = Field(None, alias="agentId")
    message_count: Optional[int] = Field(None, alias="messageCount")
    duration: Optional[float] = None


# Voice Models
class Voice(BaseModel):
    id: str
    name: str
    style: str
    accent: str
    gender: str
    language: str


# API Response Models
class ApiResponse(BaseModel):
    success: bool
    data: Optional[Dict] = None
    error: Optional[str] = None


# Health Check Models
class ServiceStatus(BaseModel):
    open_router: str = Field(..., alias="openRouter")
    murf_ai: str = Field(..., alias="murfAI")
    database: str

    class Config:
        populate_by_name = True


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str = "1.0.0"
    services: ServiceStatus
    uptime: Optional[float] = None
    memory: Optional[Dict] = None
