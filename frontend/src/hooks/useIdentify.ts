import { useCallback, useState } from "react";
import type { Persona } from "../lib/types";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export function useIdentify() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identify = useCallback(
    async (fullImage: string, cropImage: string): Promise<Persona | null> => {
      setLoading(true);
      setError(null);
      try {
        const resp = await fetch(`${API}/identify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_image: fullImage, crop_image: cropImage }),
        });
        if (!resp.ok) {
          throw new Error(`${resp.status}: ${await resp.text()}`);
        }
        return (await resp.json()) as Persona;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { identify, loading, error };
}
