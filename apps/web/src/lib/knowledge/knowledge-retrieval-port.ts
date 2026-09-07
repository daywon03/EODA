// Port de recherche dans la base de connaissances (Dependency Inversion) — même
// principe que LLMAnalysisPort : le métier ne dépend jamais directement de
// pgvector ni d'un fournisseur d'embeddings.

export type KnowledgeExcerpt = {
  content: string;
  // Titre du document de référence source (ex: "Manuel HAS — chapitre 2"), pour que
  // le prompt d'analyse cite sa source plutôt que de présenter un extrait anonyme.
  sourceTitle: string;
};

export interface KnowledgeRetrievalPort {
  search(tenantId: string, queryText: string, limit: number): Promise<KnowledgeExcerpt[]>;
}
