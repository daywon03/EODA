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

// Second compteur, sur l'IP SEULE. LOGIN_RATE_LIMIT ci-dessus est indexé sur le couple
// (IP, email) : il ferme le bourrage de mots de passe sur un compte donné, mais laisse
// passer le balayage — une même IP peut essayer 10 mots de passe sur contact@sad-a.fr,
// puis 10 sur contact@sad-b.fr, indéfiniment, sans jamais toucher un plafond. Or c'est
// l'attaque la plus probable ici : les adresses de nos comptes clients sont publiques
// (annuaire FINESS), et un mot de passe faible réutilisé sur un compte parmi cent suffit.
//
// Plafond volontairement large : une IP peut être le NAT d'une association entière, et
// une limite serrée deviendrait un déni de service sur toute la structure. 30 tentatives
// par quart d'heure restent hors d'atteinte d'un usage légitime (la session dure 8 h,
// personne ne se reconnecte trente fois dans la même heure) tout en ramenant un balayage
// à 120 essais par heure et par IP, soit un coût prohibitif.
export const LOGIN_IP_RATE_LIMIT: RateLimitPolicy = { limit: 30, windowSeconds: 15 * 60 };

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
