import { prisma } from "@eoda/database";
import type { CommercialTier, SupportMode } from "@eoda/database";
import { getCoveredDocumentCategories } from "@/lib/services/offer-scope-service";
import {
  computeMissionDocumentCounters,
  countComplianceDocuments,
  type ComplianceDocuments,
  type MissionDocumentCounters,
} from "@/lib/services/mission-document-counters-service";

// Documents attendus par l'offre et documents prouvés — mesure de l'étape « Mise en
// conformité » (call du 09/11/2026). Lu par les DEUX portails (suivi de mission du
// cabinet, « Mon suivi » de la structure) : un seul chemin, sinon l'un compterait
// ce que l'autre ne voit pas (D1). Même absence de garde que la fonction suivante,
// pour la même raison : ses appelants ont déjà franchi lib/auth/guards.ts.
//
// Un type de document attendu sans ligne Document compte quand même : c'est
// précisément ce qui reste à faire.
export async function readMissionComplianceDocuments(
  establishmentId: string,
  formule: CommercialTier | null,
  gratuit: boolean,
  mode: SupportMode
): Promise<ComplianceDocuments> {
  const categories = [...getCoveredDocumentCategories(formule, gratuit)];
  const [types, documents] = await Promise.all([
    prisma.documentType.findMany({
      where: { category: { in: categories } },
      select: { id: true, category: true, code: true, isConditional: true },
    }),
    prisma.document.findMany({
      where: { establishmentId, documentType: { category: { in: categories } } },
      select: {
        documentTypeId: true,
        status: true,
        statusOverriddenByUser: true,
        validatedAt: true,
        clientAcceptedAt: true,
        currentVersion: { select: { uploadedAt: true, uploadedBy: { select: { role: true } } } },
      },
    }),
  ]);
  const byTypeId = new Map(documents.map((d) => [d.documentTypeId, d]));

  return countComplianceDocuments(
    types.map((type) => {
      const doc = byTypeId.get(type.id);
      return {
        category: type.category,
        code: type.code,
        isConditional: type.isConditional,
        document: doc
          ? {
              status: doc.status,
              statusOverriddenByUser: doc.statusOverriddenByUser,
              validatedAt: doc.validatedAt,
              clientAcceptedAt: doc.clientAcceptedAt,
              currentVersionUploadedAt: doc.currentVersion?.uploadedAt ?? null,
              currentVersionByCabinet: doc.currentVersion != null && doc.currentVersion.uploadedBy.role !== "CLIENT_USER",
            }
          : null,
      };
    }),
    mode
  );
}

// Lecture des quatre compteurs documentaires (déposés / analysés par l'IA /
// modifiés / validés par EODA, §12.4) pour un établissement dont l'offre est déjà connue.
//
// Ce module existe parce que DEUX portails affichent les mêmes compteurs : le
// suivi de mission côté Cabinet (lib/actions/mission.ts) et « Mon suivi »
// côté client (lib/actions/client-contract.ts). Deux requêtes parallèles finiraient
// par diverger — l'une filtrerait par catégorie couverte, l'autre l'oublierait, et
// le client verrait un compteur que Sandrine ne voit pas (D1).
//
// ⚠️ AUCUN contrôle d'accès ici, et c'est délibéré : ce fichier n'est pas un
// module "use server", il n'est donc pas exposé comme route HTTP. Ses deux
// appelants sont des actions serveur qui ont DÉJÀ franchi lib/auth/guards.ts.
// Ne jamais l'appeler depuis un chemin non gardé.
export async function readMissionDocumentCounters(
  establishmentId: string,
  formule: CommercialTier | null,
  gratuit: boolean,
  mode: SupportMode
): Promise<MissionDocumentCounters> {
  const documents = await prisma.document.findMany({
    where: {
      establishmentId,
      documentType: {
        category: { in: [...getCoveredDocumentCategories(formule, gratuit)] },
      },
    },
    select: {
      status: true,
      validatedAt: true,
      clientAcceptedAt: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        select: {
          analysisResultJson: true,
          regeneratedFromVersionId: true,
          uploadedAt: true,
          uploadedBy: { select: { role: true } },
        },
      },
    },
  });

  return computeMissionDocumentCounters(
    documents.map((document) => {
      // Versions triées de la plus récente à la plus ancienne : la première est la COURANTE.
      const current = document.versions[0];
      return {
        status: document.status,
        versionCount: document.versions.length,
        hasAnalyzedVersion: document.versions.some((v) => v.analysisResultJson !== null),
        hasRegeneratedVersion: document.versions.some((v) => v.regeneratedFromVersionId !== null),
        validatedAt: document.validatedAt,
        clientAcceptedAt: document.clientAcceptedAt,
        currentVersionUploadedAt: current?.uploadedAt ?? null,
        currentVersionByCabinet: current !== undefined && current.uploadedBy.role !== "CLIENT_USER",
      };
    }),
    mode
  );
}
