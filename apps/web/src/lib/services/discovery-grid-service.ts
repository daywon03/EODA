import { DISCOVERY_GRID } from "@/content/decouverte/grille";
import type { DiscoveryField, DiscoveryGrid } from "@/content/decouverte/types";

// ─────────────────────────────────────────────────────────────────────────────
// GRILLE D'ENTRETIEN DÉCOUVERTE — lecture, validation, avancement. Règles PURES.
//
// La colonne `Prospect.discoveryAnswersJson` est un `Json` : à la relecture, ce
// n'est PAS une donnée de confiance. Elle a pu être écrite sous une version
// antérieure de la grille, contenir une question supprimée depuis, ou n'importe
// quelle forme si quelqu'un l'écrit à la main en base. Même discipline que
// `analysis-view-service` sur l'analyse documentaire : on normalise à la lecture, et
// ce qui ne rentre pas dans la grille courante est ignoré — jamais rendu tel quel.
//
// Corollaire volontaire : une réponse dont la question a disparu n'apparaît plus à
// l'écran, mais reste en base. Elle n'est pas perdue, elle n'est simplement plus
// affichée sous une question qui ne se pose plus.
// ─────────────────────────────────────────────────────────────────────────────

export type DiscoveryAnswers = Record<string, string>;

export function discoveryGrid(): DiscoveryGrid {
  return DISCOVERY_GRID;
}

export function discoveryFields(grid: DiscoveryGrid = DISCOVERY_GRID): DiscoveryField[] {
  return grid.sections.flatMap((section) => [...section.fields]);
}

// Normalise ce qui sort de la base en un dictionnaire de réponses sûr :
//   - seules les clés de la grille COURANTE sont retenues ;
//   - seules les valeurs texte sont retenues (un nombre, un objet, un tableau écrits
//     en base ne deviennent pas du texte par accident) ;
//   - une réponse vide ou blanche est traitée comme absente, sinon un espace
//     compterait comme une réponse dans l'avancement ;
//   - pour un champ à choix, une valeur hors liste est écartée : afficher un choix
//     qui n'existe plus laisserait croire qu'il est encore proposé.
export function normaliseDiscoveryAnswers(
  raw: unknown,
  grid: DiscoveryGrid = DISCOVERY_GRID
): DiscoveryAnswers {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};

  const source = raw as Record<string, unknown>;
  const answers: DiscoveryAnswers = {};

  for (const field of discoveryFields(grid)) {
    const value = source[field.id];
    if (typeof value !== "string") continue;

    const trimmed = value.trim();
    if (trimmed.length === 0) continue;

    if (field.kind === "CHOICE" && !(field.options ?? []).includes(trimmed)) continue;

    answers[field.id] = trimmed;
  }

  return answers;
}

// Valide et retient ce qui vient du FORMULAIRE. Même normalisation que la lecture —
// une seule fonction pour les deux : deux règles de validation, c'est une qui finira
// par accepter ce que l'autre refuse.
//
// Aucun champ n'est obligatoire, et c'est un choix : une découverte s'interrompt, se
// reprend, et une grille qui refuse d'être enregistrée à moitié ne sera pas remplie
// pendant l'appel — elle sera remplie après, de mémoire, ou pas du tout.
export function parseDiscoverySubmission(
  entries: Iterable<[string, string]>,
  grid: DiscoveryGrid = DISCOVERY_GRID
): DiscoveryAnswers {
  const submitted: Record<string, unknown> = {};
  for (const [key, value] of entries) submitted[key] = value;
  return normaliseDiscoveryAnswers(submitted, grid);
}

// Avancement de la grille, en pourcentage de questions renseignées. Sert à dire
// « découverte à 40 % » sur la fiche prospect : sans repère, on ne sait pas si la
// réunion a eu lieu ou si personne n'a rien saisi.
export function discoveryCompletionPercent(
  answers: DiscoveryAnswers,
  grid: DiscoveryGrid = DISCOVERY_GRID
): number {
  const fields = discoveryFields(grid);
  if (fields.length === 0) return 0;
  const answered = fields.filter((field) => (answers[field.id] ?? "").length > 0).length;
  return Math.round((answered / fields.length) * 100);
}

export function isDiscoveryStarted(answers: DiscoveryAnswers): boolean {
  return Object.keys(answers).length > 0;
}

// Ce que la grille apprend et qui doit être REDIT en évaluation des besoins. On ne
// recopie rien automatiquement dans l'offre : la grille documente une conversation,
// elle ne décide pas d'un périmètre — c'est Sandrine qui coche (§12.3).
//
// Quatre questions, choisies parce qu'elles font pencher le choix de la formule : qui
// porte la qualité en interne, ce qui existe déjà, ce que la structure peut mettre, et
// qui signe.
//
// L'échéance HAS et le type de SAD étaient dans cette liste et n'y sont plus : ils ont
// une colonne sur le prospect, l'écran d'évaluation des besoins les lit directement.
//
// ⚠️ Ces identifiants sont du texte : rien dans le langage ne les rattache à la
// grille, et une question renommée ferait simplement disparaître ses points saillants
// sans erreur. C'est arrivé au passage en v03. Le test « chaque identifiant saillant
// existe dans la grille » EST le garde-fou — ne pas le supprimer.
export const HIGHLIGHTED_DISCOVERY_FIELDS = [
  "pilotage_qualite",
  "plan_action",
  "budget_ordre_grandeur",
  "decideur",
] as const;

export function discoveryHighlights(
  answers: DiscoveryAnswers,
  grid: DiscoveryGrid = DISCOVERY_GRID
): { label: string; value: string }[] {
  const highlighted: readonly string[] = HIGHLIGHTED_DISCOVERY_FIELDS;
  return discoveryFields(grid)
    .filter((field) => highlighted.includes(field.id))
    .map((field) => ({ label: field.label, value: answers[field.id] ?? "" }))
    .filter((entry) => entry.value.length > 0);
}
