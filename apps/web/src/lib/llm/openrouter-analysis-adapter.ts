import type { LLMAnalysisPort, DocumentAnalysisInput, DocumentAnalysisResult } from "./llm-analysis-port";
import { buildSystemPrompt, buildUserMessage } from "./analysis-prompt";
import { DEFAULT_LLM_MODEL_ID, resolveOpenRouterSlug } from "./openrouter-models";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Même marge que l'adaptateur Anthropic direct : une réponse tronquée par
// max_tokens produit un JSON invalide, donc une analyse silencieusement perdue.
const MAX_TOKENS = 8000;

// Contrairement à l'API Anthropic directe, tous les modèles proposés derrière
// OpenRouter ne garantissent pas un schéma de sortie strict (structured outputs) —
// c'est un comportement par fournisseur, pas par OpenRouter lui-même. On demande
// donc un objet JSON (largement supporté) et on impose le schéma dans le prompt,
// avec un parsing défensif en repli.
type OpenRouterChatResponse = {
  choices?: { message?: { content?: string } | null; finish_reason?: string }[];
};

const JSON_SCHEMA_INSTRUCTION = `Réponds UNIQUEMENT avec un objet JSON, sans texte ni balise autour, conforme à ce schéma :
{
  "elementsPresents": string[],
  "elementsManquants": string[],
  "suggestionsCorrection": string[],
  "sembleConforme": boolean
}`;

export class OpenRouterAnalysisAdapter implements LLMAnalysisPort {
  constructor(private readonly apiKey: string) {}

  async analyze(input: DocumentAnalysisInput): Promise<DocumentAnalysisResult> {
    const model = resolveOpenRouterSlug(input.modelId ?? DEFAULT_LLM_MODEL_ID);

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        // Attribution recommandée par OpenRouter, sans incidence fonctionnelle. Un
        // en-tête HTTP est un ByteString (Latin-1) : le tiret cadratin (—, U+2014)
        // y est refusé par `fetch` — testé en conditions réelles, l'appel échouait
        // avant même de partir sur le réseau. Un tiret simple ne pose pas ce problème.
        "HTTP-Referer": "https://eoda-conseil.com",
        "X-Title": "EODA Conseil - Analyse documentaire",
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${buildSystemPrompt()}\n\n${JSON_SCHEMA_INSTRUCTION}` },
          { role: "user", content: buildUserMessage(input) },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Échec de l'appel OpenRouter (modèle ${model}) : HTTP ${response.status}`);
    }

    const body = (await response.json()) as OpenRouterChatResponse;
    const choice = body.choices?.[0];

    if (choice?.finish_reason === "length") {
      throw new Error(`Réponse d'analyse tronquée (max_tokens atteint, modèle ${model}).`);
    }

    const content = choice?.message?.content;
    if (!content) {
      throw new Error(`Réponse OpenRouter sans contenu exploitable (modèle ${model}).`);
    }

    let parsed: Partial<DocumentAnalysisResult>;
    try {
      parsed = JSON.parse(content) as Partial<DocumentAnalysisResult>;
    } catch {
      throw new Error(`Réponse du modèle ${model} non parsable en JSON malgré la consigne.`);
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
