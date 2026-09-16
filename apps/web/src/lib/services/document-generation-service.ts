import { prisma } from "@eoda/database";
import type { LLMAnalysisPort } from "@/lib/llm";
import type { FileStoragePort } from "@/lib/storage";
import type { BrandedDocxImageInput } from "@/lib/services/markdown-to-docx-service";
import { anonymizeText } from "@/lib/services/anonymization-service";
import { parseAnalysisResult } from "@/lib/services/analysis-view-service";
import { fetchKnowledgeExcerpts, fetchCriterionGuidelines } from "@/lib/services/document-ingestion-service";

// ─────────────────────────────────────────────────────────────────────────────
// GÉNÉRATION D'UN BROUILLON DE DOCUMENT CORRIGÉ PAR L'IA
//
// « Quand l'analyse est faite, ensuite le document est généré par l'IA […]
// brandé EODA, qu'ils pourront réutiliser ensuite » (Damon, 15/09/2026). Document
// ENTIER régénéré (pas seulement les paragraphes correctifs) — le gabarit EODA
// lié au critère, prévu à terme, est explicitement différé.
//
// Même structure que analyzeVersion() dans document-ingestion-service.ts :
// l'enrichissement (base de connaissances, guidelines du cabinet) est
// exactement le même, réutilisé tel quel (D1) — seul l'appel LLM change de
// forme (texte libre, pas un JSON structuré).
//
// Une analyse préalable est un PRÉALABLE, pas une option : sans
// elementsManquants/suggestionsCorrection, l'IA n'aurait rien à corriger et
// recopierait le document tel quel en prétendant l'avoir amélioré.
// ─────────────────────────────────────────────────────────────────────────────

export type GenerateDraftResult = { ok: true; markdown: string } | { error: string };

export async function generateCorrectedDraft(
  documentVersionId: string,
  llm: LLMAnalysisPort,
  modelId?: string | null
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
          establishment: { select: { name: true, tenantId: true } },
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

  const [linkedCriteria] = await Promise.all([
    prisma.documentTypeCriterion.findMany({
      where: { documentTypeId: version.document.documentTypeId },
      include: { criterion: { select: { label: true, id: true, code: true } } },
    }),
  ]);
  const criteriaLabels = linkedCriteria.map((c) => c.criterion.label);
  const criterionIds = linkedCriteria.map((c) => c.criterion.id);
  const linkedCriteriaOption = linkedCriteria.map((c) => ({
    code: c.criterion.code,
    label: c.criterion.label,
  }));
  const tenantId = version.document.establishment.tenantId;

  const [knowledgeExcerpts, criterionGuidelines] = await Promise.all([
    fetchKnowledgeExcerpts(tenantId, version.document.documentType.label, criteriaLabels),
    fetchCriterionGuidelines(tenantId, criterionIds),
  ]);

  try {
    const markdown = await llm.generateCorrectedDocument({
      documentTypeLabel: version.document.documentType.label,
      extractedText: anonymizeText(version.extractedText),
      linkedCriteria: linkedCriteriaOption,
      knowledgeExcerpts,
      criterionGuidelines,
      elementsManquants: analysis.elementsManquants,
      suggestionsCorrection: analysis.suggestionsCorrection,
      ...(modelId && { modelId }),
    });

    await prisma.documentVersion.update({
      where: { id: version.id },
      data: { correctedDraftMarkdown: markdown, correctedDraftGeneratedAt: new Date() },
    });

    return { ok: true, markdown };
  } catch (error) {
    console.error("Génération du brouillon corrigé échouée :", error);
    return { error: "La génération a échoué. Réessayez dans un instant." };
  }
}

// Images d'origine de la version, prêtes à être passées à `generateBrandedDocx`
// (annexe, D6) — chargées depuis `DocumentVersionImage` (D4) puis leur contenu
// récupéré via le port de stockage. Best-effort par image : une image dont le
// téléchargement échoue est simplement omise de l'annexe, elle ne doit jamais
// faire échouer la génération du .docx (même principe que fetchImageDescriptions
// dans document-ingestion-service.ts).
export async function loadCorrectedDraftImages(
  documentVersionId: string,
  storage: FileStoragePort
): Promise<BrandedDocxImageInput[]> {
  const images = await prisma.documentVersionImage.findMany({
    where: { documentVersionId },
    orderBy: { position: "asc" },
    select: { fileStorageKey: true, contentType: true, description: true },
  });

  const results: BrandedDocxImageInput[] = [];
  for (const image of images) {
    try {
      const buffer = await storage.download(image.fileStorageKey);
      results.push({ buffer, contentType: image.contentType, description: image.description });
    } catch (error) {
      console.error("Image d'origine — téléchargement échoué, omise de l'annexe :", error);
    }
  }
  return results;
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
