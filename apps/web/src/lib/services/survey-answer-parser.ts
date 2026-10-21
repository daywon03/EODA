import { SURVEY_SCALES, type SurveyChoiceQuestion, type SurveyTemplate } from "@/content/enquete";
import type { SurveyAnswerInput, SurveyChoice } from "@/lib/hds/beneficiary-data-port";

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE DES RÉPONSES D'ENQUÊTE REÇUES — service PUR (lot C).
//
// Le champ `answers` vient du navigateur : entrée HOSTILE. Chaque réponse doit
// désigner une question du questionnaire courant, un choix de SON échelle (ou un
// texte pour une question libre), une seule fois. Pas de cast d'enum : le choix est
// cherché dans l'échelle, jamais pris tel quel.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_FREE_TEXT_LENGTH = 1000;
// Précision d'un choix fermé (« Autre : … ») : une ligne sur le papier, pas un texte
// libre. Plus court exprès — ce n'est pas une zone de commentaire.
export const MAX_CHOICE_PRECISION_LENGTH = 200;
const MAX_RAW_LENGTH = 40_000;

// Une réponse à une question CHOICE arrive en `freeText`, sous la forme « Libellé »
// ou « Libellé : précision ». Le libellé est cherché PARMI les options de la question,
// jamais pris tel quel — pas de cast, même règle que les échelles.
// Trois issues distinctes : vide (facultatif, la question est sautée), invalide
// (l'enquête entière est refusée), ou une réponse normalisée.
type ChoiceAnswer = { kind: "skip" } | { kind: "invalid" } | { kind: "value"; freeText: string };

function parseChoiceAnswer(question: SurveyChoiceQuestion, raw: unknown): ChoiceAnswer {
  if (raw === undefined || raw === null || raw === "") return { kind: "skip" };
  if (typeof raw !== "string") return { kind: "invalid" };
  const text = raw.trim();
  if (!text) return { kind: "skip" };
  const [label, ...rest] = text.split(" : ");
  const option = question.options.find((candidate) => candidate === label?.trim());
  if (!option) return { kind: "invalid" };
  const precision = rest.join(" : ").trim();
  if (!precision) return { kind: "value", freeText: option };
  // Une précision n'a de sens que sur l'option ouverte du gabarit (« autre : .... »).
  if (question.otherOption !== option || precision.length > MAX_CHOICE_PRECISION_LENGTH) return { kind: "invalid" };
  return { kind: "value", freeText: `${option} : ${precision}` };
}

export type ParsedAnswers = { ok: true; value: SurveyAnswerInput[] } | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function parseSurveyAnswers(template: SurveyTemplate, raw: unknown): ParsedAnswers {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_RAW_LENGTH) return { ok: false, error: "Réponses illisibles." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Réponses illisibles." };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: "Réponses illisibles." };

  const seen = new Set<string>();
  const answers: SurveyAnswerInput[] = [];
  for (const item of parsed) {
    const entry = asRecord(item);
    const question = template.questions.find((q) => q.id === entry?.questionId);
    if (!entry || !question || seen.has(question.id)) return { ok: false, error: "Une réponse ne correspond à aucune question." };
    seen.add(question.id);
    if (question.kind === "TEXT") {
      const text = typeof entry.freeText === "string" ? entry.freeText.trim() : "";
      if (text.length > MAX_FREE_TEXT_LENGTH) return { ok: false, error: `Un texte dépasse ${MAX_FREE_TEXT_LENGTH} caractères.` };
      if (text) answers.push({ questionId: question.id, choice: null, freeText: text });
      continue;
    }
    if (question.kind === "CHOICE") {
      const parsedChoice = parseChoiceAnswer(question, entry.freeText);
      if (parsedChoice.kind === "invalid") return { ok: false, error: "Une réponse n'existe pas pour cette question." };
      if (parsedChoice.kind === "value") answers.push({ questionId: question.id, choice: null, freeText: parsedChoice.freeText });
      continue;
    }
    const option = SURVEY_SCALES[question.scale].options.find((o) => o.choice === entry.choice);
    if (!option) return { ok: false, error: "Une réponse n'existe pas pour cette question." };
    answers.push({ questionId: question.id, choice: option.choice satisfies SurveyChoice, freeText: null });
  }
  if (answers.every((a) => a.choice === null)) return { ok: false, error: "L'enquête ne contient aucune réponse." };
  return { ok: true, value: answers };
}
