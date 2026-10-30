import { AWARENESS_SHEET_DOCUMENT_TYPES, DEPARTEMENT_DOCUMENT_TYPES } from "@eoda/database/document-types";
import { pickValidatedVersion, type TabletDipcVersionFacts } from "./tablet-dipc-service";
import type { TabletAwarenessSheet } from "./awareness-sheet-links";

// ─────────────────────────────────────────────────────────────────────────────
// FICHES DE SENSIBILISATION « PERSONNE ACCOMPAGNÉE » SUR LA TABLETTE — règles pures
// (call du 28/10/2026 : « mettre une petite case à côté, voir la fiche de
// sensibilisation » ; l'intervenant la montre, l'explique, puis coche).
//
// Les fiches sont des documents de LA STRUCTURE (à son nom), déposés par EODA sur les
// lignes `PA_FICHE_P1…P5` de sa liste de documents : jamais dans le code. La tablette
// ne montre une fiche que si sa validation est à jour — la même règle que le DIPEC
// (`pickValidatedVersion`) : une fiche non relue n'est pas montrée à une personne.
// Document institutionnel : aucune donnée de personne ne passe, dans aucun sens.
// ─────────────────────────────────────────────────────────────────────────────

export const AWARENESS_SHEET_CODES: readonly string[] = AWARENESS_SHEET_DOCUMENT_TYPES.map((t) => t.code);
// Le tampon et le contrat récapitulatif du Département (30/10/2026) suivent la MÊME
// règle et passent par la même route : documents institutionnels de la structure.
export const DEPARTEMENT_DOCUMENT_CODES: readonly string[] = DEPARTEMENT_DOCUMENT_TYPES.map((t) => t.code);
export const TABLET_STRUCTURE_DOCUMENT_CODES: readonly string[] = [...AWARENESS_SHEET_CODES, ...DEPARTEMENT_DOCUMENT_CODES];

export type AwarenessSheetVersionFacts = Pick<TabletDipcVersionFacts, "id" | "versionNumber" | "uploadedAt" | "producedByCabinet"> & {
  originalFilename: string;
};

// Document montrable par code de type ; un code absent = pas de document validé.
export function selectTabletStructureDocuments(
  documents: readonly { code: string; validatedAt: Date | null; versions: readonly AwarenessSheetVersionFacts[] }[]
): Record<string, TabletAwarenessSheet> {
  const sheets: Record<string, TabletAwarenessSheet> = {};
  for (const document of documents) {
    if (!TABLET_STRUCTURE_DOCUMENT_CODES.includes(document.code)) continue;
    const pick = pickValidatedVersion(document);
    if (pick.status === "READY") {
      sheets[document.code] = { versionId: pick.chosen.id, originalFilename: pick.chosen.originalFilename };
    }
  }
  return sheets;
}
