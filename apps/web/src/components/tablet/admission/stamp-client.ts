"use client";

import { tabletAwarenessSheetUrl } from "@/lib/services/awareness-sheet-links";
import { detectStampSource, findStampBox, inkMask, paperToTransparent, stampQuarterTurns } from "@/lib/services/stamp-image-service";
import { canvasToPng, imageCanvas, pdfPageCanvases } from "../page-raster-client";

// ─────────────────────────────────────────────────────────────────────────────
// LE TAMPON DE LA STRUCTURE, SUR LA TABLETTE (30/10/2026) : le fichier déposé par EODA
// (scan PDF ou photo) est lu par sa route, détouré et redressé dans le navigateur
// (`stamp-image-service`), puis posé dans la case « SAD » du formulaire du Département.
// Le sens choisi à l'écran se garde sur la tablette (confort, par version du fichier).
// ─────────────────────────────────────────────────────────────────────────────

const RENDER_WIDTH_PX = 1240;
const turnsKey = (versionId: string) => `eoda-tampon-sens:${versionId}`;

export function storedStampTurns(versionId: string): number | null {
  try {
    const value = window.localStorage.getItem(turnsKey(versionId));
    return value === null ? null : Number(value);
  } catch {
    return null;
  }
}

export function storeStampTurns(versionId: string, turns: number): void {
  try {
    window.localStorage.setItem(turnsKey(versionId), String(turns));
  } catch {
    // stockage indisponible : le sens se reprendra au prochain affichage
  }
}

export type PreparedStamp = { png: Uint8Array; turns: number };

// Le fichier source dessiné une fois ; le recadrage et le sens se refont à la demande.
export async function loadStampSource(versionId: string): Promise<HTMLCanvasElement | null> {
  try {
    const response = await fetch(tabletAwarenessSheetUrl(versionId), { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const kind = detectStampSource(bytes);
    if (kind === "PDF") return (await pdfPageCanvases(bytes, 1, RENDER_WIDTH_PX)).canvases[0] ?? null;
    if (kind === "IMAGE") return await imageCanvas(new Blob([bytes as BlobPart]), RENDER_WIDTH_PX);
    return null;
  } catch {
    return null;
  }
}

export async function prepareStamp(source: HTMLCanvasElement, chosenTurns: number | null): Promise<PreparedStamp | null> {
  const context = source.getContext("2d");
  if (!context) return null;
  const pixels = context.getImageData(0, 0, source.width, source.height);
  const box = findStampBox(inkMask(pixels.data, source.width, source.height), source.width, source.height);
  if (!box) return null;
  const turns = stampQuarterTurns(box, chosenTurns);

  const canvas = document.createElement("canvas");
  const sideways = turns % 2 === 1;
  canvas.width = sideways ? box.height : box.width;
  canvas.height = sideways ? box.width : box.height;
  const out = canvas.getContext("2d");
  if (!out) return null;
  out.translate(canvas.width / 2, canvas.height / 2);
  out.rotate((turns * Math.PI) / 2);
  out.drawImage(source, box.x, box.y, box.width, box.height, -box.width / 2, -box.height / 2, box.width, box.height);
  out.setTransform(1, 0, 0, 1, 0, 0);

  const turned = out.getImageData(0, 0, canvas.width, canvas.height);
  paperToTransparent(turned.data);
  out.putImageData(turned, 0, 0);
  return { png: await canvasToPng(canvas), turns };
}
