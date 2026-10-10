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

// Libellé long, lu par le lecteur d'écran et en infobulle (§3.1, libellés HAS).
export const RATING_TITLES: Record<Rating, string> = {
  R1: "Pas du tout satisfaisant",
  R2: "Plutôt pas satisfaisant",
  R3: "Plutôt satisfaisant",
  R4: "Tout à fait satisfaisant",
  STAR: "Niveau optimisé (compte 4)",
  NC: "Non concerné",
  RI: "Réponse inadaptée",
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

// Message affiché à côté du bouton NC d'un critère impératif ET renvoyé par le
// serveur s'il est forcé — une seule formulation (D1).
export const NC_ON_IMPERATIF_REFUSAL =
  "NC n'est pas possible sur un critère impératif. Avant de conclure à un non-concerné, la HAS demande : le périmètre est-il vraiment hors des missions de la structure ? Une ressource externe pourrait-elle répondre à l'attendu ? Le choix de la personne accompagnée explique-t-il l'absence ? Une action préventive existe-t-elle malgré tout ?";

// RI n'existe que pour le Chapitre 1 ; NC est interdit sur un critère impératif —
// cf. context/02-referentiel-has.md §3.2 points 1-2. Le refus de NC sur impératif
// est un REFUS serveur depuis le 10/10/2026 (décision 4 des maquettes v2 : « NC
// interdit sur impératif ») — il n'était jusque-là qu'un avertissement, et un NC
// forcé retirait l'impératif du calcul sans que rien ne l'empêche.
export function isRatingAllowed(
  rating: Rating,
  chapterNumber: number,
  requirementLevel: RequirementLevel
): RatingAllowedResult {
  if (rating === "RI" && chapterNumber !== 1) {
    return { allowed: false, warning: "RI n'est disponible que pour le Chapitre 1." };
  }

  if (rating === "NC" && requirementLevel === "IMPERATIF") {
    return { allowed: false, warning: NC_ON_IMPERATIF_REFUSAL };
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
