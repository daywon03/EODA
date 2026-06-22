"use server";

import { prisma, type Prisma } from "@eoda/database";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireCabinetSession() {
  const session = await auth();
  if (!session || session.user.role === "CLIENT_USER") redirect("/login");
  return session;
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

  const name = (formData.get("name") as string | null)?.trim();
  const type = formData.get("type") as "SAD_AIDE" | "SAD_MIXTE" | null;

  if (!name) return { error: "Le nom de l'établissement est obligatoire." };
  if (!type) return { error: "Le type de SAD est obligatoire." };

  const finessNumber = (formData.get("finessNumber") as string | null)?.trim() || null;
  const address = (formData.get("address") as string | null)?.trim() || null;
  const targetDateRaw = formData.get("hasEvaluationTargetDate") as string | null;
  const hasEvaluationTargetDate = targetDateRaw ? new Date(targetDateRaw) : null;

  const establishment = await prisma.establishment.create({
    data: {
      tenantId: user.tenantId,
      name,
      finessNumber,
      type,
      address,
      hasEvaluationTargetDate,
      commercialTier: "BETA",
    },
  });

  revalidatePath("/dashboard/cabinet");
  redirect(`/dashboard/cabinet/etablissements/${establishment.id}`);
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
