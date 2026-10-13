"use server";

import { prisma, CommercialTier, DevisStatus } from "@eoda/database";
import { requireCommercialSession } from "@/lib/auth/guards";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendDevisEmail } from "@/lib/actions/devis-email";
import {
  DEFAULT_COMMITMENT_MONTHS,
  parseCommitmentMonths,
  type CommitmentMonths,
} from "@/lib/services/devis-recap-service";
import {
  computeDevisAmounts,
  computeValidUntil,
  devisContentError,
  nextProspectStatusForDevisTransition,
  optionCommittedAmountEuros,
} from "@/lib/services/devis-calculation-service";
import { optionUnitPriceForFormule } from "@/lib/services/subscription-service";
import {
  canTransitionDevis,
  isDevisDeletable,
  isDevisEditable,
} from "@/lib/services/devis-transition-service";
import { generateDevisNumber } from "@/lib/services/devis-numbering-service";
import { isConversionTransition } from "@/lib/services/conversion-service";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import {
  firstError,
  isEnumValue,
  optionalString,
  optionalEnum,
  requiredInt,
} from "@/lib/validation/form-parsers";

const DEVIS_LIST_PATH = "/dashboard/cabinet/commercial/devis";
const PROSPECT_LIST_PATH = "/dashboard/cabinet/commercial/prospects";
const COMMERCIAL_DASHBOARD_PATH = "/dashboard/cabinet/commercial";
// Repli si le champ n'est pas transmis — même valeur que BillingSettings.defaultDepositPercent
// (CGP v10 §06 : acompte de 40 % à la commande).
const DEFAULT_DEPOSIT_PERCENT = 40;

type ParsedDevisInput = {
  prospectId: string;
  // `null` = devis SANS offre (prestations à la carte seules, call du 01/09).
  formule: CommercialTier | null;
  optionIds: string[];
  depositPercent: number;
  installmentCount: number;
  validityDays: number;
  // Saisi pendant la réunion d'évaluation des besoins, en même temps que l'offre et
  // les options (§12.3). `undefined` = le champ n'était pas au formulaire (écran de
  // correction d'un brouillon) : on ne touche alors pas aux notes du prospect.
  needsAssessmentNotes: string | null | undefined;
  // Engagement de l'abonnement (12, 24, 0 = sans engagement) — maquette v2.
  commitmentMonths: CommitmentMonths;
  // Note pour la structure, reprise dans l'e-mail et sur le devis imprimé.
  clientNote: string | null;
};

function parseDevisInput(formData: FormData): { error: string } | ParsedDevisInput {
  // Parseurs typés plutôt que casts : une action serveur est une route HTTP
  // publique, `formData.get("formule") as CommercialTier` ne valide rien à
  // l'exécution (CLAUDE.md §5 bis).
  const prospectIdParsed = formData.get("prospectId");
  const prospectId = typeof prospectIdParsed === "string" ? prospectIdParsed.trim() : "";
  if (!prospectId) return { error: "Prospect manquant." };

  // Facultative : vide = prestations à la carte seules. Une valeur hors liste reste
  // un refus (optionalEnum), jamais un « sans offre » par défaut.
  const formule = optionalEnum(formData, "formule", "La formule", CommercialTier);
  const depositPercent = requiredInt(formData, "depositPercent", "Le taux d'acompte", {
    min: 0,
    max: 100,
    defaultValue: DEFAULT_DEPOSIT_PERCENT,
  });
  const installmentCount = requiredInt(formData, "installmentCount", "Le nombre d'échéances", {
    min: 1,
    max: 6,
    defaultValue: 1,
  });
  const validityDays = requiredInt(formData, "validityDays", "La durée de validité", {
    min: 1,
    max: 365,
    defaultValue: 30,
  });

  const hasNotesField = formData.has("needsAssessmentNotes");
  const needsAssessmentNotes = optionalString(
    formData,
    "needsAssessmentNotes",
    "Les notes d'évaluation des besoins",
    4000
  );

  const clientNote = optionalString(formData, "clientNote", "La note pour la structure", 2000);
  // Valeur fermée (12, 24, 0) : absente = 12 mois, hors liste = refus.
  const rawCommitment = formData.get("commitmentMonths");
  const commitmentMonths =
    rawCommitment === null ? DEFAULT_COMMITMENT_MONTHS : parseCommitmentMonths(rawCommitment);
  if (commitmentMonths === null) return { error: "Choisissez un engagement : 12 mois, 24 mois ou sans engagement." };

  const error = firstError(
    formule,
    depositPercent,
    installmentCount,
    validityDays,
    needsAssessmentNotes,
    clientNote
  );
  if (error) return { error };
  if (
    !formule.ok ||
    !depositPercent.ok ||
    !installmentCount.ok ||
    !validityDays.ok ||
    !needsAssessmentNotes.ok ||
    !clientNote.ok
  ) {
    return { error: "Saisie invalide." };
  }

  // `getAll` peut renvoyer des File : on ne garde que les chaînes non vides.
  const optionIds = formData
    .getAll("optionIds")
    .filter((value): value is string => typeof value === "string" && value.length > 0);

  const contentError = devisContentError(formule.value !== null, optionIds.length);
  if (contentError) return { error: contentError };

  return {
    prospectId,
    formule: formule.value,
    optionIds,
    depositPercent: depositPercent.value,
    installmentCount: installmentCount.value,
    validityDays: validityDays.value,
    needsAssessmentNotes: hasNotesField ? needsAssessmentNotes.value : undefined,
    commitmentMonths,
    clientNote: clientNote.value,
  };
}

// Colonnes d'un devis communes à la création et à la correction (D1) — snapshots de
// l'offre (forfait ET prix mensuel), engagement, note, montants recalculés.
function devisContentData(parsed: ParsedDevisInput, lines: ResolvedDevisLines, validUntil: Date) {
  return {
    catalogueFormuleId: lines.catalogueFormule?.id ?? null,
    formuleLabelSnapshot: lines.catalogueFormule?.label ?? null,
    formulePriceSnapshotEuros: lines.catalogueFormule?.priceEuros ?? null,
    formuleMonthlyPriceSnapshotEuros: lines.catalogueFormule?.monthlyPriceEuros ?? null,
    commitmentMonths: parsed.commitmentMonths,
    clientNote: parsed.clientNote,
    depositPercent: parsed.depositPercent,
    installmentCount: parsed.installmentCount,
    validityDays: parsed.validityDays,
    validUntil,
    ...lines.amounts,
    options: {
      create: lines.options.map((o) => ({
        catalogueOptionId: o.id,
        labelSnapshot: o.label,
        priceSnapshotEuros: o.engagedUnitPriceEuros,
        pricingUnitSnapshot: o.pricingUnit,
        priceMaxSnapshotEuros: o.priceMaxEuros,
        minQuantitySnapshot: o.minQuantity,
      })),
    },
  };
}

// Charge la formule et les options du catalogue et recalcule les montants côté
// serveur. Partagé par la création et la modification (D1 — la même règle écrite
// deux fois est la même règle corrigée une fois sur deux).
async function resolveDevisLines(tenantId: string, parsed: ParsedDevisInput) {
  const catalogueFormule =
    parsed.formule === null
      ? null
      : await prisma.catalogueFormule.findFirst({
          where: { tenantId, formule: parsed.formule, active: true },
        });
  if (parsed.formule !== null && !catalogueFormule) {
    return { error: "Formule introuvable ou retirée du catalogue." as const };
  }

  // `active: true` : une prestation retirée du catalogue n'est plus vendable, même
  // si son identifiant est réinjecté à la main dans la requête.
  const options = await prisma.catalogueOption.findMany({
    where: { tenantId, id: { in: parsed.optionIds }, active: true },
  });
  // Sans offre, le devis n'a de contenu que par ses options : si toutes ont été
  // retirées du catalogue entre-temps, il serait vide.
  const contentError = devisContentError(catalogueFormule !== null, options.length);
  if (contentError) return { error: contentError };

  // Dégressivité de l'abonnement portail selon l'OFFRE du devis (§12.2 : « le calcul
  // doit vivre dans l'outil »). Appliquée ici, une seule fois, puis SNAPSHOTÉE sur la
  // ligne de devis : le montant remisé fait partie du document commercial, il ne doit
  // pas se recalculer plus tard sous une autre formule.
  const pricedOptions = options.map((option) => ({
    ...option,
    engagedUnitPriceEuros: optionUnitPriceForFormule(option, parsed.formule),
  }));

  const amounts = computeDevisAmounts({
    formulePriceEuros: catalogueFormule?.priceEuros ?? 0,
    optionPricesEuros: pricedOptions.map((option) =>
      optionCommittedAmountEuros({
        priceEuros: option.engagedUnitPriceEuros,
        minQuantity: option.minQuantity,
      })
    ),
    depositPercent: parsed.depositPercent,
    installmentCount: parsed.installmentCount,
  });

  return { catalogueFormule, options: pricedOptions, amounts };
}

type ResolvedDevisLines = Exclude<Awaited<ReturnType<typeof resolveDevisLines>>, { error: string }>;

export async function createDevis(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCommercialSession();

  const parsed = parseDevisInput(formData);
  if ("error" in parsed) return parsed;

  const prospect = await prisma.prospect.findFirst({
    where: { id: parsed.prospectId, tenantId },
  });
  if (!prospect) notFound();

  const lines = await resolveDevisLines(tenantId, parsed);
  if ("error" in lines) return { error: lines.error };

  const now = new Date();
  const validUntil = computeValidUntil(now, parsed.validityDays);
  const year = now.getFullYear();

  const devis = await prisma.$transaction(async (tx) => {
    const number = await generateDevisNumber(tx, tenantId, year);

    // Écran d'évaluation des besoins : les notes prises pendant l'appel sont
    // enregistrées dans la même transaction que le devis qu'elles justifient. Le
    // formulaire de correction d'un brouillon ne porte pas ce champ et ne les
    // écrase donc pas.
    if (parsed.needsAssessmentNotes !== undefined) {
      await tx.prospect.update({
        where: { id: parsed.prospectId },
        data: { needsAssessmentNotes: parsed.needsAssessmentNotes },
      });
    }

    return tx.devis.create({
      data: { tenantId, prospectId: parsed.prospectId, number, ...devisContentData(parsed, lines, validUntil) },
    });
  });

  revalidatePath(DEVIS_LIST_PATH);
  revalidatePath(`${PROSPECT_LIST_PATH}/${parsed.prospectId}`);

  // « Envoyer le devis » (maquette v2) : le brouillon est créé PUIS envoyé par le
  // même chemin que le bouton « Envoyer » (PDF joint, journalisé). Un envoi qui
  // n'aboutit pas ne défait pas la création : le devis reste en brouillon, et sa
  // fiche le dit.
  if (formData.get("intent") === "send") {
    const sent = await sendDevisEmail(devis.id);
    if (sent) redirect(`${DEVIS_LIST_PATH}/${devis.id}?envoi=echec`);
    redirect(`${DEVIS_LIST_PATH}?onglet=en-cours`);
  }
  redirect(`${DEVIS_LIST_PATH}/${devis.id}`);
}

export async function updateDevis(
  id: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCommercialSession();

  const existing = await prisma.devis.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();
  if (!isDevisEditable(existing.status)) {
    return { error: "Seul un devis au statut Brouillon peut être modifié." };
  }

  const parsed = parseDevisInput(formData);
  if ("error" in parsed) return parsed;

  const lines = await resolveDevisLines(tenantId, parsed);
  if ("error" in lines) return { error: lines.error };

  // La validité court depuis la création, pas depuis la correction : le numéro et
  // la date d'émission du devis ne changent pas quand on rectifie un brouillon.
  const validUntil = computeValidUntil(existing.createdAt, parsed.validityDays);

  await prisma.$transaction(async (tx) => {
    await tx.devisOption.deleteMany({ where: { devisId: id } });
    await tx.devis.update({
      where: { id },
      data: devisContentData(parsed, lines, validUntil),
    });
  });

  revalidatePath(DEVIS_LIST_PATH);
  revalidatePath(`${DEVIS_LIST_PATH}/${id}`);
  redirect(`${DEVIS_LIST_PATH}/${id}`);
}

export async function changeDevisStatus(
  id: string,
  status: DevisStatus
): Promise<{ error: string } | null> {
  const { userId, tenantId, role } = await requireCommercialSession();

  // `status` est un argument d'action serveur : il vient d'une route HTTP publique,
  // pas de la table de transitions du composant client. Sans cette vérification,
  // un appel direct pouvait poser n'importe quelle valeur d'enum, y compris
  // ramener un devis signé en brouillon (constat N4 de l'audit).
  if (!isEnumValue(status, DevisStatus)) {
    return { error: "Statut de devis invalide." };
  }

  // La signature ne passe PAS par ici. C'est la seule transition qui produit des
  // effets hors du module commercial — fiche établissement, mission, périmètre
  // ouvert au client (§12.4) — et elle exige une information que cette action ne
  // possède pas : le type de SAD, qui n'est dérivable d'aucune donnée du prospect.
  // Signer sans créer le profil était exactement la charnière manuelle du parcours.
  if (isConversionTransition(status)) {
    return {
      error:
        "La signature se confirme depuis l'écran de signature du devis : elle crée la fiche client et son profil.",
    };
  }

  const changed = await prisma.$transaction(async (tx) => {
    const devis = await tx.devis.findFirst({
      where: { id, tenantId },
      include: { prospect: { select: { id: true, status: true } } },
    });
    if (!devis) notFound();

    if (!canTransitionDevis(devis.status, status)) {
      return { error: "Cette transition de statut n'est pas autorisée." as const };
    }

    await tx.devis.update({ where: { id }, data: { status } });

    // Une annulation ne rétrograde PAS le prospect (la fonction renvoie null pour
    // ANNULE) : le prospect a pu signer un autre devis, et deviner son statut
    // commercial à partir d'une correction de saisie serait une décision métier
    // que l'outil n'a pas à prendre à la place de Sandrine.
    const nextProspectStatus = nextProspectStatusForDevisTransition(status, devis.prospect.status);
    if (nextProspectStatus) {
      await tx.prospect.update({
        where: { id: devis.prospect.id },
        data: { status: nextProspectStatus },
      });
    }

    return { number: devis.number };
  });

  if ("error" in changed) return { error: changed.error };

  // L'annulation est irréversible et retire le devis de tous les indicateurs :
  // elle se trace. `detail` = le numéro du devis, clé technique, jamais une
  // donnée personnelle.
  if (status === "ANNULE") {
    await recordAuditEvent({
      action: "DEVIS_CANCELLED",
      actorUserId: userId,
      actorRole: role,
      targetId: id,
      detail: changed.number,
    });
  }

  revalidatePath(DEVIS_LIST_PATH);
  revalidatePath(`${DEVIS_LIST_PATH}/${id}`);
  revalidatePath(PROSPECT_LIST_PATH);
  revalidatePath(COMMERCIAL_DASHBOARD_PATH);
  return null;
}

// Suppression RÉELLE, réservée au brouillon. Un brouillon n'a jamais été émis :
// son numéro n'a circulé nulle part, rien de contractuel ne s'y rattache. Un devis
// émis, lui, ne se supprime jamais — il s'annule (`changeDevisStatus(..., "ANNULE")`),
// pour que la série DEVIS-AAAA-NNN reste sans trou.
export async function deleteDevis(id: string): Promise<{ error: string } | void> {
  const { userId, tenantId, role } = await requireCommercialSession();

  const devis = await prisma.devis.findFirst({ where: { id, tenantId } });
  if (!devis) notFound();

  if (!isDevisDeletable(devis.status)) {
    return {
      error: "Un devis déjà émis ne se supprime pas : annulez-le pour conserver son numéro.",
    };
  }

  const prospectId = devis.prospectId;

  await prisma.$transaction(async (tx) => {
    await tx.devisOption.deleteMany({ where: { devisId: id } });
    await tx.devis.delete({ where: { id } });
  });

  await recordAuditEvent({
    action: "DEVIS_DELETED",
    actorUserId: userId,
    actorRole: role,
    targetId: id,
    detail: devis.number,
  });

  revalidatePath(DEVIS_LIST_PATH);
  revalidatePath(`${PROSPECT_LIST_PATH}/${prospectId}`);
  revalidatePath(COMMERCIAL_DASHBOARD_PATH);
  redirect(`${PROSPECT_LIST_PATH}/${prospectId}`);
}
