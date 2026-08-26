import type { CommercialTier, ProspectStatus } from "@eoda/database";
import type { PortfolioRow } from "@/lib/services/portfolio-kpi-service";
import { toMissionLifecycleFacts, type MissionLifecycleRow } from "./to-mission-lifecycle-facts";

// Forme lue en base pour alimenter les agrégats de portefeuille. Décrite ici comme
// `MissionLifecycleRow` l'est pour les faits de cycle de vie : `portfolio-kpi-service`
// est PUR et ne doit rien savoir de Prisma.
export type PortfolioSourceRow = {
  prospect: { status: ProspectStatus } | null;
  mission: (MissionLifecycleRow & { formule: CommercialTier }) | null;
  hasEvaluationTargetDate: Date | null;
};

// Un seul endroit pour cette traduction : le tableau de bord Cabinet compte à partir
// des fiches qu'il affiche déjà, la page commerciale les recharge pour elle-même. Les
// deux doivent compter la même chose — deux conversions jumelles finiraient par ne
// plus s'accorder, et deux écrans annonceraient deux portefeuilles différents.
export function toPortfolioRow(row: PortfolioSourceRow): PortfolioRow {
  return {
    prospectStatus: row.prospect?.status ?? null,
    mission: toMissionLifecycleFacts(row.mission),
    // La formule qui fait autorité vit sur la mission (CLAUDE.md §7). Sans mission,
    // pas de formule — et surtout pas `Establishment.commercialTier`, figé à `BETA`.
    missionFormule: row.mission?.formule ?? null,
    hasEvaluationTargetDate: row.hasEvaluationTargetDate,
  };
}
