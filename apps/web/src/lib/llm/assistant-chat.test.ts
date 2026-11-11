import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/config/env", () => ({ getEnv: () => ({ openrouter: null }) }));

const { OpenRouterAssistantChat, AssistantChatError, getAssistantChatPort } = await import("./assistant-chat");

function fakeFetch(...bodies: unknown[]) {
  const fn = vi.fn();
  for (const body of bodies) fn.mockResolvedValueOnce({ ok: true, json: async () => body });
  return fn as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const reply = (content: string, cost = 0.001, finish = "stop") => ({
  model: "minimax/minimax-m2.7",
  choices: [{ message: { content }, finish_reason: finish }],
  usage: { prompt_tokens: 100, completion_tokens: 20, cost },
});

describe("OpenRouterAssistantChat", () => {
  it("demande le coût réel, renvoie texte, coût et jetons", async () => {
    const fetchImpl = fakeFetch(reply('{"reponse":"ok"}'));
    const chat = new OpenRouterAssistantChat("k", fetchImpl);
    const result = await chat.reply([{ role: "user", content: "q" }], { maxTokens: 4000 });
    expect(result).toMatchObject({ text: '{"reponse":"ok"}', cost: 0.001, inputTokens: 100, outputTokens: 20, truncated: false });
    const body = JSON.parse((fetchImpl.mock.calls[0]?.[1] as { body: string }).body) as Record<string, unknown>;
    expect(body.usage).toEqual({ include: true });
    expect(body.max_tokens).toBe(4000);
  });

  it("signale une réponse coupée faute de jetons", async () => {
    const chat = new OpenRouterAssistantChat("k", fakeFetch(reply("…", 0.001, "length")));
    expect((await chat.reply([], { maxTokens: 4000 })).truncated).toBe(true);
  });

  it("écriture étrangère : redemande une fois, puis refuse en gardant le coût consommé", async () => {
    const ok = new OpenRouterAssistantChat("k", fakeFetch(reply("ce qui规范ise"), reply("ce qui structure")));
    expect((await ok.reply([], { maxTokens: 4000 })).text).toBe("ce qui structure");

    const ko = new OpenRouterAssistantChat("k", fakeFetch(reply("规范", 0.001), reply("规范", 0.002)));
    await expect(ko.reply([], { maxTokens: 4000 })).rejects.toMatchObject({ name: "AssistantChatError", cost: 0.003 });
  });

  it("step : déclare les outils et rend les appels d'outils demandés", async () => {
    const fetchImpl = fakeFetch({
      model: "minimax/minimax-m2.7",
      choices: [{ message: { content: null, tool_calls: [{ id: "t1", function: { name: "list_structures", arguments: "{}" } }] }, finish_reason: "tool_calls" }],
      usage: { prompt_tokens: 50, completion_tokens: 10, cost: 0.0001 },
    });
    const tool = { type: "function" as const, function: { name: "list_structures", description: "d", parameters: { type: "object" } } };
    const step = await new OpenRouterAssistantChat("k", fetchImpl).step([{ role: "user", content: "q" }], { maxTokens: 1000, tools: [tool] });
    expect(step.toolCalls).toEqual([{ id: "t1", name: "list_structures", arguments: "{}" }]);
    expect(step.content).toBe("");
    const body = JSON.parse((fetchImpl.mock.calls[0]?.[1] as { body: string }).body) as Record<string, unknown>;
    expect(body.tools).toEqual([tool]);
    expect(body.tool_choice).toBe("auto");
  });

  it("réponse HTTP en erreur : AssistantChatError", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 502 }) as unknown as typeof fetch;
    await expect(new OpenRouterAssistantChat("k", fetchImpl).reply([], { maxTokens: 10 })).rejects.toBeInstanceOf(AssistantChatError);
  });

  it("sans clé OpenRouter : aucun port, l'assistant est indisponible", () => {
    expect(getAssistantChatPort()).toBeNull();
  });
});
