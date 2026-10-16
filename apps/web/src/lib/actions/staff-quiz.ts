"use server";

import { prisma } from "@eoda/database";
import { requireEstablishmentAccess, tryEstablishmentAccess, type EstablishmentAccessContext } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { recordAuditEvent } from "@/lib/services/audit-log-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { QUIZ_MODULES } from "@/content/quiz";
import {
  buildQuizMatrix,
  countUpToDate,
  listRetestsDue,
  preselectForCampaign,
  retestTasksToCreate,
  type QuizMatrixRow,
  type RetestDue,
} from "@/lib/services/quiz-status-service";

// ─────────────────────────────────────────────────────────────────────────────
// ÉQUIPE ET QUIZ — LECTURE (N10). Partagée par l'onglet « Équipe et formations » de
// la fiche (cabinet) et « Mon équipe » (portail client). Garde unique :
// requireEstablishmentAccess(id, TEAM_*) — cabinet : lecture / écriture des
// structures et périmètre d'affectation ; client : module TEAM du rôle d'accès,
// l'intervenant (OWN) ne voit QUE sa propre ligne.
// Écritures : lib/actions/staff-quiz-write.ts.
// ─────────────────────────────────────────────────────────────────────────────

export type QuizBoard = {
  establishmentId: string;
  modules: { code: string; title: string; shortTitle: string; version: number; provisional: boolean }[];
  rows: QuizMatrixRow[];
  tiles: { code: string; title: string; upToDate: number; total: number }[];
  preselection: Record<string, string[]>;
  retestsDue: RetestDue[];
  canWrite: boolean;
  ownOnly: boolean;
};

async function canWriteTeam(establishmentId: string, access: EstablishmentAccessContext): Promise<boolean> {
  if (access.ownOnly) return false;
  if (access.isClient && !canDepositDocuments(access.missionAccess)) return false;
  return (await tryEstablishmentAccess(establishmentId, NEED.TEAM_WRITE)) !== null;
}

export async function getQuizBoard(establishmentId: string, now: Date = new Date()): Promise<QuizBoard> {
  const access = await requireEstablishmentAccess(establishmentId, NEED.TEAM_READ);
  const staff = await prisma.staffMember.findMany({
    where: {
      establishmentId: access.establishmentId,
      active: true,
      ...(access.ownOnly ? { userId: access.userId } : {}),
    },
    select: { id: true, displayName: true, jobTitle: true },
    orderBy: { displayName: "asc" },
  });
  const attempts = await prisma.quizAttempt.findMany({
    where: { establishmentId: access.establishmentId, staffMemberId: { in: staff.map((s) => s.id) } },
    select: { staffMemberId: true, moduleCode: true, passed: true, completedAt: true },
  });

  const rows = buildQuizMatrix(staff, QUIZ_MODULES, attempts, now);
  return {
    establishmentId: access.establishmentId,
    modules: QUIZ_MODULES.map((m) => ({
      code: m.code,
      title: m.title,
      shortTitle: m.shortTitle,
      version: m.version,
      provisional: m.provisional,
    })),
    rows,
    tiles: QUIZ_MODULES.map((m) => ({ code: m.code, title: m.title, ...countUpToDate(rows, m.code) })),
    preselection: Object.fromEntries(QUIZ_MODULES.map((m) => [m.code, preselectForCampaign(rows, m.code, now)])),
    retestsDue: listRetestsDue(rows, now),
    canWrite: await canWriteTeam(access.establishmentId, access),
    ownOnly: access.ownOnly,
  };
}

// ── Alerte d'échéance (D12) ──────────────────────────────────────────────────
// Branchée au CHARGEMENT de l'onglet, pas sur une horloge : aucun cron n'existe dans
// cette plateforme (Vercel sans tâche planifiée), et une alerte qui ne se calcule
// que quand quelqu'un regarde est exactement celle qu'on peut garantir. Idempotente :
// une tâche QUIZ non faite de même titre suffit, on n'en crée pas une seconde. Gardée
// en ÉCRITURE : la lecture seule regarde l'onglet sans rien créer.
export async function syncQuizRetestTasks(establishmentId: string, now: Date = new Date()): Promise<number> {
  const access = await requireEstablishmentAccess(establishmentId, NEED.TEAM_WRITE);
  if (access.ownOnly || (access.isClient && !canDepositDocuments(access.missionAccess))) return 0;

  const board = await getQuizBoard(access.establishmentId, now);
  if (board.retestsDue.length === 0) return 0;
  const open = await prisma.actionItem.findMany({
    where: { establishmentId: access.establishmentId, source: "QUIZ", doneAt: null },
    select: { title: true },
  });
  const toCreate = retestTasksToCreate(
    board.retestsDue,
    new Map(QUIZ_MODULES.map((m) => [m.code, m.title])),
    new Set(open.map((o) => o.title))
  );
  if (toCreate.length === 0) return 0;

  const establishment = await prisma.establishment.findUniqueOrThrow({
    where: { id: access.establishmentId },
    select: { tenantId: true },
  });
  for (const task of toCreate) {
    const created = await prisma.actionItem.create({
      data: {
        tenantId: establishment.tenantId,
        establishmentId: access.establishmentId,
        title: task.title,
        ownerKind: "STRUCTURE",
        dueOn: task.dueOn,
        source: "QUIZ",
        createdByUserId: access.userId,
      },
      select: { id: true },
    });
    await recordAuditEvent({
      action: "ACTION_ITEM_CREATED",
      actorUserId: access.userId,
      actorRole: access.session.user.role,
      establishmentId: access.establishmentId,
      targetId: created.id,
      detail: `QUIZ · ${task.moduleCode}`,
    });
  }
  return toCreate.length;
}
