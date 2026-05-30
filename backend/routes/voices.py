"""GET /voices — the account's ElevenLabs voices, normalised to
{id, name, gender, age}. Includes unlabelled/custom voices (gender "") so the
frontend can name-match them to a persona; labelled ones drive the gender/age
fallback. Cached in-memory with a TTL so we don't hit ElevenLabs every request."""
import os
import time

import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()

_cache: dict = {"ts": 0.0, "data": None}
_TTL = 3600.0  # 1 hour


def _map_age(age: str | None) -> str:
    a = (age or "").lower()
    if "old" in a or "senior" in a or "elder" in a:
        return "old"
    if "young" in a:
        return "young"
    return "adult"  # middle_aged / unspecified


@router.get("/voices")
async def voices():
    now = time.time()
    if _cache["data"] is not None and now - _cache["ts"] < _TTL:
        return _cache["data"]

    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise HTTPException(500, "ELEVENLABS_API_KEY not set")

    out: list[dict] = []
    token: str | None = None
    async with httpx.AsyncClient(timeout=30) as client:
        for _ in range(10):  # safety cap on pagination
            params = {"page_size": 100}
            if token:
                params["next_page_token"] = token
            resp = await client.get(
                "https://api.elevenlabs.io/v2/voices",
                params=params,
                headers={"xi-api-key": api_key},
            )
            if resp.status_code != 200:
                raise HTTPException(resp.status_code, f"ElevenLabs error: {resp.text[:200]}")
            data = resp.json()
            for v in data.get("voices", []):
                labels = v.get("labels") or {}
                gender = (labels.get("gender") or "").lower()
                if gender not in ("male", "female"):
                    gender = ""  # custom/unlabelled — still useful for name-matching
                out.append(
                    {
                        "id": v["voice_id"],
                        "name": v.get("name", ""),
                        "gender": gender,
                        "age": _map_age(labels.get("age")),
                    }
                )
            if not data.get("has_more"):
                break
            token = data.get("next_page_token")
            if not token:
                break

    _cache["data"] = out
    _cache["ts"] = now
    return out
