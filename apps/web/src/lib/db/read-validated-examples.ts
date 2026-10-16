import { prisma } from "@eoda/database";
import type { ValidatedExample } from "@/lib/llm/llm-analysis-port";
import { assembleValidatedExamples, type ExampleChunkRow } from "@/lib/services/validated-example-service";

type Row = { template_version_id: string; title: string; chunk_index: number; content: string };

// Exemples validés d'un TYPE de document, pour UN tenant (N8, context/10 §9).
// Les deux filtres sont dans la clause WHERE, jamais appliqués après coup : un
// exemple d'un autre cabinet ne doit pas pouvoir entrer dans un prompt. Seules les
// lignes EXEMPLE_VALIDE d'un gabarit FINALE rattaché à ce type sont lues — jamais un
// document client, jamais un texte de référence.
//
// Best-effort, comme fetchKnowledgeExcerpts : une panne prive la génération d'exemple,
// elle ne la fait pas échouer.
export async function readValidatedExamples(tenantId: string | null, documentTypeId: string | null): Promise<ValidatedExample[]> {
  if (!tenantId || !documentTypeId) return [];
  try {
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT kc.template_version_id, td.title, kc.chunk_index, kc.content
      FROM knowledge_chunks kc
      JOIN template_versions tv ON tv.id = kc.template_version_id
      JOIN template_documents td ON td.id = tv.template_document_id
      WHERE kc.tenant_id = ${tenantId}
        AND td.tenant_id = ${tenantId}
        AND kc.nature = 'EXEMPLE_VALIDE'
        AND td.kind = 'GABARIT'
        AND tv.stage = 'FINALE'
        AND td.document_type_id = ${documentTypeId}
      ORDER BY tv.created_at DESC, kc.chunk_index ASC
      LIMIT 200
    `;
    const chunks: ExampleChunkRow[] = rows.map((r) => ({
      templateVersionId: r.template_version_id,
      title: r.title,
      chunkIndex: r.chunk_index,
      content: r.content,
    }));
    return assembleValidatedExamples(chunks);
  } catch (error) {
    console.error("Exemples validés — lecture échouée, génération sans exemple :", error);
    return [];
  }
}
