import { prisma } from "@eoda/database";
import type { FileStoragePort } from "@/lib/storage";
import type { LLMAnalysisPort } from "@/lib/llm";
import { anonymizeText } from "@/lib/services/anonymization-service";
import { deriveDocumentStatus } from "@/lib/services/document-status-service";
import { buildStorageKey, buildDocumentImageStorageKey } from "@/lib/security/upload-validation-service";
import { getKnowledgeRetrievalPort } from "@/lib/knowledge";
import { MAX_GUIDELINES_INJECTED, guidelineReach } from "@/lib/services/criterion-guideline-service";
import { directiveForAnalysis } from "@/lib/services/analysis-directive-service";
import { extractMarkdown, type ExtractedImage } from "@/lib/services/text-extraction-service";
import { validateUploadOnServer } from "@/lib/security/office-archive-guard";
import { describeImage } from "@/lib/services/image-vision-service";
import { readValidatedExamples } from "@/lib/db/read-validated-examples";
import {
  buildAdditionalCriteriaCatalog,
  validateSuggestedCriteria,
  type ValidatedSuggestion,
} from "@/lib/services/criterion-suggestion-service";

const KNOWLEDGE_EXCERPTS_LIMIT = 5;

// Plafonds décidés par Damon (revue finale, 16/09/2026) : sans borne, un dépôt
// unique pouvait déclencher un fan-out non borné d'appels payants à OpenRouter
// en parallèle (Promise.all ci-dessous) — un seul .docx malicieux ou massif
// suffisait à multiplier la facture et la charge sur une seule requête HTTP.
// Best-effort : au-delà des plafonds, l'image est ignorée silencieusement,
// jamais une erreur qui bloquerait le dépôt du document lui-même.
export const MAX_IMAGES_DESCRIBED = 10;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

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
  // Qui dépose cette version — connu de l'appelant (la session en cours), jamais
  // recalculé ici. Transmis jusqu'au prompt d'analyse (cf. llm-analysis-port.ts) :
  // l'adjoint IA qualité ne doit pas juger un dépôt client comme s'il était une
  // version déjà retravaillée par le cabinet.
  documentOrigin: "CLIENT" | "CABINET";
  extractedText: string | null;
  // Images extraites par `extractMarkdown` (.docx uniquement à ce jour) — stockées et
  // décrites ci-dessous, best-effort. `[]`/absent pour tout autre format.
  extractedImages?: ExtractedImage[];
  // Modèle demandé pour l'analyse (cf. lib/llm/openrouter-models.ts) — comparaison
  // IA à l'upload. `null`/absent : l'adaptateur actif applique son propre défaut.
  modelId?: string | null;
  // Version N+1 issue d'une mise en conformité (N8) : la version d'origine, conservée,
  // à laquelle elle est liée. Absent pour un dépôt ordinaire.
  regeneratedFromVersionId?: string;
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
      ...(input.regeneratedFromVersionId && { regeneratedFromVersionId: input.regeneratedFromVersionId }),
    },
  });

  // Stockage best-effort : une image qui échoue à se décrire ou à s'uploader ne doit
  // jamais faire échouer le dépôt du document lui-même — c'est un enrichissement.
  //
  // Deux plafonds appliqués AVANT tout appel réseau (D4, décision Damon du
  // 16/09/2026) : au plus MAX_IMAGES_DESCRIBED images par dépôt, par ordre de
  // position croissant (déjà l'ordre d'extraction) — les suivantes sont ignorées
  // silencieusement — et aucune image de plus de MAX_IMAGE_SIZE_BYTES n'est ni
  // uploadée, ni envoyée au modèle de vision, ni enregistrée.
  const extractedImages = (input.extractedImages ?? [])
    .filter((image) => image.buffer.length <= MAX_IMAGE_SIZE_BYTES)
    .slice(0, MAX_IMAGES_DESCRIBED);
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
          const rawDescription = await describeImage({
            buffer: image.buffer,
            contentType: image.contentType,
          });
          // Anonymisation avant stockage — même règle que tout texte envoyé vers un
          // service externe ou conservé en vue d'un prompt (cf. analyzeVersion plus
          // bas) : la description part elle aussi vers le prompt d'analyse (D5), et
          // un modèle de vision peut transcrire un nom, une adresse ou un numéro
          // lisible sur l'image. `null` (échec best-effort du modèle) n'est jamais
          // anonymisé — anonymizeText attend une chaîne.
          const description = rawDescription !== null ? anonymizeText(rawDescription) : null;
          await prisma.documentVersionImage.create({
            data: {
              documentVersionId: version.id,
              position: image.position,
              fileStorageKey: key,
              contentType: image.contentType,
              description,
            },
          });
        } catch (error) {
          // Best-effort : une image perdue n'empêche pas les autres, ni le dépôt.
          console.error("Image extraite — stockage échoué, omise du document :", error);
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
      documentOrigin: input.documentOrigin,
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
      // Auteur de CETTE version, pas de la personne qui clique « Réanalyser » —
      // c'est le dépôt d'origine qui détermine l'origine du contenu.
      uploadedBy: { select: { role: true } },
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
      const validation = validateUploadOnServer(buffer, buffer.length);
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
      documentOrigin: version.uploadedBy.role === "CLIENT_USER" ? "CLIENT" : "CABINET",
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
    // Optionnel ici (contrairement à IngestDocumentInput) : une ré-analyse porte sur
    // une version DÉJÀ déposée, dont l'auteur d'origine se relit en base plutôt que
    // d'être supposé — cf. reanalyzeDocumentVersion, seul appelant qui ne le connaît
    // pas d'avance.
    documentOrigin?: "CLIENT" | "CABINET";
    modelId?: string | null;
  },
  llm: LLMAnalysisPort
): Promise<boolean> {
  try {
    const [linkedCriteria, establishment, allCriteria, documentDirective] = await Promise.all([
      prisma.documentTypeCriterion.findMany({
        where: { documentTypeId: params.documentTypeId },
        include: { criterion: { select: { id: true, code: true, label: true } } },
      }),
      prisma.establishment.findUnique({
        where: { id: params.establishmentId },
        select: { tenantId: true, type: true },
      }),
      // Catalogue fermé des critères que l'IA peut proposer EN PLUS de
      // `linkedCriteria` (cf. criterion-suggestion-service.ts). Chargé à chaque
      // analyse plutôt que mis en cache : ~140 lignes, un montant négligeable à
      // côté du texte du document lui-même, et le référentiel évolue (CLAUDE.md §6).
      prisma.criterion.findMany({ select: { id: true, code: true, label: true, applicableTo: true } }),
      // Consigne de la consultante sur CE document (20/10/2026), lue ICI et non reçue
      // d'un appelant : le dépôt initial, la ré-analyse et la ré-analyse après
      // changement de type doivent tous voir la consigne du moment, jamais celle qui
      // avait été recopiée à l'endroit d'où l'on vient.
      // Le « Commentaire sur ce document » et son interrupteur (21/10/2026) sont lus
      // dans la MÊME requête que la consigne : une ligne, une lecture.
      prisma.document.findUnique({
        where: { id: params.documentId },
        select: { analysisDirective: true, directiveInAnalysis: true, missingJustification: true, commentUsedByAi: true },
      }),
    ]);
    const criteriaLabels = linkedCriteria.map((c) => c.criterion.label);
    const criterionIds = linkedCriteria.map((c) => c.criterion.id);
    const linkedCriteriaOption = linkedCriteria.map((c) => ({
      code: c.criterion.code,
      label: c.criterion.label,
    }));
    const tenantId = establishment?.tenantId ?? null;
    // Sans profil SAD connu (établissement introuvable — ne devrait pas arriver
    // pour une analyse en cours), aucune suggestion supplémentaire n'est demandée
    // plutôt que de proposer un catalogue non filtré par profil.
    const additionalCriteriaCatalog = establishment
      ? buildAdditionalCriteriaCatalog(allCriteria, establishment.type, new Set(criterionIds))
      : [];

    const [knowledgeExcerpts, criterionGuidelines, imageDescriptions, validatedExamples] = await Promise.all([
      fetchKnowledgeExcerpts(tenantId, params.documentTypeLabel, criteriaLabels),
      fetchCriterionGuidelines(tenantId, criterionIds, params.documentId),
      fetchImageDescriptions(params.documentVersionId),
      // Exemples validés du même type, du même tenant (N8, context/10 §9).
      readValidatedExamples(tenantId, params.documentTypeId),
    ]);
    const commentText = documentDirective?.missingJustification?.trim();
    const documentComment = documentDirective?.commentUsedByAi && commentText ? commentText : undefined;

    // Consigne réellement transmise au modèle — vide si le bouton « prendre en
    // compte » est éteint, ou si la consigne est blanche. C'est ELLE qui est
    // recopiée sur la version (analysisDirectiveUsed) : une analyse relue six mois
    // plus tard doit pouvoir dire avec quelles consignes elle a été produite, sans
    // dépendre de l'état actuel du document.
    const directive = directiveForAnalysis({
      analysisDirective: documentDirective?.analysisDirective ?? null,
      directiveInAnalysis: documentDirective?.directiveInAnalysis === true,
    });

    const analysis = await llm.analyze({
      documentTypeLabel: params.documentTypeLabel,
      // Anonymisation best-effort avant tout envoi vers un service externe
      // (contrainte RGPD, cf. anonymization-service.ts).
      extractedText: anonymizeText(params.extractedText ?? ""),
      linkedCriteria: linkedCriteriaOption,
      knowledgeExcerpts,
      criterionGuidelines,
      ...(imageDescriptions.length > 0 && { imageDescriptions }),
      ...(params.documentOrigin && { documentOrigin: params.documentOrigin }),
      ...(params.modelId && { modelId: params.modelId }),
      ...(additionalCriteriaCatalog.length > 0 && { additionalCriteriaCatalog }),
      ...(validatedExamples.length > 0 && { validatedExamples }),
      // Même anonymisation best-effort que le texte : un commentaire peut citer quelqu'un.
      ...(documentComment && { documentComment: anonymizeText(documentComment) }),
      ...(directive !== undefined && { analysisDirective: directive }),
    });

    // Best-effort, comme les autres enrichissements de cette fonction : une
    // suggestion perdue ne doit jamais faire échouer l'analyse elle-même.
    await persistCriterionSuggestions(
      params.documentId,
      params.documentVersionId,
      validateSuggestedCriteria(analysis.criteresSupplementaires, allCriteria)
    );

    await prisma.documentVersion.update({
      where: { id: params.documentVersionId },
      data: {
        analysisResultJson: analysis as unknown as object,
        // `null` = analyse produite SANS consigne (ou consigne éteinte), pas
        // « consigne vide » : le rendu sait ainsi distinguer les deux cas.
        analysisDirectiveUsed: directive ?? null,
      },
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

// Descriptions des images déjà stockées pour cette version (D4,
// DocumentVersionImage.description) — dans l'ordre d'apparition, seules celles
// dont la description a réussi (jamais `null`, cf. image-vision-service.ts).
// `position` est portée jusqu'au prompt (analysis-prompt.ts) : c'est le même
// numéro que le repère `[Image N]` laissé dans le texte extrait par
// text-extraction-service.ts — jamais l'index dans ce tableau, qui décale dès
// qu'une seule image échoue sa description ou son upload (cf. revue de branche).
// Même principe de repli que fetchKnowledgeExcerpts/fetchCriterionGuidelines :
// une panne de lecture ne doit jamais faire échouer l'analyse elle-même, elle
// la prive simplement de cet enrichissement.
async function fetchImageDescriptions(
  documentVersionId: string
): Promise<{ position: number; description: string }[]> {
  try {
    const images = await prisma.documentVersionImage.findMany({
      where: { documentVersionId, description: { not: null } },
      orderBy: { position: "asc" },
      select: { position: true, description: true },
    });
    return images
      .filter((image): image is { position: number; description: string } => image.description !== null)
      .map((image) => ({ position: image.position, description: image.description }));
  } catch (error) {
    console.error("Descriptions d'image — lecture échouée, analyse sans elles :", error);
    return [];
  }
}

// Persiste les critères supplémentaires détectés par l'IA (déjà revalidés contre
// le catalogue réel par validateSuggestedCriteria — jamais une suggestion brute du
// modèle) comme DocumentCriterionSuggestion, statut PENDING.
//
// NE TOUCHE JAMAIS une suggestion déjà CONFIRMED ou REJECTED : c'est une décision
// humaine, un fait stocké, jamais recalculé (même doctrine que Document.validatedAt).
// Une suggestion encore PENDING voit sa justification et sa version d'origine
// rafraîchies — c'est la même question posée à nouveau, pas une nouvelle question.
//
// Best-effort, comme fetchImageDescriptions ci-dessus : une suggestion perdue ne
// doit jamais faire échouer l'analyse elle-même.
async function persistCriterionSuggestions(
  documentId: string,
  documentVersionId: string,
  validated: ValidatedSuggestion[]
): Promise<void> {
  if (validated.length === 0) return;
  try {
    const existing = await prisma.documentCriterionSuggestion.findMany({
      where: { documentId, criterionId: { in: validated.map((v) => v.criterionId) } },
      select: { criterionId: true, status: true },
    });
    const decided = new Set(
      existing.filter((s) => s.status !== "PENDING").map((s) => s.criterionId)
    );

    const toWrite = validated.filter((v) => !decided.has(v.criterionId));
    if (toWrite.length === 0) return;

    await prisma.$transaction(
      toWrite.map((v) =>
        prisma.documentCriterionSuggestion.upsert({
          where: { documentId_criterionId: { documentId, criterionId: v.criterionId } },
          create: {
            documentId,
            criterionId: v.criterionId,
            documentVersionId,
            justification: v.justification,
          },
          update: { documentVersionId, justification: v.justification },
        })
      )
    );
  } catch (error) {
    console.error("Suggestions de critères — écriture échouée, analyse conservée sans elles :", error);
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

  try {
    // La résolution du port est DANS le `try`, et ce n'est pas cosmétique : elle finit
    // dans `getEnv()`, qui LÈVE quand la configuration est incomplète. Hors du `try`,
    // une variable d'environnement absente faisait échouer l'analyse entière — alors
    // que cette fonction est un enrichissement, jamais une condition. Constaté par le
    // test de la matrice, qui n'a pas d'environnement chargé. En production ce cas ne
    // se présente pas : la configuration est validée au démarrage (instrumentation.ts).
    const knowledge = getKnowledgeRetrievalPort();
    if (!knowledge) return [];

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
//
// « Commentaire sur ce document » (Document.missingJustification) — remis à l'IA
// seulement s'il est « pris en compte » (Document.commentUsedByAi, oui par défaut).
// Même repli que les guidelines : une panne de lecture n'empêche jamais l'analyse.
export async function readDocumentComment(documentId: string): Promise<string | undefined> {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: documentId },
      select: { missingJustification: true, commentUsedByAi: true },
    });
    const text = doc?.missingJustification?.trim();
    return doc?.commentUsedByAi && text ? text : undefined;
  } catch (error) {
    console.error("Commentaire du document — lecture échouée, analyse sans lui :", error);
    return undefined;
  }
}

//
// Call du 18/10/2026 — « les commentaires doivent être pris en compte dans
// l'analyse » : la matrice seule ne suffisait pas (vide pour la plupart des types),
// un commentaire posé sur un critère que l'IA avait reconnu dans CE document n'était
// jamais relu. Les critères du document lui-même (suggestions en attente ou
// confirmées, jamais rejetées) s'ajoutent donc à ceux de la matrice quand
// `documentId` est fourni. Seules les guidelines « prises en compte par l'IA »
// (`aiEnabled`) entrent dans le prompt.
export async function fetchCriterionGuidelines(
  tenantId: string | null,
  criterionIds: string[],
  documentId?: string | null
): Promise<string[]> {
  if (!tenantId) return [];

  try {
    const fromDocument = documentId
      ? await prisma.documentCriterionSuggestion.findMany({
          where: { documentId, status: { not: "REJECTED" } },
          select: { criterionId: true },
        })
      : [];
    const ids = guidelineReach(criterionIds, fromDocument.map((s) => s.criterionId));
    if (ids.length === 0) return [];

    const guidelines = await prisma.criterionGuideline.findMany({
      where: { tenantId, aiEnabled: true, criterionId: { in: ids } },
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
