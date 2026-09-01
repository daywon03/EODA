import type { Rating, RequirementLevel } from "@eoda/database";

// Moteur de cotation HAS — pur, sans dépendance Prisma. Règles exactes :
// context/02-referentiel-has.md §3.2. Agrégation E.E. → Critère → Objectif →
// Thématique → Chapitre → Global, moyenne simple à chaque niveau (★=4, NC/RI exclus).

// Libellé d'une cotation, tel qu'il s'affiche et tel qu'il s'exporte : 1/2/3/4/★/NC/RI
// (context/02-referentiel-has.md §3.2). Ici et non dans le composant de boutons, où il
// vivait : l'export CSV a besoin des mêmes libellés, et deux tables de correspondance
// finiraient par nommer différemment la même cotation sur l'écran et dans le fichier
// remis (D1). Les couleurs, elles, restent à l'écran — un CSV n'en a pas.
export const RATING_LABELS: Record<Rating, string> = {
  R1: "1",
  R2: "2",
  R3: "3",
  R4: "4",
  STAR: "★",
  NC: "NC",
  RI: "RI",
};

// Valeur numérique d'une cotation pour le calcul de moyenne — null = exclu du calcul
// (NC, RI). ★ compte comme 4, jamais comme une valeur à part.
export function ratingValue(rating: Rating): number | null {
  switch (rating) {
    case "R1":
      return 1;
    case "R2":
      return 2;
    case "R3":
      return 3;
    case "R4":
    case "STAR":
      return 4;
    case "NC":
    case "RI":
      return null;
  }
}

function average(values: (number | null)[]): number | null {
  const included = values.filter((v): v is number => v !== null);
  if (included.length === 0) return null;
  return included.reduce((sum, v) => sum + v, 0) / included.length;
}

export function computeCriterionScore(ratings: Rating[]): number | null {
  return average(ratings.map(ratingValue));
}

export type WeightedScore = { score: number | null; weightPercent?: number | null };

// Moyenne des scores enfants — pondérée si des poids sont fournis (point d'extension
// V2, cf. specs/01-mvp-v1.md §Module 3 hors périmètre), simple moyenne arithmétique
// sinon (V1). Ne jamais hardcoder une moyenne non pondérée qui empêcherait d'ajouter
// une pondération par objectif plus tard.
export function computeWeightedAverage(items: WeightedScore[]): number | null {
  const scored = items.filter((i): i is { score: number; weightPercent?: number | null } => i.score !== null);
  if (scored.length === 0) return null;

  const hasWeights = scored.some((i) => i.weightPercent != null);
  if (!hasWeights) {
    return scored.reduce((sum, i) => sum + i.score, 0) / scored.length;
  }

  const totalWeight = scored.reduce((sum, i) => sum + (i.weightPercent ?? 0), 0);
  if (totalWeight === 0) return scored.reduce((sum, i) => sum + i.score, 0) / scored.length;
  return scored.reduce((sum, i) => sum + i.score * (i.weightPercent ?? 0), 0) / totalWeight;
}

export type RatingAllowedResult = { allowed: boolean; warning?: string };

// RI n'existe que pour le Chapitre 1. NC est toujours saisissable mais affiche un
// avertissement pédagogique (pas un blocage technique) sur un critère impératif —
// cf. context/02-referentiel-has.md §3.2 points 1-2.
export function isRatingAllowed(
  rating: Rating,
  chapterNumber: number,
  requirementLevel: RequirementLevel
): RatingAllowedResult {
  if (rating === "RI" && chapterNumber !== 1) {
    return { allowed: false, warning: "RI n'est disponible que pour le Chapitre 1." };
  }

  if (rating === "NC" && requirementLevel === "IMPERATIF") {
    return {
      allowed: true,
      warning:
        "NC sur un critère impératif — à confirmer : le périmètre est-il vraiment hors des missions de l'ESSMS ? Une ressource externe pourrait-elle répondre à l'attendu ? Le choix de la personne accompagnée explique-t-il l'absence ? Une action préventive existe-t-elle malgré tout ?",
    };
  }

  return { allowed: true };
}

// Échelle indicative de lecture (context/02-referentiel-has.md §3.2 point 5) — aide à la
// lecture, pas une règle HAS officielle.
export function scoreLabel(score: number | null): string {
  if (score === null) return "Non coté";
  if (score >= 3.5) return "Tout à fait satisfaisant";
  if (score >= 2.5) return "Plutôt satisfaisant";
  if (score >= 1.5) return "Plutôt pas satisfaisant";
  return "Pas du tout satisfaisant";
}
