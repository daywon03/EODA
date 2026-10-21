import { SURVEY_SCALES, type SurveyScaleQuestion, type SurveyTemplate } from "@/content/enquete";
import type { SurveyChoice, SurveyMode, SurveyRespondentKind, SurveyResponseRecord, SurveyTemplateCode } from "@/lib/hds/beneficiary-data-port";

// ─────────────────────────────────────────────────────────────────────────────
// ENQUÊTE DE SATISFACTION ANONYME — règles PURES (décision de Damon, 21/10/2026).
//
// Même questionnaire versionné que l'enquête nominative (content/enquete/), moins ce
// qui ne peut pas être anonyme :
//   - les questions LIBRES : un texte peut contenir un nom ou une information de santé ;
//   - les questions de CONTRÔLE du dossier (« la personne à prévenir est-elle à
//     jour ? ») : elles n'ont de sens que rattachées à UNE personne.
// Restent les questions d'échelle, qui font le taux de satisfaction et le plan
// d'action — exactement ce que la HAS demande de mesurer.
// ─────────────────────────────────────────────────────────────────────────────

// Durée d'un lien à usage unique : le temps qu'une famille le retrouve dans ses
// messages, pas une permanence. Provisoire, à confirmer avec Sandrine.
export const ANONYMOUS_SURVEY_LINK_TTL_HOURS = 30 * 24;
// Liens créés en une fois : une structure d'environ 50 personnes (context/10 §6),
// deux questionnaires par foyer.
export const MAX_ANONYMOUS_SURVEY_LINKS = 100;

// Ce qui est dit avant de commencer. Provisoire, à valider par Sandrine — et vrai :
// rien de ce qui est écrit ici ne dépend d'une promesse que le code ne tient pas.
export const ANONYMOUS_SURVEY_NOTICE =
  "Cette enquête est anonyme. On ne vous demande pas votre nom, et vos réponses ne sont reliées ni à vous ni à votre dossier. Il n'y a rien à écrire : vous choisissez une réponse à chaque question. Les réponses servent seulement à améliorer le service, en comptant toutes les réponses ensemble.";

export function anonymousQuestions(template: SurveyTemplate): SurveyScaleQuestion[] {
  return template.questions.filter(
    (q): q is SurveyScaleQuestion =>
      q.kind === "SCALE" && q.tag !== "CONTROLE_DOSSIER" && !SURVEY_SCALES[q.scale].isControl
  );
}

export function respondentKindFor(code: SurveyTemplateCode): SurveyRespondentKind {
  return code === "PERSONNE" ? "PERSONNE" : "PROCHE";
}

export type AnonymousAnswer = { questionId: string; choice: SurveyChoice };
export type ParsedAnonymousAnswers = { ok: true; value: AnonymousAnswer[] } | { ok: false; error: string };

const MAX_RAW_LENGTH = 20_000;

// Réponses reçues du navigateur : entrée HOSTILE. Toutes les questions retenues
// doivent avoir une réponse de LEUR échelle (« Ne se prononce pas » en est une) ;
// tout autre champ — un texte, une question inconnue — fait refuser l'envoi plutôt
// que d'être ignoré en silence.
export function parseAnonymousAnswers(template: SurveyTemplate, raw: unknown): ParsedAnonymousAnswers {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_RAW_LENGTH) return { ok: false, error: "Réponses illisibles." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Réponses illisibles." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { ok: false, error: "Réponses illisibles." };
  const entries = parsed as Record<string, unknown>;
  const questions = anonymousQuestions(template);
  const allowed = new Set(questions.map((q) => q.id));
  if (Object.keys(entries).some((id) => !allowed.has(id))) {
    return { ok: false, error: "Une réponse ne correspond à aucune question." };
  }
  const value: AnonymousAnswer[] = [];
  for (const question of questions) {
    const option = SURVEY_SCALES[question.scale].options.find((o) => o.choice === entries[question.id]);
    if (!option) return { ok: false, error: "Répondez à chaque question (« Je ne sais pas » est une réponse)." };
    value.push({ questionId: question.id, choice: option.choice });
  }
  return { ok: true, value };
}

// Jour de la réponse, à minuit UTC : la colonne est une DATE, l'heure n'est jamais gardée.
export function completedOnFor(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export type AnonymousResponseFacts = {
  id: string;
  templateCode: SurveyTemplateCode;
  templateVersion: number;
  respondentKind: SurveyRespondentKind;
  mode: SurveyMode;
  completedOn: Date;
  answers: readonly AnonymousAnswer[];
};

// Une réponse anonyme se dépouille avec les mêmes règles que les autres
// (`computeTemplateStats`) : sans personne, sans texte.
export function toSurveyRecord(response: AnonymousResponseFacts): SurveyResponseRecord {
  return {
    id: response.id,
    beneficiaryId: null,
    templateCode: response.templateCode,
    templateVersion: response.templateVersion,
    respondentKind: response.respondentKind,
    mode: response.mode,
    completedAt: response.completedOn,
    answers: response.answers.map((a) => ({ questionId: a.questionId, choice: a.choice, freeText: null })),
  };
}

// Nombre de liens demandé (champ de formulaire) : entier, borné.
export function parseLinkCount(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d{1,3}$/.test(raw.trim())) return null;
  const count = Number.parseInt(raw.trim(), 10);
  return count >= 1 && count <= MAX_ANONYMOUS_SURVEY_LINKS ? count : null;
}
