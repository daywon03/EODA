// ─────────────────────────────────────────────────────────────────────────────
// LA CONSIGNE D'ANALYSE — la seule règle qui la valide, partagée.
//
// « Dans la partie commentaire du document, ça serait bien si on peut lui donner des
// précisions pour l'analyse, ou quelque directive qui rentre dans l'analyse, et
// pouvoir la prendre en compte ou non avec un bouton » (Damon, 20/10/2026).
//
// Une consigne est une note LIBRE de la consultante sur CE document — « c'est la
// synthèse 2025, pas le questionnaire vierge ». Elle oriente ce que le modèle cherche ;
// elle ne peut ni changer son rôle, ni lui faire déclarer un document conforme (le
// prompt le dit, `analysis-prompt.ts` le porte).
//
// Deux faits, deux colonnes, jamais confondus : le TEXTE (`analysisDirective`) et le
// drapeau (`directiveInAnalysis`). Éteindre le drapeau ne doit pas perdre le texte —
// c'est une note de travail, pas un champ qu'on efface pour la désactiver.
//
// Ce fichier existe pour deux raisons mécaniques :
//   1. `lib/actions/document.ts` porte `"use server"` : il ne peut exporter QUE des
//      fonctions asynchrones. Une constante qui y vivrait casserait la construction.
//   2. La longueur maximale et le refus d'une consigne vide active sont des RÈGLES :
//      elles se testent ici, une fois, et pas dans un composant qui les recopierait.
//
// Règles PURES : ni Prisma, ni React.
// ─────────────────────────────────────────────────────────────────────────────

// 2 000 caractères : assez pour situer un document et dire ce qu'on y cherche, trop
// peu pour y glisser un mode d'emploi qui remplacerait le référentiel.
export const MAX_ANALYSIS_DIRECTIVE_LENGTH = 2000;

export type DirectiveDecision =
  | { directive: string | null; includeInAnalysis: boolean }
  | { error: string };

/**
 * Normalise et valide une consigne reçue d'un formulaire.
 *
 * - le texte est découpé des espaces de bord ; vide, il vaut `null` en base ;
 * - une consigne trop longue est refusée, jamais tronquée en silence : une note
 *   coupée au milieu d'une phrase ferait dire au modèle autre chose que ce qu'elle dit ;
 * - activer une consigne VIDE est refusé : un bouton qui semble agir et ne transmet
 *   rien vaut moins qu'un message clair.
 */
export function decideAnalysisDirective(
  rawDirective: unknown,
  rawInclude: unknown
): DirectiveDecision {
  if (typeof rawDirective !== "string" || typeof rawInclude !== "boolean") {
    return { error: "Valeur invalide." };
  }
  const directive = rawDirective.trim();
  if (directive.length > MAX_ANALYSIS_DIRECTIVE_LENGTH) {
    return { error: `La consigne ne peut pas dépasser ${MAX_ANALYSIS_DIRECTIVE_LENGTH} caractères.` };
  }
  if (rawInclude && directive.length === 0) {
    return { error: "Écrivez la consigne avant de la faire prendre en compte." };
  }
  return { directive: directive.length > 0 ? directive : null, includeInAnalysis: rawInclude };
}

/**
 * Ce que le modèle reçoit RÉELLEMENT pour cette analyse.
 *
 * `undefined` — et non une chaîne vide — quand le drapeau est éteint : le prompt ne
 * doit pas afficher un bloc `<consignes_consultante>` vide, qui laisserait croire
 * qu'une consigne a été transmise. C'est aussi ce qui permet à `analyzeVersion`
 * d'écrire `analysisDirectiveUsed` : ce qui a été transmis, ou rien.
 */
export function directiveForAnalysis(input: {
  analysisDirective: string | null;
  directiveInAnalysis: boolean;
}): string | undefined {
  if (!input.directiveInAnalysis) return undefined;
  const trimmed = input.analysisDirective?.trim();
  return trimmed ? trimmed : undefined;
}
