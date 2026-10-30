"use client";

import { DEVIS_MAX_PAGES, detectDevisKind, devisFileProblem, type DevisKind } from "@/lib/services/devis-service";

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTER LE DEVIS SUR LA TABLETTE (30/10/2026) — dans le navigateur seulement.
//
// Un PDF est dessiné page par page (pdf.js, chargé à l'import seulement) ; une photo
// est recadrée à une taille raisonnable. Les pages deviennent des PNG, posés dans
// l'annexe 1 du Word. Rien ne part au serveur : le devis nomme la personne.
// ─────────────────────────────────────────────────────────────────────────────

export type ImportedDevis = {
  fileName: string;
  kind: DevisKind;
  // Le fichier d'origine, gardé entier avec le contrat.
  file: Blob;
  pages: Uint8Array[];
  pageCount: number;
};

// Largeur d'une page dessinée : lisible à l'impression A4, sans peser des mégaoctets.
const PAGE_WIDTH_PX = 1240;

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Image du devis impossible à fabriquer.");
  return new Uint8Array(await blob.arrayBuffer());
}

async function pdfPages(bytes: Uint8Array): Promise<{ pages: Uint8Array[]; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  // Fichier venu d'ailleurs : pdf.js 6 n'évalue plus aucun code ; les formulaires XFA
  // (scripts) restent coupés.
  const task = pdfjs.getDocument({ data: bytes.slice(), enableXfa: false });
  const pdf = await task.promise;
  try {
    const pages: Uint8Array[] = [];
    for (let number = 1; number <= Math.min(pdf.numPages, DEVIS_MAX_PAGES); number += 1) {
      const page = await pdf.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: PAGE_WIDTH_PX / base.width });
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      pages.push(await canvasToPng(canvas));
    }
    return { pages, pageCount: pdf.numPages };
  } finally {
    await task.destroy();
  }
}

async function imagePage(file: Blob): Promise<Uint8Array> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, PAGE_WIDTH_PX / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvasToPng(canvas);
}

export async function importDevis(file: File): Promise<ImportedDevis | { error: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const problem = devisFileProblem(bytes);
  if (problem) return { error: problem };
  const kind = detectDevisKind(bytes)!;
  try {
    if (kind === "PDF") {
      const { pages, pageCount } = await pdfPages(bytes);
      if (pages.length === 0) return { error: "Ce PDF ne contient aucune page." };
      return { fileName: file.name, kind, file, pages, pageCount };
    }
    return { fileName: file.name, kind, file, pages: [await imagePage(file)], pageCount: 1 };
  } catch {
    return { error: "Ce devis n'a pas pu être lu (fichier abîmé ou protégé). Enregistrez-le à nouveau en PDF." };
  }
}
