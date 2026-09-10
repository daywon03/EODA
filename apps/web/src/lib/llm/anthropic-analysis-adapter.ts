import Anthropic from "@anthropic-ai/sdk";
import type { LLMAnalysisPort, DocumentAnalysisInput, DocumentAnalysisResult } from "./llm-analysis-port";
import { buildSystemPrompt, buildUserMessage } from "./analysis-prompt";

// Modèle par défaut : Claude Opus 5. Surchargeable par ANTHROPIC_MODEL (cf. .env.example)
// si un arbitrage coût/qualité est décidé — l'appelant métier n'en sait rien.
const DEFAULT_MODEL = "claude-opus-5";

// Marge large : une réponse tronquée par max_tokens produit un JSON invalide, donc
// une analyse silencieusement perdue. C'est un piège classique d'une valeur trop basse.
const MAX_TOKENS = 8000;

// Schéma de sortie imposé côté API (structured outputs) : la réponse est garantie
// conforme, ce qui supprime le grattage de JSON par expression régulière et le risque
// d'échec d'analyse sur une réponse bavarde.
const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    elementsPresents: { type: "array", items: { type: "string" } },
    elementsManquants: { type: "array", items: { type: "string" } },
    suggestionsCorrection: { type: "array", items: { type: "string" } },
    sembleConforme: { type: "boolean" },
  },
  required: ["elementsPresents", "elementsManquants", "suggestionsCorrection", "sembleConforme"],
  additionalProperties: false,
} as const;

export class AnthropicAnalysisAdapter implements LLMAnalysisPort {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(options: { apiKey: string; model?: string }) {
    this.client = new Anthropic({ apiKey: options.apiKey });
    this.model = options.model ?? DEFAULT_MODEL;
  }

  async analyze(input: DocumentAnalysisInput): Promise<DocumentAnalysisResult> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: buildUserMessage(input) }],
      output_config: { format: { type: "json_schema", schema: ANALYSIS_SCHEMA } },
    });

    // Un refus de sécurité renvoie un HTTP 200 avec stop_reason "refusal" : sans ce
    // contrôle, on lirait un contenu vide comme une analyse valide.
    if (response.stop_reason === "refusal") {
      throw new Error("Analyse refusée par le modèle (stop_reason: refusal).");
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error("Réponse d'analyse tronquée (max_tokens atteint).");
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Réponse LLM sans contenu texte exploitable.");
    }

    // La sortie structurée garantit un JSON conforme au schéma ; le parse reste
    // défensif pour ne pas propager une exception brute jusqu'à l'action.
    let parsed: Partial<DocumentAnalysisResult>;
    try {
      parsed = JSON.parse(textBlock.text) as Partial<DocumentAnalysisResult>;
    } catch {
      throw new Error("Réponse LLM non parsable en JSON malgré le schéma imposé.");
    }

    return {
      elementsPresents: parsed.elementsPresents ?? [],
      elementsManquants: parsed.elementsManquants ?? [],
      suggestionsCorrection: parsed.suggestionsCorrection ?? [],
      // Défaut prudent : en l'absence de verdict explicite, on ne déclare jamais
      // un document conforme.
      sembleConforme: parsed.sembleConforme ?? false,
    };
  }
}
