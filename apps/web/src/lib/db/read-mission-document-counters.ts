import { prisma } from "@eoda/database";
import type { CommercialTier } from "@eoda/database";
import { getCoveredDocumentCategories } from "@/lib/services/offer-scope-service";
import {
  computeMissionDocumentCounters,
  type MissionDocumentCounters,
} from "@/lib/services/mission-document-counters-service";

// Lecture des quatre compteurs documentaires (déposés / analysés par l'IA /
// modifiés / conformes, §12.4) pour un établissement dont l'offre est déjà connue.
//
// Ce module existe parce que DEUX portails affichent les mêmes compteurs : le
// suivi de mission côté Cabinet (lib/actions/mission.ts) et « Mon accompagnement »
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
  formule: CommercialTier,
  gratuit: boolean
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
      versions: { select: { analysisResultJson: true, regeneratedFromVersionId: true } },
    },
  });

  return computeMissionDocumentCounters(
    documents.map((document) => ({
      status: document.status,
      versionCount: document.versions.length,
      hasAnalyzedVersion: document.versions.some((v) => v.analysisResultJson !== null),
      hasRegeneratedVersion: document.versions.some((v) => v.regeneratedFromVersionId !== null),
    }))
  );
}
