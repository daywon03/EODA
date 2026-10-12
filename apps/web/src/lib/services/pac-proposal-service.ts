import type { EstablishmentUserRole } from "@eoda/database";
import { compareCriterionCodes } from "./criteria-proof-service";

// ─────────────────────────────────────────────────────────────────────────────
// PLAN D'ACTION TIRÉ DE L'AUTO-ÉVALUATION — règles PURES (N5, context/10 §6 « PAC »).
//
//  - seuls les critères cotés SOUS 4 génèrent une action (★ vaut 4, non coté = rien) ;
//  - une action = un VERBE concret sur un DOCUMENT nommé (la matrice validée dit quel
//    document prouve le critère) ;
//  - le pilote est une FONCTION, jamais un nom ;
//  - c'est une PROPOSITION : le cabinet coche ce qu'il garde, rien n'est écrit sans
//    ce geste (task.ts) ;
//  - un critère qui a déjà une action PAC ouverte n'en reçoit pas une seconde.
// ─────────────────────────────────────────────────────────────────────────────

export type PacDocument = { documentTypeLabel: string; documentId: string | null; deposited: boolean };

export type PacCriterionInput = {
  criterionId: string;
  code: string;
  label: string;
  score: number | null;
  isImperative: boolean;
  documents: readonly PacDocument[];
};

export type PacProposal = {
  criterionId: string;
  criterionCode: string;
  criterionLabel: string;
  score: number;
  isImperative: boolean;
  title: string;
  linkedDocumentId: string | null;
  ownerFunction: EstablishmentUserRole;
};

// Pilote proposé par défaut — une fonction, modifiable ensuite (réassignation).
export const DEFAULT_PAC_PILOT: EstablishmentUserRole = "RESPONSABLE_QUALITE";

export const PAC_TARGET_SCORE = 4;

// Le document visé : d'abord un document attendu PAS ENCORE déposé (il faut le
// rédiger), sinon le premier déposé (il faut le compléter). Sans document rattaché,
// l'action reste nommée par le critère.
function pickDocument(documents: readonly PacDocument[]): PacDocument | null {
  const sorted = [...documents].sort((a, b) => a.documentTypeLabel.localeCompare(b.documentTypeLabel, "fr"));
  return sorted.find((d) => !d.deposited) ?? sorted[0] ?? null;
}

export function buildPacTitle(code: string, document: PacDocument | null): string {
  if (document === null) return `Définir et tracer la preuve du critère ${code}`;
  return document.deposited
    ? `Compléter « ${document.documentTypeLabel} » pour le critère ${code}`
    : `Rédiger « ${document.documentTypeLabel} » pour le critère ${code}`;
}

export function proposePacActions(
  criteria: readonly PacCriterionInput[],
  openPacCriterionIds: ReadonlySet<string>
): PacProposal[] {
  return criteria
    .flatMap((c): PacProposal[] => {
      if (c.score === null || c.score >= PAC_TARGET_SCORE) return [];
      if (openPacCriterionIds.has(c.criterionId)) return [];
      const document = pickDocument(c.documents);
      return [
        {
          criterionId: c.criterionId,
          criterionCode: c.code,
          criterionLabel: c.label,
          score: c.score,
          isImperative: c.isImperative,
          title: buildPacTitle(c.code, document),
          linkedDocumentId: document?.documentId ?? null,
          ownerFunction: DEFAULT_PAC_PILOT,
        },
      ];
    })
    .sort((a, b) => Number(b.isImperative) - Number(a.isImperative) || compareCriterionCodes(a.criterionCode, b.criterionCode));
}
