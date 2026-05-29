import type { PersonBox } from "./types";

/** Downscale a canvas to a max dimension to keep payloads (and Opus cost) sane. */
function toDataURL(canvas: HTMLCanvasElement, maxDim = 1280): string {
  const { width, height } = canvas;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  if (scale === 1) return canvas.toDataURL("image/jpeg", 0.9);

  const out = document.createElement("canvas");
  out.width = Math.round(width * scale);
  out.height = Math.round(height * scale);
  out.getContext("2d")!.drawImage(canvas, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.9);
}

/** The whole image with a yellow marking box drawn around the selected person. */
export function renderFullWithMarking(img: HTMLImageElement, box: PersonBox): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);

  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = Math.max(3, img.naturalWidth * 0.005);
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  return toDataURL(canvas);
}

/** A padded close-up crop of the selected person. */
export function renderCrop(img: HTMLImageElement, box: PersonBox, pad = 0.15): string {
  const px = box.w * pad;
  const py = box.h * pad;
  const sx = Math.max(0, box.x - px);
  const sy = Math.max(0, box.y - py);
  const sw = Math.min(img.naturalWidth - sx, box.w + px * 2);
  const sh = Math.min(img.naturalHeight - sy, box.h + py * 2);

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  canvas.getContext("2d")!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return toDataURL(canvas, 768);
}
