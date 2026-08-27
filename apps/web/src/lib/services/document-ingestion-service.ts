import { prisma } from "@eoda/database";
import type { FileStoragePort } from "@/lib/storage";
import type { LLMAnalysisPort } from "@/lib/llm";
import { anonymizeText } from "@/lib/services/anonymization-service";
import { deriveDocumentStatus } from "@/lib/services/document-status-service";
import { buildStorageKey } from "@/lib/security/upload-validation-service";

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
      documentId: document.id,
      documentVersionId: version.id,
      documentTypeLabel: input.documentTypeLabel,
      documentTypeId: input.documentTypeId,
      extractedText: input.extractedText,
    },
    ports.llm
  );

  return { documentId: document.id, documentVersionId: version.id, analysisSucceeded };
}

// Analyse IA synchrone (un seul appel LLM par document, cf. roadmap Jalon 3) —
// jamais bloquante : en cas d'échec, le document reste UPLOADED plutôt que de
// faire échouer tout le dépôt.
async function analyzeVersion(
  params: {
    documentId: string;
    documentVersionId: string;
    documentTypeId: string;
    documentTypeLabel: string;
    extractedText: string | null;
  },
  llm: LLMAnalysisPort
): Promise<boolean> {
  try {
    const linkedCriteria = await prisma.documentTypeCriterion.findMany({
      where: { documentTypeId: params.documentTypeId },
      include: { criterion: { select: { label: true } } },
    });

    const analysis = await llm.analyze({
      documentTypeLabel: params.documentTypeLabel,
      // Anonymisation best-effort avant tout envoi vers un service externe
      // (contrainte RGPD, cf. anonymization-service.ts).
      extractedText: anonymizeText(params.extractedText ?? ""),
      linkedCriteriaLabels: linkedCriteria.map((c) => c.criterion.label),
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
