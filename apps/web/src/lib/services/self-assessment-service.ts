import type { EstablishmentType, Rating, RequirementLevel } from "@eoda/database";
import { formatDate } from "./date-format-service";
import { computeWeightedAverage, scoreLabel } from "./scoring-service";
import type { Measure } from "./structure-sheet-service";

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-ÉVALUATION (cabinet) — règles d'affichage pures (tranche R4, maquettes v2).
//
// La cotation reste PAR ÉLÉMENT D'ÉVALUATION (décision 4 : c'est l'unité de Synaé
// et de l'export), affichée regroupée par critère. Les règles de cotation
// elles-mêmes (★ = 4, NC/RI exclus, RI chapitre 1, NC interdit sur impératif)
// vivent dans scoring-service.ts : ce fichier ne fait que les LIRE.
// Référence : .claude/context/02-referentiel-has.md §3.
// ─────────────────────────────────────────────────────────────────────────────

export type ElementFacts = {
  rating: Rating | null;
  suggestedBySystem: boolean;
  confirmedByUser: boolean;
  ratedAt: Date | null;
  ratedByName: string | null;
};

export type CriterionFacts = {
  requirementLevel: RequirementLevel;
  elements: readonly ElementFacts[];
};

// ── Attribution d'une cotation ───────────────────────────────────────────────

// Une suggestion machine non confirmée par un geste humain. Jamais « Proposé par
// EODA » : EODA engage sa parole, la plateforme propose (plan v2 §4).
export function isProposedByPlatform(element: ElementFacts): boolean {
  return element.suggestedBySystem && !element.confirmedByUser;
}

export type RatingAuthor = { text: string; kind: "platform" | "human" | "none" };

export function describeRatingAuthor(element: ElementFacts): RatingAuthor {
  if (isProposedByPlatform(element)) return { text: "Proposé par la plateforme", kind: "platform" };
  if (element.rating === null) return { text: "Pas encore coté", kind: "none" };
  const date = element.ratedAt ? formatDate(element.ratedAt) : null;
  if (element.ratedByName) {
    return { text: `Coté par ${element.ratedByName}${date ? ` · ${date}` : ""}`, kind: "human" };
  }
  // Cotation antérieure au suivi de l'auteur : on dit la date, on ne devine pas le nom.
  return { text: date ? `Coté le ${date}` : "Coté", kind: "human" };
}

// ── Filtres ──────────────────────────────────────────────────────────────────

export type AssessmentFilter = "ALL" | "IMPERATIFS" | "UNRATED" | "LOW" | "PROPOSED";

export const ASSESSMENT_FILTERS: readonly { id: AssessmentFilter; label: string }[] = [
  { id: "ALL", label: "Tous" },
  { id: "IMPERATIFS", label: "Impératifs" },
  { id: "UNRATED", label: "Non cotés" },
  { id: "LOW", label: "Cotés 1 ou 2" },
  { id: "PROPOSED", label: "Proposés par la plateforme" },
];

// Un critère est retenu par un filtre d'éléments dès qu'UN de ses éléments l'est :
// la cotation se fait à l'élément, l'affichage reste groupé par critère.
export function matchesFilter(criterion: CriterionFacts, filter: AssessmentFilter): boolean {
  switch (filter) {
    case "ALL":
      return true;
    case "IMPERATIFS":
      return criterion.requirementLevel === "IMPERATIF";
    case "UNRATED":
      return criterion.elements.some((e) => e.rating === null);
    case "LOW":
      return criterion.elements.some((e) => e.rating === "R1" || e.rating === "R2");
    case "PROPOSED":
      return criterion.elements.some(isProposedByPlatform);
  }
}

export function countByFilter(criteria: readonly CriterionFacts[]): Record<AssessmentFilter, number> {
  const counts = { ALL: 0, IMPERATIFS: 0, UNRATED: 0, LOW: 0, PROPOSED: 0 };
  for (const filter of ASSESSMENT_FILTERS) {
    counts[filter.id] = criteria.filter((c) => matchesFilter(c, filter.id)).length;
  }
  return counts;
}

// ── Cartes de synthèse ───────────────────────────────────────────────────────

export type RatedCount = { rated: number; total: number };

// « Coté » = une cotation enregistrée, NC et RI compris (l'élément est traité, même
// s'il sort de la moyenne). Une suggestion non confirmée n'est PAS une cotation.
export function countRatedElements(criteria: readonly CriterionFacts[]): RatedCount {
  const elements = criteria.flatMap((c) => c.elements);
  return { rated: elements.filter((e) => e.rating !== null).length, total: elements.length };
}

function formatScore(score: number): string {
  return `${score.toFixed(1).replace(".", ",")} / 4`;
}

// Moyenne générale : agrégation des scores de chapitre (E.E. → critère → … →
// chapitre → global, §3.2 point 4), où ★ compte 4 et NC/RI sont exclus dès
// l'élément. Rien de coté = « Non coté », sans jauge : un zéro mentirait.
export function describeAverageMeasure(chapterScores: readonly (number | null)[]): Measure {
  const label = "Moyenne des cotations";
  const average = computeWeightedAverage(chapterScores.map((score) => ({ score })));
  if (average === null) return { label, value: "Non coté", note: "Aucune cotation enregistrée" };
  return {
    label,
    value: formatScore(average),
    percent: Math.round((average / 4) * 100),
    note: `${scoreLabel(average)} · ★ compte 4, NC et RI hors moyenne`,
  };
}

export function describeChapterRatedMeasure(
  chapter: { number: number; name: string },
  count: RatedCount
): Measure {
  return {
    label: `Chapitre ${chapter.number}${chapter.name ? ` — ${chapter.name}` : ""}`,
    value: `${count.rated} / ${count.total}`,
    percent: count.total === 0 ? 0 : Math.round((count.rated / count.total) * 100),
    note: "Éléments d'évaluation cotés",
  };
}

// ── Périmètre ────────────────────────────────────────────────────────────────

// Le périmètre se DIT tel que la base le contient — jamais « 141 critères » ni le
// « 157 » commercial (CLAUDE.md §7). La base ne charge que la grille Synaé SAD aide
// (bilan 08/10 : SAD mixte non modélisé) : un SAD mixte est prévenu qu'il lui manque
// ses critères propres plutôt que de croire sa grille complète.
export function describeAssessmentScope(input: {
  criteriaCount: number;
  imperativesOnly: boolean;
  establishmentType: EstablishmentType;
}): string {
  const noun = input.imperativesOnly
    ? `${input.criteriaCount} critère${input.criteriaCount > 1 ? "s" : ""} impératif${input.criteriaCount > 1 ? "s" : ""}`
    : `${input.criteriaCount} critère${input.criteriaCount > 1 ? "s" : ""}`;
  const offer = input.imperativesOnly ? " · périmètre de l'offre souscrite" : "";
  const mixte =
    input.establishmentType === "SAD_MIXTE"
      ? " — les critères propres au SAD mixte ne sont pas encore chargés"
      : "";
  return `Auto-évaluation préparatoire · ${noun} (grille Synaé SAD aide)${offer}${mixte}`;
}
