import { getEnv } from "@/lib/config/env";
import { allowedForeignCharacters, foreignCharacters } from "./script-guard";
import { DEFAULT_LLM_MODEL_ID, resolveOpenRouterSlug } from "./openrouter-models";

// ─────────────────────────────────────────────────────────────────────────────
// DIALOGUE DE L'ASSISTANT (lot F, 11/11/2026) — un port, un adaptateur OpenRouter.
//
// Même passerelle que l'analyse (décision de Damon du 08/10/2026 : on reste sur
// OpenRouter), même modèle par défaut. Comme MusicPlanner : `fetch` sans SDK, pas de
// streaming, délai borné, température basse. Le COÛT RÉEL de l'appel est demandé à
// OpenRouter (`usage: { include: true }` → `usage.cost`) : les crédits se comptent
// sur ce que l'appel a coûté, jamais sur un tarif recopié ici.
// Garde d'écriture : une réponse en écriture étrangère est redemandée une fois, puis
// refusée (même règle que script-guard pour l'analyse).
// ─────────────────────────────────────────────────────────────────────────────

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const TIMEOUT_MS = 45_000;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatReply = {
  text: string;
  // Coût réel rapporté par OpenRouter (en crédits OpenRouter, ≈ dollars), null si absent.
  cost: number | null;
  inputTokens: number;
  outputTokens: number;
  model: string;
  truncated: boolean;
};

// Un tour de la boucle d'outils (assistant du menu, 11/11/2026) : messages au format
// OpenAI (assistant avec `tool_calls`, réponses `tool`), outils déclarés en JSON Schema.
export type ToolCall = { id: string; name: string; arguments: string };
export type StepMessage =
  | ChatMessage
  | { role: "assistant"; content: string | null; tool_calls: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };
export type ToolDefinition = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};
export type ChatStep = Omit<ChatReply, "text"> & { content: string; toolCalls: ToolCall[] };

export interface AssistantChatPort {
  reply(messages: readonly ChatMessage[], options: { maxTokens: number; sourceText?: string | undefined; model?: string | undefined }): Promise<ChatReply>;
  step(
    messages: readonly StepMessage[],
    options: { maxTokens: number; tools?: readonly ToolDefinition[]; model?: string | undefined }
  ): Promise<ChatStep>;
}

export class AssistantChatError extends Error {
  constructor(
    message: string,
    // Jetons déjà consommés malgré l'échec : ils se décomptent quand même.
    readonly cost: number | null = null
  ) {
    super(message);
    this.name = "AssistantChatError";
  }
}

type OpenRouterReply = {
  model?: string;
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[] | null;
    } | null;
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
};

export class OpenRouterAssistantChat implements AssistantChatPort {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  private async once(messages: readonly ChatMessage[], maxTokens: number, chosen?: string): Promise<ChatReply> {
    // Le modèle choisi dans le sélecteur (assistant-models), sinon celui des analyses.
    const model = chosen ?? resolveOpenRouterSlug(DEFAULT_LLM_MODEL_ID);
    const response = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://eoda-conseil.com",
        "X-Title": "EODA Conseil - Assistant",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature: 0.2,
        response_format: { type: "json_object" },
        usage: { include: true },
        messages,
      }),
    });
    if (!response.ok) throw new AssistantChatError(`OpenRouter a répondu ${response.status}.`);
    const body = (await response.json()) as OpenRouterReply;
    const choice = body.choices?.[0];
    return {
      text: choice?.message?.content ?? "",
      cost: typeof body.usage?.cost === "number" ? body.usage.cost : null,
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
      model: body.model ?? model,
      truncated: choice?.finish_reason === "length",
    };
  }

  async step(
    messages: readonly StepMessage[],
    options: { maxTokens: number; tools?: readonly ToolDefinition[]; model?: string | undefined }
  ): Promise<ChatStep> {
    const model = options.model ?? resolveOpenRouterSlug(DEFAULT_LLM_MODEL_ID);
    const response = await this.fetchImpl(ENDPOINT, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://eoda-conseil.com",
        "X-Title": "EODA Conseil - Assistant",
      },
      body: JSON.stringify({
        model,
        max_tokens: options.maxTokens,
        temperature: 0.2,
        usage: { include: true },
        ...(options.tools && options.tools.length > 0 ? { tools: options.tools, tool_choice: "auto" } : {}),
        messages,
      }),
    });
    if (!response.ok) throw new AssistantChatError(`OpenRouter a répondu ${response.status}.`);
    const body = (await response.json()) as OpenRouterReply;
    const choice = body.choices?.[0];
    const toolCalls = (choice?.message?.tool_calls ?? []).flatMap((call): ToolCall[] =>
      call.id && call.function?.name ? [{ id: call.id, name: call.function.name, arguments: call.function.arguments ?? "{}" }] : []
    );
    return {
      content: choice?.message?.content ?? "",
      toolCalls,
      cost: typeof body.usage?.cost === "number" ? body.usage.cost : null,
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
      model: body.model ?? model,
      truncated: choice?.finish_reason === "length",
    };
  }

  async reply(
    messages: readonly ChatMessage[],
    options: { maxTokens: number; sourceText?: string | undefined; model?: string | undefined }
  ): Promise<ChatReply> {
    const allowed = allowedForeignCharacters(options.sourceText);
    const first = await this.once(messages, options.maxTokens, options.model);
    if (foreignCharacters(first.text, allowed).length === 0) return first;
    const second = await this.once(messages, options.maxTokens, options.model);
    const cost = (first.cost ?? 0) + (second.cost ?? 0);
    if (foreignCharacters(second.text, allowed).length > 0) {
      throw new AssistantChatError("La réponse contenait des caractères d'une autre écriture : elle a été refusée.", cost);
    }
    return { ...second, cost, inputTokens: first.inputTokens + second.inputTokens, outputTokens: first.outputTokens + second.outputTokens };
  }
}

// null = assistant indisponible (aucune clé OpenRouter) : l'écran le dit, rien ne part.
export function getAssistantChatPort(): AssistantChatPort | null {
  const env = getEnv();
  return env.openrouter ? new OpenRouterAssistantChat(env.openrouter.apiKey) : null;
}
