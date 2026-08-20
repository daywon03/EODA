"use server";

import { prisma, type Prisma, type DevisStatus } from "@eoda/database";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  computeDevisAmounts,
  computeValidUntil,
  nextProspectStatusForDevisTransition,
  optionCommittedAmountEuros,
} from "@/lib/services/devis-calculation-service";
import { generateDevisNumber } from "@/lib/services/devis-numbering-service";

const DEVIS_LIST_PATH = "/dashboard/cabinet/commercial/devis";
const PROSPECT_LIST_PATH = "/dashboard/cabinet/commercial/prospects";
// Repli si le champ n'est pas transmis — même valeur que BillingSettings.defaultDepositPercent
// (CGP v10 §06 : acompte de 40 % à la commande).
const DEFAULT_DEPOSIT_PERCENT = 40;

type ParsedDevisInput = {
  prospectId: string;
  formule: "ESSENTIEL" | "PERFORMANCE" | "EXCELLENCE";
  optionIds: string[];
  depositPercent: number;
  installmentCount: number;
  validityDays: number;
};

function parseDevisInput(formData: FormData): { error: string } | ParsedDevisInput {
  const prospectId = formData.get("prospectId") as string | null;
  const formule = formData.get("formule") as "ESSENTIEL" | "PERFORMANCE" | "EXCELLENCE" | null;
  const depositPercentRaw = (formData.get("depositPercent") as string | null)?.trim();
  const installmentCountRaw = (formData.get("installmentCount") as string | null)?.trim();
  const validityDaysRaw = (formData.get("validityDays") as string | null)?.trim();

  if (!prospectId) return { error: "Prospect manquant." };
  if (!formule) return { error: "La formule est obligatoire." };

  // 40 % = acompte à la commande des CGP v10 §06, aligné sur BillingSettings.
  const depositPercent = depositPercentRaw ? Number(depositPercentRaw) : DEFAULT_DEPOSIT_PERCENT;
  const installmentCount = installmentCountRaw ? Number(installmentCountRaw) : 1;
  const validityDays = validityDaysRaw ? Number(validityDaysRaw) : 30;

  if (installmentCount < 1 || installmentCount > 6) {
    return { error: "Le nombre d'échéances doit être compris entre 1 et 6." };
  }
  if (depositPercent < 0 || depositPercent > 100) {
    return { error: "Le taux d'acompte doit être compris entre 0 et 100." };
  }

  const optionIds = formData.getAll("optionIds") as string[];

  return { prospectId, formule, optionIds, depositPercent, installmentCount, validityDays };
}

export async function createDevis(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetAdminSession();

  const parsed = parseDevisInput(formData);
  if ("error" in parsed) return parsed;

  const prospect = await prisma.prospect.findFirst({
    where: { id: parsed.prospectId, tenantId },
  });
  if (!prospect) notFound();

  const catalogueFormule = await prisma.catalogueFormule.findFirst({
    where: { tenantId, formule: parsed.formule, active: true },
  });
  if (!catalogueFormule) return { error: "Formule introuvable dans le catalogue." };

  const options = await prisma.catalogueOption.findMany({
    where: { tenantId, id: { in: parsed.optionIds }, active: true },
  });

  const amounts = computeDevisAmounts({
    formulePriceEuros: catalogueFormule.priceEuros,
    optionPricesEuros: options.map(optionCommittedAmountEuros),
    depositPercent: parsed.depositPercent,
    installmentCount: parsed.installmentCount,
  });

  const now = new Date();
  const validUntil = computeValidUntil(now, parsed.validityDays);
  const year = now.getFullYear();

  const devis = await prisma.$transaction(async (tx) => {
    const number = await generateDevisNumber(tx, tenantId, year);

    return tx.devis.create({
      data: {
        tenantId,
        prospectId: parsed.prospectId,
        number,
        catalogueFormuleId: catalogueFormule.id,
        formuleLabelSnapshot: catalogueFormule.label,
        formulePriceSnapshotEuros: catalogueFormule.priceEuros,
        depositPercent: parsed.depositPercent,
        installmentCount: parsed.installmentCount,
        validityDays: parsed.validityDays,
        validUntil,
        ...amounts,
        options: {
          create: options.map((o) => ({
            catalogueOptionId: o.id,
            labelSnapshot: o.label,
            priceSnapshotEuros: o.priceEuros,
            pricingUnitSnapshot: o.pricingUnit,
            priceMaxSnapshotEuros: o.priceMaxEuros,
            minQuantitySnapshot: o.minQuantity,
          })),
        },
      },
    });
  });

  revalidatePath(DEVIS_LIST_PATH);
  revalidatePath(`${PROSPECT_LIST_PATH}/${parsed.prospectId}`);
  redirect(`${DEVIS_LIST_PATH}/${devis.id}`);
}

export async function updateDevis(
  id: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetAdminSession();

  const existing = await prisma.devis.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();
  if (existing.status !== "BROUILLON") {
    return { error: "Seul un devis au statut Brouillon peut être modifié." };
  }

  const parsed = parseDevisInput(formData);
  if ("error" in parsed) return parsed;

  const catalogueFormule = await prisma.catalogueFormule.findFirst({
    where: { tenantId, formule: parsed.formule, active: true },
  });
  if (!catalogueFormule) return { error: "Formule introuvable dans le catalogue." };

  const options = await prisma.catalogueOption.findMany({
    where: { tenantId, id: { in: parsed.optionIds }, active: true },
  });

  const amounts = computeDevisAmounts({
    formulePriceEuros: catalogueFormule.priceEuros,
    optionPricesEuros: options.map(optionCommittedAmountEuros),
    depositPercent: parsed.depositPercent,
    installmentCount: parsed.installmentCount,
  });

  const validUntil = computeValidUntil(existing.createdAt, parsed.validityDays);

  await prisma.$transaction(async (tx) => {
    await tx.devisOption.deleteMany({ where: { devisId: id } });
    await tx.devis.update({
      where: { id },
      data: {
        catalogueFormuleId: catalogueFormule.id,
        formuleLabelSnapshot: catalogueFormule.label,
        formulePriceSnapshotEuros: catalogueFormule.priceEuros,
        depositPercent: parsed.depositPercent,
        installmentCount: parsed.installmentCount,
        validityDays: parsed.validityDays,
        validUntil,
        ...amounts,
        options: {
          create: options.map((o) => ({
            catalogueOptionId: o.id,
            labelSnapshot: o.label,
            priceSnapshotEuros: o.priceEuros,
            pricingUnitSnapshot: o.pricingUnit,
            priceMaxSnapshotEuros: o.priceMaxEuros,
            minQuantitySnapshot: o.minQuantity,
          })),
        },
      },
    });
  });

  revalidatePath(DEVIS_LIST_PATH);
  revalidatePath(`${DEVIS_LIST_PATH}/${id}`);
  redirect(`${DEVIS_LIST_PATH}/${id}`);
}

export async function changeDevisStatus(id: string, status: DevisStatus): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetAdminSession();

  await prisma.$transaction(async (tx) => {
    const devis = await tx.devis.findFirst({
      where: { id, tenantId },
      include: { prospect: { select: { id: true, status: true } } },
    });
    if (!devis) notFound();

    await tx.devis.update({ where: { id }, data: { status } });

    const nextProspectStatus = nextProspectStatusForDevisTransition(status, devis.prospect.status);
    if (nextProspectStatus) {
      await tx.prospect.update({
        where: { id: devis.prospect.id },
        data: { status: nextProspectStatus },
      });
    }
  });

  revalidatePath(DEVIS_LIST_PATH);
  revalidatePath(`${DEVIS_LIST_PATH}/${id}`);
  revalidatePath(PROSPECT_LIST_PATH);
  return null;
}

export async function listDevis() {
  const { tenantId } = await requireCabinetAdminSession();

  return prisma.devis.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    include: { prospect: true, catalogueFormule: true },
  });
}

export type DevisWithDetails = Prisma.DevisGetPayload<{
  include: {
    prospect: true;
    catalogueFormule: true;
    options: true;
  };
}>;

export async function getDevis(id: string): Promise<DevisWithDetails> {
  const { tenantId } = await requireCabinetAdminSession();

  const devis = await prisma.devis.findFirst({
    where: { id, tenantId },
    include: { prospect: true, catalogueFormule: true, options: true },
  });

  if (!devis) notFound();
  return devis;
}
