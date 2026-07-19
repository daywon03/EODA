"use server";

import { prisma, type Prisma } from "@eoda/database";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireCabinetSession } from "@/lib/auth/guards";

function parseEstablishmentInput(formData: FormData): { error: string } | {
  name: string;
  type: "SAD_AIDE" | "SAD_MIXTE";
  finessNumber: string | null;
  address: string | null;
  hasEvaluationTargetDate: Date | null;
} {
  const name = (formData.get("name") as string | null)?.trim();
  const type = formData.get("type") as "SAD_AIDE" | "SAD_MIXTE" | null;

  if (!name) return { error: "Le nom de l'établissement est obligatoire." };
  if (!type) return { error: "Le type de SAD est obligatoire." };

  const finessNumber = (formData.get("finessNumber") as string | null)?.trim() || null;
  const address = (formData.get("address") as string | null)?.trim() || null;
  const targetDateRaw = formData.get("hasEvaluationTargetDate") as string | null;
  const hasEvaluationTargetDate = targetDateRaw ? new Date(targetDateRaw) : null;

  return { name, type, finessNumber, address, hasEvaluationTargetDate };
}

export async function createEstablishment(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await requireCabinetSession();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { tenantId: true },
  });
  if (!user.tenantId) return { error: "Utilisateur Cabinet sans tenant." };

  const parsed = parseEstablishmentInput(formData);
  if ("error" in parsed) return parsed;

  const establishment = await prisma.establishment.create({
    data: { ...parsed, tenantId: user.tenantId, commercialTier: "BETA" },
  });

  revalidatePath("/dashboard/cabinet");
  redirect(`/dashboard/cabinet/etablissements/${establishment.id}`);
}

export async function updateEstablishment(
  id: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const session = await requireCabinetSession();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { tenantId: true },
  });

  const where: Prisma.EstablishmentWhereInput = { id };
  if (user.tenantId) where.tenantId = user.tenantId;

  const existing = await prisma.establishment.findFirst({ where });
  if (!existing) notFound();

  const parsed = parseEstablishmentInput(formData);
  if ("error" in parsed) return parsed;

  await prisma.establishment.update({
    where: { id },
    data: parsed,
  });

  revalidatePath("/dashboard/cabinet");
  revalidatePath(`/dashboard/cabinet/etablissements/${id}`);
  redirect(`/dashboard/cabinet/etablissements/${id}`);
}

export async function deleteEstablishment(id: string): Promise<{ error: string } | void> {
  const session = await requireCabinetSession();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { tenantId: true },
  });

  const where: Prisma.EstablishmentWhereInput = { id };
  if (user.tenantId) where.tenantId = user.tenantId;

  const existing = await prisma.establishment.findFirst({ where });
  if (!existing) notFound();

  await prisma.$transaction(async (tx) => {
    await tx.elementRating.deleteMany({
      where: { evaluationSession: { establishmentId: id } },
    });
    await tx.evaluationSession.deleteMany({ where: { establishmentId: id } });
    await tx.document.updateMany({
      where: { establishmentId: id },
      data: { currentVersionId: null },
    });
    await tx.documentVersion.deleteMany({ where: { document: { establishmentId: id } } });
    await tx.document.deleteMany({ where: { establishmentId: id } });
    await tx.establishmentUser.deleteMany({ where: { establishmentId: id } });
    await tx.missionChecklistItemStatus.deleteMany({ where: { mission: { establishmentId: id } } });
    await tx.mission.deleteMany({ where: { establishmentId: id } });
    await tx.establishment.delete({ where: { id } });
  });

  revalidatePath("/dashboard/cabinet");
  redirect("/dashboard/cabinet");
}

export async function listEstablishments() {
  const session = await requireCabinetSession();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { tenantId: true },
  });

  if (!user.tenantId) return [];

  return prisma.establishment.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { documents: true } } },
  });
}

export type EstablishmentWithUsers = Prisma.EstablishmentGetPayload<{
  include: {
    establishmentUsers: {
      include: { user: { select: { id: true; name: true; email: true; role: true } } };
    };
  };
}>;

export async function getEstablishment(id: string): Promise<EstablishmentWithUsers> {
  const session = await requireCabinetSession();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { tenantId: true },
  });

  const where: Prisma.EstablishmentWhereInput = { id };
  if (user.tenantId) where.tenantId = user.tenantId;

  const establishment = await prisma.establishment.findFirst({
    where,
    include: {
      establishmentUsers: {
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      },
    },
  });

  if (!establishment) notFound();
  return establishment;
}
