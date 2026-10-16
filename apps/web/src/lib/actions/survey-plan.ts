"use server";

import { prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireEstablishmentAccess } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { getBeneficiaryDataPort } from "@/lib/hds";
import { SURVEY_CAMPAIGN_MONTHS, SURVEY_TEMPLATES } from "@/content/enquete";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { computeTemplateStats } from "@/lib/services/survey-stats-service";
import { proposeSurveyActions, selectSurveyActionsToCreate } from "@/lib/services/survey-report-service";
import { recordAuditEvent } from "@/lib/services/audit-log-service";

// ─────────────────────────────────────────────────────────────────────────────
// PLAN D'ACTION ISSU DE L'ENQUÊTE (lot C). Les propositions sont RECALCULÉES ici à
// partir des réponses (jamais reçues du navigateur) ; seules les clés cochées et
// encore proposées deviennent des tâches `ActionItem` source ENQUETE, confiées à la
// structure. Les titres ne nomment personne — une tâche n'est pas une donnée usager.
// ─────────────────────────────────────────────────────────────────────────────

type Result = { error: string } | { ok: true; created: number };

export async function acceptSurveyActions(formData: FormData): Promise<Result> {
  const establishmentId = formData.get("establishmentId");
  if (typeof establishmentId !== "string" || establishmentId.length === 0) notFound();
  const access = await requireEstablishmentAccess(establishmentId, NEED.TERRAIN_WRITE);
  if (access.isClient && !canDepositDocuments(access.missionAccess)) {
    return { error: "Votre accompagnement est clos : le plan d'action est en lecture seule." };
  }
  const { tenantId } = await prisma.establishment.findUniqueOrThrow({ where: { id: access.establishmentId }, select: { tenantId: true } });
  const since = new Date();
  since.setUTCMonth(since.getUTCMonth() - SURVEY_CAMPAIGN_MONTHS);
  const responses = await getBeneficiaryDataPort().listSurveyResponses({ tenantId, establishmentId: access.establishmentId }, since);
  const proposals = proposeSurveyActions(SURVEY_TEMPLATES.map((template) => computeTemplateStats(template, responses)));
  const existing = await prisma.actionItem.findMany({
    where: { establishmentId: access.establishmentId, source: "ENQUETE" },
    select: { title: true },
  });
  const selected = selectSurveyActionsToCreate(
    proposals,
    formData.getAll("key").filter((k): k is string => typeof k === "string"),
    existing.map((row) => row.title)
  );
  if (selected.length === 0) return { error: "Aucune action à ajouter : cochez au moins une proposition." };

  for (const proposal of selected) {
    const created = await prisma.actionItem.create({
      data: {
        tenantId,
        establishmentId: access.establishmentId,
        title: proposal.title,
        ownerKind: "STRUCTURE",
        source: "ENQUETE",
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
      detail: "ENQUETE",
    });
  }
  revalidatePath("/dashboard/client/enquetes");
  revalidatePath(`/dashboard/cabinet/etablissements/${access.establishmentId}/enquetes`);
  return { ok: true, created: selected.length };
}
