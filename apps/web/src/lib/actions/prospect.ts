"use server";

import { prisma, type Prisma, type ProspectStatus, type StructureType } from "@eoda/database";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/services/pagination-service";

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
  needsAssessmentNotes: string | null;
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
    needsAssessmentNotes: (formData.get("needsAssessmentNotes") as string | null)?.trim() || null,
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

export type ProspectCardItem = {
  id: string;
  structureName: string;
  structureType: StructureType;
  status: ProspectStatus;
  contactName: string | null;
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
            contactName: true,
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
      contactName: p.contactName,
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
