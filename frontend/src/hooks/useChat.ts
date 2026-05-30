import { useCallback, useRef, useState } from "react";
import type { Persona } from "../lib/types";
import { streamChat, type ChatMessage } from "../lib/openrouter";

export type { ChatMessage };

/** Streaming chat against the identified persona (direct OpenRouter call). */
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
      const history: ChatMessage[] = [
        ...messagesRef.current,
        { role: "user", content: text },
      ];
      setMessages([...history, { role: "assistant", content: "" }]);
      setStreaming(true);

      let acc = "";
      try {
        await streamChat(persona.persona_system_prompt, history, (chunk) => {
          acc += chunk;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "assistant", content: acc };
            return next;
          });
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: "assistant",
            content: acc || `[fel vid svar: ${msg}]`,
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
