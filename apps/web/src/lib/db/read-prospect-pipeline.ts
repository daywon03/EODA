import { prisma, type AcquisitionChannel, type CommercialTier, type ProspectStatus } from "@eoda/database";
import { readImperativesByType, readProspectAnswers, progressFor } from "./read-prospect-diagnostic";
import {
  buildWorkList,
  deriveProspectSignal,
  momentLabelFor,
  type DiagnosticProgress,
  type ProspectSignal,
} from "@/lib/services/prospect-diagnostic-service";
import { originOf, type ProspectOrigin } from "@/lib/services/prospect-pipeline-service";

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE du pipeline prospects (tableau « Prospects », vue d'ensemble, fiche en
// autonomie). Aucune garde ici : l'appelant a passé requireCommercialSession() et
// fournit SON tenant. Prospects NON CONVERTIS seulement — une structure signée est
// suivie par sa fiche et sa mission (CLAUDE.md §7, KPI de portefeuille).
//
// Lecture non paginée, en projection étroite : les onglets et l'entonnoir sont des
// COMPTES sur des faits dérivés (avancement, appel demandé), qu'une page tronquée
// rendrait faux. Le cabinet n'en lit que l'avancement, jamais le contenu des réponses.
// ─────────────────────────────────────────────────────────────────────────────

const OPEN_CALL_STATUSES = ["DEMANDE", "PROPOSE", "CONFIRME"] as const;

export type PipelineFacts = {
  id: string;
  structureName: string;
  channel: AcquisitionChannel;
  channelOther: string | null;
  origin: ProspectOrigin;
  status: ProspectStatus;
  envisagedFormule: CommercialTier | null;
  firstContactDate: Date;
  contactEmail: string | null;
  contactPhone: string | null;
  progress: DiagnosticProgress | null;
  signal: ProspectSignal | null;
  hasPendingCall: boolean;
  pendingCall: { startsAt: Date; status: string; notes: string | null } | null;
  workCount: number | null;
  accountCount: number;
  accountsCreatedAt: Date | null;
  lastActivityAt: Date | null;
};

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function readPipelineFacts(tenantId: string, now: Date, onlyId?: string): Promise<PipelineFacts[]> {
  const prospects = await prisma.prospect.findMany({
    where: { tenantId, establishmentId: null, ...(onlyId && { id: onlyId }) },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      structureName: true,
      channel: true,
      channelOther: true,
      status: true,
      envisagedFormule: true,
      establishmentType: true,
      firstContactDate: true,
      createdAt: true,
      contactEmail: true,
      contactPhone: true,
      accounts: { select: { createdAt: true, user: { select: { lastLoginAt: true } } } },
      appointments: {
        where: { kind: "R1_DECOUVERTE", status: { in: [...OPEN_CALL_STATUSES] }, startsAt: { gte: startOfToday(now) } },
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { startsAt: true, status: true, notes: true },
      },
    },
  });
  const selfServiceIds = prospects.filter((p) => p.channel === "LIBRE_SERVICE").map((p) => p.id);
  const [imperativesByType, answers] = await Promise.all([
    selfServiceIds.length > 0 ? readImperativesByType() : Promise.resolve(null),
    readProspectAnswers(selfServiceIds),
  ]);

  return prospects.map((p) => {
    const origin = originOf(p.channel);
    const call = p.appointments[0] ?? null;
    const own = answers.get(p.id);
    const imperatives = origin === "LIBRE_SERVICE" && imperativesByType && p.establishmentType ? imperativesByType[p.establishmentType] : null;
    const progress = progressFor(imperatives, own?.latest ?? new Map());
    const lastLogin = p.accounts.reduce<Date | null>((max, a) => (a.user.lastLoginAt && (!max || a.user.lastLoginAt > max) ? a.user.lastLoginAt : max), null);
    const lastAnswer = own?.lastAnswerAt ?? null;
    const lastActivityAt = [lastLogin, lastAnswer].reduce<Date | null>((max, d) => (d && (!max || d > max) ? d : max), null);
    const accountsCreatedAt = p.accounts.reduce<Date | null>((min, a) => (!min || a.createdAt < min ? a.createdAt : min), null);
    const signal =
      progress === null
        ? null
        : deriveProspectSignal({
            now,
            signedUpAt: accountsCreatedAt ?? p.createdAt,
            lastActivityAt,
            pendingCall: call ? { day: call.startsAt, momentLabel: momentLabelFor(call.startsAt) } : null,
            progress,
          });
    const workCount =
      imperatives && progress?.stage === "DONE"
        ? buildWorkList(
            imperatives.map((c) => ({
              criterionId: c.id,
              criterionCode: c.code,
              answer: own?.latest.get(c.id)?.answer ?? null,
              expectedDocuments: c.expectedDocuments,
            }))
          ).length
        : null;
    return {
      id: p.id,
      structureName: p.structureName,
      channel: p.channel,
      channelOther: p.channelOther,
      origin,
      status: p.status,
      envisagedFormule: p.envisagedFormule,
      firstContactDate: p.firstContactDate,
      contactEmail: p.contactEmail,
      contactPhone: p.contactPhone,
      progress,
      signal,
      hasPendingCall: call !== null,
      pendingCall: call ? { startsAt: call.startsAt, status: call.status, notes: call.notes } : null,
      workCount,
      accountCount: p.accounts.length,
      accountsCreatedAt,
      lastActivityAt,
    };
  });
}
