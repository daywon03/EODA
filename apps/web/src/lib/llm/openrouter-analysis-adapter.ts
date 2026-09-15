import type {
  LLMAnalysisPort,
  DocumentAnalysisInput,
  DocumentAnalysisResult,
  DocumentGenerationInput,
} from "./llm-analysis-port";
import { normalizeFindings } from "./llm-analysis-port";
import {
  buildSystemPrompt,
  buildUserMessage,
  buildGenerationSystemPrompt,
  buildGenerationUserMessage,
} from "./analysis-prompt";
import { DEFAULT_LLM_MODEL_ID, resolveOpenRouterSlug } from "./openrouter-models";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// Même marge que l'adaptateur Anthropic direct : une réponse tronquée par
// max_tokens produit un JSON invalide, donc une analyse silencieusement perdue.
const MAX_TOKENS = 8000;

// Un document ENTIER régénéré est bien plus long qu'une analyse structurée — cf.
// même remarque dans anthropic-analysis-adapter.ts.
const GENERATION_MAX_TOKENS = 16_000;

// Contrairement à l'API Anthropic directe, tous les modèles proposés derrière
// OpenRouter ne garantissent pas un schéma de sortie strict (structured outputs) —
// c'est un comportement par fournisseur, pas par OpenRouter lui-même. On demande
// donc un objet JSON (largement supporté) et on impose le schéma dans le prompt,
// avec un parsing défensif en repli.
type OpenRouterChatResponse = {
  choices?: { message?: { content?: string } | null; finish_reason?: string }[];
};

// Un exemple concret, pas seulement une description de schéma : constaté à l'usage
// (15/09/2026), un modèle moins strict sur le suivi d'instructions (via le mode JSON
// libre d'OpenRouter, sans garantie de schéma comme l'appel Anthropic direct) peut
// ignorer une forme uniquement décrite en abstrait et renvoyer de simples chaînes —
// un exemple rempli se copie plus fidèlement qu'une notation de type.
const JSON_SCHEMA_INSTRUCTION = `Réponds UNIQUEMENT avec un objet JSON, sans texte ni balise autour, conforme à cet exemple (structure et noms de champs identiques, contenu à remplacer par ta propre analyse) :
{
  "elementsPresents": [
    { "text": "Le document mentionne la date de révision annuelle", "source": "Le présent règlement sera révisé chaque année civile" }
  ],
  "elementsManquants": ["La mention des voies de recours"],
  "suggestionsCorrection": ["Ajouter un paragraphe sur la personne qualifiée."],
  "sembleConforme": false
}
Chaque élément de "elementsPresents" est TOUJOURS un objet avec exactement ces deux
champs — jamais une simple chaîne. "source" est une citation copiée mot pour mot
depuis le document (jamais une paraphrase, jamais une chaîne vide) : si tu ne peux
pas citer un passage réel à l'appui d'un élément, place-le dans "elementsManquants"
au lieu de "elementsPresents".`;

// Constaté à l'usage (15/09/2026, MiniMax M2.7) : malgré `response_format:
// json_object` ET une consigne "sans texte ni balise autour", un modèle peut quand
// même envelopper sa réponse dans un bloc de code Markdown (```json ... ```). Sans
// ce nettoyage, un JSON par ailleurs parfaitement valide échouait à l'analyse
// entière plutôt que de simplement perdre les citations — pire que le repli
// silencieux que `normalizeFindings` gère déjà pour la FORME du contenu.
// `(?:\w+)?` plutôt que `(?:json)?` : la génération de document (Markdown, pas JSON)
// est sujette au même travers avec une étiquette différente (```markdown ... ```).
export function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  const fenced = /^```(?:\w+)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return fenced ? fenced[1]! : trimmed;
}

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
      parsed = JSON.parse(stripCodeFence(content)) as Partial<DocumentAnalysisResult>;
    } catch {
      throw new Error(`Réponse du modèle ${model} non parsable en JSON malgré la consigne.`);
    }

    return {
      elementsPresents: normalizeFindings(parsed.elementsPresents),
      elementsManquants: parsed.elementsManquants ?? [],
      suggestionsCorrection: parsed.suggestionsCorrection ?? [],
      // Défaut prudent : en l'absence de verdict explicite, on ne déclare jamais
      // un document conforme.
      sembleConforme: parsed.sembleConforme ?? false,
    };
  }

  async generateCorrectedDocument(input: DocumentGenerationInput): Promise<string> {
    const model = resolveOpenRouterSlug(input.modelId ?? DEFAULT_LLM_MODEL_ID);

    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://eoda-conseil.com",
        "X-Title": "EODA Conseil - Analyse documentaire",
      },
      body: JSON.stringify({
        model,
        max_tokens: GENERATION_MAX_TOKENS,
        // Pas de `response_format` ici : un document est du texte libre (Markdown),
        // pas du JSON — contrairement à `analyze()` ci-dessus.
        messages: [
          { role: "system", content: buildGenerationSystemPrompt() },
          { role: "user", content: buildGenerationUserMessage(input) },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Échec de l'appel OpenRouter — génération (modèle ${model}) : HTTP ${response.status}`);
    }

    const body = (await response.json()) as OpenRouterChatResponse;
    const choice = body.choices?.[0];

    if (choice?.finish_reason === "length") {
      throw new Error(
        `Document généré tronqué (max_tokens atteint, modèle ${model}) — document probablement trop long.`
      );
    }

    const content = choice?.message?.content;
    if (!content || content.trim().length === 0) {
      throw new Error(`Réponse OpenRouter sans contenu exploitable (modèle ${model}, génération).`);
    }

    return stripCodeFence(content);
  }
}
