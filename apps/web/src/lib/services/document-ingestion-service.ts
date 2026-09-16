import { prisma } from "@eoda/database";
import type { FileStoragePort } from "@/lib/storage";
import type { LLMAnalysisPort } from "@/lib/llm";
import { anonymizeText } from "@/lib/services/anonymization-service";
import { deriveDocumentStatus } from "@/lib/services/document-status-service";
import { buildStorageKey, buildDocumentImageStorageKey } from "@/lib/security/upload-validation-service";
import { getKnowledgeRetrievalPort } from "@/lib/knowledge";
import { MAX_GUIDELINES_INJECTED } from "@/lib/services/criterion-guideline-service";
import { extractMarkdown, type ExtractedImage } from "@/lib/services/text-extraction-service";
import { validateUploadedFile } from "@/lib/security/upload-validation-service";
import { describeImage } from "@/lib/services/image-vision-service";

const KNOWLEDGE_EXCERPTS_LIMIT = 5;

// ─────────────────────────────────────────────────────────────────────────────
// INGESTION D'UNE VERSION DE DOCUMENT — orchestration
//
// Une seule responsabilité : transformer un fichier déjà authentifié et validé en
// une DocumentVersion persistée, stockée et analysée. L'action serveur appelante
// garde les responsabilités qui lui appartiennent (autorisation, lecture du
// FormData, invalidation de cache) et ne connaît plus la séquence interne.
//
// Les deux dépendances externes (stockage, LLM) sont injectées sous forme de
// ports : ce service est testable sans bucket ni appel d'API facturé
// (Dependency Inversion, cf. CLAUDE.md §5).
// ─────────────────────────────────────────────────────────────────────────────

export type IngestionPorts = {
  storage: FileStoragePort;
  llm: LLMAnalysisPort;
};

export type IngestDocumentInput = {
  establishmentId: string;
  documentTypeId: string;
  documentTypeLabel: string;
  content: Buffer;
  contentType: string;
  originalFilename: string;
  uploadedByUserId: string;
  extractedText: string | null;
  // Images extraites par `extractMarkdown` (.docx uniquement à ce jour) — stockées et
  // décrites ci-dessous, best-effort. `[]`/absent pour tout autre format.
  extractedImages?: ExtractedImage[];
  // Modèle demandé pour l'analyse (cf. lib/llm/openrouter-models.ts) — comparaison
  // IA à l'upload. `null`/absent : l'adaptateur actif applique son propre défaut.
  modelId?: string | null;
};

export type IngestDocumentOutput = {
  documentId: string;
  documentVersionId: string;
  analysisSucceeded: boolean;
};

export async function ingestDocumentVersion(
  input: IngestDocumentInput,
  ports: IngestionPorts
): Promise<IngestDocumentOutput> {
  const document = await prisma.document.upsert({
    where: {
      establishmentId_documentTypeId: {
        establishmentId: input.establishmentId,
        documentTypeId: input.documentTypeId,
      },
    },
    update: {},
    create: {
      establishmentId: input.establishmentId,
      documentTypeId: input.documentTypeId,
      status: "MISSING",
    },
    include: {
      versions: { select: { versionNumber: true }, orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });

  const versionNumber = (document.versions[0]?.versionNumber ?? 0) + 1;

  // Clé construite par le service de sécurité — le nom de fichier d'origine n'est
  // jamais concaténé brut (traversée de chemin), cf. upload-validation-service.ts.
  const storageKey = buildStorageKey({
    establishmentId: input.establishmentId,
    documentTypeId: input.documentTypeId,
    versionNumber,
    originalFilename: input.originalFilename,
    timestamp: Date.now(),
  });

  await ports.storage.upload(storageKey, input.content, input.contentType);

  const version = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      versionNumber,
      fileStorageKey: storageKey,
      originalFilename: input.originalFilename,
      uploadedByUserId: input.uploadedByUserId,
      extractedText: input.extractedText,
    },
  });

  // Stockage best-effort : une image qui échoue à se décrire ou à s'uploader ne doit
  // jamais faire échouer le dépôt du document lui-même — c'est un enrichissement.
  const extractedImages = input.extractedImages ?? [];
  if (extractedImages.length > 0) {
    await Promise.all(
      extractedImages.map(async (image) => {
        try {
          const key = buildDocumentImageStorageKey({
            establishmentId: input.establishmentId,
            documentTypeId: input.documentTypeId,
            versionNumber,
            timestamp: Date.now(),
            position: image.position,
          });
          await ports.storage.upload(key, image.buffer, image.contentType);
          const description = await describeImage({
            buffer: image.buffer,
            contentType: image.contentType,
          });
          await prisma.documentVersionImage.create({
            data: {
              documentVersionId: version.id,
              position: image.position,
              fileStorageKey: key,
              contentType: image.contentType,
              description,
            },
          });
        } catch {
          // Best-effort : une image perdue n'empêche pas les autres, ni le dépôt.
        }
      })
    );
  }

  // Un format non analysable (image, tableur, ancien .doc) est conservé comme PIÈCE :
  // il n'y a pas de texte à confronter au référentiel. Le marquer « en analyse »
  // ferait attendre un résultat qui ne viendrait jamais.
  const analysable = input.extractedText !== null && input.extractedText.length > 0;

  await prisma.document.update({
    where: { id: document.id },
    data: {
      currentVersionId: version.id,
      status: analysable ? "ANALYZING" : "UPLOADED",
      // Un nouveau dépôt réinitialise un éventuel surclassement manuel : le statut
      // porte alors sur une version qui n'existe plus.
      statusOverriddenByUser: false,
    },
  });

  // Rien à analyser : on s'arrête au dépôt, sans appel LLM ni statut trompeur.
  if (!analysable) {
    return { documentId: document.id, documentVersionId: version.id, analysisSucceeded: false };
  }

  const analysisSucceeded = await analyzeVersion(
    {
      establishmentId: input.establishmentId,
      documentId: document.id,
      documentVersionId: version.id,
      documentTypeLabel: input.documentTypeLabel,
      documentTypeId: input.documentTypeId,
      extractedText: input.extractedText,
      ...(input.modelId !== undefined && { modelId: input.modelId }),
    },
    ports.llm
  );

  return { documentId: document.id, documentVersionId: version.id, analysisSucceeded };
}

// ── Ré-analyse à la demande — bouton « Analyser » côté cabinet ───────────────
//
// « Il faut un bouton analyser » (Damon, 15/09/2026), motivé par un vrai bug :
// une régression de dépendance (@xmldom/xmldom résolu trop récent par un override
// de sécurité trop large) faisait échouer SILENCIEUSEMENT l'extraction Word pour
// tout document déposé — texte jamais stocké, analyse jamais tentée. Corrigé,
// mais les documents déjà déposés pendant que le bug était actif restent sans
// texte ni analyse ; ce bouton permet de les rattraper SANS nouveau dépôt, et sert
// aussi de ré-analyse générale (guidelines ajoutées depuis, modèle différent…).
//
// Ré-extrait le texte si absent (fichier déjà stocké, re-téléchargé le temps de
// l'appel — jamais conservé) avant de relancer l'analyse. Si l'extraction échoue
// encore (format non analysable), retourne une erreur explicite plutôt que de
// tenter une analyse sur un texte vide.
export async function reanalyzeDocumentVersion(
  documentVersionId: string,
  ports: IngestionPorts,
  modelId?: string | null
): Promise<{ ok: true } | { error: string }> {
  const version = await prisma.documentVersion.findUnique({
    where: { id: documentVersionId },
    select: {
      id: true,
      fileStorageKey: true,
      extractedText: true,
      document: {
        select: {
          id: true,
          establishmentId: true,
          documentTypeId: true,
          documentType: { select: { label: true } },
        },
      },
    },
  });
  if (!version || !version.document.documentTypeId || !version.document.documentType) {
    return { error: "Document introuvable." };
  }

  let extractedText = version.extractedText;
  if (!extractedText) {
    try {
      const url = await ports.storage.getSignedDownloadUrl(version.fileStorageKey, {
        disposition: "inline",
        filename: "reanalyse",
      });
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      // Type réel déterminé par la signature binaire, jamais par l'extension du nom
      // de fichier d'origine — même règle qu'au dépôt initial.
      const validation = validateUploadedFile(buffer, buffer.length);
      if (validation.ok) {
        const extraction = await extractMarkdown(buffer, validation.contentType);
        extractedText = extraction ? extraction.markdown : null;
        if (extractedText) {
          await prisma.documentVersion.update({ where: { id: version.id }, data: { extractedText } });
        }
      }
    } catch (error) {
      console.error("Ré-analyse — nouvelle extraction échouée :", error);
    }
  }

  if (!extractedText) {
    return {
      error:
        "Aucun texte n'a pu être extrait de ce document — l'analyse automatique n'est pas possible pour ce format (image, ou extraction échouée).",
    };
  }

  await prisma.document.update({ where: { id: version.document.id }, data: { status: "ANALYZING" } });

  const succeeded = await analyzeVersion(
    {
      establishmentId: version.document.establishmentId,
      documentId: version.document.id,
      documentVersionId: version.id,
      documentTypeId: version.document.documentTypeId,
      documentTypeLabel: version.document.documentType.label,
      extractedText,
      ...(modelId && { modelId }),
    },
    ports.llm
  );

  return succeeded ? { ok: true } : { error: "L'analyse a échoué. Réessayez dans un instant." };
}

// Analyse IA synchrone (un seul appel LLM par document, cf. roadmap Jalon 3) —
// jamais bloquante : en cas d'échec, le document reste UPLOADED plutôt que de
// faire échouer tout le dépôt.
async function analyzeVersion(
  params: {
    establishmentId: string;
    documentId: string;
    documentVersionId: string;
    documentTypeId: string;
    documentTypeLabel: string;
    extractedText: string | null;
    modelId?: string | null;
  },
  llm: LLMAnalysisPort
): Promise<boolean> {
  try {
    const [linkedCriteria, establishment] = await Promise.all([
      prisma.documentTypeCriterion.findMany({
        where: { documentTypeId: params.documentTypeId },
        include: { criterion: { select: { id: true, code: true, label: true } } },
      }),
      prisma.establishment.findUnique({
        where: { id: params.establishmentId },
        select: { tenantId: true },
      }),
    ]);
    const criteriaLabels = linkedCriteria.map((c) => c.criterion.label);
    const criterionIds = linkedCriteria.map((c) => c.criterion.id);
    const linkedCriteriaOption = linkedCriteria.map((c) => ({
      code: c.criterion.code,
      label: c.criterion.label,
    }));
    const tenantId = establishment?.tenantId ?? null;

    const [knowledgeExcerpts, criterionGuidelines] = await Promise.all([
      fetchKnowledgeExcerpts(tenantId, params.documentTypeLabel, criteriaLabels),
      fetchCriterionGuidelines(tenantId, criterionIds),
    ]);

    const analysis = await llm.analyze({
      documentTypeLabel: params.documentTypeLabel,
      // Anonymisation best-effort avant tout envoi vers un service externe
      // (contrainte RGPD, cf. anonymization-service.ts).
      extractedText: anonymizeText(params.extractedText ?? ""),
      linkedCriteria: linkedCriteriaOption,
      knowledgeExcerpts,
      criterionGuidelines,
      ...(params.modelId && { modelId: params.modelId }),
    });

    await prisma.documentVersion.update({
      where: { id: params.documentVersionId },
      data: { analysisResultJson: analysis as unknown as object },
    });
    await prisma.document.update({
      where: { id: params.documentId },
      data: { status: deriveDocumentStatus(analysis) },
    });

    return true;
  } catch (error) {
    console.error("Analyse documentaire IA échouée — document laissé en UPLOADED :", error);
    await prisma.document.update({
      where: { id: params.documentId },
      data: { status: "UPLOADED" },
    });
    return false;
  }
}

// Isolée dans sa propre gestion d'erreur : une panne de la base de connaissances
// (fournisseur d'embeddings indisponible, par exemple) ne doit jamais faire
// échouer l'analyse elle-même — seulement la priver d'enrichissement, comme si
// VOYAGE_API_KEY n'était simplement pas configurée.
//
// Exportée : document-generation-service.ts (génération de brouillon corrigé)
// a besoin exactement du même enrichissement que l'analyse — même base de
// connaissances, mêmes guidelines du cabinet. Dupliquer aurait fait diverger les
// deux le jour où l'une des deux évoluerait (D1).
export async function fetchKnowledgeExcerpts(
  tenantId: string | null,
  documentTypeLabel: string,
  criteriaLabels: string[]
): Promise<string[]> {
  if (!tenantId) return [];
  const knowledge = getKnowledgeRetrievalPort();
  if (!knowledge) return [];

  try {
    const query = [documentTypeLabel, ...criteriaLabels].join(" ; ");
    const excerpts = await knowledge.search(tenantId, query, KNOWLEDGE_EXCERPTS_LIMIT);
    return excerpts.map((excerpt) => excerpt.content);
  } catch (error) {
    console.error("Base de connaissances IA — recherche échouée, analyse sans enrichissement :", error);
    return [];
  }
}

// Même principe de repli : une base de connaissances qui apprend des guidelines du
// cabinet est un enrichissement, jamais une condition — une panne ici ne doit
// jamais faire échouer l'analyse elle-même (cf. fetchKnowledgeExcerpts ci-dessus).
//
// `criterionIds` vient de document_type_criteria — VIDE aujourd'hui pour tout type
// de document (cf. specs/04-liaison-document-type-critere.md) : cette fonction
// rend alors `[]` sans même interroger la base, exactement comme si aucune
// guideline n'existait. Elle commencera à en rappeler dès que cette table sera
// peuplée, sans qu'aucune ligne de ce fichier n'ait besoin de changer.
export async function fetchCriterionGuidelines(
  tenantId: string | null,
  criterionIds: string[]
): Promise<string[]> {
  if (!tenantId || criterionIds.length === 0) return [];

  try {
    const guidelines = await prisma.criterionGuideline.findMany({
      where: { tenantId, criterionId: { in: criterionIds } },
      orderBy: { createdAt: "desc" },
      take: MAX_GUIDELINES_INJECTED,
      select: { note: true },
    });
    return guidelines.map((g) => g.note);
  } catch (error) {
    console.error("Guidelines du cabinet — lecture échouée, analyse sans elles :", error);
    return [];
  }
}
