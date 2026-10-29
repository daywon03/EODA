import { prisma, type SupportMode } from "@eoda/database";
import { notFound } from "next/navigation";
import { readStoredAnalysis } from "@/lib/services/stored-analysis-service";
import { NEED } from "@/lib/auth/capabilities";
import { requireEstablishmentAccess, type EstablishmentAccessContext } from "@/lib/auth/guards";
import { findMissionOffer, type MissionOffer } from "@/lib/services/establishment-offer-service";
import { resolveSupportMode } from "@/lib/services/support-mode-service";
import { correctionRight, type CorrectionRight } from "@/lib/services/offer-scope-service";
import { analysisVisibleTo } from "@/lib/services/analysis-view-service";
import { canUseComplianceWorkspace } from "@/lib/services/correction-proposal-service";

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXTE D'UNE MISE EN CONFORMITÉ (N8) — résolu une seule fois pour l'écran côte à
// côte, ses actions et ses exports. Pas une garde de plus : l'accès passe par
// requireEstablishmentAccess (guards.ts) ; ce module y ajoute la règle d'usage de
// l'écran (canUseComplianceWorkspace) et, côté structure, la barrière
// analysisVisibleTo — un écran inaccessible répond introuvable, comme un objet hors
// périmètre. L'identifiant de version reçu est une entrée non fiable.
// ─────────────────────────────────────────────────────────────────────────────

const versionSelect = {
  id: true,
  versionNumber: true,
  extractedText: true,
  analysisResultJson: true,
  analysisReviewedAt: true,
  document: {
    select: {
      id: true,
      establishmentId: true,
      currentVersionId: true,
      documentTypeId: true,
      documentType: { select: { id: true, label: true, code: true, category: true } },
      establishment: { select: { name: true } },
    },
  },
} as const;

export type CorrectionContext = {
  access: EstablishmentAccessContext;
  mode: SupportMode;
  offer: MissionOffer | null;
  right: CorrectionRight;
  hasAnalysis: boolean;
  version: {
    id: string;
    versionNumber: number;
    extractedText: string | null;
    isCurrent: boolean;
    documentId: string;
    documentTypeId: string;
    documentLabel: string;
    documentCode: string;
    establishmentId: string;
    establishmentName: string;
  };
};

export async function openCorrectionContext(versionId: unknown): Promise<CorrectionContext> {
  if (typeof versionId !== "string" || versionId.length === 0) notFound();
  const version = await prisma.documentVersion.findUnique({ where: { id: versionId }, select: versionSelect });
  if (!version?.document.documentType) notFound();
  const { document } = version;
  const documentType = document.documentType!;

  const access = await requireEstablishmentAccess(document.establishmentId, NEED.DOCUMENTS_WRITE);
  const offer = await findMissionOffer(document.establishmentId);
  const mode = resolveSupportMode(offer);
  const right = correctionRight(offer, documentType.category);

  if (!canUseComplianceWorkspace({ isClient: access.isClient, mode, rightIncluded: right.included })) notFound();
  const analysis = readStoredAnalysis(version.analysisResultJson);
  // La structure ne travaille que sur ce qu'on lui montre (même barrière que l'écran
  // « Mes documents »).
  if (access.isClient && analysisVisibleTo("CLIENT", { analysis, reviewedAt: version.analysisReviewedAt }, mode) === null) {
    notFound();
  }

  return {
    access,
    mode,
    offer,
    right,
    hasAnalysis: analysis !== null,
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      extractedText: version.extractedText,
      isCurrent: document.currentVersionId === version.id,
      documentId: document.id,
      documentTypeId: documentType.id,
      documentLabel: documentType.label,
      documentCode: documentType.code,
      establishmentId: document.establishmentId,
      establishmentName: document.establishment.name,
    },
  };
}

// Libellés des critères cités par une proposition (« Pour le critère : 3.12.1 — … »).
export async function readCriterionLabels(codes: readonly string[]): Promise<Map<string, string>> {
  if (codes.length === 0) return new Map();
  const criteria = await prisma.criterion.findMany({ where: { code: { in: [...codes] } }, select: { code: true, label: true } });
  return new Map(criteria.map((c) => [c.code, c.label]));
}
