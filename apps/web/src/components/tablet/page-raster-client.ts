"use client";

// ─────────────────────────────────────────────────────────────────────────────
// UNE PAGE EN PIXELS, DANS LE NAVIGATEUR — partagé par l'import du devis et le tampon
// de la structure (30/10/2026). Un PDF est dessiné par pdf.js (chargé à la demande) ;
// une image est ramenée à une largeur raisonnable.
// ─────────────────────────────────────────────────────────────────────────────

export async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Image impossible à fabriquer.");
  return new Uint8Array(await blob.arrayBuffer());
}

// Les `maxPages` premières pages, à `widthPx` de large, et le nombre total de pages.
export async function pdfPageCanvases(bytes: Uint8Array, maxPages: number, widthPx: number): Promise<{ canvases: HTMLCanvasElement[]; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  // Fichier venu d'ailleurs : pdf.js 6 n'évalue plus aucun code ; les formulaires XFA
  // (scripts) restent coupés.
  const task = pdfjs.getDocument({ data: bytes.slice(), enableXfa: false });
  const pdf = await task.promise;
  try {
    const canvases: HTMLCanvasElement[] = [];
    for (let number = 1; number <= Math.min(pdf.numPages, maxPages); number += 1) {
      const page = await pdf.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: widthPx / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      canvases.push(canvas);
    }
    return { canvases, pageCount: pdf.numPages };
  } finally {
    await task.destroy();
  }
}

export async function imageCanvas(file: Blob, maxWidthPx: number): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidthPx / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}
