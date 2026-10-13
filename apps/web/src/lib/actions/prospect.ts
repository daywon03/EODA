"use server";

import {
  prisma,
  AcquisitionChannel,
  Civility,
  CommercialTier,
  ContactRole,
  EstablishmentType,
  ProspectStatus,
  StructureType,
  type Prisma,
} from "@eoda/database";
import { requireCommercialSession } from "@/lib/auth/guards";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  firstError,
  isEnumValue,
  optionalDate,
  optionalEnum,
  optionalInt,
  optionalString,
  requiredDate,
  requiredEnum,
  requiredString,
} from "@/lib/validation/form-parsers";
import {
  isSelfServiceChannel,
  keepPrecisionOnlyForOther,
  otherPrecisionError,
} from "@/lib/services/prospect-contact-service";
import {
  finessFormatError,
  normaliseFiness,
  normaliseSiret,
  siretFormatError,
} from "@/lib/services/structure-identity-service";

const PROSPECT_LIST_PATH = "/dashboard/cabinet/commercial/prospects";

type ParsedProspect = {
  structureName: string;
  structureType: StructureType;
  // Identité de la structure — facultative au stade prospect, recopiée sur la fiche
  // à la signature (structure-identity-service).
  finessNumber: string | null;
  siretNumber: string | null;
  address: string | null;
  establishmentType: EstablishmentType | null;
  hasEvaluationTargetDate: Date | null;
  channel: AcquisitionChannel;
  channelOther: string | null;
  civility: Civility | null;
  contactName: string | null;
  contactRole: ContactRole | null;
  contactRoleOther: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  envisagedFormule: CommercialTier | null;
  estimatedAmountEuros: number | null;
  firstContactDate: Date;
  needsAssessmentNotes: string | null;
  notes: string | null;
};

// Les enums passaient par des casts `formData.get("x") as "A" | "B"`, qui ne valident
// rien à l'exécution : une action serveur est une route HTTP publique, appelable sans
// le <select> qui la borne à l'écran (CLAUDE.md §5 bis). Repris par les parseurs au
// moment d'ajouter les nouveaux champs.
function parseProspectInput(formData: FormData): { error: string } | ParsedProspect {
  const structureName = requiredString(formData, "structureName", "Le nom de la structure", 200);
  const structureType = requiredEnum(formData, "structureType", "Le type de structure", StructureType);
  const finessNumber = optionalString(formData, "finessNumber", "Le numéro FINESS", 20);
  const siretNumber = optionalString(formData, "siretNumber", "Le numéro SIRET", 20);
  const address = optionalString(formData, "address", "L'adresse", 300);
  const establishmentType = optionalEnum(formData, "establishmentType", "Le type de SAD", EstablishmentType);
  const hasEvaluationTargetDate = optionalDate(
    formData,
    "hasEvaluationTargetDate",
    "L'échéance d'évaluation HAS"
  );
  const channel = requiredEnum(formData, "channel", "Le canal d'acquisition", AcquisitionChannel);
  const channelOther = optionalString(formData, "channelOther", "La précision du canal", 200);
  const civility = optionalEnum(formData, "civility", "La civilité", Civility);
  const contactName = optionalString(formData, "contactName", "Le nom du contact", 200);
  const contactRole = optionalEnum(formData, "contactRole", "La fonction du contact", ContactRole);
  const contactRoleOther = optionalString(formData, "contactRoleOther", "La précision de la fonction", 200);
  const contactPhone = optionalString(formData, "contactPhone", "Le téléphone", 40);
  const contactEmail = optionalString(formData, "contactEmail", "L'e-mail", 200);
  const envisagedFormule = optionalEnum(formData, "envisagedFormule", "La formule envisagée", CommercialTier);
  const estimatedAmountEuros = optionalInt(formData, "estimatedAmountEuros", "Le montant estimé", { min: 0 });
  const firstContactDate = requiredDate(formData, "firstContactDate", "La date de premier contact");
  const needsAssessmentNotes = optionalString(formData, "needsAssessmentNotes", "L'évaluation des besoins");
  const notes = optionalString(formData, "notes", "Les notes");

  const error = firstError(
    structureName,
    structureType,
    finessNumber,
    siretNumber,
    address,
    establishmentType,
    hasEvaluationTargetDate,
    channel,
    channelOther,
    civility,
    contactName,
    contactRole,
    contactRoleOther,
    contactPhone,
    contactEmail,
    envisagedFormule,
    estimatedAmountEuros,
    firstContactDate,
    needsAssessmentNotes,
    notes
  );
  if (error) return { error };
  if (
    !structureName.ok ||
    !structureType.ok ||
    !finessNumber.ok ||
    !siretNumber.ok ||
    !address.ok ||
    !establishmentType.ok ||
    !hasEvaluationTargetDate.ok ||
    !channel.ok ||
    !channelOther.ok ||
    !civility.ok ||
    !contactName.ok ||
    !contactRole.ok ||
    !contactRoleOther.ok ||
    !contactPhone.ok ||
    !contactEmail.ok ||
    !envisagedFormule.ok ||
    !estimatedAmountEuros.ok ||
    !firstContactDate.ok ||
    !needsAssessmentNotes.ok ||
    !notes.ok
  ) {
    return { error: "Formulaire invalide." };
  }

  // « Autre » sans précision n'enregistre pas une information, il enregistre qu'on ne
  // sait pas — et fait disparaître de l'analyse d'acquisition exactement les cas
  // nouveaux qu'il faudrait repérer.
  const channelError = otherPrecisionError(channel.value, channelOther.value, "le canal d'acquisition");
  if (channelError) return { error: channelError };
  const roleError = otherPrecisionError(contactRole.value, contactRoleOther.value, "la fonction du contact");
  if (roleError) return { error: roleError };

  // FINESS : normalisé (« 99 00 00 017 » = « 990000017 ») puis contrôlé sur sa FORME.
  // Même règle qu'à la signature, même fonction — deux contrôles de FINESS finiraient
  // par accepter des choses différentes (D1).
  const finess = normaliseFiness(finessNumber.value);
  const finessError = finessFormatError(finess);
  if (finessError) return { error: finessError };

  // Même traitement pour le SIRET : « 802 341 209 00016 » est le même numéro que
  // « 80234120900016 ».
  const siret = normaliseSiret(siretNumber.value);
  const siretError = siretFormatError(siret);
  if (siretError) return { error: siretError };

  return {
    structureName: structureName.value,
    structureType: structureType.value,
    finessNumber: finess,
    siretNumber: siret,
    address: address.value,
    establishmentType: establishmentType.value,
    hasEvaluationTargetDate: hasEvaluationTargetDate.value,
    channel: channel.value,
    // La précision ne survit pas à un changement de valeur : sinon un commentaire
    // orphelin contredit le champ affiché.
    channelOther: keepPrecisionOnlyForOther(channel.value, channelOther.value),
    civility: civility.value,
    contactName: contactName.value,
    contactRole: contactRole.value,
    contactRoleOther: keepPrecisionOnlyForOther(contactRole.value, contactRoleOther.value),
    contactPhone: contactPhone.value,
    contactEmail: contactEmail.value,
    envisagedFormule: envisagedFormule.value,
    estimatedAmountEuros: estimatedAmountEuros.value,
    firstContactDate: firstContactDate.value,
    needsAssessmentNotes: needsAssessmentNotes.value,
    notes: notes.value,
  };
}

const SELF_SERVICE_CHANNEL_ERROR =
  "Le canal « Inscription en ligne » est réservé aux structures inscrites seules : il ne se choisit ni ne se retire à la main.";

export async function createProspect(
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCommercialSession();

  const parsed = parseProspectInput(formData);
  if ("error" in parsed) return parsed;
  if (isSelfServiceChannel(parsed.channel)) return { error: SELF_SERVICE_CHANNEL_ERROR };

  const prospect = await prisma.prospect.create({ data: { ...parsed, tenantId } });

  revalidatePath(PROSPECT_LIST_PATH);
  redirect(`${PROSPECT_LIST_PATH}/${prospect.id}`);
}

export async function updateProspect(
  id: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId } = await requireCommercialSession();

  const existing = await prisma.prospect.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();

  const parsed = parseProspectInput(formData);
  if ("error" in parsed) return parsed;
  // Le canal « libre-service » ne se pose qu'à l'inscription en ligne, et ne se perd
  // pas : il dit que la structure a un espace.
  if (isSelfServiceChannel(parsed.channel) !== isSelfServiceChannel(existing.channel)) {
    return { error: SELF_SERVICE_CHANNEL_ERROR };
  }

  await prisma.prospect.update({ where: { id }, data: parsed });

  revalidatePath(PROSPECT_LIST_PATH);
  revalidatePath(`${PROSPECT_LIST_PATH}/${id}`);
  redirect(`${PROSPECT_LIST_PATH}/${id}`);
}

// Identité administrative seule — statut juridique, adresse, FINESS, SIRET, type de
// SAD, échéance HAS — enregistrable SANS repasser par le formulaire complet.
//
// Pourquoi une action à part plutôt qu'un lien vers « Modifier » : ces quatre
// informations se recueillent PENDANT la réunion de découverte, en même temps que la
// grille d'entretien (« j'aimerais bien pouvoir le rentrer soit au début, soit au
// milieu, à n'importe quel moment : FINESS, SIRET, structure juridique » — call du
// 01/09). Envoyer la consultante sur un autre écran au milieu d'un appel lui ferait
// perdre les réponses de grille non encore enregistrées.
//
// Ce que cette action NE fait pas : toucher au contact, au canal d'acquisition, à la
// formule envisagée ou aux notes. Un formulaire partiel qui poste des champs absents
// les effacerait — c'est pour ça que le parseur complet n'est pas réutilisé ici.
export async function updateProspectIdentity(
  prospectId: string,
  _prevState: { error: string } | { ok: true } | null,
  formData: FormData
): Promise<{ error: string } | { ok: true }> {
  const { tenantId } = await requireCommercialSession();

  // `prospectId` arrive par une route HTTP publique : l'appartenance se vérifie en
  // base, elle ne se déduit pas du fait que l'écran l'a affiché.
  const existing = await prisma.prospect.findFirst({
    where: { id: prospectId, tenantId },
    select: { id: true },
  });
  if (!existing) notFound();

  const structureType = requiredEnum(formData, "structureType", "Le statut juridique", StructureType);
  const finessNumber = optionalString(formData, "finessNumber", "Le numéro FINESS", 20);
  const siretNumber = optionalString(formData, "siretNumber", "Le numéro SIRET", 20);
  const address = optionalString(formData, "address", "L'adresse", 300);
  // Type de SAD et échéance HAS sont ici parce que la grille d'entretien v03 les
  // demande en découverte (§1 et §3). Ils ont une COLONNE : les reposer dans la
  // grille en ferait une seconde source, et c'est la colonne qui alimente le devis,
  // le périmètre de critères et les indicateurs.
  const establishmentType = optionalEnum(formData, "establishmentType", "Le type de SAD", EstablishmentType);
  const hasEvaluationTargetDate = optionalDate(
    formData,
    "hasEvaluationTargetDate",
    "L'échéance d'évaluation HAS"
  );

  const error = firstError(
    structureType,
    finessNumber,
    siretNumber,
    address,
    establishmentType,
    hasEvaluationTargetDate
  );
  if (error) return { error };
  if (
    !structureType.ok ||
    !finessNumber.ok ||
    !siretNumber.ok ||
    !address.ok ||
    !establishmentType.ok ||
    !hasEvaluationTargetDate.ok
  ) {
    return { error: "Formulaire invalide." };
  }

  // Mêmes règles de normalisation et de forme qu'à la création et qu'à la signature.
  const finess = normaliseFiness(finessNumber.value);
  const finessError = finessFormatError(finess);
  if (finessError) return { error: finessError };

  const siret = normaliseSiret(siretNumber.value);
  const siretError = siretFormatError(siret);
  if (siretError) return { error: siretError };

  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      structureType: structureType.value,
      finessNumber: finess,
      siretNumber: siret,
      address: address.value,
      establishmentType: establishmentType.value,
      hasEvaluationTargetDate: hasEvaluationTargetDate.value,
    },
  });

  revalidatePath(`${PROSPECT_LIST_PATH}/${prospectId}`);
  revalidatePath(`${PROSPECT_LIST_PATH}/${prospectId}/decouverte`);
  return { ok: true };
}

export async function updateProspectStatus(
  id: string,
  status: ProspectStatus
): Promise<{ error: string } | null> {
  const { tenantId, userId } = await requireCommercialSession();

  // `status` arrive en argument d'action serveur, donc par une route HTTP publique :
  // le <select> qui le borne à l'écran ne le valide pas (CLAUDE.md §5 bis).
  if (!isEnumValue(status, ProspectStatus)) return { error: "Statut invalide." };

  const existing = await prisma.prospect.findFirst({ where: { id, tenantId } });
  if (!existing) notFound();

  // Rien à écrire si l'étape ne change pas : sinon la frise se remplit de lignes
  // « Nouveau → Nouveau » à chaque ouverture du menu déroulant.
  if (existing.status === status) return null;

  // Le changement et sa trace dans la même transaction. Séparés, un incident laisse
  // une étape sans histoire — et c'est justement l'histoire qu'on cherche à
  // reconstituer.
  await prisma.$transaction([
    prisma.prospect.update({ where: { id }, data: { status } }),
    prisma.prospectTimelineEntry.create({
      data: {
        tenantId,
        prospectId: id,
        kind: "CHANGEMENT_STATUT",
        authorUserId: userId,
        statusFrom: existing.status,
        statusTo: status,
      },
    }),
  ]);

  revalidatePath(PROSPECT_LIST_PATH);
  revalidatePath(`${PROSPECT_LIST_PATH}/${id}`);
  return null;
}

// Commentaire libre sur le dossier — la demande de Sandrine : « qu'on puisse mettre
// des commentaires si entre-temps ils nous envoyaient des mails, des questions ».
//
// APPEND-ONLY : il n'existe volontairement ni modification ni suppression d'une
// entrée. Un historique réécrivable ne prouve rien, et c'est ce dossier qui sert à
// répondre « pourquoi en sommes-nous là ? » six mois plus tard.
export async function addProspectComment(
  prospectId: string,
  _prevState: { error: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const { tenantId, userId } = await requireCommercialSession();

  const existing = await prisma.prospect.findFirst({ where: { id: prospectId, tenantId } });
  if (!existing) notFound();

  const body = requiredString(formData, "body", "Le commentaire", 2000);
  if (!body.ok) return { error: body.error };

  await prisma.prospectTimelineEntry.create({
    data: { tenantId, prospectId, kind: "COMMENTAIRE", authorUserId: userId, body: body.value },
  });

  revalidatePath(`${PROSPECT_LIST_PATH}/${prospectId}`);
  return null;
}

export async function deleteProspect(id: string): Promise<{ error: string } | void> {
  const { tenantId } = await requireCommercialSession();

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

// Le kanban par étape et ses compteurs sont retirés (maquette v2, décision de Damon
// du 13/10/2026) : le tableau « Prospects » et la vue d'ensemble
// (lib/actions/prospect-pipeline.ts, commercial-overview.ts) les remplacent ;
// l'étape commerciale d'un prospect se change depuis sa fiche.

export type ProspectWithDevis = Prisma.ProspectGetPayload<{
  include: {
    devis: { orderBy: { createdAt: "desc" }; include: { catalogueFormule: true } };
    timeline: {
      orderBy: { createdAt: "desc" };
      include: { author: { select: { name: true } } };
    };
  };
}>;

export async function getProspect(id: string): Promise<ProspectWithDevis> {
  const { tenantId } = await requireCommercialSession();

  const prospect = await prisma.prospect.findFirst({
    where: { id, tenantId },
    include: {
      devis: { orderBy: { createdAt: "desc" }, include: { catalogueFormule: true } },
      // L'historique du dossier, du plus récent au plus ancien. Chargé avec le
      // prospect : c'est la même lecture, et deux requêtes n'apporteraient qu'un
      // second aller-retour pour un affichage qui vit sur le même écran.
      timeline: {
        orderBy: { createdAt: "desc" },
        // Le nom de l'auteur seul — jamais l'objet User complet, qui ferait
        // traverser e-mail et empreinte de mot de passe jusqu'au composant (D2).
        include: { author: { select: { name: true } } },
      },
    },
  });

  if (!prospect) notFound();
  return prospect;
}

// Structures proposées au choix sur « Nouveau devis » (maquette v2) : prospects non
// convertis et non perdus, les plus récemment touchés d'abord. Bornée : au-delà, le
// devis se prépare depuis la fiche du prospect.
const DEVIS_PICKER_LIMIT = 24;

export async function listProspectsForDevisPicker(): Promise<{ id: string; structureName: string }[]> {
  const { tenantId } = await requireCommercialSession();
  return prisma.prospect.findMany({
    where: { tenantId, establishmentId: null, status: { not: "PERDU" } },
    orderBy: { updatedAt: "desc" },
    take: DEVIS_PICKER_LIMIT,
    select: { id: true, structureName: true },
  });
}
