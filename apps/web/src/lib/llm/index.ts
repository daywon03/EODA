import type { LLMAnalysisPort } from "./llm-analysis-port";
import { AnthropicAnalysisAdapter } from "./anthropic-analysis-adapter";
import { StubAnalysisAdapter } from "./stub-analysis-adapter";

let cached: LLMAnalysisPort | null = null;

// Sélectionne l'implémentation au démarrage — le métier n'appelle jamais un SDK
// LLM directement (même principe que getFileStoragePort()/getEmailPort()).
export function getLLMAnalysisPort(): LLMAnalysisPort {
  if (cached) return cached;

  const { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } = process.env;

  if (ANTHROPIC_API_KEY) {
    cached = new AnthropicAnalysisAdapter({
      apiKey: ANTHROPIC_API_KEY,
      ...(ANTHROPIC_MODEL && { model: ANTHROPIC_MODEL }),
    });
    return cached;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Analyse documentaire non configurée : ANTHROPIC_API_KEY requis en production.");
  }

  cached = new StubAnalysisAdapter();
  return cached;
}

export type { LLMAnalysisPort, DocumentAnalysisInput, DocumentAnalysisResult } from "./llm-analysis-port";
