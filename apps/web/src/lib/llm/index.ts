import type { LLMAnalysisPort } from "./llm-analysis-port";
import { AnthropicAnalysisAdapter } from "./anthropic-analysis-adapter";
import { StubAnalysisAdapter } from "./stub-analysis-adapter";
import { getEnv } from "@/lib/config/env";

let cached: LLMAnalysisPort | null = null;

// Sélectionne l'implémentation au démarrage — le métier n'appelle jamais un SDK
// LLM directement (même principe que getFileStoragePort()/getEmailPort()).
export function getLLMAnalysisPort(): LLMAnalysisPort {
  if (cached) return cached;

  const env = getEnv();

  if (env.anthropic) {
    cached = new AnthropicAnalysisAdapter({
      apiKey: env.anthropic.apiKey,
      ...(env.anthropic.model && { model: env.anthropic.model }),
    });
    return cached;
  }

  if (env.isProduction) {
    throw new Error("Analyse documentaire non configurée : ANTHROPIC_API_KEY requis en production.");
  }

  cached = new StubAnalysisAdapter();
  return cached;
}

export type { LLMAnalysisPort, DocumentAnalysisInput, DocumentAnalysisResult } from "./llm-analysis-port";
