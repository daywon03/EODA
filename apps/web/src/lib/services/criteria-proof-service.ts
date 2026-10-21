import type { SupportMode } from "@eoda/database";
import type { PillSpec } from "@/lib/design/status-vocabulary";
import { isValidationCurrent } from "./document-workflow-service";

// ─────────────────────────────────────────────────────────────────────────────
// CRITÈRES & PREUVES — un critère est-il prouvé par les documents de la structure ?
// (tranche N4, maquette « Critères » de la fiche structure)
//
// ÉTAT DÉRIVÉ, jamais stocké (CLAUDE.md §7). Les preuves ATTENDUES d'un critère sont
// les types de documents rattachés par la matrice `DocumentTypeCriterion` (validée
// par CABINET_ADMIN). Pour chaque type attendu, on regarde le document de la
// structure :
//   - DÉPOSÉ  = il a une version ;
//   - PROUVÉ  = sa version courante a été relue par EODA (structure accompagnée :
//               `validatedAt` posé APRÈS le dépôt de cette version — D6, la parole
//               d'EODA) ou acceptée par la structure (autonomie : acceptation
//               encore valable pour cette version).
// Jamais « conforme » : le mot engage une évaluation que la plateforme ne fait pas.
//
//   Sans preuve  = aucun type attendu n'est déposé ;
//   En partie    = au moins un déposé, mais pas tous prouvés ;
//   Prouvé       = tous les types attendus sont prouvés ;
//   Non rattaché = la matrice ne rattache encore aucun document à ce critère.
//
// Règles PURES : ni Prisma (types seulement), ni horloge.
// ─────────────────────────────────────────────────────────────────────────────

export type ProofStatus = "PROUVE" | "EN_PARTIE" | "SANS_PREUVE" | "NON_RATTACHE";

export type ProofDocumentFacts = {
  documentTypeId: string;
  versionUploadedAt: Date | null;
  validatedAt: Date | null;
  clientAcceptedAt: Date | null;
  // Version courante déposée par EODA (et non par la structure) — cf. isValidationCurrent.
  versionByCabinet?: boolean;
};

export function isDocumentDeposited(doc: ProofDocumentFacts): boolean {
  return doc.versionUploadedAt !== null;
}

export function isDocumentProven(doc: ProofDocumentFacts, mode: SupportMode): boolean {
  const uploadedAt = doc.versionUploadedAt;
  if (uploadedAt === null) return false;
  // Accompagné : la MÊME règle que le panneau du document (« Validé »), une seule
  // fonction pour les deux écrans (21/10/2026).
  if (mode === "ACCOMPAGNE") {
    return isValidationCurrent({
      validatedAt: doc.validatedAt,
      versionUploadedAt: uploadedAt,
      versionByCabinet: doc.versionByCabinet ?? false,
    });
  }
  return doc.clientAcceptedAt !== null && doc.clientAcceptedAt >= uploadedAt;
}

export type CriterionProof = {
  status: ProofStatus;
  expected: number;
  deposited: number;
  proven: number;
};

export function deriveCriterionProof(
  expectedDocumentTypeIds: readonly string[],
  documentsByType: ReadonlyMap<string, ProofDocumentFacts>,
  mode: SupportMode
): CriterionProof {
  const expectedIds = [...new Set(expectedDocumentTypeIds)];
  const docs = expectedIds.flatMap((id) => {
    const doc = documentsByType.get(id);
    return doc ? [doc] : [];
  });
  const deposited = docs.filter(isDocumentDeposited).length;
  const proven = docs.filter((d) => isDocumentProven(d, mode)).length;
  const expected = expectedIds.length;

  let status: ProofStatus;
  if (expected === 0) status = "NON_RATTACHE";
  else if (proven === expected) status = "PROUVE";
  else if (deposited === 0) status = "SANS_PREUVE";
  else status = "EN_PARTIE";
  return { status, expected, deposited, proven };
}

export type CriterionProofSource = {
  id: string;
  code: string;
  label: string;
  chapterNumber: number;
  isImperative: boolean;
  expectedDocumentTypeIds: readonly string[];
};

// La ligne garde ses types attendus : « Mon diagnostic » (N6) en dérive ses actions
// prioritaires (quels documents prouveraient le plus d'impératifs sans preuve).
export type CriterionProofRow = CriterionProofSource & CriterionProof;

// « 1.10.2 » avant « 1.2.1 » serait l'ordre alphabétique : on compare nombre à nombre.
export function compareCriterionCodes(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function buildCriteriaProofRows(
  criteria: readonly CriterionProofSource[],
  documents: readonly ProofDocumentFacts[],
  mode: SupportMode
): CriterionProofRow[] {
  const byType = new Map(documents.map((d) => [d.documentTypeId, d]));
  return criteria
    .map((criterion) => ({
      ...criterion,
      ...deriveCriterionProof(criterion.expectedDocumentTypeIds, byType, mode),
    }))
    .sort((a, b) => compareCriterionCodes(a.code, b.code));
}

export type ImperativesProof = { proven: number; total: number };

export function countImperativesProven(rows: readonly Pick<CriterionProofRow, "isImperative" | "status">[]): ImperativesProof {
  const imperatives = rows.filter((r) => r.isImperative);
  return { proven: imperatives.filter((r) => r.status === "PROUVE").length, total: imperatives.length };
}

// Impératifs EN PARTIE : au moins une pièce déposée, pas encore toutes prouvées.
// « Prouvé » exige TOUTES les pièces attendues (règle inchangée) : sans ce second
// compte, un cadre à « 0 / 16 » laissait croire que les documents déjà relus ne
// comptaient pour rien (constaté le 21/10/2026 sur le pilote, 7 documents validés).
export function countImperativesInProgress(rows: readonly Pick<CriterionProofRow, "isImperative" | "status">[]): number {
  return rows.filter((r) => r.isImperative && r.status === "EN_PARTIE").length;
}

// ── Le détail des preuves d'un critère (21/10/2026) ──────────────────────────
// « Savoir quels documents ont été mis comme preuve » : un critère liste chacun de
// ses documents attendus avec SON état, par la même règle que le statut du critère
// (isDocumentProven) — jamais un second calcul.
export type EvidenceState = "PROUVEE" | "A_RELIRE" | "ABSENTE";

export type EvidenceItem = { documentTypeId: string; label: string; state: EvidenceState };

export function describeEvidence(
  expectedDocumentTypeIds: readonly string[],
  documentsByType: ReadonlyMap<string, ProofDocumentFacts>,
  labels: ReadonlyMap<string, string>,
  mode: SupportMode
): EvidenceItem[] {
  const order: Record<EvidenceState, number> = { A_RELIRE: 0, ABSENTE: 1, PROUVEE: 2 };
  return [...new Set(expectedDocumentTypeIds)]
    .map((documentTypeId): EvidenceItem => {
      const doc = documentsByType.get(documentTypeId);
      const state: EvidenceState = !doc || !isDocumentDeposited(doc) ? "ABSENTE" : isDocumentProven(doc, mode) ? "PROUVEE" : "A_RELIRE";
      return { documentTypeId, label: labels.get(documentTypeId) ?? "Document", state };
    })
    // Ce qui reste à faire d'abord : à relire, puis à déposer, puis ce qui est acquis.
    .sort((a, b) => order[a.state] - order[b.state] || a.label.localeCompare(b.label, "fr"));
}

export const EVIDENCE_PILLS: Record<EvidenceState, PillSpec> = {
  PROUVEE: { tone: "ok", label: "Prouvée", glyph: "✓" },
  A_RELIRE: { tone: "progress", label: "Déposée, pas encore relue", glyph: "◐" },
  ABSENTE: { tone: "fix", label: "Pas déposée", glyph: "○" },
};

// Le même état, dans les mots du PORTAIL (« les deux portails ne regardent pas la même
// chose », 26/08) : accompagnée, c'est EODA qui relit ; en autonomie, c'est la
// structure qui accepte — jamais « validé » ni « conforme ».
export function clientEvidencePill(state: EvidenceState, mode: SupportMode): PillSpec {
  if (state === "PROUVEE") {
    return mode === "ACCOMPAGNE"
      ? { tone: "ok", label: "Relue par EODA", glyph: "✓" }
      : { tone: "ok", label: "Acceptée par vous", glyph: "✓" };
  }
  if (state === "A_RELIRE") {
    return mode === "ACCOMPAGNE"
      ? { tone: "progress", label: "Reçue, EODA la relit", glyph: "◐" }
      : { tone: "progress", label: "À vérifier par vous", glyph: "◐" };
  }
  return { tone: "fix", label: "À déposer", glyph: "○" };
}

export type ProofFilter = "TOUS" | "IMPERATIFS";

export function parseProofFilter(raw: string | string[] | undefined): ProofFilter {
  return raw === "IMPERATIFS" ? "IMPERATIFS" : "TOUS";
}

export function filterProofRows<T extends { isImperative: boolean }>(rows: readonly T[], filter: ProofFilter): T[] {
  return filter === "IMPERATIFS" ? rows.filter((r) => r.isImperative) : [...rows];
}

// Pastilles : glyphe + mot, jamais la couleur seule.
export const PROOF_PILLS: Record<ProofStatus, PillSpec> = {
  PROUVE: { label: "Prouvé", glyph: "✓", tone: "ok" },
  EN_PARTIE: { label: "En partie", glyph: "◐", tone: "progress" },
  SANS_PREUVE: { label: "Sans preuve", glyph: "○", tone: "fix" },
  NON_RATTACHE: { label: "Aucun document rattaché", glyph: "–", tone: "neutral" },
};

// « 3 / 16 » : le libellé du cadre de la vue d'ensemble et de la colonne Structures.
export function describeImperativesProof(proof: ImperativesProof): string {
  return `${proof.proven} / ${proof.total}`;
}
