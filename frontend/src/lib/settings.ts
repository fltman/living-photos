/** Bring-your-own-keys settings, stored in localStorage. The app is fully
 * client-side: each user supplies their own OpenRouter + ElevenLabs keys, which
 * never leave their device (no backend). */
const LS_KEY = "lp_settings_v1";

export interface Settings {
  openrouterKey: string;
  openrouterModel: string;
  elevenlabsKey: string;
  elevenlabsAgentId: string;
}

const DEFAULTS: Settings = {
  openrouterKey: "",
  openrouterModel: "anthropic/claude-opus-4.8",
  elevenlabsKey: "",
  elevenlabsAgentId: "",
};

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(LS_KEY, JSON.stringify(s));
}

/** Identify + chat need the OpenRouter key. */
export function hasIdentifyKeys(s = getSettings()): boolean {
  return s.openrouterKey.trim().length > 0;
}

/** Voice mode needs the ElevenLabs key + agent id. */
export function hasVoiceKeys(s = getSettings()): boolean {
  return s.elevenlabsKey.trim().length > 0 && s.elevenlabsAgentId.trim().length > 0;
}
