import type { SurveyTemplateCode } from "@/lib/hds/beneficiary-data-port";
import { SURVEY_FAMILLE } from "./famille";
import { SURVEY_PERSONNE } from "./personne";
import { SURVEY_SCALES } from "./scales";
import type { SurveyScaleOption, SurveyScaleQuestion, SurveyTemplate } from "./types";

export * from "./types";
export { SURVEY_SCALES } from "./scales";

export const SURVEY_TEMPLATES: readonly SurveyTemplate[] = [SURVEY_PERSONNE, SURVEY_FAMILLE];

// Un code reçu (formulaire, base) est une entrée non fiable : inconnu ⇒ null.
export function findSurveyTemplate(code: string): SurveyTemplate | null {
  return SURVEY_TEMPLATES.find((template) => template.code === code) ?? null;
}

export function surveyTemplateFor(code: SurveyTemplateCode): SurveyTemplate {
  return code === "PERSONNE" ? SURVEY_PERSONNE : SURVEY_FAMILLE;
}

export function scaleOptions(question: SurveyScaleQuestion): readonly SurveyScaleOption[] {
  return SURVEY_SCALES[question.scale].options;
}

export { missingAnswerHint } from "./hints";

// ─────────────────────────────────────────────────────────────────────────────
// SEUILS DU DÉPOUILLEMENT — ceux de la grille de dépouillement v02 (07/10) :
// ≥ 90 Excellent, ≥ 75 Satisfaisant, ≥ 60 À surveiller, sinon Point d'alerte.
// Le plan d'action se PROPOSE sous le seuil « Satisfaisant » (75 %). La maquette
// disait « sous 70 % » : le seuil de la grille de Sandrine l'emporte.
// ─────────────────────────────────────────────────────────────────────────────
export const SATISFACTION_GRADES = [
  { min: 90, grade: "EXCELLENT", label: "Excellent" },
  { min: 75, grade: "SATISFAISANT", label: "Satisfaisant" },
  { min: 60, grade: "A_SURVEILLER", label: "À surveiller" },
  { min: 0, grade: "ALERTE", label: "Point d'alerte" },
] as const;

export const ACTION_PROPOSAL_THRESHOLD = 75;

// Campagne d'enquête : une par an pour une structure d'environ 50 personnes
// (context/10 §6 Participation). Le portail compte l'avancement sur 12 mois.
export const SURVEY_CAMPAIGN_MONTHS = 12;
