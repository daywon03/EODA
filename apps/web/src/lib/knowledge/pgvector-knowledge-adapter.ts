import { prisma } from "@eoda/database";
import type { EmbeddingPort } from "@/lib/embeddings";
import type { KnowledgeRetrievalPort, KnowledgeExcerpt } from "./knowledge-retrieval-port";

type Row = { content: string; source_title: string };

export class PgVectorKnowledgeAdapter implements KnowledgeRetrievalPort {
  constructor(private readonly embeddings: EmbeddingPort) {}

  async search(tenantId: string, queryText: string, limit: number): Promise<KnowledgeExcerpt[]> {
    const trimmed = queryText.trim();
    if (trimmed.length === 0) return [];

    const [queryVector] = await this.embeddings.embed([trimmed], "query");
    if (!queryVector) return [];

    // Format texte pgvector : "[0.1,0.2,...]". Interpolé comme paramètre lié (pas
    // concaténé dans le texte de la requête) puis casté côté SQL — la valeur vient
    // exclusivement de notre propre appel d'embedding, jamais d'une entrée utilisateur.
    const vectorLiteral = `[${queryVector.join(",")}]`;

    // `knowledge_chunks` porte un `embedding` de type Prisma `Unsupported` : seul le
    // SQL brut peut le lire (cf. schema.prisma). Le périmètre TENANT est appliqué
    // dans la clause WHERE, jamais filtré après coup — une jointure sans ce filtre
    // ferait fuir la bibliothèque de référence d'un autre cabinet.
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT kc.content AS content, td.title AS source_title
      FROM knowledge_chunks kc
      JOIN template_versions tv ON tv.id = kc.template_version_id
      JOIN template_documents td ON td.id = tv.template_document_id
      WHERE kc.tenant_id = ${tenantId}
      ORDER BY kc.embedding <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `;

    return rows.map((row) => ({ content: row.content, sourceTitle: row.source_title }));
  }
}
