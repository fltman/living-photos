import { useEffect, useState } from "react";
import { loadVoices } from "./lib/voices";
import { ChatPanel } from "./components/ChatPanel";
import { VoicePanel } from "./components/VoicePanel";
import { ImageCanvas } from "./components/ImageCanvas";
import { IdentifyProgress } from "./components/IdentifyProgress";
import { useIdentify } from "./hooks/useIdentify";
import { renderCrop, renderFullWithMarking } from "./lib/cropImage";
import type { Persona, PersonBox } from "./lib/types";

type Mode = "idle" | "chat" | "voice";

export default function App() {
  const { identify, loading, error } = useIdentify();
  const [persona, setPersona] = useState<Persona | null>(null);
  const [mode, setMode] = useState<Mode>("idle");

  // Warm the voice pool cache (localStorage + memo) so voice mode starts fast.
  useEffect(() => {
    void loadVoices().catch(() => {});
  }, []);

  async function handleSelect(img: HTMLImageElement, box: PersonBox) {
    setPersona(null);
    setMode("idle");
    const full = renderFullWithMarking(img, box);
    const crop = renderCrop(img, box);
    setPersona(await identify(full, crop));
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">
          Living Photos <span className="text-yellow-400">·</span>
        </h1>
        <p className="text-sm text-white/60">
          Ladda upp en känd bild och dra en ruta runt en person för att låsa ramen.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:gap-8 md:grid-cols-[1fr_360px]">
        <ImageCanvas onSelect={handleSelect} />

        <aside className="flex min-h-[60vh] flex-col overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 md:h-[78vh] md:min-h-0 md:p-5">
          {mode === "chat" && persona ? (
            <ChatPanel persona={persona} onClose={() => setMode("idle")} />
          ) : mode === "voice" && persona ? (
            <VoicePanel persona={persona} onClose={() => setMode("idle")} />
          ) : (
          <div className="flex h-full flex-col overflow-y-auto">
          <h2 className="mb-3 text-lg font-medium">Identifiering</h2>

          {loading && <IdentifyProgress />}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {!loading && !persona && !error && (
            <p className="text-white/40 text-sm">
              Klicka på en markerad person för att identifiera och skapa en persona.
            </p>
          )}

          {persona && (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-white/40">Person</div>
                <div className="text-base font-medium">{persona.person_name}</div>
                <div className="text-white/50">
                  Säkerhet: {Math.round(persona.confidence * 100)}%
                </div>
              </div>
              <div>
                <div className="text-white/40">Scen</div>
                <div>{persona.scene}</div>
              </div>
              <div>
                <div className="text-white/40">Öppningsreplik</div>
                <div className="italic">”{persona.first_message}”</div>
              </div>
              <details className="text-white/60">
                <summary className="cursor-pointer">Persona-prompt</summary>
                <p className="mt-1 whitespace-pre-wrap text-xs">
                  {persona.persona_system_prompt}
                </p>
              </details>
              <div className="text-white/40 text-xs">
                Röst: {persona.suggested_voice} · Språk: {persona.language}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setMode("chat")}
                  className="flex-1 min-h-11 rounded-lg bg-yellow-400 px-3 py-2.5 text-base font-medium text-black hover:bg-yellow-300"
                >
                  Chatta
                </button>
                <button
                  onClick={() => setMode("voice")}
                  className="flex-1 min-h-11 rounded-lg border border-white/20 px-3 py-2.5 text-base hover:bg-white/10"
                >
                  Tala
                </button>
              </div>
            </div>
          )}
          </div>
          )}
        </aside>
      </div>
    </div>
  );
}
