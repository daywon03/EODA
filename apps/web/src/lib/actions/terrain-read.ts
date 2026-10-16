"use server";

import { prisma } from "@eoda/database";
import { notFound } from "next/navigation";
import { requireEstablishmentAccess, type EstablishmentAccessContext } from "@/lib/auth/guards";
import { NEED } from "@/lib/auth/capabilities";
import { getBeneficiaryDataPort, type BeneficiaryScope, type SurveyResponseRecord } from "@/lib/hds";
import { SURVEY_CAMPAIGN_MONTHS, SURVEY_TEMPLATES } from "@/content/enquete";
import { computeTemplateStats, withoutFreeTexts, type TemplateStats } from "@/lib/services/survey-stats-service";
import { buildSurveyCsv, proposeSurveyActions, type SurveyActionProposal } from "@/lib/services/survey-report-service";
import { deriveDeadlineAlerts, isActiveOn, type DeadlineAlert } from "@/lib/services/beneficiary-deadline-service";
import { computeBeneficiaryAggregates, type BeneficiaryAggregates } from "@/lib/services/beneficiary-aggregate-service";
import { buildEodaFileName } from "@/lib/services/document-naming-service";
import { recordAuditEvent } from "@/lib/services/audit-log-service";

// ─────────────────────────────────────────────────────────────────────────────
// TERRAIN — LECTURES (lot C). Garde : requireEstablishmentAccess(id, TERRAIN_READ)
// — direction et responsable qualité côté structure, STRUCTURES_READ côté cabinet.
// Toutes les données usager passent par le port : avec le verrou HDS fermé, elles
// sont vides et `hdsAvailable` vaut false — l'écran le dit, il n'invente rien.
//
// MINIMISATION (décision de Damon, 14/10/2026) : la liste NOMINATIVE
// (`getPeopleBoard`) est réservée à la structure ; un compte cabinet y reçoit
// `notFound()`. Le cabinet lit des chiffres (`getPeopleAggregates`) et les
// statistiques d'enquête, calculés sur `listBeneficiaryTimelines` — qui ne
// sélectionne aucun champ nominatif.
// ─────────────────────────────────────────────────────────────────────────────

export type PeopleRow = {
  id: string;
  name: string;
  girLevel: number | null;
  monthlyHours: number | null;
  surveyDone: boolean;
};

export type TerrainPeopleBoard = {
  hdsAvailable: boolean;
  people: PeopleRow[];
  alerts: (DeadlineAlert & { name: string })[];
};

export type TerrainPeopleAggregates = { hdsAvailable: boolean; aggregates: BeneficiaryAggregates };

export type TerrainSurveyBoard = {
  hdsAvailable: boolean;
  surveyStats: TemplateStats[];
  proposals: SurveyActionProposal[];
  // Vrai côté cabinet : les commentaires libres ont été retirés côté serveur.
  freeTextsWithheld: boolean;
  coverage: { done: number; total: number; personne: number; famille: number };
};

type TerrainContext = { scope: BeneficiaryScope; name: string; access: EstablishmentAccessContext };

function campaignStart(now: Date): Date {
  const start = new Date(now.getTime());
  start.setUTCMonth(start.getUTCMonth() - SURVEY_CAMPAIGN_MONTHS);
  return start;
}

async function contextOf(establishmentId: unknown): Promise<TerrainContext> {
  if (typeof establishmentId !== "string" || establishmentId.length === 0) notFound();
  const access = await requireEstablishmentAccess(establishmentId, NEED.TERRAIN_READ);
  const row = await prisma.establishment.findUniqueOrThrow({
    where: { id: access.establishmentId },
    select: { tenantId: true, name: true },
  });
  return { scope: { tenantId: row.tenantId, establishmentId: access.establishmentId }, name: row.name, access };
}

function surveyedIdsOf(responses: readonly SurveyResponseRecord[]): Set<string> {
  return new Set(responses.flatMap((r) => (r.beneficiaryId ? [r.beneficiaryId] : [])));
}

// Liste nominative — STRUCTURE seulement. Le refus est ici, côté serveur : masquer
// l'onglet ne suffirait pas.
export async function getPeopleBoard(establishmentId: string): Promise<TerrainPeopleBoard> {
  const { scope, access } = await contextOf(establishmentId);
  if (!access.isClient) notFound();
  const port = getBeneficiaryDataPort();
  const now = new Date();
  const [beneficiaries, documents, responses] = await Promise.all([
    port.listBeneficiaries(scope),
    port.listBeneficiaryDocuments(scope),
    port.listSurveyResponses(scope, campaignStart(now)),
  ]);
  const surveyed = surveyedIdsOf(responses);
  const nameOf = new Map(beneficiaries.map((b) => [b.id, `${b.firstName} ${b.lastName}`]));

  return {
    hdsAvailable: port.isAvailable,
    people: beneficiaries
      .filter((b) => isActiveOn(b, now))
      .map((b) => ({
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
  };
}

// Chiffres agrégés — ce que lit le cabinet (et que la structure peut lire aussi).
export async function getPeopleAggregates(establishmentId: string): Promise<TerrainPeopleAggregates> {
  const { scope } = await contextOf(establishmentId);
  const port = getBeneficiaryDataPort();
  const now = new Date();
  const [timelines, documents, responses] = await Promise.all([
    port.listBeneficiaryTimelines(scope),
    port.listBeneficiaryDocuments(scope),
    port.listSurveyResponses(scope, campaignStart(now)),
  ]);
  return {
    hdsAvailable: port.isAvailable,
    aggregates: computeBeneficiaryAggregates({ timelines, documents, surveyedIds: surveyedIdsOf(responses), today: now }),
  };
}

// Le cabinet reçoit les statistiques SANS les commentaires libres (minimisation,
// 14/10/2026) : le retrait se fait ici, pas dans le composant — ce que le serveur
// n'envoie pas ne peut pas fuir.
export async function getSurveyBoard(establishmentId: string): Promise<TerrainSurveyBoard> {
  const { scope, access } = await contextOf(establishmentId);
  const port = getBeneficiaryDataPort();
  const now = new Date();
  const [timelines, responses] = await Promise.all([
    port.listBeneficiaryTimelines(scope),
    port.listSurveyResponses(scope, campaignStart(now)),
  ]);
  const surveyed = surveyedIdsOf(responses);
  const active = timelines.filter((b) => isActiveOn(b, now));
  const computed = SURVEY_TEMPLATES.map((template) => computeTemplateStats(template, responses));
  const surveyStats = access.isClient ? computed : computed.map(withoutFreeTexts);

  return {
    hdsAvailable: port.isAvailable,
    surveyStats,
    proposals: proposeSurveyActions(surveyStats),
    freeTextsWithheld: !access.isClient,
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
  const { scope, name, access } = await contextOf(establishmentId);
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
    clientName: name,
    objet: "Resultats-satisfaction",
    audience: "Interne",
    extension: "csv",
  });
  return { csv, fileName };
}
