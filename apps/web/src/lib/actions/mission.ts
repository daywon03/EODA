"use server";

import { prisma, type CommercialTier, type MissionChecklistScope } from "@eoda/database";
import { requireCabinetSession } from "@/lib/auth/guards";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { computeMissionProgress, isScopeApplicable, type MissionProgress } from "@/lib/services/mission-progress-service";

async function requireTenantId(): Promise<{ session: Awaited<ReturnType<typeof requireCabinetSession>>; tenantId: string }> {
  const session = await requireCabinetSession();
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { tenantId: true },
  });
  if (!user.tenantId) notFound();
  return { session, tenantId: user.tenantId };
}

function missionPaths(establishmentId: string) {
  return [
    `/dashboard/cabinet/etablissements/${establishmentId}`,
    `/dashboard/cabinet/etablissements/${establishmentId}/mission`,
  ];
}

// Lecture seule des offres actives du catalogue — accessible aux deux rôles
// Cabinet (contrairement à listCatalogue() qui gère l'édition du catalogue et
// reste réservée à CABINET_ADMIN) : un CABINET_EVALUATOR doit pouvoir voir les
// prix pour choisir l'offre à la création d'une mission.
export async function listFormulesForMissionSetup() {
  const { tenantId } = await requireTenantId();

  return prisma.catalogueFormule.findMany({
    where: { tenantId, active: true },
    orderBy: { priceEuros: "asc" },
  });
}

export async function createMission(
  establishmentId: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireTenantId();

  const establishment = await prisma.establishment.findFirst({
    where: { id: establishmentId, tenantId },
  });
  if (!establishment) notFound();

  const existing = await prisma.mission.findUnique({ where: { establishmentId } });
  if (existing) return { error: "Une mission existe déjà pour cet établissement." };

  const formule = formData.get("formule") as CommercialTier | null;
  const gratuit = formData.get("gratuit") === "on";

  if (!formule) return { error: "La formule est obligatoire." };

  const availableFormules = await prisma.catalogueFormule.findMany({
    where: { tenantId, active: true },
    select: { formule: true },
  });
  if (!availableFormules.some((f) => f.formule === formule)) {
    return { error: "Cette formule n'est pas disponible dans le catalogue." };
  }

  await prisma.mission.create({ data: { tenantId, establishmentId, formule, gratuit } });

  for (const path of missionPaths(establishmentId)) revalidatePath(path);
  return null;
}

export async function updateMissionScope(
  missionId: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireTenantId();

  const mission = await prisma.mission.findFirst({ where: { id: missionId, tenantId } });
  if (!mission) notFound();

  const formule = formData.get("formule") as CommercialTier | null;
  const gratuit = formData.get("gratuit") === "on";

  if (!formule) return { error: "La formule est obligatoire." };

  const availableFormules = await prisma.catalogueFormule.findMany({
    where: { tenantId, active: true },
    select: { formule: true },
  });
  if (!availableFormules.some((f) => f.formule === formule)) {
    return { error: "Cette formule n'est pas disponible dans le catalogue." };
  }

  // Ne touche jamais aux statuts de checklist déjà cochés — une régression
  // Excellence → Essentiel masque seulement les phases hors scope, sans
  // détruire la progression déjà enregistrée (cf. plan §7 edge cases).
  await prisma.mission.update({ where: { id: missionId }, data: { formule, gratuit } });

  for (const path of missionPaths(mission.establishmentId)) revalidatePath(path);
  return null;
}

export async function toggleChecklistItem(
  missionId: string,
  itemCode: string,
  completed: boolean
): Promise<{ error: string } | null> {
  const { tenantId } = await requireTenantId();

  const mission = await prisma.mission.findFirst({ where: { id: missionId, tenantId } });
  if (!mission) notFound();

  const item = await prisma.missionChecklistItem.findUnique({ where: { code: itemCode } });
  if (!item) notFound();

  if (!isScopeApplicable(item.scope, mission.formule, mission.gratuit)) {
    return { error: "Cette phase n'est pas disponible pour le périmètre de cette mission." };
  }

  await prisma.missionChecklistItemStatus.upsert({
    where: { missionId_itemId: { missionId, itemId: item.id } },
    update: { completed, completedAt: completed ? new Date() : null },
    create: { missionId, itemId: item.id, completed, completedAt: completed ? new Date() : null },
  });

  for (const path of missionPaths(mission.establishmentId)) revalidatePath(path);
  return null;
}

const PHASE_DATE_FIELDS: Record<
  Exclude<MissionChecklistScope, "DIAGNOSTIC">,
  { start: "fondationsStartDate" | "deploiementStartDate" | "consolidationStartDate" | "preparationFinaleStartDate"; end: "fondationsEndDate" | "deploiementEndDate" | "consolidationEndDate" | "preparationFinaleEndDate" }
> = {
  FONDATIONS: { start: "fondationsStartDate", end: "fondationsEndDate" },
  DEPLOIEMENT: { start: "deploiementStartDate", end: "deploiementEndDate" },
  CONSOLIDATION: { start: "consolidationStartDate", end: "consolidationEndDate" },
  PREPARATION_FINALE: { start: "preparationFinaleStartDate", end: "preparationFinaleEndDate" },
};

export async function updatePhaseDates(
  missionId: string,
  phase: Exclude<MissionChecklistScope, "DIAGNOSTIC">,
  startDate: string | null,
  endDate: string | null
): Promise<{ error: string } | null> {
  const { tenantId } = await requireTenantId();

  const mission = await prisma.mission.findFirst({ where: { id: missionId, tenantId } });
  if (!mission) notFound();

  const fields = PHASE_DATE_FIELDS[phase];
  await prisma.mission.update({
    where: { id: missionId },
    data: {
      [fields.start]: startDate ? new Date(startDate) : null,
      [fields.end]: endDate ? new Date(endDate) : null,
    },
  });

  for (const path of missionPaths(mission.establishmentId)) revalidatePath(path);
  return null;
}

export type MissionWithProgress = {
  id: string;
  formule: CommercialTier;
  gratuit: boolean;
  fondationsStartDate: Date | null;
  fondationsEndDate: Date | null;
  deploiementStartDate: Date | null;
  deploiementEndDate: Date | null;
  consolidationStartDate: Date | null;
  consolidationEndDate: Date | null;
  preparationFinaleStartDate: Date | null;
  preparationFinaleEndDate: Date | null;
  items: { code: string; scope: MissionChecklistScope; label: string; order: number; completed: boolean }[];
  progress: MissionProgress;
};

export async function getMission(establishmentId: string): Promise<MissionWithProgress | null> {
  const { tenantId } = await requireTenantId();

  const mission = await prisma.mission.findFirst({
    where: { establishmentId, tenantId },
    include: { itemStatuses: true },
  });
  if (!mission) return null;

  const catalogItems = await prisma.missionChecklistItem.findMany({
    orderBy: [{ scope: "asc" }, { order: "asc" }],
  });

  const completedByItemId = new Map(mission.itemStatuses.map((s) => [s.itemId, s.completed]));

  const items = catalogItems.map((ci) => ({
    code: ci.code,
    scope: ci.scope,
    label: ci.label,
    order: ci.order,
    completed: completedByItemId.get(ci.id) ?? false,
  }));

  const progress = computeMissionProgress(
    items.map((i) => ({ scope: i.scope, completed: i.completed })),
    mission.formule,
    mission.gratuit
  );

  return {
    id: mission.id,
    formule: mission.formule,
    gratuit: mission.gratuit,
    fondationsStartDate: mission.fondationsStartDate,
    fondationsEndDate: mission.fondationsEndDate,
    deploiementStartDate: mission.deploiementStartDate,
    deploiementEndDate: mission.deploiementEndDate,
    consolidationStartDate: mission.consolidationStartDate,
    consolidationEndDate: mission.consolidationEndDate,
    preparationFinaleStartDate: mission.preparationFinaleStartDate,
    preparationFinaleEndDate: mission.preparationFinaleEndDate,
    items,
    progress,
  };
}
