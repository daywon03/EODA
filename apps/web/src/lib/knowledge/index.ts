import { getEmbeddingPort } from "@/lib/embeddings";
import { PgVectorKnowledgeAdapter } from "./pgvector-knowledge-adapter";
import type { KnowledgeRetrievalPort } from "./knowledge-retrieval-port";

let cached: KnowledgeRetrievalPort | null = null;

// `null` sans fournisseur d'embeddings configuré (VOYAGE_API_KEY) — la base de
// connaissances est un enrichissement de l'analyse documentaire, jamais une
// condition pour analyser un document. Un appelant reçoit null et poursuit sans
// extrait de contexte, exactement comme sans cette fonctionnalité.
export function getKnowledgeRetrievalPort(): KnowledgeRetrievalPort | null {
  if (cached) return cached;

  const embeddings = getEmbeddingPort();
  if (!embeddings) return null;

  cached = new PgVectorKnowledgeAdapter(embeddings);
  return cached;
}

export type { KnowledgeRetrievalPort, KnowledgeExcerpt } from "./knowledge-retrieval-port";
