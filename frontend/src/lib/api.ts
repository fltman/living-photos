/** Shared API base URL.
 *
 * Priority:
 *   1. VITE_API_URL (explicit override, e.g. a tunnel or prod host)
 *   2. Derived from the page origin: same protocol + hostname, port 8000.
 *
 * Why derive instead of hardcoding localhost: when the app is opened from a
 * phone over the LAN (http://192.168.x.x:5175), `localhost` resolves to the
 * PHONE, not the dev machine. `location.hostname` is the dev machine's LAN IP,
 * so `${protocol}//${hostname}:8000` correctly points back at the backend. */
const BACKEND_PORT = 8000;

function deriveBase(): string {
  // SSR / non-browser guard (tests, prerender) — fall back to localhost.
  if (typeof location === "undefined") return `http://localhost:${BACKEND_PORT}`;
  return `${location.protocol}//${location.hostname}:${BACKEND_PORT}`;
}

export const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? deriveBase();
