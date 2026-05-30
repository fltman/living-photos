/** Direct ElevenLabs calls from the browser using the user's own key. Voices
 * are fetched from the account, normalised to {id,name,gender,age}, and cached
 * in localStorage (TTL) + a session memo. A persona's `suggested_voice` narrows
 * the pool by gender+age; the character's name seeds a deterministic pick (and
 * can match a same-named cloned voice). */
import { getSettings } from "./settings";

const LS_KEY = "lp_voices_v3";
const TTL = 24 * 3600 * 1000; // 24h

export interface Voice {
  id: string;
  name: string;
  gender: "male" | "female" | ""; // "" = custom/unlabelled voice
  age: "old" | "adult" | "young";
}

/** Safe fallback if voices can't be fetched (Mark — middle-aged male). */
export const DEFAULT_VOICE = "1SM7GgM6IMuvQlz2BwM3";

function mapAge(age: string | undefined): Voice["age"] {
  const a = (age || "").toLowerCase();
  if (a.includes("old") || a.includes("senior") || a.includes("elder")) return "old";
  if (a.includes("young")) return "young";
  return "adult";
}

let memo: Promise<Voice[]> | null = null;

export function loadVoices(): Promise<Voice[]> {
  if (memo) return memo;
  memo = (async () => {
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
        const gender = String(labels.gender ?? "").toLowerCase();
        out.push({
          id: v.voice_id,
          name: v.name ?? "",
          gender: gender === "male" || gender === "female" ? gender : "",
          age: mapAge(labels.age),
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
  })();
  return memo;
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

/** Stable string hash (djb2) so a seed always maps to the same voice. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}

/** Pick a voice from `pool` for the persona.
 *  1. Name hint: match a voice whose name shares a distinctive token with the
 *     character, or is the character's initials (e.g. "dt2" for Donald Trump) —
 *     often a custom clone of that person. Gender-aligned matches win.
 *  2. Otherwise pick by gender + age, varied deterministically by `seed`. */
export function voiceIdFor(pool: Voice[], suggested: string, seed = ""): string {
  if (!pool.length) return DEFAULT_VOICE;
  const [gender, age] = suggested.split("_");

  const words = seed.toLowerCase().split(/[^a-z0-9åäö]+/).filter(Boolean);
  const tokens = words.filter((t) => t.length >= 4);
  const initials = words.length >= 2 ? words.map((w) => w[0]).join("") : "";

  const isInitials = (t: string) =>
    t === initials ||
    (t.startsWith(initials) && /^\d+$/.test(t.slice(initials.length)));

  const matches = (v: Voice): boolean => {
    const n = v.name.toLowerCase();
    if (tokens.some((t) => n.includes(t))) return true;
    if (initials.length >= 2) {
      const nameTokens = n.split(/[^a-z0-9åäö]+/).filter(Boolean);
      if (nameTokens.some(isInitials)) return true;
    }
    return false;
  };

  if (tokens.length || initials) {
    let named = pool.filter(matches);
    const sameGender = named.filter((v) => v.gender === gender);
    if (sameGender.length) named = sameGender;
    if (named.length) return named[hash(seed) % named.length].id;
  }

  let candidates = pool.filter((v) => v.gender === gender && v.age === age);
  if (candidates.length === 0) candidates = pool.filter((v) => v.gender === gender);
  if (candidates.length === 0) candidates = pool.filter((v) => v.gender !== "");
  if (candidates.length === 0) candidates = pool;

  return candidates[hash(seed) % candidates.length].id;
}
