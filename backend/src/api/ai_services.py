"""
AI Services Endpoints - OpenRouter (LLM) and Murf AI (TTS) Integration
"""

import os
import httpx
from fastapi import APIRouter, HTTPException, status
from src.models.models import GenerateResponseRequest, TextToSpeechRequest

router = APIRouter()

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# OpenRouter model IDs (provider/model). Try in order; first success wins.
OPENROUTER_MODELS = [
    "google/gemini-2.0-flash",
    "google/gemini-2.0-flash-001",
    "google/gemini-1.5-flash",
    "google/gemini-1.5-pro",
    "google/gemini-pro",
    "google/gemini-2.5-flash-preview-05-20",
    "google/gemini-2.5-pro-preview-05-06",
]


@router.post("/generate-response", response_model=dict)
async def generate_ai_response(request: GenerateResponseRequest):
    """Generate AI response using OpenRouter (supports Gemini and other models)."""
    try:
        api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
        if not api_key or api_key == "your_openrouter_api_key_here":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="OpenRouter API key is not configured. Set OPENROUTER_API_KEY in your environment. Get a key at https://openrouter.ai/keys",
            )

        system_content = (
            request.agent_prompt
            or "You are a friendly and talkative AI assistant. "
            "Respond to the user's message in a conversational and engaging way. "
            "Keep your responses informative but not too long (2-3 sentences max)."
        )
        user_content = request.message

        requested = (request.model or "").strip()
        model_ids = (
            [requested] + [m for m in OPENROUTER_MODELS if m != requested]
            if requested
            else list(OPENROUTER_MODELS)
        )

        last_error = None
        async with httpx.AsyncClient(timeout=60.0) as client:
            for model_id in model_ids:
                try:
                    response = await client.post(
                        OPENROUTER_URL,
                        headers={
                            "Content-Type": "application/json",
                            "Authorization": f"Bearer {api_key}",
                        },
                        json={
                            "model": model_id,
                            "messages": [
                                {"role": "system", "content": system_content},
                                {"role": "user", "content": user_content},
                            ],
                            "max_tokens": 512,
                        },
                    )
                    data = response.json()

                    if not response.is_success:
                        err_msg = data.get("error", {}).get("message") or data.get("message") or response.text
                        raise Exception(err_msg)

                    text = (
                        (data.get("choices") or [{}])[0]
                        .get("message", {})
                        .get("content", "")
                        .strip()
                    ) or ((data.get("choices") or [{}])[0].get("text", "") or "").strip()
                    if text:
                        return {"success": True, "text": text}
                    raise Exception("Empty response from model")
                except Exception as e:
                    last_error = e
                    continue

        err_str = str(last_error) if last_error else "Unknown error"
        error_message = "Failed to generate response"
        if "API key" in err_str or "401" in err_str or ("invalid" in err_str.lower() and "key" in err_str.lower()):
            error_message = "Invalid OpenRouter API key. Get a key at https://openrouter.ai/keys"
        elif "quota" in err_str.lower() or "429" in err_str:
            error_message = "API quota exceeded. Please try again later."
        elif "model" in err_str.lower() or "404" in err_str or "not found" in err_str.lower():
            error_message = f"No model responded. Tried: {', '.join(model_ids)}. {err_str[:200]}"
        else:
            error_message = err_str[:300]

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_message,
        )
    except HTTPException:
        raise
    except Exception as e:
        err_str = str(e)
        error_message = "Failed to generate response"
        if "API key" in err_str:
            error_message = "Invalid OpenRouter API key."
        elif "quota" in err_str.lower():
            error_message = "API quota exceeded. Please try again later."
        elif "model" in err_str.lower():
            error_message = "Model not available. Try a different model."
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_message,
        )


@router.post("/text-to-speech", response_model=dict)
async def convert_text_to_speech(request: TextToSpeechRequest):
    """Convert text to speech using Murf AI"""
    try:
        if not request.text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text is required"
            )

        api_key = os.getenv("MURF_API_KEY")
        if not api_key or api_key == "your_murf_api_key_here":
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Murf API key is not configured. Please set MURF_API_KEY in your environment variables."
            )

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.murf.ai/v1/speech/generate",
                json={
                    "text": request.text,
                    "voiceId": request.voice_id or "en-US-terrell",
                },
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "api-key": api_key,
                },
                timeout=30.0,
            )

            if response.status_code != 200:
                error_detail = response.json().get("message", "Murf API error")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Murf API error: {error_detail}"
                )

            data = response.json()
            if not data.get("audioFile"):
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Invalid response from Murf API"
                )

            return {"success": True, "audioUrl": data["audioFile"]}
    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Request to Murf API timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to convert text to speech: {str(e)}"
        )
