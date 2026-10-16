import { prisma } from "@eoda/database";
import { getEmbeddingPort } from "@/lib/embeddings";
import {
  indexValidatedExampleVersion,
  isValidatedExampleCandidate,
  removeTemplateChunks,
} from "./knowledge-indexing-service";

// (Ré)indexe l'exemple validé d'un gabarit (N8, context/10 §9) : sa DERNIÈRE version
// FINALE, s'il est rattaché à un type de document. Sinon, retire ses exemples : un
// gabarit détaché ne doit plus servir d'exemple. Appelée après un dépôt FINALE et
// après un changement de rattachement. Best-effort : une panne d'embedding (ou
// l'absence de VOYAGE_API_KEY) prive l'IA d'exemple, jamais le cabinet de son geste.
export async function reindexValidatedExample(tenantId: string, templateDocumentId: string): Promise<void> {
  try {
    const template = await prisma.templateDocument.findFirst({
      where: { id: templateDocumentId, tenantId },
      select: {
        kind: true,
        documentTypeId: true,
        versions: {
          where: { stage: "FINALE" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, stage: true, extractedText: true },
        },
      },
    });
    if (!template) return;
    const latest = template.versions[0];
    const candidate =
      latest !== undefined &&
      isValidatedExampleCandidate({ kind: template.kind, stage: latest.stage, documentTypeId: template.documentTypeId });
    if (!candidate) {
      await removeTemplateChunks(templateDocumentId, "EXEMPLE_VALIDE");
      return;
    }
    const embeddings = getEmbeddingPort();
    if (!embeddings) return;
    await indexValidatedExampleVersion({
      tenantId,
      templateDocumentId,
      templateVersionId: latest.id,
      extractedText: latest.extractedText,
      embeddings,
    });
  } catch (error) {
    console.error("Exemple validé — indexation échouée, gabarit conservé :", error);
  }
}
