import type { EmbeddingPort } from "./embedding-port";
import { VoyageEmbeddingAdapter } from "./voyage-embedding-adapter";
import { getEnv } from "@/lib/config/env";

let cached: EmbeddingPort | null = null;

// `null` sans configuration — jamais une exception, contrairement à
// getLLMAnalysisPort()/getEmailPort() en production. La base de connaissances est
// un enrichissement de l'analyse documentaire, jamais une condition pour analyser
// un document (cf. production-profile.ts).
export function getEmbeddingPort(): EmbeddingPort | null {
  if (cached) return cached;

  const env = getEnv();
  if (!env.voyage) return null;

  cached = new VoyageEmbeddingAdapter(env.voyage.apiKey);
  return cached;
}

export type { EmbeddingPort, EmbeddingInputType } from "./embedding-port";
