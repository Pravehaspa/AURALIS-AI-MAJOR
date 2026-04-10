"""
Agent Management Endpoints
"""

from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException, status
from src.models.models import Agent, AgentCreate, AgentUpdate
from src.storage.database import (
    get_all_agents,
    get_agent,
    create_agent,
    update_agent,
    delete_agent,
)

router = APIRouter()


@router.get("", response_model=dict)
async def get_agents():
    """Get all agents"""
    try:
        agents = get_all_agents()
        return {"success": True, "data": [agent.model_dump(by_alias=True) for agent in agents]}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch agents"
        )


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_new_agent(agent_data: AgentCreate):
    """Create a new agent"""
    try:
        # Validate required fields
        if not all([
            agent_data.name,
            agent_data.description,
            agent_data.category,
            agent_data.voice_id,
            agent_data.prompt,
            agent_data.first_message,
        ]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required fields"
            )

        # Create new agent
        new_agent = Agent(
            id=str(int(datetime.now().timestamp() * 1000)),
            name=agent_data.name,
            description=agent_data.description,
            category=agent_data.category,
            voiceId=agent_data.voice_id,
            isActive=agent_data.is_active,
            conversations=0,
            lastUsed="Never",
            prompt=agent_data.prompt,
            firstMessage=agent_data.first_message,
            templateType=agent_data.template_type,
            createdAt=datetime.now().isoformat(),
            updatedAt=datetime.now().isoformat(),
        )

        created_agent = create_agent(new_agent)
        return {"success": True, "data": created_agent.model_dump(by_alias=True)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create agent"
        )


@router.get("/{agent_id}", response_model=dict)
async def get_agent_by_id(agent_id: str):
    """Get a specific agent by ID"""
    try:
        agent = get_agent(agent_id)
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found"
            )
        return {"success": True, "data": agent.model_dump(by_alias=True)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch agent"
        )


@router.put("/{agent_id}", response_model=dict)
async def update_agent_by_id(agent_id: str, agent_updates: AgentUpdate):
    """Update an agent"""
    try:
        # Convert updates to dict, excluding None values
        updates = agent_updates.model_dump(by_alias=True, exclude_none=True)
        
        updated_agent = update_agent(agent_id, updates)
        if not updated_agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found"
            )
        return {"success": True, "data": updated_agent.model_dump(by_alias=True)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update agent"
        )


@router.delete("/{agent_id}", response_model=dict)
async def delete_agent_by_id(agent_id: str):
    """Delete an agent"""
    try:
        agent = get_agent(agent_id)
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Agent not found"
            )
        
        delete_agent(agent_id)
        return {"success": True, "message": "Agent deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete agent"
        )
