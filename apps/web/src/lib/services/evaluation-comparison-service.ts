import type { Rating } from "@eoda/database";
import { computeCriterionScore, computeWeightedAverage } from "./scoring-service";

// ─────────────────────────────────────────────────────────────────────────────
// DEUXIÈME AUTO-ÉVALUATION, COMPARABLE À LA PREMIÈRE — promesse de l'offre
// Excellence (§12.6, [3:54:12] : « 2ᵉ session d'auto-évaluation, comparable à la
// première »).
//
// Deux sessions existaient déjà en base — rien n'empêchait d'en ouvrir une seconde
// après avoir clos la première. Ce qui manquait, c'est la COMPARAISON : sans elle,
// refaire l'exercice produit deux photos qu'on regarde séparément, et la promesse
// commerciale (« montrer le progrès ») n'est pas tenue.
//
// Trois décisions de fond :
//
//   1. On compare des SCORES DE CRITÈRE, pas des cotations d'éléments. C'est le
//      critère qui est l'unité de langage de la HAS, et un critère peut progresser
//      alors qu'un de ses éléments recule.
//   2. Un critère coté d'un seul côté n'est PAS un progrès de +4 ni une chute de -4 :
//      c'est une comparaison impossible, et elle est dite comme telle. Inventer un
//      écart depuis une absence est le plus sûr moyen de faire mentir un rapport
//      remis au client.
//   3. NC et RI sortent du calcul (règle HAS, scoring-service). Un critère
//      entièrement NC des deux côtés n'a donc pas de score, et n'est pas comparable.
//
// Règles PURES : ni Prisma, ni React.
// ─────────────────────────────────────────────────────────────────────────────

export type CriterionComparisonInput = {
  code: string;
  label: string;
  requirementLevel: "IMPERATIF" | "STANDARD";
  previousRatings: readonly Rating[];
  currentRatings: readonly Rating[];
};

export type ComparisonTrend =
  | "PROGRESSION"
  | "REGRESSION"
  | "STABLE"
  // Coté d'un seul côté, ou d'aucun : rien à comparer. État à part entière, et non
  // un zéro déguisé.
  | "INCOMPARABLE";

export type CriterionComparison = {
  code: string;
  label: string;
  requirementLevel: "IMPERATIF" | "STANDARD";
  previousScore: number | null;
  currentScore: number | null;
  // Écart courant − précédent, uniquement quand les deux côtés ont un score.
  delta: number | null;
  trend: ComparisonTrend;
};

export function compareCriterion(input: CriterionComparisonInput): CriterionComparison {
  const previousScore = computeCriterionScore([...input.previousRatings]);
  const currentScore = computeCriterionScore([...input.currentRatings]);

  if (previousScore === null || currentScore === null) {
    return {
      code: input.code,
      label: input.label,
      requirementLevel: input.requirementLevel,
      previousScore,
      currentScore,
      delta: null,
      trend: "INCOMPARABLE",
    };
  }

  const delta = Number((currentScore - previousScore).toFixed(2));

  return {
    code: input.code,
    label: input.label,
    requirementLevel: input.requirementLevel,
    previousScore,
    currentScore,
    delta,
    trend: delta > 0 ? "PROGRESSION" : delta < 0 ? "REGRESSION" : "STABLE",
  };
}

export function compareCriteria(
  inputs: readonly CriterionComparisonInput[]
): CriterionComparison[] {
  return inputs.map(compareCriterion);
}

export type ComparisonSummary = {
  comparable: number;
  progression: number;
  regression: number;
  stable: number;
  incomparable: number;
  previousAverage: number | null;
  currentAverage: number | null;
  averageDelta: number | null;
  // Impératifs passés sous 4 alors qu'ils y étaient : la seule ligne que Sandrine
  // regarde en premier, parce que c'est celle qui coûte cher le jour de la visite.
  imperatifsRegressed: string[];
};

export function summariseComparison(
  comparisons: readonly CriterionComparison[]
): ComparisonSummary {
  const comparable = comparisons.filter((c) => c.trend !== "INCOMPARABLE");

  // Moyennes calculées sur les critères COMPARABLES seulement, des deux côtés. Prendre
  // tous les critères de chaque côté comparerait deux périmètres différents, et
  // l'écart mesurerait alors surtout ce qui a été coté, pas ce qui a progressé.
  const previousAverage = computeWeightedAverage(
    comparable.map((c) => ({ score: c.previousScore }))
  );
  const currentAverage = computeWeightedAverage(
    comparable.map((c) => ({ score: c.currentScore }))
  );

  return {
    comparable: comparable.length,
    progression: comparisons.filter((c) => c.trend === "PROGRESSION").length,
    regression: comparisons.filter((c) => c.trend === "REGRESSION").length,
    stable: comparisons.filter((c) => c.trend === "STABLE").length,
    incomparable: comparisons.filter((c) => c.trend === "INCOMPARABLE").length,
    previousAverage,
    currentAverage,
    averageDelta:
      previousAverage === null || currentAverage === null
        ? null
        : Number((currentAverage - previousAverage).toFixed(2)),
    imperatifsRegressed: comparisons
      .filter(
        (c) =>
          c.requirementLevel === "IMPERATIF" &&
          c.previousScore !== null &&
          c.currentScore !== null &&
          c.previousScore >= 4 &&
          c.currentScore < 4
      )
      .map((c) => c.code),
  };
}

// Ordre d'affichage : ce qui a reculé d'abord, puis ce qui a progressé, puis le
// reste. Un tableau trié par code ferait scroller pour trouver l'information qui
// compte.
const TREND_ORDER: Record<ComparisonTrend, number> = {
  REGRESSION: 0,
  PROGRESSION: 1,
  STABLE: 2,
  INCOMPARABLE: 3,
};

export function sortForReview(
  comparisons: readonly CriterionComparison[]
): CriterionComparison[] {
  return [...comparisons].sort((a, b) => {
    const byTrend = TREND_ORDER[a.trend] - TREND_ORDER[b.trend];
    if (byTrend !== 0) return byTrend;
    // À tendance égale, les impératifs remontent : ce sont eux qui bloquent.
    if (a.requirementLevel !== b.requirementLevel) {
      return a.requirementLevel === "IMPERATIF" ? -1 : 1;
    }
    return a.code.localeCompare(b.code);
  });
}

export function formatDelta(delta: number | null): string {
  if (delta === null) return "—";
  const formatted = Math.abs(delta).toFixed(2).replace(".", ",");
  if (delta > 0) return `+${formatted}`;
  if (delta < 0) return `−${formatted}`;
  return "=";
}
