# Living Photos

Ladda upp en känd bild, dra en ruta runt en person, och identifiera + chatta/prata med hen.

**Helt klient-sida (bring-your-own-keys).** Appen är en statisk SPA utan backend: varje
användare lägger in sina egna API-nycklar (OpenRouter + ElevenLabs), som sparas i
`localStorage` och skickas *direkt* till tjänsterna — aldrig till någon server. Det gör
att appen kan hostas var som helst (statiskt) med gratis HTTPS.

## Funktioner
- Upload eller **kamera** (mobil) → dra en ruta runt en person.
- **Identifiering**: Claude Opus (vision, via OpenRouter) känner igen scen + person och
  bygger en persona.
- **Chatt**: streamande textsamtal med personan.
- **Röst**: live-samtal via ElevenLabs Conversational AI, persona injicerad via overrides,
  röst vald ur ditt eget röstbibliotek (matchar t.o.m. klonade röster på namn).
- Responsiv, fungerar på mobil. Personen inleder på sitt modersmål.

## Nycklar (Inställningar ⚙︎)
- **OpenRouter API-nyckel** (krävs för identifiering + chatt) — https://openrouter.ai/keys
- **ElevenLabs API-nyckel + Agent-ID** (för röstläget). Agenten måste ha *overrides* på
  (system prompt, first message, voice, language) och en *multilingual* TTS-modell.

## Köra lokalt
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```
Öppna appen, klicka ⚙︎ och lägg in dina nycklar.

## Bygga / deploya (statiskt)
```bash
cd frontend
npm run build    # -> frontend/dist/
```
`dist/` är en statisk SPA — deploya på valfri statisk host (Cloudflare Pages, Vercel,
Netlify, GitHub Pages). HTTPS krävs för röstläget (mikrofonen via getUserMedia).

## Att tänka på
- Nycklar i `localStorage` kan läsas av JS på sidan (XSS) — standard BYOK-avvägning. Det
  är användarens egen nyckel på egen enhet; appen laddar inga tredjeparts-skript.
- Markering är manuell (drag-to-draw) — pålitligt även på svartvita/vintagefoton.
- Identifieringen är AI:ns gissning; visa gärna en disclaimer.

## `backend/` (legacy)
Den tidigare FastAPI-proxyn finns kvar men används inte längre av appen. Den kan köras om
man hellre vill hålla nycklarna server-sida — sätt då `VITE_API_URL` och återinför
proxy-anropen. För standard-BYOK-flödet behövs den inte.
