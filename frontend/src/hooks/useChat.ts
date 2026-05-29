import { useCallback, useRef, useState } from "react";
import type { Persona } from "../lib/types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Streaming chat against the identified persona. */
export function useChat(persona: Persona) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    persona.first_message
      ? [{ role: "assistant", content: persona.first_message }]
      : [],
  );
  const [streaming, setStreaming] = useState(false);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const send = useCallback(
    async (text: string) => {
      const history = [
        ...messagesRef.current,
        { role: "user" as const, content: text },
      ];
      setMessages([...history, { role: "assistant", content: "" }]);
      setStreaming(true);

      try {
        const resp = await fetch(`${API}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            persona_system_prompt: persona.persona_system_prompt,
            messages: history,
          }),
        });
        if (!resp.ok || !resp.body) throw new Error(`${resp.status}`);

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: acc };
            return next;
          });
        }
      } catch {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: "[fel vid svar — kontrollera backend]",
          };
          return next;
        });
      } finally {
        setStreaming(false);
      }
    },
    [persona],
  );

  return { messages, send, streaming };
}
