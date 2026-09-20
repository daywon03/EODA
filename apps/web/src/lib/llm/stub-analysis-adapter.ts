import type {
  LLMAnalysisPort,
  DocumentAnalysisInput,
  DocumentAnalysisResult,
  DocumentGenerationInput,
} from "./llm-analysis-port";

// Fallback dev/tant-que-ANTHROPIC_API_KEY-non-configuré — ne fait aucun appel LLM,
// renvoie un résultat neutre pour ne pas bloquer le flux d'upload. Ne jamais
// utiliser en production (cf. getLLMAnalysisPort()).
export class StubAnalysisAdapter implements LLMAnalysisPort {
  async analyze(input: DocumentAnalysisInput): Promise<DocumentAnalysisResult> {
    console.log(
      `[StubAnalysisAdapter] Analyse non exécutée (ANTHROPIC_API_KEY absent) pour "${input.documentTypeLabel}".`
    );
    return {
      elementsPresents: [],
      elementsManquants: [],
      suggestionsCorrection: [],
      sembleConforme: false,
      criteriaCoverage: [],
      criteresSupplementaires: [],
    };
  }

  async generateCorrectedDocument(input: DocumentGenerationInput): Promise<string> {
    console.log(
      `[StubAnalysisAdapter] Génération non exécutée (ANTHROPIC_API_KEY absent) pour "${input.documentTypeLabel}".`
    );
    throw new Error("Génération de document non configurée (adaptateur de repli, développement uniquement).");
  }
}
