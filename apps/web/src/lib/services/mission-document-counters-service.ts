import type { DocumentStatus } from "@eoda/database";

// Les quatre compteurs du portail interne de suivi de mission, tels que dictés au
// call du 16/08/2026 : documents déposés / analysés par l'IA / modifiés / conformes
// (context/07-outil-pilotage-missions.md §12.4).
//
// Le portail de suivi est un REFLET en lecture seule du portail client : il ne
// porte aucun contrôle de dépôt. Ce service est pur — il ne connaît ni Prisma ni la
// requête qui l'alimente, seulement l'état observable de chaque document.

export type MissionDocumentSnapshot = {
  status: DocumentStatus;
  // Nombre de versions déposées. 0 = le document n'a jamais été fourni.
  versionCount: number;
  // Au moins une version porte un résultat d'analyse IA (analysisResultJson).
  hasAnalyzedVersion: boolean;
  // Au moins une version a été produite par régénération d'une version antérieure.
  hasRegeneratedVersion: boolean;
};

export type MissionDocumentCounters = {
  deposited: number;
  analyzed: number;
  modified: number;
  compliant: number;
};

export function computeMissionDocumentCounters(
  documents: MissionDocumentSnapshot[]
): MissionDocumentCounters {
  const deposited = documents.filter((d) => d.versionCount > 0);

  return {
    deposited: deposited.length,
    analyzed: deposited.filter((d) => d.hasAnalyzedVersion).length,
    // « Modifié » = le document a évolué après son premier dépôt, que la nouvelle
    // version vienne de la régénération assistée ou d'un redépôt manuel du client.
    modified: deposited.filter((d) => d.hasRegeneratedVersion || d.versionCount > 1).length,
    // Un document non déposé n'est jamais conforme, quelle qu'ait été la valeur du
    // statut en base : le compteur reste un reflet du dépôt.
    compliant: deposited.filter((d) => d.status === "COMPLIANT").length,
  };
}
