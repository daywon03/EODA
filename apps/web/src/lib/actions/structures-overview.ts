"use server";

import { prisma } from "@eoda/database";
import { requireCabinetSession } from "@/lib/auth/guards";
import { listEstablishments } from "@/lib/actions/establishment";
import { getEstablishmentIdsWithUnansweredMessage } from "@/lib/actions/message";
import { countDocumentsAwaitingReviewByEstablishment } from "@/lib/actions/review-queue";
import { toMissionLifecycleFacts } from "@/lib/db/to-mission-lifecycle-facts";
import { toPortfolioRow } from "@/lib/db/to-portfolio-row";
import { deriveFunnelStage, isBetaMission } from "@/lib/services/lifecycle-service";
import type { PortfolioRow } from "@/lib/services/portfolio-kpi-service";
import {
  latestClientActivityByEstablishment,
  type StructureFacts,
} from "@/lib/services/structures-overview-service";

// ─────────────────────────────────────────────────────────────────────────────
// FAITS DES STRUCTURES — lecture pour la liste « Structures » et l'accueil.
//
// Chaque fait vient d'une lecture déjà existante (fiches et étapes : establishment.ts ;
// messages : message.ts ; file à relire : review-queue.ts), chacune sous sa garde.
// Les lectures propres à ce fichier — dernière activité de la structure et
// couverture loi 2002-2 — sont GROUPÉES (une requête chacune, jamais une par structure) et bornées
// au tenant de la garde.
// ─────────────────────────────────────────────────────────────────────────────

export type StructuresOverview = {
  rows: StructureFacts[];
  // Pour les KPI de portefeuille (portfolio-kpi-service), calculés à partir des
  // MÊMES fiches que les étapes affichées.
  portfolio: PortfolioRow[];
};

export async function getStructuresOverview(): Promise<StructuresOverview> {
  const { tenantId } = await requireCabinetSession();

  const [establishments, unanswered, awaitingReview, loi2002, loi2002Total] = await Promise.all([
    listEstablishments(),
    getEstablishmentIdsWithUnansweredMessage(),
    countDocumentsAwaitingReviewByEstablishment(),
    prisma.document.groupBy({
      by: ["establishmentId"],
      where: {
        establishment: { tenantId },
        documentType: { category: "LOI_2002_2" },
        currentVersionId: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.documentType.count({ where: { category: "LOI_2002_2" } }),
  ]);

  // Dernière action DE LA STRUCTURE (pas du cabinet) : comptes clients rattachés,
  // puis leur dernière entrée du journal par (fiche, acteur). Le journal n'a pas de
  // relation vers l'établissement : le filtre est la liste des fiches DÉJÀ bornées au
  // tenant ci-dessus. Deux requêtes groupées, jamais une par structure ; la paire
  // (fiche, compte) est revérifiée par latestClientActivityByEstablishment.
  const establishmentIds = establishments.map((e) => e.id);
  const links =
    establishmentIds.length === 0
      ? []
      : await prisma.establishmentUser.findMany({
          where: { establishmentId: { in: establishmentIds }, user: { role: "CLIENT_USER" } },
          select: { establishmentId: true, userId: true },
        });
  const activity =
    links.length === 0
      ? []
      : await prisma.auditLogEntry.groupBy({
          by: ["establishmentId", "actorUserId"],
          where: {
            establishmentId: { in: establishmentIds },
            actorUserId: { in: [...new Set(links.map((l) => l.userId))] },
          },
          _max: { occurredAt: true },
        });

  const lastActivity = latestClientActivityByEstablishment(
    activity.map((a) => ({ establishmentId: a.establishmentId, actorUserId: a.actorUserId, lastAt: a._max.occurredAt })),
    links
  );
  const deposited = new Map(loi2002.map((d) => [d.establishmentId, d._count._all]));

  const rows = establishments.map((e): StructureFacts => {
    const mission = toMissionLifecycleFacts(e.mission);
    return {
      id: e.id,
      name: e.name,
      type: e.type,
      stage: deriveFunnelStage({ prospectStatus: e.prospect?.status ?? null, mission }),
      isBeta: isBetaMission(mission),
      hasEvaluationTargetDate: e.hasEvaluationTargetDate,
      lastActivityAt: lastActivity.get(e.id) ?? null,
      documentsAwaitingReview: awaitingReview.get(e.id) ?? 0,
      hasUnansweredMessage: unanswered.has(e.id),
      loi2002Deposited: deposited.get(e.id) ?? 0,
      loi2002Total,
    };
  });

  return { rows, portfolio: establishments.map(toPortfolioRow) };
}
