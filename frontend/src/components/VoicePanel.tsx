import { useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { voiceIdFor } from "../lib/voiceMap";
import type { Persona } from "../lib/types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

interface Props {
  persona: Persona;
  onClose: () => void;
}

export function VoicePanel({ persona, onClose }: Props) {
  const conversation = useConversation();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const connected = conversation.status === "connected";

  async function start() {
    setError(null);
    setStarting(true);
    try {
      // Mic permission must be granted before the session opens.
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const resp = await fetch(`${API}/voice/signed-url`);
      if (!resp.ok) throw new Error(`signed-url ${resp.status}: ${await resp.text()}`);
      const { signed_url } = await resp.json();

      await conversation.startSession({
        signedUrl: signed_url,
        overrides: {
          agent: {
            prompt: { prompt: persona.persona_system_prompt },
            firstMessage: persona.first_message,
            language: persona.language as "sv" | "en",
          },
          tts: { voiceId: voiceIdFor(persona.suggested_voice) },
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }

  function stop() {
    conversation.endSession();
  }

  function close() {
    if (connected) conversation.endSession();
    onClose();
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">{persona.person_name}</h2>
        <button onClick={close} className="text-sm text-white/50 hover:text-white">
          ✕ stäng
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div
          className={[
            "flex h-32 w-32 items-center justify-center rounded-full transition-all",
            connected
              ? conversation.isSpeaking
                ? "bg-yellow-400/30 scale-110 ring-4 ring-yellow-400"
                : "bg-white/10 ring-2 ring-white/30"
              : "bg-white/5",
          ].join(" ")}
        >
          <span className="text-4xl">{connected ? "🎙️" : "🔇"}</span>
        </div>

        <p className="text-sm text-white/60">
          {!connected && "Inte uppkopplad"}
          {connected && conversation.isSpeaking && `${persona.person_name} talar…`}
          {connected && !conversation.isSpeaking && "Lyssnar — säg något"}
        </p>

        {error && <p className="max-w-full text-center text-xs text-red-400">{error}</p>}

        {!connected ? (
          <button
            onClick={start}
            disabled={starting}
            className="rounded-lg bg-yellow-400 px-6 py-3 font-medium text-black hover:bg-yellow-300 disabled:opacity-40"
          >
            {starting ? "Kopplar upp…" : "Börja samtala"}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={() => conversation.setMuted(!conversation.isMuted)}
              className="rounded-lg border border-white/20 px-4 py-2 text-sm"
            >
              {conversation.isMuted ? "Slå på mik" : "Tysta mik"}
            </button>
            <button
              onClick={stop}
              className="rounded-lg bg-red-500/80 px-4 py-2 text-sm font-medium hover:bg-red-500"
            >
              Avsluta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
