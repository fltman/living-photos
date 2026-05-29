"""POST /chat — streaming text conversation with the identified persona,
via Claude (OpenRouter). Streams plain-text deltas back to the client."""
import json
import os
from typing import Literal

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    persona_system_prompt: str
    messages: list[Message]


async def _stream(payload: dict, api_key: str):
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST",
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "Living Photos",
            },
            json=payload,
        ) as resp:
            if resp.status_code != 200:
                body = await resp.aread()
                raise HTTPException(resp.status_code, f"OpenRouter error: {body[:300]!r}")
            async for line in resp.aiter_lines():
                if not line.startswith("data: "):
                    continue
                data = line[6:]
                if data == "[DONE]":
                    break
                try:
                    delta = json.loads(data)["choices"][0]["delta"].get("content")
                except (json.JSONDecodeError, KeyError, IndexError):
                    continue
                if delta:
                    yield delta


@router.post("/chat")
async def chat(req: ChatRequest):
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(500, "OPENROUTER_API_KEY not set")
    model = os.getenv("OPENROUTER_MODEL", "anthropic/claude-opus-4.1")

    payload = {
        "model": model,
        "stream": True,
        "messages": [
            {"role": "system", "content": req.persona_system_prompt},
            *[m.model_dump() for m in req.messages],
        ],
    }
    return StreamingResponse(_stream(payload, api_key), media_type="text/plain")
