import type { RateLimiterPort, RateLimitDecision, RateLimitPolicy, RateLimitState } from "./rate-limiter-port";
import {
  decideFromCounter,
  failClosedDecision,
  failClosedState,
  shouldPurgeExpired,
  stateFromCounter,
  windowExpiresAtMs,
  type RateLimitCounter,
} from "./rate-limit-window";

// ─────────────────────────────────────────────────────────────────────────────
// COMPTEUR DE LIMITATION PARTAGÉ (adossé à Postgres)
//
// Pourquoi il existe : l'adaptateur mémoire (`in-memory-rate-limiter.ts`) garde
// sa fenêtre dans une Map du processus. Sur un hébergement *serverless* (Vercel),
// chaque invocation peut tomber sur une instance différente et un démarrage à
// froid remet la Map à zéro : le quota effectif contre la force brute est
// multiplié par le nombre d'instances, et la protection devient largement
// fictive. Le compteur doit donc vivre là où toutes les instances le partagent —
// la base, la seule ressource déjà commune à toutes.
//
// L'adaptateur mémoire reste utilisé en développement et dans les tests : pas
// d'aller-retour réseau, pas de base à démarrer. Sélection dans `index.ts`.
//
// Ce fichier ne contient QUE de la décision. L'accès SQL est derrière
// `RateLimitCounterStore`, ce qui permet de tester les cas qui comptent (limite
// atteinte, fenêtre expirée, peek non consommant, panne de base) sans base
// réelle — et, accessoirement, de brancher Redis plus tard sans y toucher.
// ─────────────────────────────────────────────────────────────────────────────

export type IncrementInput = {
  key: string;
  nowMs: number;
  // Expiration à poser si la ligne est créée OU si la fenêtre trouvée est échue.
  windowExpiresAtMs: number;
  // Demande à l'implémentation d'évacuer au passage les lignes échues des AUTRES
  // clés. Tiré au sort par l'appelant (cf. shouldPurgeExpired).
  purgeExpired: boolean;
};

// Frontière de persistance. Les trois opérations sont volontairement minces : la
// logique de fenêtre vit dans `rate-limit-window.ts`, pas ici.
export interface RateLimitCounterStore {
  // DOIT être atomique : incrémente et renvoie le compteur résultant en UNE
  // instruction. Un read-then-write laisserait deux requêtes simultanées passer
  // sur le dernier créneau — c'est exactement la course que ce module ferme.
  incrementWithinWindow(input: IncrementInput): Promise<RateLimitCounter>;
  read(key: string): Promise<RateLimitCounter | null>;
  remove(key: string): Promise<void>;
}

export type PostgresRateLimiterOptions = {
  // Injectables pour les tests — jamais lus depuis l'horloge/le hasard global ici.
  now?: () => number;
  sample?: () => number;
};

export class PostgresRateLimiter implements RateLimiterPort {
  private readonly store: RateLimitCounterStore;
  private readonly now: () => number;
  private readonly sample: () => number;

  constructor(store: RateLimitCounterStore, options: PostgresRateLimiterOptions = {}) {
    this.store = store;
    this.now = options.now ?? (() => Date.now());
    this.sample = options.sample ?? (() => Math.random());
  }

  async consume(key: string, policy: RateLimitPolicy): Promise<RateLimitDecision> {
    const nowMs = this.now();

    try {
      const counter = await this.store.incrementWithinWindow({
        key,
        nowMs,
        windowExpiresAtMs: windowExpiresAtMs(nowMs, policy.windowSeconds),
        purgeExpired: shouldPurgeExpired(this.sample()),
      });

      return decideFromCounter(counter, policy, nowMs);
    } catch {
      // Fail-closed — justification complète dans rate-limit-window.ts.
      return failClosedDecision(policy);
    }
  }

  async peek(key: string, policy: RateLimitPolicy): Promise<RateLimitState> {
    const nowMs = this.now();

    try {
      // Lecture seule : aucune écriture, donc aucun créneau consommé. Le provider
      // d'authentification s'en sert pour composer un message précis sans fausser
      // le comptage.
      const counter = await this.store.read(key);
      return stateFromCounter(counter, policy, nowMs);
    } catch {
      return failClosedState(policy);
    }
  }

  async reset(key: string): Promise<void> {
    try {
      await this.store.remove(key);
    } catch {
      // Un effacement raté ne laisse qu'un compteur qui expirera de lui-même à la
      // fin de sa fenêtre. Refuser une authentification DÉJÀ RÉUSSIE pour ça
      // serait pénaliser l'utilisateur légitime sans rien protéger : ici, et ici
      // seulement, on absorbe l'erreur.
    }
  }
}
