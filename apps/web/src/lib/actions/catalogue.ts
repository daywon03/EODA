"use server";

import { prisma, CommercialTier, PricingUnit } from "@eoda/database";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import {
  firstError,
  optionalInt,
  optionalString,
  requiredEnum,
  requiredInt,
  requiredString,
} from "@/lib/validation/form-parsers";

const CATALOGUE_PATH = "/dashboard/cabinet/commercial/catalogue";

// Borne haute des prix saisissables. Un devis agrège prix × quantité minimale dans
// `Devis.totalAmountEuros`, colonne INTEGER : sans borne, une faute de frappe
// (10 000 000 €) déborde en base et remonte en 500 au lieu d'une erreur de saisie.
const MAX_PRICE_EUROS = 1_000_000;

export async function upsertCatalogueFormule(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetAdminSession();

  const formule = requiredEnum(formData, "formule", "La formule", CommercialTier);
  const label = requiredString(formData, "label", "Le libellé", 200);
  const priceEuros = requiredInt(formData, "priceEuros", "Le prix", {
    min: 0,
    max: MAX_PRICE_EUROS,
  });
  const modulesLabel = optionalString(formData, "modulesLabel", "Les modules", 200);
  const description = optionalString(formData, "description", "La description", 2000);

  const error = firstError(formule, label, priceEuros, modulesLabel, description);
  if (error) return { error };
  if (!formule.ok || !label.ok || !priceEuros.ok || !modulesLabel.ok || !description.ok) {
    return { error: "Saisie invalide." };
  }

  const values = {
    label: label.value,
    priceEuros: priceEuros.value,
    modulesLabel: modulesLabel.value,
    description: description.value,
  };

  await prisma.catalogueFormule.upsert({
    where: { tenantId_formule: { tenantId, formule: formule.value } },
    update: values,
    create: { tenantId, formule: formule.value, ...values },
  });

  revalidatePath(CATALOGUE_PATH);
  return null;
}

export async function upsertCatalogueOption(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetAdminSession();

  // Parseurs typés plutôt que casts : une action serveur est une route HTTP
  // publique, `formData.get("pricingUnit") as PricingUnit` ne validerait rien à
  // l'exécution (CLAUDE.md §5 bis).
  const code = requiredString(formData, "code", "Le code de l'option", 60);
  const label = requiredString(formData, "label", "Le libellé", 200);
  const priceEuros = requiredInt(formData, "priceEuros", "Le prix", { min: 0, max: MAX_PRICE_EUROS });
  const pricingUnit = requiredEnum(formData, "pricingUnit", "L'unité de tarification", PricingUnit);
  const priceMaxEuros = optionalInt(formData, "priceMaxEuros", "Le prix maximum", {
    min: 0,
    max: MAX_PRICE_EUROS,
  });
  const minQuantity = optionalInt(formData, "minQuantity", "La quantité minimale", {
    min: 1,
    max: 999,
  });

  const error = firstError(code, label, priceEuros, pricingUnit, priceMaxEuros, minQuantity);
  if (error) return { error };
  if (!code.ok || !label.ok || !priceEuros.ok || !pricingUnit.ok || !priceMaxEuros.ok || !minQuantity.ok) {
    return { error: "Saisie invalide." };
  }

  if (priceMaxEuros.value !== null && priceMaxEuros.value <= priceEuros.value) {
    return { error: "Le prix maximum d'une fourchette doit être supérieur au prix de départ." };
  }
  if (pricingUnit.value === "FORFAIT" && minQuantity.value !== null) {
    return { error: "Une quantité minimale n'a pas de sens sur un forfait." };
  }

  const values = {
    label: label.value,
    priceEuros: priceEuros.value,
    pricingUnit: pricingUnit.value,
    priceMaxEuros: priceMaxEuros.value,
    minQuantity: minQuantity.value,
  };

  await prisma.catalogueOption.upsert({
    where: { tenantId_code: { tenantId, code: code.value } },
    update: values,
    create: { tenantId, code: code.value, ...values },
  });

  revalidatePath(CATALOGUE_PATH);
  return null;
}

// ── Retrait / remise en vente d'une ligne de catalogue ───────────────────────
//
// Retirer une ligne ne la supprime pas : les devis qui la référencent doivent
// rester lisibles. Ils le sont par construction — chaque devis fige un snapshot
// du libellé et du prix (`formuleLabelSnapshot`, `DevisOption.labelSnapshot`), et
// les relations `catalogueFormule` / `catalogueOption` ne filtrent jamais sur
// `active`. Seuls les sélecteurs (page « nouveau devis ») et les actions d'écriture
// (`resolveDevisLines`) filtrent `active: true` : une ligne retirée disparaît des
// listes déroulantes et refuse d'être vendue, y compris si son identifiant est
// réinjecté à la main dans la requête.
//
// `active` arrive en argument d'action serveur : on le valide comme n'importe
// quelle entrée, un `boolean` TypeScript ne garantit rien à l'exécution.
function parseActiveFlag(active: unknown): { error: string } | { value: boolean } {
  if (typeof active !== "boolean") return { error: "État de disponibilité invalide." };
  return { value: active };
}

async function recordCatalogueToggle(
  userId: string,
  active: boolean,
  targetId: string,
  detail: string
): Promise<void> {
  await recordAuditEvent({
    action: active ? "CATALOGUE_ITEM_RESTORED" : "CATALOGUE_ITEM_RETIRED",
    actorUserId: userId,
    actorRole: "CABINET_ADMIN",
    targetId,
    // Code de la ligne de catalogue / nom de la formule : clé technique, jamais
    // une donnée personnelle.
    detail,
  });
}

export async function toggleCatalogueOptionActive(
  id: string,
  active: boolean
): Promise<{ error: string } | null> {
  const { userId, tenantId } = await requireCabinetAdminSession();

  const parsed = parseActiveFlag(active);
  if ("error" in parsed) return parsed;

  // findFirst + update plutôt qu'updateMany : sans lecture préalable, un
  // identifiant appartenant à un autre tenant renvoyait « 0 ligne modifiée » et
  // un succès silencieux. notFound() ne révèle pas qu'il existe ailleurs.
  const option = await prisma.catalogueOption.findFirst({ where: { id, tenantId } });
  if (!option) notFound();

  await prisma.catalogueOption.update({ where: { id }, data: { active: parsed.value } });
  await recordCatalogueToggle(userId, parsed.value, id, option.code);

  revalidatePath(CATALOGUE_PATH);
  return null;
}

export async function toggleCatalogueFormuleActive(
  id: string,
  active: boolean
): Promise<{ error: string } | null> {
  const { userId, tenantId } = await requireCabinetAdminSession();

  const parsed = parseActiveFlag(active);
  if ("error" in parsed) return parsed;

  const formule = await prisma.catalogueFormule.findFirst({ where: { id, tenantId } });
  if (!formule) notFound();

  await prisma.catalogueFormule.update({ where: { id }, data: { active: parsed.value } });
  await recordCatalogueToggle(userId, parsed.value, id, formule.formule);

  revalidatePath(CATALOGUE_PATH);
  return null;
}

export async function updateBillingSettings(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCabinetAdminSession();

  // `Number("abc")` vaut NaN, et NaN échoue silencieusement aux comparaisons : sans
  // parseur, une saisie non numérique traversait la validation et partait en base.
  const depositPercent = optionalInt(formData, "defaultDepositPercent", "Le taux d'acompte", {
    min: 0,
    max: 100,
  });
  const validityDays = optionalInt(formData, "defaultValidityDays", "La durée de validité", {
    min: 1,
    max: 365,
  });

  const error = firstError(depositPercent, validityDays);
  if (error) return { error };
  if (!depositPercent.ok || !validityDays.ok) return { error: "Saisie invalide." };

  // 40 % à la commande, validité 30 jours — CGP de l'offre commerciale v10 §06.
  const defaultDepositPercent = depositPercent.value ?? 40;
  const defaultValidityDays = validityDays.value ?? 30;

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
