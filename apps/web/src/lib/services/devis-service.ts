// ─────────────────────────────────────────────────────────────────────────────
// LE DEVIS DE LA PERSONNE, IMPORTÉ AVANT LE CONTRAT — règles pures (call du
// 30/10/2026 de la structure pilote : le devis est fait et signé dans le logiciel de la structure,
// enregistré en PDF sur la tablette ; « un bouton importer le devis, et ça le met
// directement dans l'annexe 1 du Word »).
//
// Le devis porte le nom, l'adresse et le tarif de la personne : il reste sur la
// TABLETTE, comme le contrat (verrou HDS) — jamais envoyé au serveur. Son type se
// décide par la SIGNATURE du fichier, jamais par son nom ni par ce que le navigateur
// annonce.
// ─────────────────────────────────────────────────────────────────────────────

export const DEVIS_MAX_BYTES = 15 * 1024 * 1024;
// Un devis tient en une à trois pages ; au-delà, seules les premières vont dans le Word
// (le fichier d'origine, lui, est gardé entier avec le contrat).
export const DEVIS_MAX_PAGES = 8;

export type DevisKind = "PDF" | "PNG" | "JPEG";

export function detectDevisKind(bytes: Uint8Array): DevisKind | null {
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  if (starts(0x25, 0x50, 0x44, 0x46)) return "PDF"; // %PDF
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "PNG";
  if (starts(0xff, 0xd8, 0xff)) return "JPEG";
  return null;
}

export function devisFileProblem(bytes: Uint8Array): string | null {
  if (bytes.length === 0) return "Le fichier est vide.";
  if (bytes.length > DEVIS_MAX_BYTES) return "Le devis dépasse 15 Mo : enregistrez-le à nouveau en PDF.";
  if (!detectDevisKind(bytes)) return "Ce fichier n'est ni un PDF ni une photo (JPEG, PNG). Enregistrez le devis en PDF.";
  return null;
}

const EXTENSIONS: Record<DevisKind, string> = { PDF: "pdf", PNG: "png", JPEG: "jpg" };

export function devisExtension(kind: DevisKind): string {
  return EXTENSIONS[kind];
}

// Ce qui est écrit sous le titre de l'annexe 1, au-dessus des pages.
export function devisCaption(input: { importedAt: Date; pageCount: number; shownPages: number }): string {
  const day = input.importedAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" });
  const pages = `${input.pageCount} page${input.pageCount > 1 ? "s" : ""}`;
  const cut = input.shownPages < input.pageCount ? ` (les ${input.shownPages} premières reproduites ; le devis complet est joint au contrat)` : "";
  return `Devis remis à la personne, joint le ${day} — ${pages}${cut}.`;
}
