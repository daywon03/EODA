"use server";

import { prisma } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { parseSupportMode } from "@/lib/services/support-mode-service";

// ─────────────────────────────────────────────────────────────────────────────
// PASSER UNE MISSION EN AUTONOMIE OU EN ACCOMPAGNEMENT (tranche N1).
//
// Réservé à CABINET_ADMIN : le mode décide si la structure lit des analyses que
// personne chez EODA n'a relues. C'est un engagement de la parole du cabinet — et,
// dans l'autre sens, une prestation vendue (l'accompagnement en option) —, pas du
// suivi opérationnel.
// ─────────────────────────────────────────────────────────────────────────────

export async function setMissionSupportMode(
  missionId: string,
  rawMode: unknown
): Promise<{ error: string } | null> {
  const { tenantId, userId, session } = await requireCabinetAdminSession();

  const mode = parseSupportMode(rawMode);
  if (!mode) return { error: "Mode invalide." };

  // Tenant dans la requête : une mission d'un autre cabinet est introuvable, et
  // on ne le dit pas autrement (CLAUDE.md §5 bis).
  const mission = await prisma.mission.findFirst({
    where: { id: typeof missionId === "string" ? missionId : "", tenantId },
    select: { id: true, establishmentId: true, supportMode: true },
  });
  if (!mission) notFound();
  if (mission.supportMode === mode) return null;

  await prisma.mission.update({ where: { id: mission.id }, data: { supportMode: mode } });

  await recordAuditEvent({
    action: "MISSION_SUPPORT_MODE_CHANGED",
    actorUserId: userId,
    actorRole: session.user.role,
    establishmentId: mission.establishmentId,
    targetId: mission.id,
    detail: mode,
  });

  revalidatePath(`/dashboard/cabinet/etablissements/${mission.establishmentId}`, "layout");
  // Tout le portail client change de règle de lecture en même temps.
  revalidatePath("/dashboard/client", "layout");
  return null;
}
