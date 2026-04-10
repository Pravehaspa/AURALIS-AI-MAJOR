"""
In-memory database/storage for demo purposes
In production, replace with actual database (PostgreSQL, MongoDB, etc.)
"""

from datetime import datetime
from typing import List, Optional
from src.models.models import Agent, Conversation


# In-memory storage
agents_db: List[Agent] = [
    Agent(
        id="1",
        name="Stress-Buster Buddy",
        description="Your empathetic companion for stress relief and mental wellness support",
        category="Wellness",
        voiceId="en-US-terrell",
        isActive=True,
        conversations=127,
        lastUsed="2 hours ago",
        prompt="You are a talkative, empathetic assistant bot. Your main job is to help people reduce stress by chatting with them, giving them calming advice, jokes, or friendly motivation. You talk in a relaxed, human tone, like a good friend who really listens.",
        firstMessage="Hey there 😊 I'm your little stress-buster buddy! What's on your mind today?",
        createdAt="2024-01-01T00:00:00Z",
        updatedAt="2024-01-01T00:00:00Z",
    ),
    Agent(
        id="2",
        name="Creative Artist",
        description="Your inspiring guide for artistic projects and creative inspiration",
        category="Creative",
        voiceId="en-US-natalie",
        isActive=True,
        conversations=89,
        lastUsed="1 day ago",
        prompt="You are an inspiring and knowledgeable artist assistant. You help people with creative projects, art techniques, and provide artistic inspiration. You're passionate about all forms of art and love to encourage creativity.",
        firstMessage="Hello, creative soul! 🎨 I'm here to help spark your artistic journey. What are you working on today?",
        createdAt="2024-01-01T00:00:00Z",
        updatedAt="2024-01-01T00:00:00Z",
    ),
]

conversations_db: List[Conversation] = []


def get_agent(agent_id: str) -> Optional[Agent]:
    """Get agent by ID"""
    return next((a for a in agents_db if a.id == agent_id), None)


def get_all_agents() -> List[Agent]:
    """Get all agents"""
    return agents_db


def create_agent(agent: Agent) -> Agent:
    """Create a new agent"""
    agents_db.append(agent)
    return agent


def update_agent(agent_id: str, updates: dict) -> Optional[Agent]:
    """Update an agent"""
    agent = get_agent(agent_id)
    if not agent:
        return None
    
    agent_dict = agent.model_dump(by_alias=True)
    agent_dict.update(updates)
    agent_dict["updatedAt"] = datetime.now().isoformat()
    
    updated_agent = Agent(**agent_dict)
    index = next(i for i, a in enumerate(agents_db) if a.id == agent_id)
    agents_db[index] = updated_agent
    return updated_agent


def delete_agent(agent_id: str) -> bool:
    """Delete an agent"""
    global agents_db
    agents_db = [a for a in agents_db if a.id != agent_id]
    return True


def get_conversations(agent_id: Optional[str] = None) -> List[Conversation]:
    """Get conversations, optionally filtered by agent_id"""
    if agent_id:
        return [c for c in conversations_db if c.agentId == agent_id]
    return conversations_db


def create_conversation(conversation: Conversation) -> Conversation:
    """Create a new conversation"""
    conversations_db.append(conversation)
    return conversation
