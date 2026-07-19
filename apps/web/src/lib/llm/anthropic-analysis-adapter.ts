import Anthropic from "@anthropic-ai/sdk";
import type { LLMAnalysisPort, DocumentAnalysisInput, DocumentAnalysisResult } from "./llm-analysis-port";

const DEFAULT_MODEL = "claude-sonnet-4-5";

function buildPrompt(input: DocumentAnalysisInput): string {
  return `Tu analyses un document fourni par un établissement social/médico-social (ESSMS) en
préparation à une évaluation qualité HAS. Type de document attendu : "${input.documentTypeLabel}".
Critères HAS rattachés à ce type de document : ${input.linkedCriteriaLabels.join("; ") || "aucun rattachement connu"}.

Analyse le texte ci-dessous et réponds UNIQUEMENT avec un objet JSON de cette forme exacte,
sans texte autour :
{
  "elementsPresents": string[],
  "elementsManquants": string[],
  "suggestionsCorrection": string[],
  "sembleConforme": boolean
}

Règles : reste factuel, ne devine pas de contenu absent, "suggestionsCorrection" propose des
paragraphes-types génériques quand un élément manque, jamais d'invention de données
personnelles. Cette analyse est une aide à la décision, jamais une validation finale.

Texte du document :
"""
${input.extractedText.slice(0, 15000)}
"""`;
}

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
      max_tokens: 1024,
      messages: [{ role: "user", content: buildPrompt(input) }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("Réponse LLM sans contenu texte exploitable.");
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Réponse LLM non parsable en JSON.");
    }

    const parsed = JSON.parse(jsonMatch[0]) as Partial<DocumentAnalysisResult>;

    return {
      elementsPresents: parsed.elementsPresents ?? [],
      elementsManquants: parsed.elementsManquants ?? [],
      suggestionsCorrection: parsed.suggestionsCorrection ?? [],
      sembleConforme: parsed.sembleConforme ?? false,
    };
  }
}
