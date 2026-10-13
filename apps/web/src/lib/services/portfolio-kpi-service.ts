import { deriveEstablishmentStage, type MissionLifecycleFacts } from "./lifecycle-service";

// ─────────────────────────────────────────────────────────────────────────────
// KPI DE PORTEFEUILLE — ce qui reste après la vue d'ensemble commerciale v2.
//
// Depuis la maquette v2 (13/10/2026), les compteurs COMMERCIAUX (entonnoir, « À
// faire », abonnements actifs par formule de mission) vivent dans
// `commercial-overview-service.ts`. Ce service ne garde que le compteur que l'accueil
// du cabinet affiche encore : les évaluations HAS à venir sur les missions actives
// (tranche 11 : les agrégats que plus aucun écran n'affichait — clients actifs,
// accompagnements en cours, bêta actives, missions par formule, entonnoir unifié —
// ont été retirés plutôt que gardés « au cas où » ; ils se réécrivent depuis
// lifecycle-service le jour où un écran en a besoin).
//
// Même règle qu'avant : on compte à partir des MÊMES faits que les badges d'étape
// (lifecycle-service), jamais d'un statut stocké. Règles PURES : `now` est un
// paramètre — un test qui dépend de l'heure réelle est un test instable (D7).
// ─────────────────────────────────────────────────────────────────────────────

// Ce dont le compteur a besoin, fiche par fiche. Étroit volontairement : ramener
// l'entité entière laisserait croire que d'autres champs entrent dans le calcul.
export type PortfolioRow = {
  mission: MissionLifecycleFacts | null;
  hasEvaluationTargetDate: Date | null;
};

// Une fiche est « active » tant que sa mission n'est pas close. `SIGNE` (signée, rien
// n'a démarré) compte autant que `EN_COURS` : le client a payé, l'engagement court.
function isActive(row: PortfolioRow): boolean {
  const stage = deriveEstablishmentStage(row.mission);
  return stage === "SIGNE" || stage === "EN_COURS";
}

// Échéances HAS à venir dans un horizon donné, sur les seules missions actives.
//
// Remplace un indicateur devenu vide de sens : il comptait les fiches dont la date
// d'évaluation était renseignée, or elle est EXIGÉE depuis la refonte de l'entonnoir
// — il affichait donc le nombre total de fiches sous une autre étiquette. Une
// échéance déjà passée ou appartenant à une mission close ne dit rien non plus de ce
// qu'il reste à préparer.
export function countUpcomingHasEvaluations(
  rows: PortfolioRow[],
  options: { now: Date; withinDays: number }
): number {
  const horizon = new Date(options.now.getTime() + options.withinDays * 24 * 60 * 60 * 1000);

  return rows.filter((row) => {
    if (!isActive(row)) return false;
    const target = row.hasEvaluationTargetDate;
    if (target === null) return false;
    return target >= options.now && target <= horizon;
  }).length;
}
