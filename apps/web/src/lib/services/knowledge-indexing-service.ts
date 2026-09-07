import { randomUUID } from "node:crypto";
import { prisma } from "@eoda/database";
import type { EmbeddingPort } from "@/lib/embeddings";
import { chunkText } from "./knowledge-chunking-service";

// ─────────────────────────────────────────────────────────────────────────────
// INDEXATION D'UN DOCUMENT DE RÉFÉRENCE — appelée après le dépôt d'une nouvelle
// version d'un document de RÉFÉRENCE de la bibliothèque de modèles (jamais pour un
// GABARIT, jamais pour un document CLIENT).
//
// Ne fait jamais échouer le dépôt du fichier : appelée en best-effort par l'action
// serveur, comme l'envoi d'e-mail (cf. lib/email/notifications.ts). Un manuel HAS
// mal indexé prive l'analyse d'un enrichissement, il ne doit jamais priver le
// cabinet de son dépôt de fichier.
// ─────────────────────────────────────────────────────────────────────────────

export async function indexReferenceDocumentVersion(params: {
  tenantId: string;
  templateDocumentId: string;
  templateVersionId: string;
  extractedText: string | null;
  embeddings: EmbeddingPort;
}): Promise<{ chunksIndexed: number }> {
  const text = params.extractedText?.trim();
  if (!text) return { chunksIndexed: 0 };

  const chunks = chunkText(text);
  if (chunks.length === 0) return { chunksIndexed: 0 };

  const vectors = await params.embeddings.embed(chunks, "document");

  // Une nouvelle version REMPLACE la précédente dans la base de connaissances : sans
  // ça, un texte réglementaire périmé resterait retrouvable à côté de sa mise à
  // jour, et l'analyse citerait potentiellement les deux comme si elles faisaient
  // également autorité.
  await prisma.$executeRaw`
    DELETE FROM knowledge_chunks
    WHERE template_version_id IN (
      SELECT tv.id FROM template_versions tv
      WHERE tv.template_document_id = ${params.templateDocumentId}
    )
  `;

  for (let index = 0; index < chunks.length; index += 1) {
    const vector = vectors[index];
    if (!vector) continue;
    const vectorLiteral = `[${vector.join(",")}]`;

    await prisma.$executeRaw`
      INSERT INTO knowledge_chunks (id, tenant_id, template_version_id, chunk_index, content, embedding)
      VALUES (
        ${randomUUID()},
        ${params.tenantId},
        ${params.templateVersionId},
        ${index},
        ${chunks[index]},
        ${vectorLiteral}::vector
      )
    `;
  }

  return { chunksIndexed: chunks.length };
}
