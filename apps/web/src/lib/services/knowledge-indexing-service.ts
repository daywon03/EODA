import { randomUUID } from "node:crypto";
import { prisma, type KnowledgeNature } from "@eoda/database";
import type { EmbeddingPort } from "@/lib/embeddings";
import { chunkText } from "./knowledge-chunking-service";

// ─────────────────────────────────────────────────────────────────────────────
// INDEXATION DE LA BASE DE CONNAISSANCES — deux natures qui ne se mélangent jamais :
//
//   - RÉFÉRENCE : une version d'un document de RÉFÉRENCE de la bibliothèque (manuel
//     HAS, textes réglementaires). Retrouvée par recherche vectorielle pour l'analyse.
//   - EXEMPLE VALIDÉ (N8, context/10 §9) : la version FINALE d'un GABARIT rattaché à
//     un type de document. Injectée comme exemple à la génération et à l'analyse de
//     CE type, jamais renvoyée par la recherche du référentiel.
// Jamais un document CLIENT (`DocumentVersion`) : on ne va jamais chercher un exemple
// dans les documents d'un autre établissement.
//
// Ne fait jamais échouer le dépôt du fichier : appelée en best-effort par l'action
// serveur. Un document mal indexé prive l'IA d'un enrichissement, pas le cabinet de
// son dépôt.
// ─────────────────────────────────────────────────────────────────────────────

type IndexParams = {
  tenantId: string;
  templateDocumentId: string;
  templateVersionId: string;
  extractedText: string | null;
  embeddings: EmbeddingPort;
};

async function indexTemplateVersion(params: IndexParams, nature: KnowledgeNature): Promise<{ chunksIndexed: number }> {
  const text = params.extractedText?.trim();
  if (!text) return { chunksIndexed: 0 };

  const chunks = chunkText(text);
  if (chunks.length === 0) return { chunksIndexed: 0 };

  const vectors = await params.embeddings.embed(chunks, "document");

  // Une nouvelle version REMPLACE la précédente de la même nature : un texte périmé
  // (ou un ancien exemple) ne doit pas rester retrouvable à côté de sa mise à jour.
  await removeTemplateChunks(params.templateDocumentId, nature);

  for (let index = 0; index < chunks.length; index += 1) {
    const vector = vectors[index];
    if (!vector) continue;
    const vectorLiteral = `[${vector.join(",")}]`;

    await prisma.$executeRaw`
      INSERT INTO knowledge_chunks (id, tenant_id, template_version_id, chunk_index, nature, content, embedding)
      VALUES (
        ${randomUUID()},
        ${params.tenantId},
        ${params.templateVersionId},
        ${index},
        ${nature}::"KnowledgeNature",
        ${chunks[index]},
        ${vectorLiteral}::vector
      )
    `;
  }

  return { chunksIndexed: chunks.length };
}

export async function removeTemplateChunks(templateDocumentId: string, nature: KnowledgeNature): Promise<void> {
  await prisma.$executeRaw`
    DELETE FROM knowledge_chunks
    WHERE nature = ${nature}::"KnowledgeNature"
      AND template_version_id IN (
        SELECT tv.id FROM template_versions tv
        WHERE tv.template_document_id = ${templateDocumentId}
      )
  `;
}

export async function indexReferenceDocumentVersion(params: IndexParams): Promise<{ chunksIndexed: number }> {
  return indexTemplateVersion(params, "REFERENCE");
}

// Exemple validé : seulement une version FINALE d'un GABARIT rattaché à un type de
// document — l'appelant le vérifie (`isValidatedExampleCandidate`), ce service indexe.
export async function indexValidatedExampleVersion(params: IndexParams): Promise<{ chunksIndexed: number }> {
  return indexTemplateVersion(params, "EXEMPLE_VALIDE");
}

export function isValidatedExampleCandidate(facts: {
  kind: "GABARIT" | "REFERENCE";
  stage: "VIERGE" | "FINALE" | null;
  documentTypeId: string | null;
}): boolean {
  return facts.kind === "GABARIT" && facts.stage === "FINALE" && facts.documentTypeId !== null;
}
