import { prisma } from "@eoda/database";
import type { LLMAnalysisPort } from "@/lib/llm";
import type { FileStoragePort } from "@/lib/storage";
import type { BrandedDocxImageInput } from "@/lib/services/markdown-to-docx-service";
import { anonymizeText } from "@/lib/services/anonymization-service";
import { parseAnalysisResult } from "@/lib/services/analysis-view-service";
import { fetchKnowledgeExcerpts, fetchCriterionGuidelines } from "@/lib/services/document-ingestion-service";
import { readValidatedExamples } from "@/lib/db/read-validated-examples";
import { sanitizeProposal, type CorrectionProposal } from "@/lib/llm/correction-proposal";
import { proposalToMarkdown } from "@/lib/services/correction-proposal-service";
import { applicableToValuesFor } from "@/lib/services/criterion-applicability-service";

// ─────────────────────────────────────────────────────────────────────────────
// GÉNÉRATION D'UN BROUILLON DE DOCUMENT CORRIGÉ PAR L'IA
//
// « Quand l'analyse est faite, ensuite le document est généré par l'IA […]
// brandé EODA, qu'ils pourront réutiliser ensuite » (Damon, 15/09/2026). Document
// ENTIER régénéré (pas seulement les paragraphes correctifs). Depuis N8 (12/10/2026)
// la sortie est STRUCTURÉE (segments ORIGINAL / AJOUT, correction-proposal.ts) et
// stockée comme CorrectionProposal ; les exemples validés du même type (gabarits
// FINALE, context/10 §9) sont injectés comme donnée.
//
// Même structure que analyzeVersion() dans document-ingestion-service.ts :
// l'enrichissement (base de connaissances, guidelines du cabinet) est
// exactement le même, réutilisé tel quel (D1) — seul l'appel LLM change de
// forme (une proposition structurée).
//
// Une analyse préalable est un PRÉALABLE, pas une option : sans
// elementsManquants/suggestionsCorrection, l'IA n'aurait rien à corriger et
// recopierait le document tel quel en prétendant l'avoir amélioré.
// ─────────────────────────────────────────────────────────────────────────────

export type GenerateDraftResult = { ok: true; proposalId: string; proposal: CorrectionProposal } | { error: string };

export async function generateCorrectedDraft(
  documentVersionId: string,
  llm: LLMAnalysisPort,
  modelId: string | null | undefined,
  generatedById: string
): Promise<GenerateDraftResult> {
  const version = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    select: {
      id: true,
      extractedText: true,
      analysisResultJson: true,
      document: {
        select: {
          id: true,
          establishmentId: true,
          documentTypeId: true,
          documentType: { select: { label: true } },
          establishment: { select: { name: true, tenantId: true, type: true } },
        },
      },
    },
  });
  if (!version || !version.document.documentTypeId || !version.document.documentType) {
    return { error: "Document introuvable." };
  }

  if (!version.extractedText) {
    return {
      error: "Aucun texte n'a pu être extrait de ce document — la génération n'est pas possible pour ce format.",
    };
  }

  const analysis = parseAnalysisResult(version.analysisResultJson);
  if (!analysis) {
    return {
      error: "Ce document doit d'abord être analysé — la génération s'appuie sur les manques et suggestions identifiés.",
    };
  }

  const documentTypeId = version.document.documentTypeId;
  const [linkedCriteria, allCriteria] = await Promise.all([
    prisma.documentTypeCriterion.findMany({
      where: { documentTypeId },
      include: { criterion: { select: { label: true, id: true, code: true } } },
    }),
    // Les codes que le modèle peut citer pour justifier un ajout : le référentiel du
    // profil de la structure (un SAD aide ne voit jamais un critère SAD mixte).
    prisma.criterion.findMany({
      where: { applicableTo: { in: applicableToValuesFor(version.document.establishment.type) } },
      select: { code: true },
    }),
  ]);
  const criteriaLabels = linkedCriteria.map((c) => c.criterion.label);
  const criterionIds = linkedCriteria.map((c) => c.criterion.id);
  const linkedCriteriaOption = linkedCriteria.map((c) => ({ code: c.criterion.code, label: c.criterion.label }));
  const tenantId = version.document.establishment.tenantId;

  const [knowledgeExcerpts, criterionGuidelines, validatedExamples] = await Promise.all([
    fetchKnowledgeExcerpts(tenantId, version.document.documentType.label, criteriaLabels),
    fetchCriterionGuidelines(tenantId, criterionIds, version.document.id),
    // Exemples validés du même type, du même tenant — jamais d'un autre établissement.
    readValidatedExamples(tenantId, documentTypeId),
  ]);

  const sentText = anonymizeText(version.extractedText);
  try {
    const raw = await llm.generateCorrectedDocument({
      documentTypeLabel: version.document.documentType.label,
      extractedText: sentText,
      linkedCriteria: linkedCriteriaOption,
      knowledgeExcerpts,
      criterionGuidelines,
      elementsManquants: analysis.elementsManquants,
      suggestionsCorrection: analysis.suggestionsCorrection,
      ...(validatedExamples.length > 0 && { validatedExamples }),
      ...(modelId && { modelId }),
    });
    // Ce que le modèle ne peut pas prouver est retiré (code hors référentiel,
    // citation du manuel absente des extraits fournis).
    const proposal = sanitizeProposal(raw, {
      knownCriterionCodes: new Set(allCriteria.map((c) => c.code)),
      knowledgeExcerpts,
      originalText: sentText,
    });

    const [created] = await prisma.$transaction([
      prisma.correctionProposal.create({
        data: { sourceVersionId: version.id, proposalJson: proposal, generatedById },
        select: { id: true },
      }),
      // Le brouillon Markdown (panneau cabinet existant, export « brouillon ») reste
      // alimenté : c'est la proposition entière, ajouts compris.
      prisma.documentVersion.update({
        where: { id: version.id },
        data: { correctedDraftMarkdown: proposalToMarkdown(proposal), correctedDraftGeneratedAt: new Date() },
      }),
    ]);

    return { ok: true, proposalId: created.id, proposal };
  } catch (error) {
    console.error("Génération du brouillon corrigé échouée :", error);
    return { error: "La génération a échoué. Réessayez dans un instant." };
  }
}

// Images d'origine de la version, prêtes à être passées à `generateBrandedDocx`
// (annexe, D6) — chargées depuis `DocumentVersionImage` (D4) puis leur contenu
// récupéré via le port de stockage. Best-effort à deux niveaux : par image (une
// image dont le téléchargement échoue est omise de l'annexe) et globalement (une
// panne de lecture de la table, comme fetchImageDescriptions dans
// document-ingestion-service.ts, ne doit jamais faire échouer le téléchargement
// du brouillon lui-même — l'annexe est un bonus, pas une condition).
export async function loadCorrectedDraftImages(
  documentVersionId: string,
  storage: FileStoragePort
): Promise<BrandedDocxImageInput[]> {
  try {
    const images = await prisma.documentVersionImage.findMany({
      where: { documentVersionId },
      orderBy: { position: "asc" },
      select: { position: true, fileStorageKey: true, contentType: true, description: true },
    });

    const results: BrandedDocxImageInput[] = [];
    for (const image of images) {
      try {
        const buffer = await storage.download(image.fileStorageKey);
        results.push({
          buffer,
          contentType: image.contentType,
          description: image.description,
          position: image.position,
        });
      } catch (error) {
        console.error("Image d'origine — téléchargement échoué, omise de l'annexe :", error);
      }
    }
    return results;
  } catch (error) {
    console.error("Images d'origine — lecture échouée, brouillon généré sans annexe :", error);
    return [];
  }
}

// Édition manuelle du brouillon — le cabinet relit et complète ce que l'IA a
// laissé en `[À compléter par la structure : …]` avant de le partager. Ne
// touche pas `correctedDraftGeneratedAt` : cette date reste celle de la
// génération IA, pas de la dernière modification humaine.
export async function saveCorrectedDraft(documentVersionId: string, markdown: string): Promise<void> {
  await prisma.documentVersion.update({
    where: { id: documentVersionId },
    data: { correctedDraftMarkdown: markdown },
  });
}
