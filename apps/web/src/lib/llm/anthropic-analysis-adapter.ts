import Anthropic from "@anthropic-ai/sdk";
import type {
  LLMAnalysisPort,
  DocumentAnalysisInput,
  DocumentAnalysisResult,
  DocumentGenerationInput,
} from "./llm-analysis-port";
import {
  normalizeFindings,
  normalizeCriteriaCoverage,
  normalizeCriterionSuggestions,
} from "./llm-analysis-port";
import {
  buildSystemPrompt,
  buildUserMessage,
  buildGenerationSystemPrompt,
  buildGenerationUserMessage,
} from "./analysis-prompt";

// Modèle par défaut : Claude Opus 5. Surchargeable par ANTHROPIC_MODEL (cf. .env.example)
// si un arbitrage coût/qualité est décidé — l'appelant métier n'en sait rien.
const DEFAULT_MODEL = "claude-opus-5";

// Marge large : une réponse tronquée par max_tokens produit un JSON invalide, donc
// une analyse silencieusement perdue. C'est un piège classique d'une valeur trop basse.
const MAX_TOKENS = 8000;

// Un document ENTIER régénéré est bien plus long qu'une analyse structurée — la
// marge de l'analyse (8000) tronquerait un document de plusieurs pages en plein
// milieu, ce qui est pire ici que pour l'analyse : un document déposé tel quel
// couperait une section en cours de rédaction.
const GENERATION_MAX_TOKENS = 16_000;

// Schéma de sortie imposé côté API (structured outputs) : la réponse est garantie
// conforme, ce qui supprime le grattage de JSON par expression régulière et le risque
// d'échec d'analyse sur une réponse bavarde.
const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    elementsPresents: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          // Citation mot pour mot du document — cf. buildSystemPrompt : sans elle,
          // une "présence" affirmée n'est qu'une déduction du modèle.
          source: { type: "string" },
        },
        required: ["text", "source"],
        additionalProperties: false,
      },
    },
    elementsManquants: { type: "array", items: { type: "string" } },
    suggestionsCorrection: { type: "array", items: { type: "string" } },
    sembleConforme: { type: "boolean" },
    criteriaCoverage: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterionCode: { type: "string" },
          criterionLabel: { type: "string" },
          status: { type: "string", enum: ["couvert", "partiel", "absent"] },
          note: { type: "string" },
        },
        required: ["criterionCode", "criterionLabel", "status", "note"],
        additionalProperties: false,
      },
    },
    // Critères NON déjà rattachés au type, que ce document précis semble
    // concerner en plus — cf. RawCriterionSuggestion. Toujours présent dans le
    // schéma (structured outputs exige `required` exhaustif), mais peut être un
    // tableau vide : rien à ajouter n'est une réponse valide.
    criteresSupplementaires: {
      type: "array",
      items: {
        type: "object",
        properties: {
          criterionCode: { type: "string" },
          justification: { type: "string" },
        },
        required: ["criterionCode", "justification"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "elementsPresents",
    "elementsManquants",
    "suggestionsCorrection",
    "sembleConforme",
    "criteriaCoverage",
    "criteresSupplementaires",
  ],
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
      elementsPresents: normalizeFindings(parsed.elementsPresents),
      elementsManquants: parsed.elementsManquants ?? [],
      suggestionsCorrection: parsed.suggestionsCorrection ?? [],
      // Défaut prudent : en l'absence de verdict explicite, on ne déclare jamais
      // un document conforme.
      sembleConforme: parsed.sembleConforme ?? false,
      criteriaCoverage: normalizeCriteriaCoverage(parsed.criteriaCoverage),
      criteresSupplementaires: normalizeCriterionSuggestions(parsed.criteresSupplementaires),
    };
  }

  async generateCorrectedDocument(input: DocumentGenerationInput): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: GENERATION_MAX_TOKENS,
      system: buildGenerationSystemPrompt(),
      messages: [{ role: "user", content: buildGenerationUserMessage(input) }],
      // Pas de `output_config` ici : un document est du texte libre, pas du JSON —
      // contrairement à `analyze()` ci-dessus.
    });

    if (response.stop_reason === "refusal") {
      throw new Error("Génération refusée par le modèle (stop_reason: refusal).");
    }
    if (response.stop_reason === "max_tokens") {
      throw new Error("Document généré tronqué (max_tokens atteint) — document probablement trop long.");
    }

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text" || textBlock.text.trim().length === 0) {
      throw new Error("Réponse de génération sans contenu texte exploitable.");
    }

    return textBlock.text.trim();
  }
}
