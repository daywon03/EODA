import {
  SATISFACTION_GRADES,
  SURVEY_SCALES,
  type SurveyScaleQuestion,
  type SurveyTemplate,
} from "@/content/enquete";
import type { SurveyAnswerInput, SurveyChoice, SurveyTemplateCode } from "@/lib/hds/beneficiary-data-port";

// ─────────────────────────────────────────────────────────────────────────────
// DÉPOUILLEMENT DE L'ENQUÊTE — service PUR (lot C).
//
// Reproduit la grille de dépouillement v02 de Sandrine : score par question =
// moyenne pondérée des réponses (« Non concerné », « Cela ne m'est pas arrivé » et
// « Ne se prononce pas » exclus), taux global = toutes les réponses pondérées du
// questionnaire, indicateur de contrôle hors taux.
//
// NON NOMINATIF par construction : l'entrée ne contient que le questionnaire, sa
// version et les réponses — jamais la personne. Les textes libres sont rendus sans
// auteur ni date.
// ─────────────────────────────────────────────────────────────────────────────

export type SurveyResponseForStats = {
  templateCode: SurveyTemplateCode;
  templateVersion: number;
  answers: readonly SurveyAnswerInput[];
};

export type SatisfactionGrade = (typeof SATISFACTION_GRADES)[number]["grade"];

export type QuestionStats = {
  questionId: string;
  shortLabel: string;
  isControl: boolean;
  // Réponses reçues (exclues comprises) / réponses entrant dans le calcul.
  answered: number;
  counted: number;
  // Pourcentage arrondi à l'unité ; null tant qu'aucune réponse ne compte.
  rate: number | null;
  grade: SatisfactionGrade | null;
  // Contrôle : nombre de « Non » / « Je ne sais pas ».
  alerts: number;
  distribution: { choice: SurveyChoice; label: string; count: number }[];
};

export type TemplateStats = {
  templateCode: SurveyTemplateCode;
  title: string;
  responses: number;
  rate: number | null;
  grade: SatisfactionGrade | null;
  controlAlerts: number;
  questions: QuestionStats[];
  ruleProposals: string[];
  verbatims: string[];
};

export function gradeFor(rate: number | null): SatisfactionGrade | null {
  if (rate === null) return null;
  return SATISFACTION_GRADES.find((step) => rate >= step.min)?.grade ?? "ALERTE";
}

export function gradeLabel(grade: SatisfactionGrade | null): string {
  if (!grade) return "Pas encore de données";
  return SATISFACTION_GRADES.find((step) => step.grade === grade)?.label ?? "";
}

function weightOf(question: SurveyScaleQuestion, choice: SurveyChoice): number | null {
  return SURVEY_SCALES[question.scale].options.find((option) => option.choice === choice)?.weight ?? null;
}

function isValidChoice(question: SurveyScaleQuestion, choice: SurveyChoice): boolean {
  return SURVEY_SCALES[question.scale].options.some((option) => option.choice === choice);
}

function toPercent(sum: number, count: number): number | null {
  return count > 0 ? Math.round((sum / count) * 100) : null;
}

function questionStats(question: SurveyScaleQuestion, choices: readonly SurveyChoice[]): { stats: QuestionStats; sum: number } {
  const scale = SURVEY_SCALES[question.scale];
  const valid = choices.filter((choice) => isValidChoice(question, choice));
  let sum = 0;
  let counted = 0;
  for (const choice of valid) {
    const weight = scale.isControl ? null : weightOf(question, choice);
    if (weight === null) continue;
    sum += weight;
    counted += 1;
  }
  const rate = toPercent(sum, counted);
  const stats: QuestionStats = {
    questionId: question.id,
    shortLabel: question.shortLabel,
    isControl: scale.isControl,
    answered: valid.length,
    counted,
    rate,
    grade: gradeFor(rate),
    alerts: valid.filter((choice) => scale.options.some((o) => o.choice === choice && o.alert)).length,
    distribution: scale.options.map((option) => ({
      choice: option.choice,
      label: option.label,
      count: valid.filter((choice) => choice === option.choice).length,
    })),
  };
  return { stats, sum };
}

// Seules les réponses à la version COURANTE du questionnaire sont comptées : une
// question reformulée n'est plus la même question.
export function computeTemplateStats(
  template: SurveyTemplate,
  responses: readonly SurveyResponseForStats[]
): TemplateStats {
  const own = responses.filter((r) => r.templateCode === template.code && r.templateVersion === template.version);
  const answersFor = (questionId: string) =>
    own.flatMap((r) => r.answers.filter((a) => a.questionId === questionId));

  const scaleQuestions = template.questions.filter((q): q is SurveyScaleQuestion => q.kind === "SCALE");
  const detailed = scaleQuestions.map((question) =>
    questionStats(
      question,
      answersFor(question.id).flatMap((a) => (a.choice ? [a.choice] : []))
    )
  );
  const rated = detailed.filter((q) => !q.stats.isControl);
  const rate = toPercent(
    rated.reduce((total, q) => total + q.sum, 0),
    rated.reduce((total, q) => total + q.stats.counted, 0)
  );

  const texts = (predicate: (ruleProposal: boolean) => boolean) =>
    template.questions
      .filter((q) => q.kind === "TEXT" && predicate(Boolean(q.feedsRuleProposals)))
      .flatMap((q) => answersFor(q.id).flatMap((a) => (a.freeText?.trim() ? [a.freeText.trim()] : [])));

  return {
    templateCode: template.code,
    title: template.title,
    responses: own.length,
    rate,
    grade: gradeFor(rate),
    controlAlerts: detailed.filter((q) => q.stats.isControl).reduce((total, q) => total + q.stats.alerts, 0),
    questions: detailed.map((q) => q.stats),
    ruleProposals: texts((isRule) => isRule),
    verbatims: texts((isRule) => !isRule),
  };
}

// MINIMISATION (décision de Damon, 14/10/2026) : le cabinet ne lit pas les
// commentaires libres. Un texte libre peut contenir un nom — celui de la personne,
// d'un proche ou d'un intervenant — et l'agrégat ne le neutralise pas. Les chiffres
// restent ; les textes (idées ET propositions sur le règlement) sont vidés. La
// structure, elle, garde ses commentaires.
export function withoutFreeTexts(stats: TemplateStats): TemplateStats {
  return { ...stats, verbatims: [], ruleProposals: [] };
}
