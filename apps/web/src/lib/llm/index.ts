import type { LLMAnalysisPort } from "./llm-analysis-port";
import { AnthropicAnalysisAdapter } from "./anthropic-analysis-adapter";
import { OpenRouterAnalysisAdapter } from "./openrouter-analysis-adapter";
import { StubAnalysisAdapter } from "./stub-analysis-adapter";
import { getEnv } from "@/lib/config/env";

let cached: LLMAnalysisPort | null = null;

// Sélectionne l'implémentation au démarrage — le métier n'appelle jamais un SDK
// LLM directement (même principe que getFileStoragePort()/getEmailPort()).
//
// OpenRouter prend le pas sur Anthropic direct quand les deux sont configurées :
// c'est la passerelle multi-modèles (Claude/MiniMax/Qwen/Kimi, sélectionnable
// document par document — cf. openrouter-models.ts), donc le choix le plus large
// dès qu'il est disponible. Anthropic direct reste le repli à modèle fixe.
export function getLLMAnalysisPort(): LLMAnalysisPort {
  if (cached) return cached;

  const env = getEnv();

  if (env.openrouter) {
    cached = new OpenRouterAnalysisAdapter(env.openrouter.apiKey);
    return cached;
  }

  if (env.anthropic) {
    cached = new AnthropicAnalysisAdapter({
      apiKey: env.anthropic.apiKey,
      ...(env.anthropic.model && { model: env.anthropic.model }),
    });
    return cached;
  }

  if (env.isProduction) {
    throw new Error(
      "Analyse documentaire non configurée : ANTHROPIC_API_KEY ou OPENROUTER_API_KEY requis en production."
    );
  }

  cached = new StubAnalysisAdapter();
  return cached;
}

export type { LLMAnalysisPort, DocumentAnalysisInput, DocumentAnalysisResult } from "./llm-analysis-port";
export { LLM_MODEL_OPTIONS, DEFAULT_LLM_MODEL_ID, isKnownLlmModelId } from "./openrouter-models";
export type { LlmModelOption } from "./openrouter-models";
