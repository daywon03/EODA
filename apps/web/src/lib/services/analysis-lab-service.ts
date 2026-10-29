import type { AnalysisVerdict } from "@eoda/database";
import type { DocumentAnalysisResult } from "@/lib/llm/llm-analysis-port";

// ─────────────────────────────────────────────────────────────────────────────
// LABORATOIRE D'ANALYSE — règles pures (29/10/2026).
//
// Résumer un résultat pour le comparer d'un coup d'œil à un autre, lire un verdict
// reçu, compter les verdicts par version de prompt. Ni Prisma, ni session.
// ─────────────────────────────────────────────────────────────────────────────

export type AnalysisSummary = {
  present: number;
  missing: number;
  suggestions: number;
  covered: number;
  partial: number;
  absent: number;
  extraCriteria: number;
  natureMismatch: boolean;
};

export function summarizeAnalysis(result: DocumentAnalysisResult): AnalysisSummary {
  const coverage = result.criteriaCoverage;
  return {
    present: result.elementsPresents.length,
    missing: result.elementsManquants.length,
    suggestions: result.suggestionsCorrection.length,
    covered: coverage.filter((c) => c.status === "couvert").length,
    partial: coverage.filter((c) => c.status === "partiel").length,
    absent: coverage.filter((c) => c.status === "absent").length,
    extraCriteria: result.criteresSupplementaires.length,
    natureMismatch: result.natureObservee?.correspondAuType === false,
  };
}

export const ANALYSIS_VERDICT_LABELS: Record<AnalysisVerdict, string> = {
  BON: "Bon",
  A_REVOIR: "À revoir",
};

export const VERDICT_NOTE_MAX = 1000;

export function parseVerdict(value: unknown): AnalysisVerdict | null {
  return value === "BON" || value === "A_REVOIR" ? value : null;
}

// Note de la consultante : texte libre borné, espaces resserrés, vide = pas de note.
export function normalizeVerdictNote(value: unknown): string | null | { error: string } {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return { error: "Note invalide." };
  const note = value.replace(/\s+/g, " ").trim();
  if (!note) return null;
  if (note.length > VERDICT_NOTE_MAX) return { error: `La note ne peut pas dépasser ${VERDICT_NOTE_MAX} caractères.` };
  return note;
}

// Bilan par version de prompt : combien d'essais, combien jugés bons / à revoir.
// C'est ce qui permet de CHOISIR la version par défaut sur des faits.
export type VariantTally = { variant: string; trials: number; good: number; toReview: number; unjudged: number };

export function tallyByVariant(trials: readonly { promptVariant: string; verdict: AnalysisVerdict | null }[]): VariantTally[] {
  const byVariant = new Map<string, VariantTally>();
  for (const trial of trials) {
    const tally = byVariant.get(trial.promptVariant) ?? { variant: trial.promptVariant, trials: 0, good: 0, toReview: 0, unjudged: 0 };
    tally.trials += 1;
    if (trial.verdict === "BON") tally.good += 1;
    else if (trial.verdict === "A_REVOIR") tally.toReview += 1;
    else tally.unjudged += 1;
    byVariant.set(trial.promptVariant, tally);
  }
  return [...byVariant.values()];
}
