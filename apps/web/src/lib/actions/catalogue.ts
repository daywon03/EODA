"use server";

import { prisma } from "@eoda/database";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { revalidatePath } from "next/cache";

const CATALOGUE_PATH = "/dashboard/cabinet/commercial/catalogue";

export async function upsertCatalogueFormule(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetAdminSession();

  const formule = formData.get("formule") as "ESSENTIEL" | "PERFORMANCE" | "EXCELLENCE" | null;
  const label = (formData.get("label") as string | null)?.trim();
  const priceEurosRaw = (formData.get("priceEuros") as string | null)?.trim();
  const modulesLabel = (formData.get("modulesLabel") as string | null)?.trim() || null;
  const description = (formData.get("description") as string | null)?.trim() || null;

  if (!formule) return { error: "La formule est obligatoire." };
  if (!label) return { error: "Le libellé est obligatoire." };
  if (!priceEurosRaw || Number.isNaN(Number(priceEurosRaw))) {
    return { error: "Le prix doit être un nombre." };
  }

  await prisma.catalogueFormule.upsert({
    where: { tenantId_formule: { tenantId, formule } },
    update: { label, priceEuros: Number(priceEurosRaw), modulesLabel, description },
    create: {
      tenantId,
      formule,
      label,
      priceEuros: Number(priceEurosRaw),
      modulesLabel,
      description,
    },
  });

  revalidatePath(CATALOGUE_PATH);
  return null;
}

export async function upsertCatalogueOption(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetAdminSession();

  const code = (formData.get("code") as string | null)?.trim();
  const label = (formData.get("label") as string | null)?.trim();
  const priceEurosRaw = (formData.get("priceEuros") as string | null)?.trim();

  if (!code) return { error: "Le code de l'option est obligatoire." };
  if (!label) return { error: "Le libellé est obligatoire." };
  if (!priceEurosRaw || Number.isNaN(Number(priceEurosRaw))) {
    return { error: "Le prix doit être un nombre." };
  }

  await prisma.catalogueOption.upsert({
    where: { tenantId_code: { tenantId, code } },
    update: { label, priceEuros: Number(priceEurosRaw) },
    create: { tenantId, code, label, priceEuros: Number(priceEurosRaw) },
  });

  revalidatePath(CATALOGUE_PATH);
  return null;
}

export async function toggleCatalogueOptionActive(id: string, active: boolean): Promise<void> {
  const { tenantId } = await requireCabinetAdminSession();

  await prisma.catalogueOption.updateMany({ where: { id, tenantId }, data: { active } });

  revalidatePath(CATALOGUE_PATH);
}

export async function updateBillingSettings(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetAdminSession();

  const depositPercentRaw = (formData.get("defaultDepositPercent") as string | null)?.trim();
  const validityDaysRaw = (formData.get("defaultValidityDays") as string | null)?.trim();

  const defaultDepositPercent = depositPercentRaw ? Number(depositPercentRaw) : 30;
  const defaultValidityDays = validityDaysRaw ? Number(validityDaysRaw) : 30;

  if (defaultDepositPercent < 0 || defaultDepositPercent > 100) {
    return { error: "Le taux d'acompte doit être compris entre 0 et 100." };
  }

  await prisma.billingSettings.upsert({
    where: { tenantId },
    update: { defaultDepositPercent, defaultValidityDays },
    create: { tenantId, defaultDepositPercent, defaultValidityDays },
  });

  revalidatePath(CATALOGUE_PATH);
  return null;
}

export async function listCatalogue() {
  const { tenantId } = await requireCabinetAdminSession();

  const [formules, options, billingSettings] = await Promise.all([
    prisma.catalogueFormule.findMany({ where: { tenantId }, orderBy: { priceEuros: "asc" } }),
    prisma.catalogueOption.findMany({ where: { tenantId }, orderBy: { label: "asc" } }),
    prisma.billingSettings.findUnique({ where: { tenantId } }),
  ]);

  return { formules, options, billingSettings };
}
