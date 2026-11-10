import { readFile } from "node:fs/promises";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// LOGO EODA POUR LES DOCUMENTS PRODUITS CÔTÉ SERVEUR (page de garde E2).
//
// « Le logo ne se redessine pas » (CLAUDE.md §7) : c'est le fichier officiel
// `public/logo-eoda.png` (bloc complet pour fonds clairs) qui est lu, jamais une
// copie. Embarqué dans les fonctions qui l'utilisent par `outputFileTracingIncludes`
// (next.config.ts). Un fichier introuvable n'empêche JAMAIS l'enregistrement d'un
// document : la page de garde retombe sur le nom « EODA conseil » écrit.
// ─────────────────────────────────────────────────────────────────────────────

export const EODA_LOGO_PUBLIC_PATH = path.join("public", "logo-eoda.png");

export async function readEodaLogoPng(root: string = process.cwd()): Promise<Buffer | null> {
  try {
    return await readFile(path.join(root, EODA_LOGO_PUBLIC_PATH));
  } catch (error) {
    console.warn("Logo EODA introuvable pour la page de garde : nom écrit à la place.", error instanceof Error ? error.message : error);
    return null;
  }
}
