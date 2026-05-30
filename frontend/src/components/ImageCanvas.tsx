import { useRef, useState } from "react";
import type { PersonBox } from "../lib/types";

interface Props {
  /** Called when the user locks a person by drawing a box around them. */
  onSelect: (img: HTMLImageElement, box: PersonBox) => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function ImageCanvas({ onSelect }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [selected, setSelected] = useState<Rect | null>(null);
  const [draft, setDraft] = useState<Rect | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelected(null);
    setDraft(null);
    setSrc(URL.createObjectURL(file));
  }

  /** Convert a client (screen) coordinate to the image's native pixel space. */
  function toNatural(clientX: number, clientY: number) {
    const el = imgRef.current!;
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * el.naturalWidth;
    const y = ((clientY - r.top) / r.height) * el.naturalHeight;
    return {
      x: Math.max(0, Math.min(el.naturalWidth, x)),
      y: Math.max(0, Math.min(el.naturalHeight, y)),
    };
  }

  function pct(rect: Rect) {
    const el = imgRef.current!;
    return {
      left: `${(rect.x / el.naturalWidth) * 100}%`,
      top: `${(rect.y / el.naturalHeight) * 100}%`,
      width: `${(rect.w / el.naturalWidth) * 100}%`,
      height: `${(rect.h / el.naturalHeight) * 100}%`,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    // Only react to the primary pointer (ignore 2nd finger / right-click).
    if (!e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const n = toNatural(e.clientX, e.clientY);
    dragStart.current = { x: n.x, y: n.y };
    setDraft(null);
  }

  function onPointerMove(e: React.PointerEvent) {
    const start = dragStart.current;
    if (!start) return;
    const n = toNatural(e.clientX, e.clientY);
    setDraft({
      x: Math.min(start.x, n.x),
      y: Math.min(start.y, n.y),
      w: Math.abs(n.x - start.x),
      h: Math.abs(n.y - start.y),
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    if ((e.currentTarget as HTMLElement).hasPointerCapture?.(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    dragStart.current = null;
    if (draft && draft.w > 10 && draft.h > 10) {
      setSelected(draft);
      onSelect(imgRef.current!, { id: -1, ...draft, score: 1 });
    }
    setDraft(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex min-h-11 w-fit cursor-pointer items-center justify-center rounded-lg bg-yellow-400 px-5 py-3 text-center text-base font-medium text-black hover:bg-yellow-300">
          Ladda upp bild
          <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
        </label>
        <label className="inline-flex min-h-11 w-fit cursor-pointer items-center justify-center rounded-lg border border-yellow-400 px-5 py-3 text-center text-base font-medium text-yellow-400 hover:bg-yellow-400/10">
          Ta foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
          />
        </label>
      </div>

      {src && (
        <p className="text-sm text-white/60 md:text-xs">
          <span className="text-yellow-400">Dra en ruta</span> runt en person i bilden
          för att identifiera och prata med hen.
        </p>
      )}

      {src && (
        <div
          className="relative w-fit max-w-full self-start cursor-crosshair select-none touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <img
            ref={imgRef}
            src={src}
            className="block max-h-[60vh] w-auto max-w-full rounded-lg md:max-h-[75vh]"
            alt="uppladdad"
            draggable={false}
          />

          {(draft || selected) && imgRef.current && (
            <div
              style={pct((draft ?? selected) as Rect)}
              className="pointer-events-none absolute box-border rounded-sm border-2 border-yellow-400 bg-yellow-400/20"
            />
          )}
        </div>
      )}
    </div>
  );
}
