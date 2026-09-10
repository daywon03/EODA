// Catalogue figé des modèles proposés à la sélection côté cabinet, pour comparer
// leurs résultats sur un même document (demande de Damon, 10/09/2026). Liste
// volontairement en dur : ce sont quatre choix éditoriaux, pas une donnée qui
// grossit — une table en base se remplirait à la main et s'oublierait (cf.
// CLAUDE.md, même raisonnement que pour la bibliothèque de modèles).
//
// Fichier sans dépendance serveur : importable tel quel depuis un composant client
// pour peupler le sélecteur.

export type LlmModelOption = {
  id: string;
  label: string;
  openRouterSlug: string;
};

const DEFAULT_OPTION: LlmModelOption = {
  id: "claude-opus-5",
  label: "Claude Opus 5 (Anthropic)",
  openRouterSlug: "anthropic/claude-opus-5",
};

export const LLM_MODEL_OPTIONS: LlmModelOption[] = [
  DEFAULT_OPTION,
  { id: "minimax-m2.7", label: "MiniMax M2.7", openRouterSlug: "minimax/minimax-m2.7" },
  { id: "qwen3.8-max", label: "Qwen3.8 Max", openRouterSlug: "qwen/qwen3.8-max-0902" },
  { id: "kimi-k3", label: "Kimi K3 (Moonshot AI)", openRouterSlug: "moonshotai/kimi-k3" },
];

export const DEFAULT_LLM_MODEL_ID = DEFAULT_OPTION.id;

export function isKnownLlmModelId(value: string): boolean {
  return LLM_MODEL_OPTIONS.some((option) => option.id === value);
}

// Repli silencieux sur le modèle par défaut si l'identifiant est inconnu — ce n'est
// pas une frontière de sécurité (la validation qui compte est à l'action serveur,
// isKnownLlmModelId), seulement une garantie que l'appel OpenRouter part toujours
// avec un modèle valide.
export function resolveOpenRouterSlug(modelId: string | null | undefined): string {
  const found = LLM_MODEL_OPTIONS.find((option) => option.id === modelId);
  return (found ?? DEFAULT_OPTION).openRouterSlug;
}
