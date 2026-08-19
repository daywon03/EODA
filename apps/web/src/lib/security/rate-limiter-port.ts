// Port de limitation de débit (Dependency Inversion) — le métier ne dépend jamais
// d'un backend de compteur particulier. Même principe que FileStoragePort /
// LLMAnalysisPort / EmailPort, cf. specs/02-architecture-technique.md §1.
//
// Permet de remplacer le compteur en mémoire par un compteur partagé (Redis,
// Prisma Postgres) sans toucher le code appelant, dès que l'application tourne sur
// plusieurs instances.

export type RateLimitDecision = {
  allowed: boolean;
  // Nombre de tentatives restantes avant blocage — utile pour un message utilisateur.
  remaining: number;
  // Secondes avant réouverture, uniquement quand allowed === false.
  retryAfterSeconds: number;
};

export type RateLimitState = {
  blocked: boolean;
  retryAfterSeconds: number;
};

export interface RateLimiterPort {
  // Enregistre une tentative pour `key` et indique si elle est autorisée.
  // Idempotence non garantie : chaque appel compte pour une tentative.
  consume(key: string, options: { limit: number; windowSeconds: number }): Promise<RateLimitDecision>;
  // Lit l'état sans consommer de tentative — permet d'afficher un message précis à
  // l'utilisateur sans fausser le comptage.
  peek(key: string, options: { limit: number; windowSeconds: number }): Promise<RateLimitState>;
  // Remet le compteur à zéro — appelé après une authentification réussie, pour
  // qu'un utilisateur légitime ne reste pas pénalisé par ses erreurs de frappe.
  reset(key: string): Promise<void>;
}
