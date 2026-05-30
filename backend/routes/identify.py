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
  "persona_system_prompt": "En system-prompt skriven i andra person ('Du ÄR ...') som låter en röst-/chattagent spela personen trovärdigt, i jag-form, med rätt epok, tonfall och kunskapshorisont. Personen ska INTE veta om saker som hänt efter bildens tid. Personen talar och inleder på sitt modersmål, men förstår och kan svara besökaren om denne byter språk.",
  "first_message": "En kort öppningsreplik som personen säger när samtalet börjar, in character — skriven på personens MODERSMÅL (samma språk som fältet 'language' nedan).",
  "suggested_voice": "en av: male_old, male_adult, male_young, female_old, female_adult, female_young",
  "language": "Personens modersmål som ISO-639-1-kod. MÅSTE vara en av dessa (ElevenLabs-stödda): en, sv, fr, de, es, it, pt, ru, nl, pl, ja, zh, ar, hi, ko, tr, da, no, fi, el, cs, uk, ro, hu. T.ex. en amerikansk person -> en, en fransk -> fr, en tysk -> de, en svensk -> sv. Välj den närmaste i listan om exakt språk saknas."
}

Om du är osäker på vem personen är: sätt låg confidence och låt persona spela en
trovärdig person ur den miljön (t.ex. 'en soldat i skyttegraven 1916') istället för
att hitta på ett namn. Håll alltid personan respektfull."""


class IdentifyRequest(BaseModel):
    full_image: str  # data URL of full image with the yellow marking box drawn
    crop_image: str  # data URL of the cropped close-up


def _extract_json(text: str) -> dict:
    """Models occasionally wrap JSON in prose/fences or add trailing text.
    Pull out the first complete, balanced JSON object."""
    text = text.strip()
    if text.startswith("```"):  # strip ```json … ``` fences
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text).strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Scan for the first balanced top-level object, honouring strings/escapes,
    # so trailing data or a second block can't break parsing.
    start = text.find("{")
    if start != -1:
        depth = 0
        in_str = False
        esc = False
        for i in range(start, len(text)):
            ch = text[i]
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
            elif ch == '"':
                in_str = True
            elif ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start : i + 1])
                    except json.JSONDecodeError:
                        break

    raise HTTPException(502, f"Could not parse JSON from model: {text[:200]}")


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

    try:
        content = resp.json()["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError):
        raise HTTPException(502, f"Unexpected OpenRouter response: {resp.text[:300]}")
    return _extract_json(content)
