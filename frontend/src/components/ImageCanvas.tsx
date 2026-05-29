import { useRef, useState } from "react";
import { usePersonDetection } from "../hooks/usePersonDetection";
import type { PersonBox } from "../lib/types";

interface Props {
  /** Called when the user locks a person (by clicking a suggestion or drawing a box). */
  onSelect: (img: HTMLImageElement, box: PersonBox) => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CLICK_THRESHOLD = 6; // px of movement below which a drag counts as a click

export function ImageCanvas({ onSelect }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [boxes, setBoxes] = useState<PersonBox[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<PersonBox | null>(null);
  const [draft, setDraft] = useState<Rect | null>(null);
  const dragStart = useRef<{ x: number; y: number; client: [number, number] } | null>(null);
  const { detect, loading } = usePersonDetection();

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBoxes([]);
    setSelected(null);
    setDraft(null);
    setSrc(URL.createObjectURL(file));
  }

  async function handleLoad() {
    if (!imgRef.current) return;
    setBoxes(await detect(imgRef.current));
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

  function commit(box: PersonBox) {
    setSelected(box);
    onSelect(imgRef.current!, box);
  }

  function onMouseDown(e: React.MouseEvent) {
    const n = toNatural(e.clientX, e.clientY);
    dragStart.current = { x: n.x, y: n.y, client: [e.clientX, e.clientY] };
    setDraft(null);
  }

  function onMouseMove(e: React.MouseEvent) {
    const start = dragStart.current;
    if (!start) {
      // Not dragging — update hover highlight against suggestion boxes.
      const n = toNatural(e.clientX, e.clientY);
      const hit = boxes.find(
        (b) => n.x >= b.x && n.x <= b.x + b.w && n.y >= b.y && n.y <= b.y + b.h,
      );
      setHovered(hit ? hit.id : null);
      return;
    }
    const n = toNatural(e.clientX, e.clientY);
    setDraft({
      x: Math.min(start.x, n.x),
      y: Math.min(start.y, n.y),
      w: Math.abs(n.x - start.x),
      h: Math.abs(n.y - start.y),
    });
  }

  function onMouseUp(e: React.MouseEvent) {
    const start = dragStart.current;
    dragStart.current = null;
    if (!start) return;

    const movedPx = Math.hypot(
      e.clientX - start.client[0],
      e.clientY - start.client[1],
    );

    if (movedPx < CLICK_THRESHOLD) {
      // Treat as a click: select a suggestion box under the cursor, if any.
      const n = toNatural(e.clientX, e.clientY);
      const hit = boxes.find(
        (b) => n.x >= b.x && n.x <= b.x + b.w && n.y >= b.y && n.y <= b.y + b.h,
      );
      setDraft(null);
      if (hit) commit(hit);
      return;
    }

    // A real drag — commit the drawn rectangle as a manual selection.
    if (draft && draft.w > 10 && draft.h > 10) {
      commit({ id: -1, ...draft, score: 1 });
    }
    setDraft(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="w-fit cursor-pointer rounded-lg bg-yellow-400 px-4 py-2 text-center font-medium text-black hover:bg-yellow-300">
        Ladda upp bild
        <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </label>

      {src && (
        <p className="text-xs text-white/50">
          Klicka på ett förslag — eller <span className="text-yellow-400">dra en ruta</span> med
          musen runt vem som helst i bilden.
        </p>
      )}

      {src && (
        <div
          className="relative inline-block cursor-crosshair select-none"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => {
            dragStart.current = null;
            setHovered(null);
          }}
        >
          <img
            ref={imgRef}
            src={src}
            onLoad={handleLoad}
            className="max-h-[75vh] w-auto rounded-lg"
            alt="uppladdad"
            draggable={false}
          />

          {imgRef.current &&
            boxes.map((box) => {
              const isSel = selected?.id === box.id;
              const active = hovered === box.id || isSel;
              const dimmed = selected !== null && !isSel;
              return (
                <div
                  key={box.id}
                  style={pct(box)}
                  className={[
                    "pointer-events-none absolute box-border rounded-sm transition-all",
                    active
                      ? "border-2 border-yellow-400 bg-yellow-400/20"
                      : "border border-dashed border-white/50",
                    dimmed ? "opacity-25" : "opacity-100",
                  ].join(" ")}
                />
              );
            })}

          {/* Manual selection: the in-progress drag, or the committed manual box. */}
          {(draft || (selected && selected.id === -1)) && imgRef.current && (
            <div
              style={pct(draft ?? (selected as Rect))}
              className="pointer-events-none absolute box-border rounded-sm border-2 border-yellow-400 bg-yellow-400/20"
            />
          )}
        </div>
      )}

      {loading && <p className="text-sm text-white/60">Söker efter personer…</p>}
      {src && !loading && boxes.length === 0 && (
        <p className="text-sm text-white/60">
          Inga personer hittades automatiskt — dra en ruta runt personen själv.
        </p>
      )}
    </div>
  );
}
