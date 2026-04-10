"""
Voice Management Endpoints
"""

from typing import Optional
from fastapi import APIRouter, HTTPException, Query, status
from src.models.models import Voice

router = APIRouter()

# Available voices
voice_options = [
    Voice(id="en-US-terrell", name="Terrell", style="Conversational", accent="American", gender="Male", language="en-US"),
    Voice(id="en-US-natalie", name="Natalie", style="Inspirational", accent="American", gender="Female", language="en-US"),
    Voice(id="en-US-ken", name="Ken", style="Energetic", accent="American", gender="Male", language="en-US"),
    Voice(id="en-US-julia", name="Julia", style="Warm", accent="American", gender="Female", language="en-US"),
    Voice(id="en-US-miles", name="Miles", style="Professional", accent="American", gender="Male", language="en-US"),
    Voice(id="en-GB-oliver", name="Oliver", style="Sophisticated", accent="British", gender="Male", language="en-GB"),
    Voice(id="en-AU-sarah", name="Sarah", style="Friendly", accent="Australian", gender="Female", language="en-AU"),
    Voice(id="es-MX-valeria", name="Valeria", style="Expressive", accent="Mexican", gender="Female", language="es-MX"),
    Voice(id="fr-FR-pierre", name="Pierre", style="Elegant", accent="French", gender="Male", language="fr-FR"),
    Voice(id="de-DE-anna", name="Anna", style="Clear", accent="German", gender="Female", language="de-DE"),
    Voice(id="it-IT-marco", name="Marco", style="Passionate", accent="Italian", gender="Male", language="it-IT"),
    Voice(id="pt-BR-carla", name="Carla", style="Warm", accent="Brazilian", gender="Female", language="pt-BR"),
]


@router.get("", response_model=dict)
async def get_voices(
    language: Optional[str] = Query(None),
    gender: Optional[str] = Query(None),
    style: Optional[str] = Query(None),
):
    """Get available voices with optional filtering"""
    try:
        filtered_voices = voice_options

        if language:
            filtered_voices = [v for v in filtered_voices if v.language == language]

        if gender:
            filtered_voices = [v for v in filtered_voices if v.gender == gender]

        if style:
            filtered_voices = [
                v for v in filtered_voices 
                if style.lower() in v.style.lower()
            ]

        return {
            "success": True,
            "data": [voice.model_dump() for voice in filtered_voices]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch voices"
        )
