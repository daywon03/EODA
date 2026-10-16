"use server";

import { prisma } from "@eoda/database";
import { requireCommercialSession } from "@/lib/auth/guards";
import { readPipelineFacts } from "@/lib/db/read-prospect-pipeline";
import { listDevisForKpi, listOpenDevisForTodo } from "@/lib/actions/devis-read";
import {
  buildFunnel,
  buildTodo,
  groupSubscriptions,
  type FunnelStep,
  type SubscriptionRow,
  type TodoItem,
} from "@/lib/services/commercial-overview-service";

// ─────────────────────────────────────────────────────────────────────────────
// VUE D'ENSEMBLE COMMERCIALE (maquette v2) — capacité COMMERCIAL. Lit les faits ;
// l'entonnoir, « À faire » et les abonnements sont calculés par
// commercial-overview-service (pur, testé).
// ─────────────────────────────────────────────────────────────────────────────

export type CommercialOverview = {
  funnel: FunnelStep[];
  todo: TodoItem[];
  subscriptions: { rows: SubscriptionRow[]; total: number };
};

export async function getCommercialOverview(): Promise<CommercialOverview> {
  const { tenantId } = await requireCommercialSession();
  const now = new Date();
  const [pipeline, devisKpi, openDevis, missions] = await Promise.all([
    readPipelineFacts(tenantId, now),
    listDevisForKpi(),
    listOpenDevisForTodo(),
    prisma.mission.findMany({ where: { tenantId, closedAt: null }, select: { formule: true, supportMode: true } }),
  ]);

  const selfService = pipeline.filter((p) => p.origin === "LIBRE_SERVICE");
  return {
    funnel: buildFunnel({
      now,
      prospects: pipeline.map((p) => ({
        selfService: p.origin === "LIBRE_SERVICE",
        diagnosticDone: p.progress?.stage === "DONE",
        hasPendingCall: p.hasPendingCall,
      })),
      devis: devisKpi.map((d) => ({
        status: d.status,
        signedAt: d.status === "SIGNE" ? (d.missions[0]?.createdAt ?? d.updatedAt) : null,
      })),
    }),
    todo: buildTodo({
      now,
      calls: pipeline
        .filter((p) => p.hasPendingCall)
        .map((p) => ({ prospectId: p.id, structureName: p.structureName, signalText: p.signal?.text ?? "Appel prévu" })),
      openDevis: openDevis.map((d) => ({
        id: d.id,
        number: d.number,
        status: d.status,
        structureName: d.prospectStructureName,
        contactEmail: d.prospectContactEmail,
        lastSentAt: d.lastSentAt,
      })),
      inactive: selfService
        .filter((p) => p.signal?.inactive && !p.hasPendingCall)
        .map((p) => ({ prospectId: p.id, structureName: p.structureName, signalText: p.signal?.text ?? "" })),
    }),
    subscriptions: groupSubscriptions(missions),
  };
}
