import { useCallback, useState } from "react";
import type { Persona } from "../lib/types";
import { identify as identifyDirect } from "../lib/openrouter";

export function useIdentify() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identify = useCallback(
    async (fullImage: string, cropImage: string): Promise<Persona | null> => {
      setLoading(true);
      setError(null);
      try {
        return await identifyDirect(fullImage, cropImage);
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
