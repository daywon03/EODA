"use server";

import { prisma, type Prisma, type ProspectStatus } from "@eoda/database";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";

const PROSPECT_LIST_PATH = "/dashboard/cabinet/commercial/prospects";

function parseProspectInput(formData: FormData): { error: string } | {
  structureName: string;
  structureType: "ASSOCIATION" | "PRIVE" | "PUBLIC";
  channel:
    | "BOUCHE_A_OREILLE"
    | "REFERENCEMENT_UNA"
    | "EMAILING"
    | "REFERENCEMENT_GOOGLE"
    | "LINKEDIN"
    | "AUTRE";
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  envisagedFormule: "BETA" | "ESSENTIEL" | "PERFORMANCE" | "EXCELLENCE" | null;
  estimatedAmountEuros: number | null;
  firstContactDate: Date;
  notes: string | null;
} {
  const structureName = (formData.get("structureName") as string | null)?.trim();
  const structureType = formData.get("structureType") as
    | "ASSOCIATION"
    | "PRIVE"
    | "PUBLIC"
    | null;
  const channel = formData.get("channel") as
    | "BOUCHE_A_OREILLE"
    | "REFERENCEMENT_UNA"
    | "EMAILING"
    | "REFERENCEMENT_GOOGLE"
    | "LINKEDIN"
    | "AUTRE"
    | null;
  const firstContactDateRaw = formData.get("firstContactDate") as string | null;

  if (!structureName) return { error: "Le nom de la structure est obligatoire." };
  if (!structureType) return { error: "Le type de structure est obligatoire." };
  if (!channel) return { error: "Le canal d'acquisition est obligatoire." };
  if (!firstContactDateRaw) return { error: "La date de premier contact est obligatoire." };

  const envisagedFormuleRaw = formData.get("envisagedFormule") as string | null;
  const estimatedAmountRaw = (formData.get("estimatedAmountEuros") as string | null)?.trim();

  return {
    structureName,
    structureType,
    channel,
    contactName: (formData.get("contactName") as string | null)?.trim() || null,
    contactPhone: (formData.get("contactPhone") as string | null)?.trim() || null,
    contactEmail: (formData.get("contactEmail") as string | null)?.trim() || null,
    envisagedFormule: envisagedFormuleRaw
      ? (envisagedFormuleRaw as "BETA" | "ESSENTIEL" | "PERFORMANCE" | "EXCELLENCE")
      : null,
    estimatedAmountEuros: estimatedAmountRaw ? Number(estimatedAmountRaw) : null,
    firstContactDate: new Date(firstContactDateRaw),
    notes: (formData.get("notes") as string | null)?.trim() || null,
  };
}

export async function createProspect(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetAdminSession();

  const parsed = parseProspectInput(formData);
  if ("error" in parsed) return parsed;

  const prospect = await prisma.prospect.create({ data: { ...parsed, tenantId } });

  revalidatePath(PROSPECT_LIST_PATH);
  redirect(`${PROSPECT_LIST_PATH}/${prospect.id}`);
}

export async function updateProspect(
  id: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetAdminSession();

  const existing = await prisma.prospect.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();

  const parsed = parseProspectInput(formData);
  if ("error" in parsed) return parsed;

  await prisma.prospect.update({ where: { id }, data: parsed });

  revalidatePath(PROSPECT_LIST_PATH);
  revalidatePath(`${PROSPECT_LIST_PATH}/${id}`);
  redirect(`${PROSPECT_LIST_PATH}/${id}`);
}

export async function updateProspectStatus(id: string, status: ProspectStatus): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetAdminSession();

  const existing = await prisma.prospect.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();

  await prisma.prospect.update({ where: { id }, data: { status } });

  revalidatePath(PROSPECT_LIST_PATH);
  revalidatePath(`${PROSPECT_LIST_PATH}/${id}`);
  return null;
}

export async function deleteProspect(id: string): Promise<{ error: string } | void> {
  const { tenantId } = await requireCabinetAdminSession();

  const existing = await prisma.prospect.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();

  const devisCount = await prisma.devis.count({ where: { prospectId: id } });
  if (devisCount > 0) {
    return { error: "Impossible de supprimer un prospect ayant des devis associés." };
  }

  await prisma.prospect.delete({ where: { id } });

  revalidatePath(PROSPECT_LIST_PATH);
  redirect(PROSPECT_LIST_PATH);
}

export async function listProspects() {
  const { tenantId } = await requireCabinetAdminSession();

  return prisma.prospect.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { devis: true } } },
  });
}

export type ProspectWithDevis = Prisma.ProspectGetPayload<{
  include: { devis: { orderBy: { createdAt: "desc" }; include: { catalogueFormule: true } } };
}>;

export async function getProspect(id: string): Promise<ProspectWithDevis> {
  const { tenantId } = await requireCabinetAdminSession();

  const prospect = await prisma.prospect.findFirst({
    where: { id, tenantId },
    include: {
      devis: { orderBy: { createdAt: "desc" }, include: { catalogueFormule: true } },
    },
  });

  if (!prospect) notFound();
  return prospect;
}
