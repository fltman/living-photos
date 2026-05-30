# Living Photos

Ladda upp en känd bild, dra en ruta runt en person, och identifiera + chatta/prata med hen.

## Status
- [x] **Steg 1–2:** upload → dra en ruta runt personen → crop → `/identify` (Claude Opus vision via OpenRouter) → visar persona.
- [x] **Steg 3:** chattläge — streamande textsamtal med personan (`/chat`, Opus via OpenRouter).
- [x] **Steg 4:** röstläge — ElevenLabs Conversational AI med persona injicerad via overrides (`/voice/signed-url` + `VoicePanel`). Kräver ELEVENLABS-nycklar + en agent med overrides på.

## Röstläge — setup
1. Skapa en agent i ElevenLabs (Agents / Conversational AI), välj en **multilingual** TTS-modell.
2. Under agentens **Security**-flik: aktivera overrides för `system prompt`, `first message`, `voice` och `language`.
3. Fyll i `ELEVENLABS_API_KEY` + `ELEVENLABS_AGENT_ID` i backend `.env`.
4. Röst-bucketarna (`male_old` etc.) mappas till voice-ID:n i `frontend/src/lib/voiceMap.ts` — byt mot egna röster vid behov.

## Arkitektur
- **frontend/** — React + Vite + TS + Tailwind. Manuell markering: dra en ruta runt personen (koordinater i bildens native pixelrymd).
- **backend/** — tunn FastAPI. Döljer nycklar, proxar Opus-vision, mintar ElevenLabs signed URL.

## Köra lokalt

### Backend
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fyll i OPENROUTER_API_KEY (+ ev. OPENROUTER_MODEL)
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:8000
npm run dev            # http://localhost:5173
```

## Att tänka på
- Markeringen är helt manuell (drag-to-draw) — pålitligt även på svartvita/vintagefoton där objektdetektering ofta missar.
- Identifieringen är AI:ns gissning; visa en disclaimer i UI:t.
- Opus debiteras per `/identify`-anrop — överväg caching per bild+box.
