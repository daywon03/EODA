import type { PortfolioRow } from "@/lib/services/portfolio-kpi-service";
import { toMissionLifecycleFacts, type MissionLifecycleRow } from "./to-mission-lifecycle-facts";

// Forme lue en base pour alimenter le compteur de portefeuille de l'accueil cabinet.
// Décrite ici comme `MissionLifecycleRow` l'est pour les faits de cycle de vie :
// `portfolio-kpi-service` est PUR et ne doit rien savoir de Prisma.
export type PortfolioSourceRow = {
  mission: MissionLifecycleRow | null;
  hasEvaluationTargetDate: Date | null;
};

// Un seul endroit pour cette traduction : l'accueil compte à partir des fiches que
// `getStructuresOverview` charge déjà pour la liste des structures — deux
// conversions jumelles finiraient par ne plus compter la même chose.
export function toPortfolioRow(row: PortfolioSourceRow): PortfolioRow {
  return {
    mission: toMissionLifecycleFacts(row.mission),
    hasEvaluationTargetDate: row.hasEvaluationTargetDate,
  };
}
