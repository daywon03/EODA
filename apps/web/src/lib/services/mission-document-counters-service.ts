import type { DocumentStatus, SupportMode } from "@eoda/database";
import { isDocumentProven } from "./criteria-proof-service";

// Les quatre compteurs du portail interne de suivi de mission, tels que dictés au
// call du 16/08/2026 : documents déposés / analysés par l'IA / modifiés / conformes
// (context/07-outil-pilotage-missions.md §12.4).
//
// Le quatrième s'appelle désormais « Validés par EODA » (08/11/2026, retour de
// Sandrine : « 0 Conformes » sur une structure aux documents validés). Il lisait le
// statut COMPLIANT, que l'IA pose quand elle ne trouve AUCUN manque — presque jamais,
// et sans rien dire d'EODA. Il compte maintenant ce qui est prouvé au sens de
// isDocumentProven : validé par EODA (accompagné), accepté par la structure
// (autonomie). Le mot « conforme » n'apparaît plus (CLAUDE.md §7).
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
  // Faits de validation de la version COURANTE (isDocumentProven).
  validatedAt: Date | null;
  clientAcceptedAt: Date | null;
  currentVersionUploadedAt: Date | null;
  currentVersionByCabinet: boolean;
};

export type MissionDocumentCounters = {
  deposited: number;
  analyzed: number;
  modified: number;
  validated: number;
};

export function computeMissionDocumentCounters(
  documents: MissionDocumentSnapshot[],
  mode: SupportMode
): MissionDocumentCounters {
  const deposited = documents.filter((d) => d.versionCount > 0);

  return {
    deposited: deposited.length,
    analyzed: deposited.filter((d) => d.hasAnalyzedVersion).length,
    // « Modifié » = le document a évolué après son premier dépôt, que la nouvelle
    // version vienne de la régénération assistée ou d'un redépôt manuel du client.
    modified: deposited.filter((d) => d.hasRegeneratedVersion || d.versionCount > 1).length,
    // Un document non déposé ou « non concerné » n'est jamais compté validé.
    validated: deposited.filter(
      (d) =>
        d.status !== "NOT_APPLICABLE" &&
        isDocumentProven(
          {
            versionUploadedAt: d.currentVersionUploadedAt,
            validatedAt: d.validatedAt,
            clientAcceptedAt: d.clientAcceptedAt,
            versionByCabinet: d.currentVersionByCabinet,
          },
          mode
        )
    ).length,
  };
}

// Ce que compte chaque compteur, en une ligne sous le nombre (retour du 09/11/2026,
// #12 : quatre nombres sans légende). Écrit ICI, à côté du calcul qu'il décrit, pour
// que la légende suive la règle et non l'inverse.
export function missionDocumentCounterHint(key: keyof MissionDocumentCounters, mode: SupportMode): string {
  switch (key) {
    case "deposited":
      return "Au moins une version déposée.";
    case "analyzed":
      return "Au moins une version analysée.";
    case "modified":
      return "Une version régénérée, ou plus d'une version déposée.";
    case "validated":
      return mode === "ACCOMPAGNE"
        ? "Validation d'EODA à jour : aucune version plus récente à relire."
        : "Acceptation de la structure à jour : aucune version plus récente à relire.";
  }
}

// Libellé du quatrième compteur, une seule source pour les deux portails : il dit QUI
// a validé. La structure lit « par vous » là où le cabinet lit « par la structure ».
export function validatedCounterLabel(mode: SupportMode, audience: "CABINET" | "CLIENT" = "CABINET"): string {
  if (mode === "ACCOMPAGNE") return "Validés par EODA";
  return audience === "CLIENT" ? "Acceptés par vous" : "Acceptés par la structure";
}
