"use server";

import { prisma, ActionOwnerKind } from "@eoda/database";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { requireCabinetSession, requireEstablishmentAccess, structureScopeWhere } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import {
  assignmentError,
  canActorActOnItem,
  describeActionForAudit,
  isVisibleToClient,
  selectTodayTasks,
  titleError,
  type ActionActor,
  type ActionItemFacts,
} from "@/lib/services/action-item-service";
import { firstError, optionalDate, requiredEnum, requiredString } from "@/lib/validation/form-parsers";

// ─────────────────────────────────────────────────────────────────────────────
// TÂCHES = PLAN D'ACTION (N5) — actions minces ; les règles sont dans
// action-item-service. Garde unique : requireEstablishmentAccess (cabinet : fiche de
// son tenant ; client : SA structure, accès révoqué = notFound). Un client n'écrit
// que si la mission est ACTIVE (bibliothèque en lecture seule après clôture).
// Journal : la source et le côté, jamais le titre (texte libre).
// ─────────────────────────────────────────────────────────────────────────────

export type ActionPerson = { id: string; name: string };

export type ActionItemRow = ActionItemFacts & {
  ownerName: string | null;
  linkedDocumentId: string | null;
  linkedCriterionCode: string | null;
};

export type EstablishmentActionItems = {
  items: ActionItemRow[];
  viewerId: string;
  isClient: boolean;
  canWrite: boolean;
  canCreate: boolean;
  cabinetPeople: ActionPerson[];
  structurePeople: ActionPerson[];
};

const ITEM_SELECT = {
  id: true,
  title: true,
  ownerKind: true,
  ownerUserId: true,
  ownerFunction: true,
  dueOn: true,
  doneAt: true,
  source: true,
  linkedDocumentId: true,
  ownerUser: { select: { name: true } },
  linkedCriterion: { select: { code: true } },
} as const;

type AccessContext = Awaited<ReturnType<typeof requireEstablishmentAccess>>;

function actorOf(access: AccessContext): ActionActor {
  return access.isClient ? { side: "CLIENT", userId: access.userId } : { side: "CABINET" };
}

function canWrite(access: AccessContext): boolean {
  return !access.isClient || canDepositDocuments(access.missionAccess);
}

async function loadPeople(establishmentId: string): Promise<{ tenantId: string; cabinet: ActionPerson[]; structure: ActionPerson[] }> {
  const establishment = await prisma.establishment.findUnique({ where: { id: establishmentId }, select: { tenantId: true } });
  if (!establishment) notFound();
  const [cabinet, links] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId: establishment.tenantId, role: { in: ["CABINET_ADMIN", "CABINET_EVALUATOR"] }, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.establishmentUser.findMany({
      where: { establishmentId, revokedAt: null, user: { isActive: true } },
      select: { user: { select: { id: true, name: true } } },
    }),
  ]);
  return { tenantId: establishment.tenantId, cabinet, structure: links.map((l) => l.user) };
}

function revalidateTasks(establishmentId: string): void {
  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}/plan-action`);
  revalidatePath(`/dashboard/cabinet/etablissements/${establishmentId}`);
  revalidatePath("/dashboard/cabinet");
  revalidatePath("/dashboard/client/taches");
}

export async function listEstablishmentActionItems(establishmentId: string): Promise<EstablishmentActionItems> {
  const access = await requireEstablishmentAccess(establishmentId, NEED.TASKS_READ);
  const [rows, people] = await Promise.all([
    prisma.actionItem.findMany({
      where: {
        establishmentId: access.establishmentId,
        ...(access.isClient ? { ownerKind: "STRUCTURE" } : {}),
        // Intervenant (niveau OWN, N9) : SES tâches, rien d'autre.
        ...(access.ownOnly ? { ownerUserId: access.userId } : {}),
      },
      select: ITEM_SELECT,
      orderBy: { createdAt: "asc" },
    }),
    loadPeople(access.establishmentId),
  ]);
  const items = rows
    .filter((r) => !access.isClient || isVisibleToClient(r))
    .map(({ ownerUser, linkedCriterion, ...item }) => ({
      ...item,
      ownerName: ownerUser?.name ?? null,
      linkedCriterionCode: linkedCriterion?.code ?? null,
    }));
  return {
    items,
    viewerId: access.userId,
    isClient: access.isClient,
    canWrite: canWrite(access),
    // Un intervenant (OWN) coche ses tâches mais n'en crée pas.
    canCreate: canWrite(access) && !access.ownOnly,
    cabinetPeople: access.isClient ? [] : people.cabinet,
    structurePeople: people.structure,
  };
}

function parseOwner(formData: FormData): { error: string } | { ownerKind: ActionOwnerKind; ownerUserId: string | null } {
  const ownerKind = requiredEnum(formData, "ownerKind", "Le responsable", ActionOwnerKind);
  if (!ownerKind.ok) return { error: ownerKind.error };
  const rawUser = formData.get("ownerUserId");
  return { ownerKind: ownerKind.value, ownerUserId: typeof rawUser === "string" && rawUser.length > 0 ? rawUser : null };
}

export async function createActionItem(formData: FormData): Promise<{ error: string } | null> {
  const establishmentIdRaw = formData.get("establishmentId");
  if (typeof establishmentIdRaw !== "string" || establishmentIdRaw.length === 0) return { error: "Structure manquante." };
  const access = await requireEstablishmentAccess(establishmentIdRaw, NEED.TASKS_WRITE);
  if (!canWrite(access)) return { error: "L'accompagnement est clôturé : les tâches sont en lecture seule." };
  // « Ses tâches » : un intervenant coche les siennes, il n'en crée pas.
  if (access.ownOnly) return { error: "Votre accès permet de faire vos tâches, pas d'en créer." };

  const title = requiredString(formData, "title", "La tâche", 400);
  const dueOn = optionalDate(formData, "dueOn", "L'échéance");
  const error = firstError(title, dueOn);
  if (error) return { error };
  if (!title.ok || !dueOn.ok) return { error: "Formulaire invalide." };
  const invalidTitle = titleError(title.value);
  if (invalidTitle) return { error: invalidTitle };

  const owner = parseOwner(formData);
  if ("error" in owner) return owner;
  const people = await loadPeople(access.establishmentId);
  const refused = assignmentError(actorOf(access), owner, {
    cabinetUserIds: new Set(people.cabinet.map((p) => p.id)),
    structureUserIds: new Set(people.structure.map((p) => p.id)),
  });
  if (refused) return { error: refused };

  const created = await prisma.actionItem.create({
    data: {
      tenantId: people.tenantId,
      establishmentId: access.establishmentId,
      title: title.value.trim(),
      ownerKind: owner.ownerKind,
      ownerUserId: owner.ownerUserId,
      dueOn: dueOn.value,
      source: "MANUEL",
      createdByUserId: access.userId,
    },
    select: { id: true, source: true, ownerKind: true },
  });
  await recordAuditEvent({
    action: "ACTION_ITEM_CREATED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    targetId: created.id,
    detail: describeActionForAudit(created),
  });
  revalidateTasks(access.establishmentId);
  return null;
}

// Résout une tâche APRÈS la garde, bornée à la structure gardée : un identifiant
// d'une autre structure répond notFound, comme un identifiant inexistant.
async function resolveItem(formData: FormData): Promise<{ access: AccessContext; item: ActionItemFacts }> {
  const establishmentId = formData.get("establishmentId");
  const itemId = formData.get("actionItemId");
  if (typeof establishmentId !== "string" || typeof itemId !== "string" || !establishmentId || !itemId) notFound();
  const access = await requireEstablishmentAccess(establishmentId, NEED.TASKS_WRITE);
  const item = await prisma.actionItem.findFirst({
    where: { id: itemId, establishmentId: access.establishmentId },
    select: { id: true, title: true, ownerKind: true, ownerUserId: true, ownerFunction: true, dueOn: true, doneAt: true, source: true },
  });
  if (!item) notFound();
  if (access.isClient && !isVisibleToClient(item)) notFound();
  if (access.ownOnly && item.ownerUserId !== access.userId) notFound();
  return { access, item };
}

export async function setActionItemDone(formData: FormData): Promise<{ error: string } | null> {
  const { access, item } = await resolveItem(formData);
  if (!canWrite(access)) return { error: "L'accompagnement est clôturé : les tâches sont en lecture seule." };
  if (!canActorActOnItem(actorOf(access), item)) return { error: "Cette tâche est confiée à quelqu'un d'autre." };
  const raw = formData.get("done");
  if (raw !== "true" && raw !== "false") return { error: "Valeur invalide." };
  const done = raw === "true";
  if (done === (item.doneAt !== null)) return null;

  await prisma.actionItem.update({
    where: { id: item.id },
    data: done ? { doneAt: new Date(), doneByUserId: access.userId } : { doneAt: null, doneByUserId: null },
  });
  await recordAuditEvent({
    action: done ? "ACTION_ITEM_COMPLETED" : "ACTION_ITEM_REOPENED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    targetId: item.id,
    detail: describeActionForAudit(item),
  });
  revalidateTasks(access.establishmentId);
  return null;
}

export async function reassignActionItem(formData: FormData): Promise<{ error: string } | null> {
  const { access, item } = await resolveItem(formData);
  if (!canWrite(access)) return { error: "L'accompagnement est clôturé : les tâches sont en lecture seule." };
  const actor = actorOf(access);
  if (!canActorActOnItem(actor, item)) return { error: "Cette tâche est confiée à quelqu'un d'autre." };
  const owner = parseOwner(formData);
  if ("error" in owner) return owner;
  const people = await loadPeople(access.establishmentId);
  const refused = assignmentError(actor, owner, {
    cabinetUserIds: new Set(people.cabinet.map((p) => p.id)),
    structureUserIds: new Set(people.structure.map((p) => p.id)),
  });
  if (refused) return { error: refused };

  // Réassigner, c'est choisir : la fonction d'un ancien pilote ne survit pas au choix.
  await prisma.actionItem.update({
    where: { id: item.id },
    data: { ownerKind: owner.ownerKind, ownerUserId: owner.ownerUserId, ownerFunction: null },
  });
  await recordAuditEvent({
    action: "ACTION_ITEM_REASSIGNED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: access.establishmentId,
    targetId: item.id,
    detail: describeActionForAudit({ source: item.source, ownerKind: owner.ownerKind }),
  });
  revalidateTasks(access.establishmentId);
  return null;
}

// « Mes tâches du jour » (accueil cabinet) : tâches confiées à l'appelant, dans les
// structures de SON tenant, échues aujourd'hui ou en retard.
export type TodayTask = ActionItemFacts & { establishmentId: string; establishmentName: string };

export async function listMyTasksToday(now: Date = new Date()): Promise<TodayTask[]> {
  const context = await requireCabinetSession("STRUCTURES_READ");
  const { userId, tenantId } = context;
  const rows = await prisma.actionItem.findMany({
    where: { tenantId, establishment: structureScopeWhere(context), ownerUserId: userId, doneAt: null, dueOn: { not: null } },
    select: {
      id: true,
      title: true,
      ownerKind: true,
      ownerUserId: true,
      ownerFunction: true,
      dueOn: true,
      doneAt: true,
      source: true,
      establishmentId: true,
      establishment: { select: { name: true } },
    },
  });
  return selectTodayTasks(
    rows.map(({ establishment, ...item }) => ({ ...item, establishmentName: establishment.name })),
    userId,
    now
  );
}
