"use server";

import { prisma } from "@eoda/database";
import { requireClientEstablishment } from "@/lib/auth/guards";
import {
  computeMissionProgress,
  type MissionProgress,
} from "@/lib/services/mission-progress-service";

// ─────────────────────────────────────────────────────────────────────────────
// « MON SUIVI » — la progression de la mission, vue par le client (demande du
// 07/09/2026). Jusqu'ici visible uniquement côté cabinet (MissionSummaryCard) ;
// aucune donnée nouvelle, seulement la même lecture rendue au bon interlocuteur.
//
// Établissement résolu depuis la session (requireClientEstablishment) — aucun
// identifiant reçu de la requête, même principe que client-contract.ts.
// ─────────────────────────────────────────────────────────────────────────────

export type ClientMissionProgressView =
  | { hasMission: false }
  | { hasMission: true; progress: MissionProgress };

export async function getClientMissionProgress(): Promise<ClientMissionProgressView> {
  const { establishment } = await requireClientEstablishment();
  if (!establishment) return { hasMission: false };

  const mission = await prisma.mission.findUnique({
    where: { establishmentId: establishment.id },
    select: {
      formule: true,
      gratuit: true,
      itemStatuses: { select: { itemId: true, completed: true } },
    },
  });
  if (!mission) return { hasMission: false };

  const catalogItems = await prisma.missionChecklistItem.findMany({
    select: { id: true, scope: true, minFormule: true },
  });
  const completedByItemId = new Map(mission.itemStatuses.map((s) => [s.itemId, s.completed]));

  const progress = computeMissionProgress(
    catalogItems.map((item) => ({
      scope: item.scope,
      minFormule: item.minFormule,
      completed: completedByItemId.get(item.id) ?? false,
    })),
    mission.formule,
    mission.gratuit
  );

  return { hasMission: true, progress };
}
