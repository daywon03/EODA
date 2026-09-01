import { FUNNEL_STAGES, type FunnelStage } from "./lifecycle-service";

// ─────────────────────────────────────────────────────────────────────────────
// ENTONNOIR — de « combien à chaque étape » à « où ça décroche ».
//
// `computeFunnelBreakdown` (portfolio-kpi-service) compte les structures
// ACTUELLEMENT à chaque étape. C'est exact, mais ça ne se lit pas comme un
// entonnoir : trois structures en « Signé » et douze en « En cours » donnent
// l'impression d'un étranglement à la signature, alors que les douze l'ont franchie.
//
// Ce service dérive donc le CUMUL — « combien ont atteint au moins cette étape » —
// puis le taux de passage d'une étape à la suivante. C'est cette seconde lecture qui
// répond à « où perd-on des affaires ? ».
//
// ⚠️ `PERDU` est tenu à l'écart, volontairement : on sait qu'une affaire est perdue,
// on ne sait PAS à quelle étape elle l'a été (rien ne l'enregistre). La répartir
// inventerait des décrochages. Elle est donc comptée à part, et l'écran le dit.
//
// Règles PURES : ni Prisma, ni React.
// ─────────────────────────────────────────────────────────────────────────────

// Étapes de l'entonnoir dans l'ordre, hors `PERDU` (sortie, pas étape).
export const FUNNEL_PROGRESS_STAGES = FUNNEL_STAGES.filter(
  (stage): stage is Exclude<FunnelStage, "PERDU"> => stage !== "PERDU"
);

export type FunnelStep = {
  stage: Exclude<FunnelStage, "PERDU">;
  // Structures actuellement à cette étape.
  current: number;
  // Structures qui ont atteint AU MOINS cette étape — c'est la barre de l'entonnoir.
  reached: number;
  // Part de la première étape, en pourcentage. 100 % sur la première.
  sharePercent: number;
  // Taux de passage vers l'étape suivante, null sur la dernière (il n'y a rien après).
  passRatePercent: number | null;
  // Nombre perdu entre cette étape et la suivante.
  dropCount: number;
};

export function buildFunnelSteps(byStage: Record<FunnelStage, number>): FunnelStep[] {
  const stages = FUNNEL_PROGRESS_STAGES;

  // Cumul par la fin : une structure « en cours » a forcément franchi la signature.
  const reached: number[] = [];
  let running = 0;
  for (let index = stages.length - 1; index >= 0; index--) {
    running += byStage[stages[index]!];
    reached[index] = running;
  }

  const entry = reached[0] ?? 0;

  return stages.map((stage, index) => {
    const reachedHere = reached[index] ?? 0;
    const reachedNext = reached[index + 1];

    return {
      stage,
      current: byStage[stage],
      reached: reachedHere,
      // Division protégée : un pipeline vide affiche 0 %, pas NaN %.
      sharePercent: entry === 0 ? 0 : Math.round((reachedHere / entry) * 100),
      passRatePercent:
        reachedNext === undefined || reachedHere === 0
          ? null
          : Math.round((reachedNext / reachedHere) * 100),
      dropCount: reachedNext === undefined ? 0 : Math.max(0, reachedHere - reachedNext),
    };
  });
}

// L'étape où l'on perd le plus, en valeur absolue. C'est la seule information que la
// consultante peut transformer en action — d'où sa mise en avant à l'écran. `null`
// quand rien ne se perd (ou quand le pipeline est vide) : souligner une étape « au
// hasard » ferait travailler quelqu'un sur un problème qui n'existe pas.
export function biggestDropStage(steps: readonly FunnelStep[]): FunnelStep["stage"] | null {
  let worst: FunnelStep | null = null;
  for (const step of steps) {
    if (step.dropCount <= 0) continue;
    if (worst === null || step.dropCount > worst.dropCount) worst = step;
  }
  return worst?.stage ?? null;
}

// Phrase de synthèse, au-dessus de l'entonnoir. Trois formulations, parce que « 0
// structure » et « pipeline vide » ne se disent pas de la même façon.
export function describeFunnel(input: {
  steps: readonly FunnelStep[];
  lost: number;
  indetermine: number;
}): string {
  const entry = input.steps[0]?.reached ?? 0;
  if (entry === 0 && input.lost === 0) {
    return "Aucune structure dans l'entonnoir : les prospects créés apparaîtront ici.";
  }

  const parts = [`${entry} structure${entry > 1 ? "s" : ""} entrées dans l'entonnoir`];
  if (input.lost > 0) parts.push(`${input.lost} perdue${input.lost > 1 ? "s" : ""}`);
  if (input.indetermine > 0) {
    parts.push(`${input.indetermine} sans étape déterminable`);
  }
  return `${parts.join(" · ")}.`;
}
