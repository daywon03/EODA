"use server";

import {
  prisma,
  AcquisitionChannel,
  Civility,
  CommercialTier,
  ContactRole,
  ProspectStatus,
  StructureType,
  type Prisma,
} from "@eoda/database";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/services/pagination-service";
import {
  firstError,
  isEnumValue,
  optionalEnum,
  optionalInt,
  optionalString,
  requiredDate,
  requiredEnum,
  requiredString,
} from "@/lib/validation/form-parsers";
import {
  formatContactIdentity,
  keepPrecisionOnlyForOther,
  otherPrecisionError,
} from "@/lib/services/prospect-contact-service";

const PROSPECT_LIST_PATH = "/dashboard/cabinet/commercial/prospects";

type ParsedProspect = {
  structureName: string;
  structureType: StructureType;
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

  return {
    structureName: structureName.value,
    structureType: structureType.value,
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

export async function updateProspectStatus(
  id: string,
  status: ProspectStatus
): Promise<{ error: string } | null> {
  const { tenantId, userId } = await requireCabinetAdminSession();

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
  const { tenantId, userId } = await requireCabinetAdminSession();

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

export type ProspectCardItem = {
  id: string;
  structureName: string;
  structureType: StructureType;
  status: ProspectStatus;
  // Identité déjà composée (civilité, nom, fonction) : la carte du Kanban ne
  // recompose pas la règle de son côté, sinon deux écrans finissent par écrire le
  // même contact de deux façons.
  contactIdentity: string | null;
  estimatedAmountEuros: number | null;
  devisCount: number;
};

export type ProspectBoardPage = {
  items: ProspectCardItem[];
  // Effectif RÉEL de chaque colonne, calculé en base — pas la longueur de la page
  // affichée. Sans ça, le compteur du Kanban mentirait dès la première troncature.
  totalByStatus: Record<ProspectStatus, number>;
  totalCount: number;
};

const PROSPECT_STATUSES: readonly ProspectStatus[] = [
  "NOUVEAU",
  "RDV",
  "DEVIS_ENVOYE",
  "NEGOCIATION",
  "SIGNE",
  "PERDU",
];

// Kanban borné : `perColumn` prospects au plus PAR COLONNE, jamais la table
// entière. Le Kanban sérialise sa liste vers un composant client — une lecture non
// bornée y coûte deux fois (requête + payload React). Six requêtes indexées
// bornées valent mieux qu'un `findMany` sans `take`.
export async function listProspectBoard(
  perColumn: number = DEFAULT_PAGE_SIZE
): Promise<ProspectBoardPage> {
  const { tenantId } = await requireCabinetAdminSession();
  const take = Math.min(Math.max(Math.trunc(perColumn) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  const [columns, counts] = await Promise.all([
    Promise.all(
      PROSPECT_STATUSES.map((status) =>
        prisma.prospect.findMany({
          where: { tenantId, status },
          orderBy: { createdAt: "desc" },
          take,
          select: {
            id: true,
            structureName: true,
            structureType: true,
            status: true,
            civility: true,
            contactName: true,
            contactRole: true,
            contactRoleOther: true,
            estimatedAmountEuros: true,
            _count: { select: { devis: true } },
          },
        })
      )
    ),
    prisma.prospect.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } }),
  ]);

  const totalByStatus = emptyStatusCounts();
  for (const row of counts) totalByStatus[row.status] = row._count._all;

  return {
    items: columns.flat().map((p) => ({
      id: p.id,
      structureName: p.structureName,
      structureType: p.structureType,
      status: p.status,
      contactIdentity: formatContactIdentity(p),
      estimatedAmountEuros: p.estimatedAmountEuros,
      devisCount: p._count.devis,
    })),
    totalByStatus,
    totalCount: Object.values(totalByStatus).reduce((sum, n) => sum + n, 0),
  };
}

function emptyStatusCounts(): Record<ProspectStatus, number> {
  return { NOUVEAU: 0, RDV: 0, DEVIS_ENVOYE: 0, NEGOCIATION: 0, SIGNE: 0, PERDU: 0 };
}

// Agrégats du tableau de bord : comptés en base plutôt qu'en chargeant toutes les
// lignes pour les compter en mémoire. Un KPI calculé sur une page serait faux, et
// un KPI calculé sur une table entière chargée en RAM ne passe pas l'échelle — le
// `groupBy` répond aux deux.
//
// `byStatus` ne compte que les prospects NON CONVERTIS (`establishmentId: null`).
// Raison : après la signature, `Prospect.status` reste figé à `SIGNE` — c'est le
// dernier état commercial et il est correct comme tel, mais la structure est
// désormais suivie par sa mission. La compter des deux côtés la ferait apparaître
// deux fois dans l'entonnoir unifié, une fois en « Signé » et une fois à l'étape
// réelle de son accompagnement. `byStructureType` reste calculé sur TOUS les
// prospects : c'est une lecture de marché (d'où viennent nos contacts), pas une
// photo du pipeline.
export async function getProspectKpiCounts(): Promise<{
  byStatus: Record<ProspectStatus, number>;
  byStructureType: Record<StructureType, number>;
}> {
  const { tenantId } = await requireCabinetAdminSession();

  const [statusRows, typeRows] = await Promise.all([
    prisma.prospect.groupBy({
      by: ["status"],
      where: { tenantId, establishmentId: null },
      _count: { _all: true },
    }),
    prisma.prospect.groupBy({ by: ["structureType"], where: { tenantId }, _count: { _all: true } }),
  ]);

  const byStatus = emptyStatusCounts();
  for (const row of statusRows) byStatus[row.status] = row._count._all;

  const byStructureType: Record<StructureType, number> = { ASSOCIATION: 0, PRIVE: 0, PUBLIC: 0 };
  for (const row of typeRows) byStructureType[row.structureType] = row._count._all;

  return { byStatus, byStructureType };
}

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
  const { tenantId } = await requireCabinetAdminSession();

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
