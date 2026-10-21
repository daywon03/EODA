import { prisma, type EstablishmentType, type SupportMode } from "@eoda/database";
import { readCriteriaProofFor } from "./read-criteria-proof";
import { readChapters } from "./referential-cache";
import { findMissionOffer } from "@/lib/services/establishment-offer-service";
import { resolveSupportMode } from "@/lib/services/support-mode-service";
import { getOfferScope } from "@/lib/services/offer-scope-service";
import { EXPECTED_IMPERATIVE_COUNT } from "@/lib/services/criterion-applicability-service";
import { countImperativesInProgress, type CriterionProofRow } from "@/lib/services/criteria-proof-service";
import {
  buildDiagnosticSummary,
  derivePriorityActions,
  describeDiagnosticLine,
  diagnosticFingerprint,
  groupDiagnosticChapters,
  type DiagnosticChapter,
  type DiagnosticSummary,
  type PriorityAction,
} from "@/lib/services/diagnostic-service";
import {
  describeDiagnosticValidation,
  type DiagnosticValidationFacts,
  type DiagnosticValidationView,
} from "@/lib/services/diagnostic-validation-service";

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE « Mon diagnostic » d'une structure (tranche N6).
//
// Aucune garde ici : l'appelant a DÉJÀ résolu l'établissement sous sa garde
// (requireClientEstablishment, requireEstablishmentInTenant, requireEstablishmentAccess).
// Les règles vivent dans diagnostic-service / diagnostic-validation-service.
// ─────────────────────────────────────────────────────────────────────────────

export type DiagnosticData = {
  establishmentId: string;
  establishmentName: string;
  establishmentLogo: string | null;
  establishmentType: EstablishmentType;
  expectedImperatives: number;
  mode: SupportMode;
  scopeAll: boolean;
  rows: CriterionProofRow[];
  summary: DiagnosticSummary;
  line: string;
  priorities: PriorityAction[];
  chapters: DiagnosticChapter[];
  fingerprint: string;
  latestValidation: DiagnosticValidationFacts | null;
  validation: DiagnosticValidationView;
};

export async function readLatestDiagnosticValidation(establishmentId: string): Promise<DiagnosticValidationFacts | null> {
  return prisma.diagnosticValidation.findFirst({
    where: { establishmentId },
    orderBy: { createdAt: "desc" },
    select: { id: true, snapshotJson: true, reviewedByEodaAt: true, acceptedByClientAt: true },
  });
}

export async function readDiagnostic(establishmentId: string): Promise<DiagnosticData | null> {
  const establishment = await prisma.establishment.findUnique({
    where: { id: establishmentId },
    select: { id: true, name: true, type: true, logoDataUri: true },
  });
  if (!establishment) return null;

  const offer = await findMissionOffer(establishment.id);
  const mode = resolveSupportMode(offer);
  // Sans mission, le périmètre le plus étroit (les impératifs) : on ne montre pas un
  // référentiel qu'aucun contrat ne couvre.
  const scopeAll = offer ? getOfferScope(offer.formule, offer.gratuit).criteriaScope === "ALL" : false;

  // Calcul « critères & preuves » partagé avec les autres panneaux du même rendu, et
  // chapitres lus dans le cache du référentiel.
  const [rows, chapters, latestValidation] = await Promise.all([
    readCriteriaProofFor(establishment.id, establishment.type, mode),
    readChapters(),
    readLatestDiagnosticValidation(establishment.id),
  ]);

  const expectedTypeIds = [...new Set(rows.flatMap((r) => r.expectedDocumentTypeIds))];
  const documentTypes =
    expectedTypeIds.length > 0
      ? await prisma.documentType.findMany({ where: { id: { in: expectedTypeIds } }, select: { id: true, label: true } })
      : [];
  const documentLabels = new Map(documentTypes.map((t) => [t.id, t.label]));

  const summary = buildDiagnosticSummary(rows);
  const fingerprint = diagnosticFingerprint(rows);
  return {
    establishmentId: establishment.id,
    establishmentName: establishment.name,
    establishmentLogo: establishment.logoDataUri,
    establishmentType: establishment.type,
    expectedImperatives: EXPECTED_IMPERATIVE_COUNT[establishment.type],
    mode,
    scopeAll,
    rows,
    summary,
    line: describeDiagnosticLine(summary.imperatives, countImperativesInProgress(rows)),
    priorities: derivePriorityActions(rows, documentLabels),
    chapters: groupDiagnosticChapters(rows, chapters, scopeAll),
    fingerprint,
    latestValidation,
    validation: describeDiagnosticValidation(mode, latestValidation, fingerprint),
  };
}
