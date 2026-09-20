import { prisma } from "@eoda/database";
import type { LLMAnalysisPort } from "@/lib/llm";
import {
  buildTemplateCriteriaCatalog,
  validateSuggestedCriteria,
  type ValidatedSuggestion,
} from "@/lib/services/criterion-suggestion-service";

// ─────────────────────────────────────────────────────────────────────────────
// DÉTECTION IA DE CRITÈRES SUR UN GABARIT — pendant de
// document-ingestion-service.ts::analyzeVersion, mais pour la BIBLIOTHÈQUE DE
// MODÈLES : « fait tout ce qu'il y a dans l'artifact » (Damon, 20/09/2026), la
// pipeline dépôt → extraction → détection IA → cohérence → revue humaine →
// publié manquait cette brique côté gabarits (elle n'existait que pour les
// documents client).
//
// Différences volontaires avec analyzeVersion :
//  - pas d'établissement, pas de profil SAD : buildTemplateCriteriaCatalog
//    (pas buildAdditionalCriteriaCatalog) ;
//  - pas de statut de conformité à dériver — un gabarit n'a pas de
//    DocumentStatus. Seul `criteresSupplementaires` de la réponse est utilisé ;
//    le reste (elementsPresents, elementsManquants…) est ignoré sans être
//    persisté nulle part, il ne veut rien dire pour un gabarit.
//  - best-effort de bout en bout : une détection ratée ne doit jamais faire
//    échouer le dépôt du fichier lui-même (cf. storeVersion, template-library.ts).
// ─────────────────────────────────────────────────────────────────────────────

export async function detectTemplateCriteria(
  params: { templateId: string; templateVersionId: string; extractedText: string },
  llm: LLMAnalysisPort
): Promise<void> {
  try {
    const [template, allCriteria] = await Promise.all([
      prisma.templateDocument.findUnique({
        where: { id: params.templateId },
        select: {
          title: true,
          criteria: { select: { criterion: { select: { id: true, code: true, label: true } } } },
        },
      }),
      prisma.criterion.findMany({ select: { id: true, code: true, label: true, applicableTo: true } }),
    ]);
    if (!template) return;

    const linkedCriterionIds = new Set(template.criteria.map((c) => c.criterion.id));
    const additionalCriteriaCatalog = buildTemplateCriteriaCatalog(allCriteria, linkedCriterionIds);
    if (additionalCriteriaCatalog.length === 0) return;

    const analysis = await llm.analyze({
      documentTypeLabel: template.title,
      extractedText: params.extractedText,
      linkedCriteria: template.criteria.map((c) => ({
        code: c.criterion.code,
        label: c.criterion.label,
      })),
      additionalCriteriaCatalog,
    });

    await persistTemplateCriterionSuggestions(
      params.templateId,
      params.templateVersionId,
      validateSuggestedCriteria(analysis.criteresSupplementaires, allCriteria)
    );
  } catch (error) {
    console.error("Détection IA de critères (gabarit) échouée — dépôt conservé sans elle :", error);
  }
}

// Même doctrine que persistCriterionSuggestions (document-ingestion-service.ts) :
// ne touche JAMAIS une suggestion déjà CONFIRMED ou REJECTED — c'est une décision
// humaine, un fait stocké, jamais recalculé.
async function persistTemplateCriterionSuggestions(
  templateDocumentId: string,
  templateVersionId: string,
  validated: ValidatedSuggestion[]
): Promise<void> {
  if (validated.length === 0) return;

  const existing = await prisma.templateCriterionSuggestion.findMany({
    where: { templateDocumentId, criterionId: { in: validated.map((v) => v.criterionId) } },
    select: { criterionId: true, status: true },
  });
  const decided = new Set(existing.filter((s) => s.status !== "PENDING").map((s) => s.criterionId));

  const toWrite = validated.filter((v) => !decided.has(v.criterionId));
  if (toWrite.length === 0) return;

  await prisma.$transaction(
    toWrite.map((v) =>
      prisma.templateCriterionSuggestion.upsert({
        where: { templateDocumentId_criterionId: { templateDocumentId, criterionId: v.criterionId } },
        create: {
          templateDocumentId,
          criterionId: v.criterionId,
          templateVersionId,
          justification: v.justification,
        },
        update: { templateVersionId, justification: v.justification },
      })
    )
  );
}
