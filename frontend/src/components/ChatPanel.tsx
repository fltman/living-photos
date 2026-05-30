import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useChat } from "../hooks/useChat";
import type { Persona } from "../lib/types";

interface Props {
  persona: Persona;
  onClose: () => void;
}

export function ChatPanel({ persona, onClose }: Props) {
  const { messages, send, streaming } = useChat(persona);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft("");
    void send(text);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-medium">{persona.person_name}</h2>
        <button
          onClick={onClose}
          className="-mr-2 px-2 py-1 text-sm text-white/50 hover:text-white"
        >
          ✕ stäng
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === "user" ? "text-right" : "text-left"}
          >
            <span
              className={[
                "inline-block max-w-[85%] rounded-2xl px-3 py-2 text-left text-sm",
                m.role === "user"
                  ? "bg-yellow-400 text-black"
                  : "bg-white/10 text-white",
              ].join(" ")}
            >
              {m.role === "assistant" ? (
                m.content ? (
                  <div className="md-content">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  streaming && "…"
                )
              ) : (
                m.content
              )}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Skriv till ${persona.person_name}…`}
          inputMode="text"
          enterKeyHint="send"
          className="flex-1 rounded-lg border border-white/20 bg-black/40 px-3 py-2.5 text-base outline-none focus:border-yellow-400 md:py-2 md:text-sm"
        />
        <button
          type="submit"
          disabled={streaming}
          className="min-h-11 rounded-lg bg-yellow-400 px-4 py-2.5 font-medium text-black disabled:opacity-40"
        >
          Skicka
        </button>
      </form>
    </div>
  );
}
