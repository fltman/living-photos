"""POST /identify — send the full marked image + a close crop to Claude Opus
(via OpenRouter, vision) and get back who the marked person is plus a ready-to-use
persona prompt for chat/voice."""
import json
import os
import re

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

SYSTEM_PROMPT = """Du är en konstkännare och historiker. Du får TVÅ bilder:
1. Hela fotografiet/målningen med en GUL markeringsruta runt en specifik person.
2. En croppad närbild av samma markerade person.

Identifiera scenen och den markerade personen så gott det går. Svara ENDAST med ett
JSON-objekt (ingen markdown, ingen text runt om) med exakt dessa fält:

{
  "scene": "Kort beskrivning av bilden/situationen och var/när den togs.",
  "person_name": "Den markerade personens namn, eller en beskrivande roll om okänd.",
  "confidence": 0.0-1.0,
  "persona_system_prompt": "En system-prompt skriven i andra person ('Du ÄR ...') som låter en röst-/chattagent spela personen trovärdigt, i jag-form, med rätt epok, tonfall och kunskapshorisont. Personen ska INTE veta om saker som hänt efter bildens tid.",
  "first_message": "En kort öppningsreplik som personen säger när samtalet börjar, in character.",
  "suggested_voice": "en av: male_old, male_adult, male_young, female_old, female_adult, female_young",
  "language": "sv eller en (vad personen rimligen talar i samtalet)"
}

Om du är osäker på vem personen är: sätt låg confidence och låt persona spela en
trovärdig person ur den miljön (t.ex. 'en soldat i skyttegraven 1916') istället för
att hitta på ett namn. Håll alltid personan respektfull."""


class IdentifyRequest(BaseModel):
    full_image: str  # data URL of full image with the yellow marking box drawn
    crop_image: str  # data URL of the cropped close-up


def _extract_json(text: str) -> dict:
    """Models occasionally wrap JSON in prose or fences — pull out the object."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if not match:
            raise HTTPException(502, f"Opus did not return JSON: {text[:200]}")
        return json.loads(match.group(0))


@router.post("/identify")
async def identify(req: IdentifyRequest):
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(500, "OPENROUTER_API_KEY not set")
    model = os.getenv("OPENROUTER_MODEL", "anthropic/claude-opus-4.1")

    payload = {
        "model": model,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Hela bilden med markeringsruta:"},
                    {"type": "image_url", "image_url": {"url": req.full_image}},
                    {"type": "text", "text": "Närbild på den markerade personen:"},
                    {"type": "image_url", "image_url": {"url": req.crop_image}},
                ],
            },
        ],
    }

    async with httpx.AsyncClient(timeout=90) as client:
        resp = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "Living Photos",
            },
            json=payload,
        )

    if resp.status_code != 200:
        raise HTTPException(resp.status_code, f"OpenRouter error: {resp.text[:300]}")

    content = resp.json()["choices"][0]["message"]["content"]
    return _extract_json(content)
