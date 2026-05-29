import { useCallback, useRef, useState } from "react";
import "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import type { PersonBox } from "../lib/types";

/** Lazily loads COCO-SSD once and detects `person` boxes in an image element. */
export function usePersonDetection() {
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const [loading, setLoading] = useState(false);

  const detect = useCallback(async (img: HTMLImageElement): Promise<PersonBox[]> => {
    setLoading(true);
    try {
      if (!modelRef.current) {
        modelRef.current = await cocoSsd.load();
      }
      const predictions = await modelRef.current.detect(img, 50);
      return predictions
        .filter((p) => p.class === "person" && p.score > 0.45)
        .map((p, i) => ({
          id: i,
          x: p.bbox[0],
          y: p.bbox[1],
          w: p.bbox[2],
          h: p.bbox[3],
          score: p.score,
        }));
    } finally {
      setLoading(false);
    }
  }, []);

  return { detect, loading };
}
