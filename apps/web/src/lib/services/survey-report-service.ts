import { ACTION_PROPOSAL_THRESHOLD } from "@/content/enquete";
import { gradeLabel, type TemplateStats } from "./survey-stats-service";

// ─────────────────────────────────────────────────────────────────────────────
// DE L'ENQUÊTE AU PLAN D'ACTION — service PUR (lot C).
//
// PROPOSE, n'écrit rien : une action par question sous 75 % (seuil « Satisfaisant »
// de la grille de Sandrine), une action de mise à jour des dossiers si l'indicateur
// de contrôle a des « Non » / « Je ne sais pas ». La structure (ou le cabinet) coche
// ce qu'elle retient ; l'action serveur recalcule les propositions avant d'écrire —
// jamais ce que le navigateur prétend. Les titres ne nomment personne.
// ─────────────────────────────────────────────────────────────────────────────

export type SurveyActionProposal = {
  // Clé stable : questionnaire + question (ou « controle »).
  key: string;
  title: string;
  reason: string;
};

export function proposeSurveyActions(stats: readonly TemplateStats[]): SurveyActionProposal[] {
  return stats.flatMap((template) => {
    const lowQuestions = template.questions
      .filter((q) => !q.isControl && q.rate !== null && q.rate < ACTION_PROPOSAL_THRESHOLD)
      .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0))
      .map((q) => ({
        key: `${template.templateCode}:${q.questionId}`,
        title: `Enquête : améliorer « ${q.shortLabel} »`,
        reason: `${q.rate} % de satisfaction (${gradeLabel(q.grade)}) sur ${q.counted} réponses — questionnaire ${template.templateCode === "PERSONNE" ? "personne" : "famille"}.`,
      }));
    const control =
      template.controlAlerts > 0
        ? [
            {
              key: `${template.templateCode}:controle`,
              title: "Enquête : mettre à jour la personne à prévenir dans les dossiers",
              reason: `${template.controlAlerts} réponse(s) « Non » ou « Je ne sais pas » à la question sur la personne à prévenir.`,
            },
          ]
        : [];
    return [...lowQuestions, ...control];
  });
}

// Retenir uniquement les clés DEMANDÉES qui sont encore proposées, et pas déjà
// présentes dans le plan d'action (titre identique) : l'écriture reste idempotente.
export function selectSurveyActionsToCreate(
  proposals: readonly SurveyActionProposal[],
  requestedKeys: readonly string[],
  existingTitles: readonly string[]
): SurveyActionProposal[] {
  const requested = new Set(requestedKeys);
  const existing = new Set(existingTitles);
  return proposals.filter((p) => requested.has(p.key) && !existing.has(p.title));
}

// ── Export CSV AGRÉGÉ ──────────────────────────────────────────────────────────
// Une ligne par question : jamais une ligne par répondant. Séparateur « ; » et BOM
// (ouverture correcte dans un tableur français), champs échappés — y compris contre
// l'injection de formule (=, +, -, @ en tête de cellule).
import { csvCell } from "./csv-cell";
export { csvCell };

export function buildSurveyCsv(stats: readonly TemplateStats[]): string {
  const header = ["Questionnaire", "Question", "Réponses", "Comptées", "Taux (%)", "Niveau", "À mettre à jour"];
  const rows = stats.flatMap((template) =>
    template.questions.map((q) => [
      template.title,
      q.shortLabel,
      q.answered,
      q.counted,
      q.isControl ? null : q.rate,
      q.isControl ? "Indicateur de contrôle" : gradeLabel(q.grade),
      q.isControl ? q.alerts : null,
    ])
  );
  const totals = stats.map((t) => [t.title, "Taux global", t.responses, null, t.rate, gradeLabel(t.grade), t.controlAlerts]);
  return `﻿${[header, ...rows, ...totals].map((row) => row.map(csvCell).join(";")).join("\r\n")}\r\n`;
}
