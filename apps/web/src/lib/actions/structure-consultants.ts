"use server";

import { prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";

// ─────────────────────────────────────────────────────────────────────────────
// LES CONSULTANTES QUI SUIVENT LA STRUCTURE — geste de SA DIRECTION (29/10/2026).
//
// Décision de Damon : « la structure ou le cabinet doit pouvoir assigner la
// consultante ». Une consultante (CABINET_EVALUATOR : la vue du cabinet sans le
// commercial ni les montants) ne voit QUE ses structures affectées
// (`resolveStructureScope`). EODA affecte depuis « Équipe EODA » ; la DIRECTION de la
// structure peut, ici, ouvrir ou fermer SA structure à une consultante d'EODA.
//
// Ce que la structure ne peut PAS faire : créer un compte de consultante (les comptes
// d'EODA se créent chez EODA — un compte créé par la structure pourrait marquer « Relu
// par EODA » ses propres documents), ni toucher l'affectation d'une autre structure.
// La structure vient du lien du compte connecté, jamais d'un paramètre ; la
// consultante visée est relue dans le cabinet de la structure, sinon notFound().
// ─────────────────────────────────────────────────────────────────────────────

const SETTINGS_PATH = "/dashboard/client/parametres";
const CLOSED = "Votre accompagnement est clos : les accès ne se modifient plus ici. Écrivez à EODA.";

export type StructureConsultantRow = { userId: string; name: string; email: string; assigned: boolean };

async function establishmentTenant(establishmentId: string): Promise<string> {
  const row = await prisma.establishment.findUnique({ where: { id: establishmentId }, select: { tenantId: true } });
  if (!row) notFound();
  return row.tenantId;
}

export async function getStructureConsultants(): Promise<{ rows: StructureConsultantRow[]; canEdit: boolean } | null> {
  const { establishment, missionAccess } = await requireClientEstablishment(NEED.ACCESS_READ);
  if (!establishment) return null;
  const tenantId = await establishmentTenant(establishment.id);
  const consultants = await prisma.user.findMany({
    where: { tenantId, role: "CABINET_EVALUATOR", isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      establishmentAssignments: { where: { establishmentId: establishment.id }, select: { establishmentId: true } },
    },
    orderBy: { name: "asc" },
  });
  return {
    rows: consultants.map((c) => ({ userId: c.id, name: c.name, email: c.email, assigned: c.establishmentAssignments.length > 0 })),
    canEdit: canDepositDocuments(missionAccess),
  };
}

export async function setStructureConsultant(consultantUserId: string, assigned: boolean): Promise<{ error: string } | null> {
  const context = await requireClientEstablishment(NEED.ACCESS_WRITE);
  if (!context.establishment) notFound();
  if (typeof consultantUserId !== "string" || consultantUserId.length === 0 || typeof assigned !== "boolean") notFound();
  if (!canDepositDocuments(context.missionAccess)) return { error: CLOSED };

  const establishmentId = context.establishment.id;
  const tenantId = await establishmentTenant(establishmentId);
  // Une consultante ACTIVE du cabinet de CETTE structure, et rien d'autre : ni un
  // administrateur, ni un compte d'un autre cabinet, ni un compte client.
  const consultant = await prisma.user.findFirst({
    where: { id: consultantUserId, tenantId, role: "CABINET_EVALUATOR", isActive: true },
    select: { id: true },
  });
  if (!consultant) notFound();

  if (assigned) {
    await prisma.establishmentAssignment.upsert({
      where: { userId_establishmentId: { userId: consultant.id, establishmentId } },
      create: { tenantId, establishmentId, userId: consultant.id },
      update: {},
    });
  } else {
    await prisma.establishmentAssignment.deleteMany({ where: { userId: consultant.id, establishmentId } });
  }

  await recordAuditEvent({
    action: "CABINET_USER_ASSIGNMENTS_UPDATED",
    actorUserId: context.userId,
    actorRole: "CLIENT_USER",
    establishmentId,
    targetId: consultant.id,
    detail: assigned ? "structure · consultante ajoutée" : "structure · consultante retirée",
  });

  revalidatePath(SETTINGS_PATH);
  revalidatePath("/dashboard/cabinet");
  return null;
}
