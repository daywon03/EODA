"use server";

import { prisma, type DevisStatus, type Prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { requireCommercialSession } from "@/lib/auth/guards";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/services/pagination-service";
import { countDevisByTab, parseDevisTab, statusesForTab, type DevisTab } from "@/lib/services/devis-list-service";
import { lastSentAt } from "@/lib/services/devis-recap-service";

// ─────────────────────────────────────────────────────────────────────────────
// LECTURES DU MODULE DEVIS — séparées des écritures (lib/actions/devis.ts) pour que
// chaque fichier reste lisible. Toutes passent par requireCommercialSession() :
// commercial-pages-guard.test.ts le vérifie export par export.
// ─────────────────────────────────────────────────────────────────────────────

const SENT_ACTIONS = ["DEVIS_EMAIL_SENT", "DEVIS_REMINDER_SENT"] as const;

// Dernier envoi (envoi ou relance) de chaque devis, DÉRIVÉ du journal d'audit :
// aucun horodatage d'envoi n'est stocké sur le devis. `targetId` = id du devis.
async function readSentEvents(devisIds: readonly string[]): Promise<Map<string, Date[]>> {
  const byDevis = new Map<string, Date[]>();
  if (devisIds.length === 0) return byDevis;
  const events = await prisma.auditLogEntry.findMany({
    where: { action: { in: [...SENT_ACTIONS] }, targetId: { in: [...devisIds] } },
    select: { targetId: true, occurredAt: true },
  });
  for (const event of events) {
    if (!event.targetId) continue;
    byDevis.set(event.targetId, [...(byDevis.get(event.targetId) ?? []), event.occurredAt]);
  }
  return byDevis;
}

export type DevisListItem = {
  id: string;
  number: string;
  status: DevisStatus;
  formuleLabelSnapshot: string | null;
  optionLabels: string[];
  commitmentMonths: number | null;
  clientNote: string | null;
  totalAmountEuros: number;
  createdAt: Date;
  validUntil: Date;
  lastSentAt: Date;
  prospectId: string;
  prospectStructureName: string;
  prospectContactEmail: string | null;
};

export type DevisListPage = {
  items: DevisListItem[];
  // Effectif de l'onglet affiché (pour « Voir plus »), et de chaque onglet.
  totalCount: number;
  countsByTab: Record<DevisTab, number>;
};

const LIST_SELECT = {
  id: true,
  number: true,
  status: true,
  formuleLabelSnapshot: true,
  commitmentMonths: true,
  clientNote: true,
  totalAmountEuros: true,
  createdAt: true,
  validUntil: true,
  prospectId: true,
  options: { select: { labelSnapshot: true } },
  prospect: { select: { structureName: true, contactEmail: true } },
} satisfies Prisma.DevisSelect;

type ListRow = Prisma.DevisGetPayload<{ select: typeof LIST_SELECT }>;

async function toListItems(rows: readonly ListRow[]): Promise<DevisListItem[]> {
  const sent = await readSentEvents(rows.map((d) => d.id));
  return rows.map((d) => ({
    id: d.id,
    number: d.number,
    status: d.status,
    formuleLabelSnapshot: d.formuleLabelSnapshot,
    optionLabels: d.options.map((o) => o.labelSnapshot),
    commitmentMonths: d.commitmentMonths,
    clientNote: d.clientNote,
    totalAmountEuros: d.totalAmountEuros,
    createdAt: d.createdAt,
    validUntil: d.validUntil,
    lastSentAt: lastSentAt({ createdAt: d.createdAt, sentEvents: sent.get(d.id) ?? [] }),
    prospectId: d.prospectId,
    prospectStructureName: d.prospect.structureName,
    prospectContactEmail: d.prospect.contactEmail,
  }));
}

// Liste bornée, filtrée par onglet. `pageSize` est déjà replafonné par
// `parsePageSize`, mais on reborne ici : cette fonction est une action serveur,
// appelable directement — et `tab` est relu par `parseDevisTab` pour la même raison.
export async function listDevis(pageSize: number = DEFAULT_PAGE_SIZE, tab?: string): Promise<DevisListPage> {
  const { tenantId } = await requireCommercialSession();
  const take = Math.min(Math.max(Math.trunc(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const statuses = statusesForTab(parseDevisTab(tab));
  const where = { tenantId, ...(statuses && { status: { in: [...statuses] } }) };

  const [rows, totalCount, byStatus] = await Promise.all([
    prisma.devis.findMany({ where, orderBy: { createdAt: "desc" }, take, select: LIST_SELECT }),
    prisma.devis.count({ where }),
    prisma.devis.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } }),
  ]);

  return {
    items: await toListItems(rows),
    totalCount,
    countsByTab: countDevisByTab(Object.fromEntries(byStatus.map((g) => [g.status, g._count._all]))),
  };
}

// Devis EN COURS (brouillons et envoyés) pour le bloc « À faire » de la vue
// d'ensemble. Borné : au-delà, la liste des devis prend le relais.
export async function listOpenDevisForTodo(): Promise<DevisListItem[]> {
  const { tenantId } = await requireCommercialSession();
  const rows = await prisma.devis.findMany({
    where: { tenantId, status: { in: ["BROUILLON", "ENVOYE"] } },
    orderBy: { createdAt: "asc" },
    take: MAX_PAGE_SIZE,
    select: LIST_SELECT,
  });
  return toListItems(rows);
}

// Chargement dédié aux KPI : quelques scalaires par devis, sans les includes de la
// page de liste. Volontairement non paginé — un indicateur calculé sur une page
// serait faux. La date de signature est celle de la mission née du devis (la
// conversion la crée dans la même transaction) : aucune date de plus n'est stockée.
export async function listDevisForKpi() {
  const { tenantId } = await requireCommercialSession();

  return prisma.devis.findMany({
    where: { tenantId },
    select: {
      status: true,
      totalAmountEuros: true,
      updatedAt: true,
      catalogueFormule: { select: { formule: true } },
      prospect: { select: { status: true } },
      missions: { select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
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
  const { tenantId } = await requireCommercialSession();

  const devis = await prisma.devis.findFirst({
    where: { id, tenantId },
    include: { prospect: true, catalogueFormule: true, options: true },
  });

  if (!devis) notFound();
  return devis;
}
