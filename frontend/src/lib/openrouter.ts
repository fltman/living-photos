/** Direct OpenRouter (Claude) calls from the browser using the user's own key.
 * Replaces the old /identify and /chat backend endpoints. */
import type { Persona } from "./types";
import { getSettings } from "./settings";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `Du är en konstkännare och historiker. Du får TVÅ bilder:
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
att hitta på ett namn. Håll alltid personan respektfull.`;

/** Pull the first complete, balanced JSON object out of model output (which may
 * carry fences or trailing prose). */
function extractJson(text: string): Persona {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim();
  }
  try {
    return JSON.parse(t) as Persona;
  } catch {
    /* fall through to brace scan */
  }
  const start = t.indexOf("{");
  if (start !== -1) {
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < t.length; i++) {
      const ch = t[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(t.slice(start, i + 1)) as Persona;
          } catch {
            break;
          }
        }
      }
    }
  }
  throw new Error(`Kunde inte tolka JSON från modellen: ${t.slice(0, 200)}`);
}

function headers(key: string) {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": location.origin,
    "X-Title": "Living Photos",
  };
}

/** Identify the marked person and build a persona. */
export async function identify(fullImage: string, cropImage: string): Promise<Persona> {
  const { openrouterKey, openrouterModel } = getSettings();
  if (!openrouterKey) throw new Error("Ingen OpenRouter-nyckel angiven (öppna inställningar).");

  const resp = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: headers(openrouterKey),
    body: JSON.stringify({
      model: openrouterModel,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Hela bilden med markeringsruta:" },
            { type: "image_url", image_url: { url: fullImage } },
            { type: "text", text: "Närbild på den markerade personen:" },
            { type: "image_url", image_url: { url: cropImage } },
          ],
        },
      ],
    }),
  });

  if (!resp.ok) throw new Error(`OpenRouter ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const content = (await resp.json())?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Oväntat OpenRouter-svar.");
  return extractJson(content);
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Stream a persona chat reply, invoking `onDelta` with each text chunk. */
export async function streamChat(
  personaSystemPrompt: string,
  messages: ChatMessage[],
  onDelta: (chunk: string) => void,
): Promise<void> {
  const { openrouterKey, openrouterModel } = getSettings();
  if (!openrouterKey) throw new Error("Ingen OpenRouter-nyckel angiven.");

  const resp = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: headers(openrouterKey),
    body: JSON.stringify({
      model: openrouterModel,
      stream: true,
      messages: [{ role: "system", content: personaSystemPrompt }, ...messages],
    }),
  });
  if (!resp.ok || !resp.body) throw new Error(`OpenRouter ${resp.status}`);

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep the trailing partial line
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
      } catch {
        /* ignore keep-alive / partial */
      }
    }
  }
}
