import { useState } from "react";
import { getSettings, saveSettings, type Settings as TSettings } from "../lib/settings";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function Settings({ open, onClose, onSaved }: Props) {
  const [s, setS] = useState<TSettings>(getSettings);

  if (!open) return null;

  function set<K extends keyof TSettings>(k: K, v: TSettings[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  function save() {
    saveSettings({
      ...s,
      openrouterKey: s.openrouterKey.trim(),
      elevenlabsKey: s.elevenlabsKey.trim(),
      elevenlabsAgentId: s.elevenlabsAgentId.trim(),
    });
    onSaved?.();
    onClose();
  }

  const field = "w-full rounded-lg border border-white/20 bg-black/40 px-3 py-2.5 text-base outline-none focus:border-yellow-400 md:text-sm";
  const labelCls = "mb-1 block text-sm text-white/70";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#141414] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">Inställningar · dina nycklar</h2>
          <button onClick={onClose} className="px-2 py-1 text-white/50 hover:text-white">
            ✕
          </button>
        </div>

        <p className="mb-4 text-xs text-white/50">
          Nycklarna sparas bara lokalt i din webbläsare och skickas direkt till
          OpenRouter / ElevenLabs — aldrig till någon server.
        </p>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>
              OpenRouter API-nyckel <span className="text-yellow-400">(krävs)</span>
            </label>
            <input
              type="password"
              autoComplete="off"
              value={s.openrouterKey}
              onChange={(e) => set("openrouterKey", e.target.value)}
              placeholder="sk-or-v1-…"
              className={field}
            />
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-yellow-400/80 hover:text-yellow-400"
            >
              Hämta nyckel ↗
            </a>
          </div>

          <div>
            <label className={labelCls}>Modell</label>
            <input
              type="text"
              value={s.openrouterModel}
              onChange={(e) => set("openrouterModel", e.target.value)}
              placeholder="anthropic/claude-opus-4.8"
              className={field}
            />
          </div>

          <hr className="border-white/10" />
          <p className="text-xs text-white/50">För röstläget (valfritt):</p>

          <div>
            <label className={labelCls}>ElevenLabs API-nyckel</label>
            <input
              type="password"
              autoComplete="off"
              value={s.elevenlabsKey}
              onChange={(e) => set("elevenlabsKey", e.target.value)}
              placeholder="…"
              className={field}
            />
          </div>

          <div>
            <label className={labelCls}>ElevenLabs Agent-ID</label>
            <input
              type="text"
              value={s.elevenlabsAgentId}
              onChange={(e) => set("elevenlabsAgentId", e.target.value)}
              placeholder="agent_…"
              className={field}
            />
            <p className="mt-1 text-xs text-white/40">
              Agenten måste ha overrides på (system prompt, first message, voice,
              language) och en multilingual TTS-modell.
            </p>
          </div>
        </div>

        <button
          onClick={save}
          className="mt-6 min-h-11 w-full rounded-lg bg-yellow-400 px-4 py-2.5 font-medium text-black hover:bg-yellow-300"
        >
          Spara
        </button>
      </div>
    </div>
  );
}
