import { describe, expect, it } from "vitest";
import {
  ASSISTANT_MODELS,
  DEFAULT_ASSISTANT_MODEL_ID,
  formatCostFactor,
  isKnownAssistantModelId,
  resolveAssistantModel,
} from "./assistant-models";

describe("catalogue des modèles de l'assistant", () => {
  it("le défaut existe, vaut ×1, et chaque identifiant est unique", () => {
    expect(resolveAssistantModel(DEFAULT_ASSISTANT_MODEL_ID).costFactor).toBe(1);
    expect(new Set(ASSISTANT_MODELS.map((m) => m.id)).size).toBe(ASSISTANT_MODELS.length);
    expect(new Set(ASSISTANT_MODELS.map((m) => m.openRouterSlug)).size).toBe(ASSISTANT_MODELS.length);
  });

  it("propose les modèles chinois testés (MiniMax, DeepSeek, Qwen, GLM, Kimi)", () => {
    const providers = new Set(ASSISTANT_MODELS.map((m) => m.provider));
    for (const p of ["MiniMax", "DeepSeek", "Alibaba", "Zhipu", "Moonshot AI"]) expect(providers.has(p)).toBe(true);
  });

  it("un identifiant inconnu (entrée du navigateur) retombe sur le défaut", () => {
    expect(isKnownAssistantModelId("gpt-inconnu")).toBe(false);
    expect(isKnownAssistantModelId(42)).toBe(false);
    expect(resolveAssistantModel("gpt-inconnu").id).toBe(DEFAULT_ASSISTANT_MODEL_ID);
    expect(resolveAssistantModel("glm-5.3-flash").openRouterSlug).toBe("z-ai/glm-5.3-flash");
  });

  it("facteur écrit à la française", () => {
    expect(formatCostFactor(0.4)).toBe("×0,4");
    expect(formatCostFactor(12)).toBe("×12");
  });
});
