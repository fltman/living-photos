/** Direct ElevenLabs calls from the browser using the user's own key.
 *
 * Voice pool, in priority order:
 *  1. The agent's own voice list ("Voices" tab on the agent in ElevenLabs,
 *     a.k.a. `supported_voices`). Each entry has a free-text label/description
 *     such as "old lady" or "young male" which we parse into gender + age.
 *     This is fetched fresh on every page load so voices added to the agent
 *     show up without a code change.
 *  2. If the agent has no voice list: every voice on the account (24h cache).
 *
 * `voiceIdFor` scores the pool against the persona's `suggested_voice`
 * (e.g. "female_young") and the character's name (which may match a cloned
 * voice). If nothing fits, we send no override and the agent's default voice
 * is used. */
import { getSettings } from "./settings";

const LS_KEY = "lp_voices_v4";
const TTL = 24 * 3600 * 1000; // 24h, account pool only

export type Gender = "male" | "female" | "";
export type Age = "child" | "young" | "adult" | "old" | "";

export interface Voice {
  id: string;
  name: string;
  gender: Gender;
  age: Age;
  source: "agent" | "account";
}

/** Historical fallback (Mark — middle-aged male). Only used when the pool is
 * non-empty but nothing matches *and* we want some voice; prefer `null`. */
export const DEFAULT_VOICE = "1SM7GgM6IMuvQlz2BwM3";

/* ---------- label parsing ---------- */

const FEMALE = /\b(female\w*|woman|women|lad(y|ies|ys)|girl|kvinn\w*|flick\w*|dam|tjej|mother|mamma|mor|gumm\w*|tant|grandma|mormor|farmor)\b/;
const MALE = /\b(male\w*|man|men|boy|guy|gentleman|pojk\w*|kille|father|pappa|far|gubb\w*|grandpa|morfar|farfar)\b/;

const CHILD = /\b(child|children|kid|kids|barn|toddler|baby|boy|girl|pojk\w*|flick\w*)\b/;
const YOUNG = /\b(young|youth\w*|ung|teen\w*|tonår\w*|student)\b/;
const OLD = /\b(old|elder\w*|senior|gammal|gamla|gumm\w*|gubb\w*|grand\w*|mormor|farmor|morfar|farfar|tant)\b/;
const ADULT = /\b(middle[_ -]?aged|adult|vuxen|medelålder\w*|mature)\b/;

const norm = (text: string) => text.toLowerCase().replace(/[_\-./]+/g, " ");

export function parseGender(text: string): Gender {
  const t = norm(text);
  if (FEMALE.test(t)) return "female";
  if (MALE.test(t)) return "male";
  return "";
}

export function parseAge(text: string): Age {
  const t = norm(text);
  // Explicit "N år" / "N years" beats keywords.
  const m = t.match(/\b(\d{1,3})\s*(år|years?|yo)\b/);
  if (m) {
    const n = Number(m[1]);
    if (n < 13) return "child";
    if (n < 30) return "young";
    if (n < 60) return "adult";
    return "old";
  }
  if (CHILD.test(t)) return "child";
  if (YOUNG.test(t)) return "young";
  if (OLD.test(t)) return "old";
  if (ADULT.test(t)) return "adult";
  return "";
}

/* ---------- fetching ---------- */

interface AgentSupportedVoice {
  voice_id: string;
  label?: string;
  description?: string | null;
}

/** The agent's configured voice list. No persistent cache: cheap call, and we
 * want newly added voices to appear immediately. */
export async function loadAgentVoices(): Promise<Voice[]> {
  const { elevenlabsKey, elevenlabsAgentId } = getSettings();
  if (!elevenlabsKey || !elevenlabsAgentId) {
    throw new Error("ElevenLabs-nyckel eller agent-id saknas.");
  }
  const resp = await fetch(
    `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(elevenlabsAgentId)}`,
    { headers: { "xi-api-key": elevenlabsKey } },
  );
  if (!resp.ok) throw new Error(`ElevenLabs agent ${resp.status}`);
  const data = await resp.json();
  const list: AgentSupportedVoice[] =
    data?.conversation_config?.tts?.supported_voices ?? [];
  return list
    .filter((v) => v && v.voice_id)
    .map((v) => {
      const text = `${v.label ?? ""} ${v.description ?? ""}`;
      return {
        id: v.voice_id,
        name: v.label || v.voice_id,
        gender: parseGender(text),
        age: parseAge(text),
        source: "agent" as const,
      };
    });
}

function mapAccountAge(age: string | undefined): Age {
  const a = (age || "").toLowerCase();
  if (a.includes("old") || a.includes("senior") || a.includes("elder")) return "old";
  if (a.includes("young")) return "young";
  if (a.includes("middle") || a.includes("adult")) return "adult";
  return "";
}

/** Every voice on the account (library + cloned + generated), cached 24h. */
export async function loadAccountVoices(): Promise<Voice[]> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < TTL && Array.isArray(data) && data.length) {
        return data as Voice[];
      }
    }
  } catch {
    /* ignore bad cache */
  }

  const { elevenlabsKey } = getSettings();
  if (!elevenlabsKey) throw new Error("Ingen ElevenLabs-nyckel angiven.");

  const out: Voice[] = [];
  let token: string | undefined;
  for (let page = 0; page < 10; page++) {
    const url = new URL("https://api.elevenlabs.io/v2/voices");
    url.searchParams.set("page_size", "100");
    if (token) url.searchParams.set("next_page_token", token);
    const resp = await fetch(url, { headers: { "xi-api-key": elevenlabsKey } });
    if (!resp.ok) throw new Error(`ElevenLabs voices ${resp.status}`);
    const data = await resp.json();
    for (const v of data.voices ?? []) {
      const labels = v.labels ?? {};
      const g = String(labels.gender ?? "").toLowerCase();
      out.push({
        id: v.voice_id,
        name: v.name ?? "",
        gender: g === "male" || g === "female" ? g : parseGender(v.name ?? ""),
        age: mapAccountAge(labels.age) || parseAge(v.name ?? ""),
        source: "account",
      });
    }
    if (!data.has_more) break;
    token = data.next_page_token;
    if (!token) break;
  }

  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), data: out }));
  } catch {
    /* storage full / disabled — session memo still applies */
  }
  return out;
}

let memo: Promise<Voice[]> | null = null;

/** Agent voice list if it has one, otherwise the whole account. Memoised per
 * page load; call `resetVoiceCache()` after changing keys/agent. */
export function loadVoices(): Promise<Voice[]> {
  if (memo) return memo;
  memo = (async () => {
    try {
      const agent = await loadAgentVoices();
      if (agent.length) return agent;
      console.info("[voices] agenten har ingen röstlista – använder kontots röster");
    } catch (e) {
      console.warn("[voices] kunde inte läsa agentens röster:", e);
    }
    return loadAccountVoices();
  })();
  memo.catch(() => {
    memo = null; // let the next attempt retry
  });
  return memo;
}

export function resetVoiceCache(): void {
  memo = null;
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}

/** Mint a signed WebSocket URL for the user's agent using their own key. */
export async function getSignedUrl(): Promise<string> {
  const { elevenlabsKey, elevenlabsAgentId } = getSettings();
  if (!elevenlabsKey || !elevenlabsAgentId) {
    throw new Error("ElevenLabs-nyckel eller agent-id saknas.");
  }
  const url = new URL("https://api.elevenlabs.io/v1/convai/conversation/get-signed-url");
  url.searchParams.set("agent_id", elevenlabsAgentId);
  const resp = await fetch(url, { headers: { "xi-api-key": elevenlabsKey } });
  if (!resp.ok) throw new Error(`signed-url ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  return (await resp.json()).signed_url as string;
}

/* ---------- selection ---------- */

/** Stable string hash (djb2) so a seed always maps to the same voice. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}

const AGE_ORDER: Age[] = ["child", "young", "adult", "old"];

function ageScore(want: Age, have: Age): number {
  if (!want) return 0;
  if (!have) return 2; // unknown age: mild penalty vs an exact match
  if (want === have) return 8;
  const d = Math.abs(AGE_ORDER.indexOf(want) - AGE_ORDER.indexOf(have));
  return d === 1 ? 2 : 0;
}

/** Parse "female_young" → {gender, age}. Tolerates "female young", "old lady". */
export function parseSuggested(suggested: string): { gender: Gender; age: Age } {
  const s = (suggested || "").replace(/_/g, " ");
  return { gender: parseGender(s), age: parseAge(s) };
}

/** True if the voice's name/label shares a distinctive token with `seed`
 * (the character's name) or equals its initials (e.g. "dt2" ↔ Donald Trump) —
 * usually a custom clone of that person. */
function nameMatches(v: Voice, seed: string): boolean {
  const words = seed.toLowerCase().split(/[^a-z0-9åäöéü]+/).filter(Boolean);
  const tokens = words.filter((t) => t.length >= 4);
  const initials = words.length >= 2 ? words.map((w) => w[0]).join("") : "";
  const n = v.name.toLowerCase();
  const nameTokens = n.split(/[^a-z0-9åäöéü]+/).filter(Boolean);
  if (tokens.some((t) => nameTokens.some((nt) => nt === t || nt.startsWith(t)))) return true;
  if (initials.length >= 2) {
    const isInitials = (t: string) =>
      t === initials ||
      (t.startsWith(initials) && /^\d+$/.test(t.slice(initials.length)));
    if (nameTokens.some(isInitials)) return true;
  }
  return false;
}

/** Pick the best voice for the persona, or `null` to leave the agent's
 * default voice in place. A voice whose gender contradicts the persona is
 * never chosen, not even on a name match (Erik must not get "Erika"). */
export function pickVoice(pool: Voice[], suggested: string, seed = ""): Voice | null {
  if (!pool.length) return null;
  const want = parseSuggested(suggested);

  let best: Voice[] = [];
  let bestScore = -Infinity;
  for (const v of pool) {
    if (want.gender && v.gender && v.gender !== want.gender) continue;
    let score = 0;
    if (want.gender) score += v.gender === want.gender ? 10 : 6;
    score += ageScore(want.age, v.age);
    if (seed && nameMatches(v, seed)) score += 20;
    if (score > bestScore) {
      bestScore = score;
      best = [v];
    } else if (score === bestScore) {
      best.push(v);
    }
  }
  if (!best.length) return null;
  return best[hash(seed || suggested) % best.length];
}

/** Back-compat wrapper: voice id or DEFAULT_VOICE. */
export function voiceIdFor(pool: Voice[], suggested: string, seed = ""): string {
  return pickVoice(pool, suggested, seed)?.id ?? DEFAULT_VOICE;
}
