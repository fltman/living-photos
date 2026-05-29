"""GET /voice/signed-url — mint a short-lived signed WebSocket URL for the
ElevenLabs Conversational AI agent. Keeps the API key off the client; the
persona is injected client-side via conversation overrides."""
import os

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()

SIGNED_URL_ENDPOINT = "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url"


@router.get("/voice/signed-url")
async def signed_url():
    api_key = os.getenv("ELEVENLABS_API_KEY")
    agent_id = os.getenv("ELEVENLABS_AGENT_ID")
    if not api_key or not agent_id:
        raise HTTPException(500, "ELEVENLABS_API_KEY / ELEVENLABS_AGENT_ID not set")

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            SIGNED_URL_ENDPOINT,
            params={"agent_id": agent_id},
            headers={"xi-api-key": api_key},
        )
    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"ElevenLabs error: {resp.text[:300]}")

    return {"signed_url": resp.json()["signed_url"]}
