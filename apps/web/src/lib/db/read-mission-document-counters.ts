import { prisma } from "@eoda/database";
import type { CommercialTier, SupportMode } from "@eoda/database";
import { getCoveredDocumentCategories } from "@/lib/services/offer-scope-service";
import {
  computeMissionDocumentCounters,
  type MissionDocumentCounters,
} from "@/lib/services/mission-document-counters-service";

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
