import type { MissionLifecycleFacts } from "@/lib/services/lifecycle-service";

// Forme de mission telle que lue en base pour dériver un état. Décrite ici et pas
// dans le service : `lifecycle-service` est PUR et ne doit rien savoir de Prisma ni
// du découpage en huit colonnes de dates.
export type MissionLifecycleRow = {
  closedAt: Date | null;
  gratuit: boolean;
  fondationsStartDate: Date | null;
  fondationsEndDate: Date | null;
  deploiementStartDate: Date | null;
  deploiementEndDate: Date | null;
  consolidationStartDate: Date | null;
  consolidationEndDate: Date | null;
  preparationFinaleStartDate: Date | null;
  preparationFinaleEndDate: Date | null;
  // COMPTE, et non la liste des lignes. Seul le nombre est utilisé
  // (`completedChecklistCount`) : ramener une ligne par item coché faisait transiter
  // une trentaine d'objets par mission pour n'en lire que la longueur — invisible sur
  // quatre fiches, une fois et demie le volume de la réponse à 120.
  _count: { itemStatuses: number };
};

// Traduit une ligne Prisma en faits de cycle de vie. Un seul endroit : la liste des
// fiches, la page d'une fiche et les futurs KPI doivent compter les mêmes choses,
// sinon deux écrans annoncent deux états pour la même mission.
//
// Le compte d'items est attendu DÉJÀ filtré sur `completed: true` par la requête —
// recompter ici obligerait à ramener toute la checklist pour n'en garder qu'un
// nombre.
export function toMissionLifecycleFacts(
  mission: MissionLifecycleRow | null
): MissionLifecycleFacts | null {
  if (!mission) return null;

  const phaseDates = [
    mission.fondationsStartDate,
    mission.fondationsEndDate,
    mission.deploiementStartDate,
    mission.deploiementEndDate,
    mission.consolidationStartDate,
    mission.consolidationEndDate,
    mission.preparationFinaleStartDate,
    mission.preparationFinaleEndDate,
  ];

  return {
    closedAt: mission.closedAt,
    gratuit: mission.gratuit,
    completedChecklistCount: mission._count.itemStatuses,
    scheduledPhaseDateCount: phaseDates.filter((date) => date !== null).length,
  };
}
