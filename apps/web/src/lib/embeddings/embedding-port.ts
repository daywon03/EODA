// Port d'embeddings (Dependency Inversion) — même principe que LLMAnalysisPort,
// EmailPort, FileStoragePort : le métier ne dépend jamais directement d'un SDK
// externe. cf. specs/02-architecture-technique.md §1.

// "document" à l'indexation, "query" à la recherche : Voyage AI optimise chaque
// vecteur différemment selon ce rôle (récupération asymétrique). Se tromper ne
// casse rien mais dégrade la pertinence — c'est pourquoi c'est un paramètre
// obligatoire, jamais une valeur par défaut silencieuse.
export type EmbeddingInputType = "document" | "query";

export interface EmbeddingPort {
  embed(texts: string[], inputType: EmbeddingInputType): Promise<number[][]>;
}
