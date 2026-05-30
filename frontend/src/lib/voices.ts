/** Voices are loaded dynamically from the account (via the backend /voices
 * endpoint) and cached: a module-level promise for the session, plus
 * localStorage with a TTL so a page reload doesn't refetch. A persona's
 * `suggested_voice` (e.g. "female_young") narrows the pool by gender+age, and
 * the character's name seeds a deterministic pick — stable per character,
 * varied across characters. */
import { API_BASE } from "./api";

const LS_KEY = "lp_voices_v2";
const TTL = 24 * 3600 * 1000; // 24h

export interface Voice {
  id: string;
  name: string;
  gender: "male" | "female" | ""; // "" = custom/unlabelled voice
  age: "old" | "adult" | "young";
}

/** Safe fallback if /voices is unreachable (Mark — middle-aged male). */
export const DEFAULT_VOICE = "1SM7GgM6IMuvQlz2BwM3";

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

    const resp = await fetch(`${API_BASE}/voices`);
    if (!resp.ok) throw new Error(`voices ${resp.status}`);
    const data = (await resp.json()) as Voice[];
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      /* storage full / disabled — fine, session memo still applies */
    }
    return data;
  })();
  return memo;
}

/** Stable string hash (djb2) so a seed always maps to the same voice. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return Math.abs(h);
}

/** Pick a voice from `pool` for the persona.
 *  1. Name hint: if a voice's name shares a distinctive token with the
 *     character's name (e.g. a cloned "Churchill" voice), prefer it — these are
 *     often custom clones of that very person. Gender-aligned matches win.
 *  2. Otherwise pick by gender + age from `suggested` (e.g. "male_old"),
 *     varied deterministically by `seed`.
 * Falls back gracefully to any gendered voice, then DEFAULT_VOICE. */
export function voiceIdFor(pool: Voice[], suggested: string, seed = ""): string {
  if (!pool.length) return DEFAULT_VOICE;
  const [gender, age] = suggested.split("_");

  // 1. Name hint. Match a voice whose name shares a distinctive token (>= 4
  //    chars) with the character's name, OR whose name is the character's
  //    initials (e.g. a "dt" clone for "Donald Trump"). Custom clones are
  //    often named exactly this way. Gender-aligned matches win.
  const words = seed.toLowerCase().split(/[^a-z0-9åäö]+/).filter(Boolean);
  const tokens = words.filter((t) => t.length >= 4);
  const initials = words.length >= 2 ? words.map((w) => w[0]).join("") : "";

  // Initials match: a name token that is the initials, optionally with a digit
  // suffix ("dt", "dt2") — clones are often named this way. Avoids matching
  // arbitrary words that merely contain the letters (e.g. "soldat").
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

  // 2. Gender + age.
  let candidates = pool.filter((v) => v.gender === gender && v.age === age);
  if (candidates.length === 0) candidates = pool.filter((v) => v.gender === gender);
  if (candidates.length === 0) candidates = pool.filter((v) => v.gender !== "");
  if (candidates.length === 0) candidates = pool;

  return candidates[hash(seed) % candidates.length].id;
}
