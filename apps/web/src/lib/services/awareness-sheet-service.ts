import { AWARENESS_SHEET_DOCUMENT_TYPES, DEPARTEMENT_DOCUMENT_TYPES } from "@eoda/database/document-types";
import { pickValidatedVersion, type TabletDipcVersionFacts } from "./tablet-dipc-service";
import type { TabletAwarenessSheet } from "./awareness-sheet-links";
import { isRestrictedDocumentType } from "@/content/documents/acces-restreint";

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
//
// EXCEPTION, document à accès restreint (le tampon, ADR 20261110) : EODA ne l'ouvre pas,
// donc ne le valide jamais — exiger une validation le rendrait inutilisable. La tablette
// prend sa DERNIÈRE version déposée, par la direction ou par EODA pour elle.
export function selectTabletStructureDocuments(
  documents: readonly { code: string; validatedAt: Date | null; versions: readonly AwarenessSheetVersionFacts[] }[]
): Record<string, TabletAwarenessSheet> {
  const sheets: Record<string, TabletAwarenessSheet> = {};
  for (const document of documents) {
    if (!TABLET_STRUCTURE_DOCUMENT_CODES.includes(document.code)) continue;
    const chosen = isRestrictedDocumentType(document.code) ? latestVersion(document.versions) : validatedVersion(document);
    if (chosen) sheets[document.code] = { versionId: chosen.id, originalFilename: chosen.originalFilename };
  }
  return sheets;
}

function latestVersion(versions: readonly AwarenessSheetVersionFacts[]): AwarenessSheetVersionFacts | null {
  return [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null;
}

function validatedVersion(document: {
  validatedAt: Date | null;
  versions: readonly AwarenessSheetVersionFacts[];
}): AwarenessSheetVersionFacts | null {
  const pick = pickValidatedVersion(document);
  return pick.status === "READY" ? pick.chosen : null;
}
