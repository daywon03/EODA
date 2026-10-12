import type { PracticeAnswerValue } from "@eoda/database";
import type { PracticeQuestion, PracticeQuestionnaire } from "@/content/pratiques/types";
import { PROOF_PILLS, type CriterionProofRow } from "./criteria-proof-service";

// ─────────────────────────────────────────────────────────────────────────────
// QUESTIONS SUR LES PRATIQUES — règles pures (tranche N7).
//
// Une question par critère IMPÉRATIF de la structure (16 SAD aide, 17 SAD mixte —
// la liste vient de la base, jamais d'un nombre écrit). Le texte vient du contenu
// versionné ; un impératif sans question écrite reçoit une formulation de repli tirée
// de son intitulé, plutôt que de disparaître du questionnaire.
// Les réponses sont append-only : la plus récente par critère fait foi, et elle n'est
// « à jour » que si elle répond à la formulation courante.
// ─────────────────────────────────────────────────────────────────────────────

export const PRACTICE_ANSWER_VALUES = ["OUI", "EN_PARTIE", "PAS_ENCORE", "NE_SAIS_PAS"] as const satisfies readonly PracticeAnswerValue[];

export const PRACTICE_ANSWER_LABELS: Record<PracticeAnswerValue, string> = {
  OUI: "Oui",
  EN_PARTIE: "En partie",
  PAS_ENCORE: "Pas encore",
  NE_SAIS_PAS: "Je ne sais pas",
};

// Valeur reçue d'un formulaire : jamais castée (CLAUDE.md §5 bis).
export function parsePracticeAnswer(raw: unknown): PracticeAnswerValue | null {
  return typeof raw === "string" && (PRACTICE_ANSWER_VALUES as readonly string[]).includes(raw)
    ? (raw as PracticeAnswerValue)
    : null;
}

export const MAX_PRACTICE_TEXT_LENGTH = 2000;

export type PracticeTextCheck = { ok: true; text: string | null } | { ok: false; error: string };

export function validatePracticeText(raw: unknown): PracticeTextCheck {
  if (raw === null || raw === undefined) return { ok: true, text: null };
  if (typeof raw !== "string") return { ok: false, error: "Réponse illisible." };
  const text = raw.trim();
  if (text.length > MAX_PRACTICE_TEXT_LENGTH) {
    return { ok: false, error: `Votre texte est trop long (${MAX_PRACTICE_TEXT_LENGTH} caractères au plus).` };
  }
  return { ok: true, text: text.length > 0 ? text : null };
}

export type ImperativeForPractice = Pick<
  CriterionProofRow,
  "id" | "code" | "label" | "status" | "expectedDocumentTypeIds"
>;

export type ResolvedPracticeQuestion = PracticeQuestion & {
  criterionId: string;
  criterionLabel: string;
  // Repli tiré de l'intitulé : aucune question n'est encore écrite pour ce critère.
  isFallback: boolean;
};

export const FALLBACK_QUESTION_VERSION = 0;

// Questions dans l'ordre des codes ; une question écrite pour un critère que la
// structure n'a pas (3.6.2 chez un SAD aide) n'apparaît jamais.
export function resolvePracticeQuestions(
  imperatives: readonly ImperativeForPractice[],
  questionnaire: PracticeQuestionnaire
): ResolvedPracticeQuestion[] {
  const byCode = new Map(questionnaire.questions.map((q) => [q.criterionCode, q]));
  return [...imperatives]
    .sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }))
    .map((criterion) => {
      const written = byCode.get(criterion.code);
      const base: PracticeQuestion = written ?? {
        criterionCode: criterion.code,
        version: FALLBACK_QUESTION_VERSION,
        theme: criterion.label,
        question: `Comment faites-vous, au quotidien, pour ce point : « ${criterion.label} » ? Racontez-nous.`,
        proofHint: "Une trace écrite aide : une procédure, un compte rendu, une feuille d'émargement.",
      };
      return { ...base, criterionId: criterion.id, criterionLabel: criterion.label, isFallback: !written };
    });
}

export type PracticeAnswerFacts = {
  criterionId: string;
  questionVersion: number;
  answer: PracticeAnswerValue;
  text: string | null;
  answeredAt: Date;
};

export function latestAnswersByCriterion(answers: readonly PracticeAnswerFacts[]): Map<string, PracticeAnswerFacts> {
  const latest = new Map<string, PracticeAnswerFacts>();
  for (const answer of answers) {
    const current = latest.get(answer.criterionId);
    if (!current || answer.answeredAt > current.answeredAt) latest.set(answer.criterionId, answer);
  }
  return latest;
}

export function isAnswerCurrent(answer: PracticeAnswerFacts | undefined, question: { version: number }): boolean {
  return answer !== undefined && answer.questionVersion === question.version;
}

export function describePracticeProgress(
  questions: readonly ResolvedPracticeQuestion[],
  latest: ReadonlyMap<string, PracticeAnswerFacts>
): { answered: number; total: number; label: string } {
  const answered = questions.filter((q) => isAnswerCurrent(latest.get(q.criterionId), q)).length;
  const total = questions.length;
  return { answered, total, label: `${answered} réponse${answered > 1 ? "s" : ""} sur ${total}` };
}

// « Document lié » : les types attendus par la matrice pour ce critère, et ce que
// dit la preuve. Jamais « C'est bon » ni « conforme » : le statut de preuve, en mots.
export function describeLinkedDocuments(
  criterion: ImperativeForPractice,
  documentLabels: ReadonlyMap<string, string>
): string {
  const labels = criterion.expectedDocumentTypeIds.flatMap((id) => {
    const label = documentLabels.get(id);
    return label ? [label] : [];
  });
  if (labels.length === 0) return "Document lié : aucun pour le moment.";
  return `Document${labels.length > 1 ? "s" : ""} lié${labels.length > 1 ? "s" : ""} : ${labels.join(", ")} — ${PROOF_PILLS[criterion.status].label.toLowerCase()}.`;
}

// Index de la question demandée dans l'adresse (?q=3, base 1), borné.
export function parseQuestionIndex(raw: string | string[] | undefined, total: number): number {
  const value = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(value) || total === 0) return 0;
  return Math.min(Math.max(value, 1), total) - 1;
}
