import { MAX_ACTION_TITLE_LENGTH } from "./action-item-service";

// ─────────────────────────────────────────────────────────────────────────────
// « DEMANDER À LA STRUCTURE » depuis un élément manquant relevé par l'analyse
// (09/11/2026). La consultante part d'un texte PRÉREMPLI — l'intitulé du document et
// l'élément attendu —, le corrige, puis l'envoie : une tâche `ActionItem` confiée à
// la structure (source DOCUMENT). Le texte de l'analyse ne part jamais par e-mail :
// l'e-mail ne dit que l'intitulé du type et « une information est attendue ». Pure.
// ─────────────────────────────────────────────────────────────────────────────

const squash = (text: string): string => text.replace(/\s+/g, " ").trim();

export function defaultInformationRequestTitle(documentLabel: string, missingElement: string): string {
  const prefix = `${squash(documentLabel)} : compléter « `;
  const suffix = " »";
  const element = squash(missingElement);
  const room = MAX_ACTION_TITLE_LENGTH - prefix.length - suffix.length;
  const fitted = element.length <= room ? element : `${element.slice(0, Math.max(0, room - 1)).trimEnd()}…`;
  return `${prefix}${fitted}${suffix}`;
}
