"use client";

import { fitInRect, type PdfRect, type PdfTextItem } from "@/lib/services/document-signature-service";

// ─────────────────────────────────────────────────────────────────────────────
// UN PDF À SIGNER, DANS LE NAVIGATEUR (12/11/2026) : pages dessinées par pdf.js
// (chargé à la demande) avec leur texte positionné — pour repérer les cases —, puis
// signature et tampon posés par pdf-lib. Rien ne part au serveur avant « Enregistrer ».
// ─────────────────────────────────────────────────────────────────────────────

// Un document de travail ne dépasse pas cette longueur ; au-delà, l'écran le dit.
export const MAX_SIGNING_PAGES = 40;

export type RenderedPdfPage = {
  page: number;
  // Taille en points PDF : les cases et le clic s'y rapportent.
  width: number;
  height: number;
  imageUrl: string;
  items: PdfTextItem[];
};

export async function renderPdfPages(bytes: Uint8Array, widthPx: number): Promise<{ pages: RenderedPdfPage[]; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  // Fichier venu d'ailleurs : pdf.js 6 n'évalue aucun code ; formulaires XFA coupés.
  const task = pdfjs.getDocument({ data: bytes.slice(), enableXfa: false });
  const pdf = await task.promise;
  try {
    const pages: RenderedPdfPage[] = [];
    for (let number = 1; number <= Math.min(pdf.numPages, MAX_SIGNING_PAGES); number += 1) {
      const page = await pdf.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: widthPx / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const text = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const item of text.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        items.push({ text: item.str, x: item.transform[4] as number, y: item.transform[5] as number, width: item.width, height: item.height });
      }
      pages.push({ page: number, width: base.width, height: base.height, imageUrl: canvas.toDataURL("image/png"), items });
    }
    return { pages, pageCount: pdf.numPages };
  } finally {
    await task.destroy();
  }
}

export type PdfMarkPlacement = { page: number; rect: PdfRect; png: Uint8Array };

export async function stampPdf(bytes: Uint8Array, placements: readonly PdfMarkPlacement[]): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(bytes);
  const pages = pdf.getPages();
  for (const placement of placements) {
    const page = pages[placement.page - 1];
    if (!page) continue;
    const image = await pdf.embedPng(placement.png);
    const box = fitInRect({ width: image.width, height: image.height }, placement.rect);
    page.drawImage(image, box);
  }
  return pdf.save();
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToObjectUrl(bytes: Uint8Array, type: string): string {
  return URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
}
