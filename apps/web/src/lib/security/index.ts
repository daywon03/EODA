import type { RateLimiterPort, RateLimitPolicy } from "./rate-limiter-port";
import { InMemoryRateLimiter } from "./in-memory-rate-limiter";
import { PostgresRateLimiter } from "./postgres-rate-limiter";
import { PrismaRateLimitCounterStore } from "./prisma-rate-limit-store";
import { isProductionRuntime, isServerlessRuntime } from "@/lib/config/env";

let cached: RateLimiterPort | null = null;

// Faut-il un compteur PARTAGÉ entre instances ?
//
// Oui dès que l'application ne tourne plus dans un processus unique et durable :
//   - hébergement serverless (Vercel) : chaque invocation peut atterrir sur une
//     autre instance et un démarrage à froid remet le compteur mémoire à zéro, ce
//     qui multiplie le quota effectif par le nombre d'instances ;
//   - production en général : même une exécution longue peut être répliquée, et
//     se tromper dans ce sens ne coûte qu'un aller-retour base par tentative.
//
// Non en développement et dans les tests : le compteur mémoire y est plus rapide,
// ne demande aucune base, et l'écart de comportement est nul du point de vue de
// l'appelant — c'est précisément ce que le port garantit.
export function shouldUseSharedRateLimiter(): boolean {
  return isServerlessRuntime() || isProductionRuntime();
}

// Sélectionne l'implémentation derrière `RateLimiterPort`. Les appelants
// (login-throttle, attempt-throttle) ne savent pas laquelle ils utilisent — c'est
// l'intérêt du port (cf. rate-limiter-port.ts).
export function getRateLimiter(): RateLimiterPort {
  if (cached) return cached;
  cached = shouldUseSharedRateLimiter()
    ? new PostgresRateLimiter(new PrismaRateLimitCounterStore())
    : new InMemoryRateLimiter();
  return cached;
}

// Politique de limitation de l'authentification. Volontairement centralisée ici
// plutôt que dupliquée dans l'action de login : une seule valeur à ajuster.
export const LOGIN_RATE_LIMIT: RateLimitPolicy = { limit: 10, windowSeconds: 15 * 60 };

// Changement de mot de passe : plus strict que la connexion. L'action exige le mot
// de passe courant, donc elle est un oracle de vérification de mot de passe pour une
// session volée — 5 essais par quart d'heure suffisent à un utilisateur légitime et
// ferment le bourrage.
export const PASSWORD_CHANGE_RATE_LIMIT: RateLimitPolicy = { limit: 5, windowSeconds: 15 * 60 };

export type {
  RateLimiterPort,
  RateLimitDecision,
  RateLimitPolicy,
  RateLimitState,
} from "./rate-limiter-port";
