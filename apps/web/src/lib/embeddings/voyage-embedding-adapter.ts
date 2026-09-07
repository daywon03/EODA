import type { EmbeddingPort, EmbeddingInputType } from "./embedding-port";

// voyage-4 : 200 millions de tokens gratuits par compte (les modèles voyage-3
// n'ont plus d'allocation gratuite depuis 2026). 1024 dimensions par défaut —
// aligné sur vector(1024) dans la migration knowledge_chunks.
const VOYAGE_MODEL = "voyage-4";
const ENDPOINT = "https://api.voyageai.com/v1/embeddings";

type VoyageResponse = {
  data: { embedding: number[]; index: number }[];
};

export class VoyageEmbeddingAdapter implements EmbeddingPort {
  constructor(private readonly apiKey: string) {}

  async embed(texts: string[], inputType: EmbeddingInputType): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: inputType }),
    });

    if (!response.ok) {
      throw new Error(`Échec de l'appel Voyage AI (embeddings) : HTTP ${response.status}`);
    }

    const body = (await response.json()) as VoyageResponse;
    // L'API rend les embeddings dans l'ordre de soumission mais documente `index`
    // comme la garantie contractuelle : on trie dessus plutôt que de supposer l'ordre.
    return [...body.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
  }
}
