"use server";

import { prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { requireEstablishmentAccess } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { getBeneficiaryDataPort } from "@/lib/hds";
import { SURVEY_CAMPAIGN_MONTHS, SURVEY_TEMPLATES } from "@/content/enquete";
import { computeTemplateStats, type TemplateStats } from "@/lib/services/survey-stats-service";
import { buildSurveyCsv, proposeSurveyActions, type SurveyActionProposal } from "@/lib/services/survey-report-service";
import { deriveDeadlineAlerts, type DeadlineAlert } from "@/lib/services/beneficiary-deadline-service";
import { buildEodaFileName } from "@/lib/services/document-naming-service";
import { recordAuditEvent } from "@/lib/services/audit-log-service";

// ─────────────────────────────────────────────────────────────────────────────
// TERRAIN — LECTURES (lot C). Garde : requireEstablishmentAccess(id, TERRAIN_READ)
// — direction et responsable qualité côté structure, STRUCTURES_READ côté cabinet
// (« mêmes onglets en lecture »). Toutes les données usager passent par le port :
// avec le verrou HDS fermé, elles sont vides et `hdsAvailable` vaut false — l'écran
// le dit, il n'invente rien.
// ─────────────────────────────────────────────────────────────────────────────

export type PeopleRow = {
  id: string;
  name: string;
  girLevel: number | null;
  monthlyHours: number | null;
  surveyDone: boolean;
};

export type TerrainBoard = {
  hdsAvailable: boolean;
  people: PeopleRow[];
  alerts: (DeadlineAlert & { name: string })[];
  surveyStats: TemplateStats[];
  proposals: SurveyActionProposal[];
  coverage: { done: number; total: number; personne: number; famille: number };
};

function campaignStart(now: Date): Date {
  const start = new Date(now.getTime());
  start.setUTCMonth(start.getUTCMonth() - SURVEY_CAMPAIGN_MONTHS);
  return start;
}

async function scopeOf(establishmentId: unknown): Promise<{ tenantId: string; establishmentId: string; name: string }> {
  if (typeof establishmentId !== "string" || establishmentId.length === 0) notFound();
  const access = await requireEstablishmentAccess(establishmentId, NEED.TERRAIN_READ);
  const row = await prisma.establishment.findUniqueOrThrow({
    where: { id: access.establishmentId },
    select: { tenantId: true, name: true },
  });
  return { tenantId: row.tenantId, establishmentId: access.establishmentId, name: row.name };
}

export async function getTerrainBoard(establishmentId: string): Promise<TerrainBoard> {
  const scope = await scopeOf(establishmentId);
  const port = getBeneficiaryDataPort();
  const now = new Date();
  const [beneficiaries, documents, responses] = await Promise.all([
    port.listBeneficiaries(scope),
    port.listBeneficiaryDocuments(scope),
    port.listSurveyResponses(scope, campaignStart(now)),
  ]);
  const surveyed = new Set(responses.flatMap((r) => (r.beneficiaryId ? [r.beneficiaryId] : [])));
  const nameOf = new Map(beneficiaries.map((b) => [b.id, `${b.firstName} ${b.lastName}`]));
  const surveyStats = SURVEY_TEMPLATES.map((template) => computeTemplateStats(template, responses));
  const active = beneficiaries.filter((b) => !b.endedOn || b.endedOn > now);

  return {
    hdsAvailable: port.isAvailable,
    people: active.map((b) => ({
      id: b.id,
      name: nameOf.get(b.id) ?? "",
      girLevel: b.girLevel,
      monthlyHours: b.monthlyHours,
      surveyDone: surveyed.has(b.id),
    })),
    alerts: deriveDeadlineAlerts(beneficiaries, documents, now).map((alert) => ({
      ...alert,
      name: nameOf.get(alert.beneficiaryId) ?? "",
    })),
    surveyStats,
    proposals: proposeSurveyActions(surveyStats),
    coverage: {
      done: active.filter((b) => surveyed.has(b.id)).length,
      total: active.length,
      personne: responses.filter((r) => r.templateCode === "PERSONNE").length,
      famille: responses.filter((r) => r.templateCode === "FAMILLE").length,
    },
  };
}

// Export AGRÉGÉ (une ligne par question, jamais par répondant), servi par la route
// /api/export/enquete/[id]. Journalisé sans contenu.
export async function buildSurveyExport(establishmentId: string): Promise<{ csv: string; fileName: string }> {
  const scope = await scopeOf(establishmentId);
  const access = await requireEstablishmentAccess(scope.establishmentId, NEED.TERRAIN_READ);
  const responses = await getBeneficiaryDataPort().listSurveyResponses(scope, campaignStart(new Date()));
  const csv = buildSurveyCsv(SURVEY_TEMPLATES.map((template) => computeTemplateStats(template, responses)));
  await recordAuditEvent({
    action: "SURVEY_RESULTS_EXPORTED",
    actorUserId: access.userId,
    actorRole: access.session.user.role,
    establishmentId: scope.establishmentId,
  });
  const fileName = buildEodaFileName({
    issuedOn: new Date(),
    type: "ENQUETE",
    clientName: scope.name,
    objet: "Resultats-satisfaction",
    audience: "Interne",
    extension: "csv",
  });
  return { csv, fileName };
}
