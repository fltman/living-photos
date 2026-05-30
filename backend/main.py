"""Living Photos backend — thin FastAPI proxy.

Responsibilities:
  - keep OpenRouter / ElevenLabs keys off the client
  - run the Opus vision identify call
  - (later) mint ElevenLabs signed URLs for voice mode
"""
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import chat, identify, voice, voices

load_dotenv()

app = FastAPI(title="Living Photos API")

app.add_middleware(
    CORSMiddleware,
    # Vite picks any free port in dev, and the app may be opened from a phone
    # over the LAN, so accept localhost/127.0.0.1 plus the RFC1918 private
    # ranges (10/8, 192.168/16, 172.16–31/12) on any port. http only — LAN dev
    # is plain http; add an https alternative here if you serve over a tunnel.
    allow_origin_regex=(
        r"http://(localhost|127\.0\.0\.1|"
        r"10(\.\d{1,3}){3}|"
        r"192\.168(\.\d{1,3}){2}|"
        r"172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}"
        r"):\d+"
    ),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(identify.router)
app.include_router(chat.router)
app.include_router(voice.router)
app.include_router(voices.router)


@app.get("/health")
def health():
    return {"ok": True}
