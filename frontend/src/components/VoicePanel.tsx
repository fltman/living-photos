import { useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { getSignedUrl, loadVoices, pickVoice, type Voice } from "../lib/voices";
import type { Persona } from "../lib/types";

// ElevenLabs language codes we allow the persona to open in (the agent must
// use a multilingual TTS model). Opus returns the person's native language.
type Lang =
  | "en" | "sv" | "fr" | "de" | "es" | "it" | "pt" | "ru" | "nl" | "pl"
  | "ja" | "zh" | "ar" | "hi" | "ko" | "tr" | "da" | "no" | "fi" | "el"
  | "cs" | "uk" | "ro" | "hu";

interface Props {
  persona: Persona;
  onClose: () => void;
}

export function VoicePanel({ persona, onClose }: Props) {
  const conversation = useConversation();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [voice, setVoice] = useState<Voice | null>(null);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  const connected = conversation.status === "connected";

  async function start() {
    setError(null);
    setStarting(true);
    try {
      // Mic permission must be granted before the session opens.
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const signed_url = await getSignedUrl();

      // Pick a voice from the agent's voice list (or the account pool). If
      // nothing fits, send no override so the agent's default voice is used.
      let picked: Voice | null = null;
      setVoiceNote(null);
      try {
        const pool = await loadVoices();
        picked = pickVoice(pool, persona.suggested_voice, persona.person_name);
        console.info(
          `[voices] ${pool.length} röster (${pool[0]?.source ?? "?"}), önskad "${persona.suggested_voice}" →`,
          picked ? `${picked.name} (${picked.id})` : "agentens standardröst",
        );
        if (!picked) setVoiceNote("Ingen passande röst i agentens lista – använder agentens standardröst.");
      } catch (e) {
        console.warn("[voices] kunde inte hämta röster:", e);
        setVoiceNote(`Kunde inte hämta röster (${e instanceof Error ? e.message : String(e)}) – använder agentens standardröst.`);
      }
      setVoice(picked);

      await conversation.startSession({
        signedUrl: signed_url,
        overrides: {
          agent: {
            prompt: { prompt: persona.persona_system_prompt },
            firstMessage: persona.first_message,
            language: persona.language as Lang,
          },
          ...(picked ? { tts: { voiceId: picked.id } } : {}),
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
        {voiceNote && <p className="max-w-full text-center text-xs text-yellow-300/80">{voiceNote}</p>}
        {voice && (
          <p className="text-xs text-white/40">
            Röst: {voice.name} ({voice.source === "agent" ? "agentens lista" : "kontot"})
          </p>
        )}

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
