import type { RateLimiterPort } from "./rate-limiter-port";
import { InMemoryRateLimiter } from "./in-memory-rate-limiter";

let cached: RateLimiterPort | null = null;

// Sélectionne l'implémentation — un seul adaptateur pour l'instant (mémoire du
// processus). Point d'extension prévu : un adaptateur partagé (Redis / table
// Postgres) le jour où l'application tourne sur plusieurs instances, sans que les
// appelants changent (cf. rate-limiter-port.ts).
export function getRateLimiter(): RateLimiterPort {
  if (cached) return cached;
  cached = new InMemoryRateLimiter();
  return cached;
}

// Politique de limitation de l'authentification. Volontairement centralisée ici
// plutôt que dupliquée dans l'action de login : une seule valeur à ajuster.
export const LOGIN_RATE_LIMIT = { limit: 10, windowSeconds: 15 * 60 } as const;

export type { RateLimiterPort, RateLimitDecision, RateLimitState } from "./rate-limiter-port";
