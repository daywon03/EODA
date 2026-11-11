// ─────────────────────────────────────────────────────────────────────────────
// MODÈLES DE L'ASSISTANT (11/11/2026 — « donne la possibilité de changer de modèle
// comme sur MusicPlanner », puis « mets les autres modèles chinois aussi »).
//
// Catalogue FIGÉ, comme MusicPlanner : seuls des modèles TESTÉS EN RÉEL le 11/11/2026
// via OpenRouter (appel d'outils puis réponse finale, données fictives) y entrent — un
// modèle trouvé sur une liste tierce n'est jamais proposé sans cet essai.
// `costFactor` : coût mesuré de la même question rapporté au modèle par défaut (×1). Il
// n'est qu'indicatif : les crédits se décomptent sur le coût RÉEL renvoyé par OpenRouter.
// Fichier sans dépendance serveur : importable par l'écran (sélecteur).
// ─────────────────────────────────────────────────────────────────────────────

export type AssistantModelOption = {
  id: string;
  label: string;
  provider: string;
  description: string;
  openRouterSlug: string;
  costFactor: number;
};

export const ASSISTANT_MODELS: readonly AssistantModelOption[] = [
  { id: "minimax-m2.7", label: "MiniMax M2.7", provider: "MiniMax", description: "Équilibré, celui des analyses", openRouterSlug: "minimax/minimax-m2.7", costFactor: 1 },
  { id: "deepseek-v4.1-flash", label: "DeepSeek V4.1 Flash", provider: "DeepSeek", description: "Rapide et économique", openRouterSlug: "deepseek/deepseek-v4.1-flash", costFactor: 1.1 },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro", provider: "DeepSeek", description: "Plus réfléchi", openRouterSlug: "deepseek/deepseek-v4-pro", costFactor: 4 },
  { id: "qwen3.8-flash", label: "Qwen3.8 Flash", provider: "Alibaba", description: "Très économique", openRouterSlug: "qwen/qwen3.8-flash", costFactor: 0.5 },
  { id: "qwen3.8-max", label: "Qwen3.8 Max", provider: "Alibaba", description: "Grand modèle, plus cher", openRouterSlug: "qwen/qwen3.8-max-0902", costFactor: 9 },
  { id: "glm-5.3-flash", label: "GLM 5.3 Flash", provider: "Zhipu", description: "Le moins cher", openRouterSlug: "z-ai/glm-5.3-flash", costFactor: 0.4 },
  { id: "glm-5.3", label: "GLM 5.3", provider: "Zhipu", description: "Polyvalent", openRouterSlug: "z-ai/glm-5.3", costFactor: 2.4 },
  { id: "kimi-k3", label: "Kimi K3", provider: "Moonshot AI", description: "Raisonne longuement, plus cher", openRouterSlug: "moonshotai/kimi-k3", costFactor: 14 },
  { id: "mistral-large", label: "Mistral Large", provider: "Mistral AI", description: "Européen, rapide", openRouterSlug: "mistralai/mistral-large-2512", costFactor: 0.7 },
  { id: "claude-haiku-5.5", label: "Claude Haiku 5.5", provider: "Anthropic", description: "Rapide et soigné", openRouterSlug: "anthropic/claude-haiku-5.5", costFactor: 0.7 },
  { id: "claude-sonnet-5.5", label: "Claude Sonnet 5.5", provider: "Anthropic", description: "Le plus précis, plus cher", openRouterSlug: "anthropic/claude-sonnet-5.5", costFactor: 12 },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite", provider: "Google", description: "Très économique", openRouterSlug: "google/gemini-3.5-flash-lite", costFactor: 0.5 },
];

export const DEFAULT_ASSISTANT_MODEL_ID = "minimax-m2.7";

export function isKnownAssistantModelId(value: unknown): value is string {
  return typeof value === "string" && ASSISTANT_MODELS.some((m) => m.id === value);
}

// Entrée non fiable (vient du navigateur) : un identifiant inconnu retombe sur le défaut.
export function resolveAssistantModel(value: unknown): AssistantModelOption {
  const found = ASSISTANT_MODELS.find((m) => m.id === value);
  return found ?? ASSISTANT_MODELS.find((m) => m.id === DEFAULT_ASSISTANT_MODEL_ID)!;
}

// « ×0,4 » / « ×12 » — écrit à la française.
export function formatCostFactor(factor: number): string {
  return `×${String(Math.round(factor * 10) / 10).replace(".", ",")}`;
}
