// ─────────────────────────────────────────────────────────────────────────────
// PURGE DU CONTENU DÉRIVÉ DES DOCUMENTS À ACCÈS RESTREINT (ADR 20261110, relecture de
// sécurité du 10/11/2026).
//
// Un tampon déposé AVANT la restriction a pu être lu par l'IA : texte extrait, analyse,
// brouillon corrigé, essais du laboratoire, suggestions de critères, images extraites,
// propositions de mise en conformité. Toutes les portes de l'application les ferment
// désormais ; ce module les EFFACE de la base. Le fichier déposé, lui, reste (c'est le
// tampon que la direction et la tablette ouvrent).
//
// Ce module décide et écrit ; le script `scripts/purge-restricted-document-content.ts`
// l'appelle — essai à blanc par défaut, `--apply` pour écrire. Testé par
// `apps/web/src/lib/db/restricted-content-purge.test.ts` sur un client doublé.
//
// Journal : une ligne par version, action `ANALYSIS_UNPUBLISHED` (l'énumération
// `AuditAction` n'a pas de valeur dédiée, et en ajouter une est une migration), acteur
// « SCRIPT … », détail = code du type seulement — jamais de contenu ni de personne.
// Limite : les images extraites sont retirées de la base, pas du stockage (le script
// n'a pas d'accès au stockage) ; leur nombre est rendu pour décision.
// ─────────────────────────────────────────────────────────────────────────────
import { Prisma, type PrismaClient } from "@prisma/client";

export const PURGE_ACTOR_ROLE = "SCRIPT purge-restricted-document-content";

export type RestrictedContentCounts = {
  versions: number;
  extractedTexts: number;
  analyses: number;
  correctedDrafts: number;
  analysisTrials: number;
  criterionSuggestions: number;
  versionImages: number;
  correctionProposals: number;
};

export type RestrictedContentPurgeReport = { applied: boolean; counts: RestrictedContentCounts };

type PurgeTx = Pick<
  Prisma.TransactionClient,
  "documentVersion" | "analysisTrial" | "documentCriterionSuggestion" | "documentVersionImage" | "correctionProposal" | "auditLogEntry"
>;
export type RestrictedContentPurgeClient = PurgeTx & Pick<PrismaClient, "$transaction">;

const EMPTY_COUNTS: RestrictedContentCounts = {
  versions: 0,
  extractedTexts: 0,
  analyses: 0,
  correctedDrafts: 0,
  analysisTrials: 0,
  criterionSuggestions: 0,
  versionImages: 0,
  correctionProposals: 0,
};

async function countContent(client: PurgeTx, versionIds: string[]): Promise<RestrictedContentCounts> {
  const id = { in: versionIds };
  const [extractedTexts, analyses, correctedDrafts, analysisTrials, criterionSuggestions, versionImages, correctionProposals] =
    await Promise.all([
      client.documentVersion.count({ where: { id, extractedText: { not: null } } }),
      client.documentVersion.count({ where: { id, analysisResultJson: { not: Prisma.AnyNull } } }),
      client.documentVersion.count({ where: { id, correctedDraftMarkdown: { not: null } } }),
      client.analysisTrial.count({ where: { documentVersionId: id } }),
      client.documentCriterionSuggestion.count({ where: { documentVersionId: id } }),
      client.documentVersionImage.count({ where: { documentVersionId: id } }),
      client.correctionProposal.count({ where: { sourceVersionId: id } }),
    ]);
  return {
    versions: versionIds.length,
    extractedTexts,
    analyses,
    correctedDrafts,
    analysisTrials,
    criterionSuggestions,
    versionImages,
    correctionProposals,
  };
}

export async function purgeRestrictedDocumentContent(
  client: RestrictedContentPurgeClient,
  options: { codes: readonly string[]; apply: boolean }
): Promise<RestrictedContentPurgeReport> {
  if (options.codes.length === 0) return { applied: false, counts: EMPTY_COUNTS };

  // Jamais le contenu lui-même : l'identifiant, l'établissement et le code du type.
  const versions = await client.documentVersion.findMany({
    where: { document: { documentType: { code: { in: [...options.codes] } } } },
    select: { id: true, document: { select: { establishmentId: true, documentType: { select: { code: true } } } } },
  });
  if (versions.length === 0) return { applied: false, counts: EMPTY_COUNTS };

  const versionIds = versions.map((version) => version.id);
  const counts = await countContent(client, versionIds);
  if (!options.apply) return { applied: false, counts };

  const id = { in: versionIds };
  await client.$transaction(async (tx) => {
    await tx.documentVersion.updateMany({
      where: { id },
      data: {
        extractedText: null,
        analysisResultJson: Prisma.DbNull,
        correctedDraftMarkdown: null,
        correctedDraftGeneratedAt: null,
        // Une revue qui porte sur une analyse effacée ne dirait plus rien.
        analysisReviewedAt: null,
        analysisReviewedByUserId: null,
      },
    });
    await tx.analysisTrial.deleteMany({ where: { documentVersionId: id } });
    await tx.documentCriterionSuggestion.deleteMany({ where: { documentVersionId: id } });
    await tx.documentVersionImage.deleteMany({ where: { documentVersionId: id } });
    await tx.correctionProposal.deleteMany({ where: { sourceVersionId: id } });
    for (const version of versions) {
      await tx.auditLogEntry.create({
        data: {
          action: "ANALYSIS_UNPUBLISHED",
          actorUserId: null,
          actorRole: PURGE_ACTOR_ROLE,
          establishmentId: version.document.establishmentId,
          targetId: version.id,
          detail: `${version.document.documentType?.code ?? "?"} · contenu dérivé effacé (accès restreint)`,
        },
      });
    }
  });
  return { applied: true, counts };
}
