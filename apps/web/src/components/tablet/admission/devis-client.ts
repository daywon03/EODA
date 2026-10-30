"use client";

import { DEVIS_MAX_PAGES, detectDevisKind, devisFileProblem, type DevisKind } from "@/lib/services/devis-service";
import { canvasToPng, imageCanvas, pdfPageCanvases } from "../page-raster-client";

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

async function pdfPages(bytes: Uint8Array): Promise<{ pages: Uint8Array[]; pageCount: number }> {
  const { canvases, pageCount } = await pdfPageCanvases(bytes, DEVIS_MAX_PAGES, PAGE_WIDTH_PX);
  const pages: Uint8Array[] = [];
  for (const canvas of canvases) pages.push(await canvasToPng(canvas));
  return { pages, pageCount };
}

async function imagePage(file: Blob): Promise<Uint8Array> {
  return canvasToPng(await imageCanvas(file, PAGE_WIDTH_PX));
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
