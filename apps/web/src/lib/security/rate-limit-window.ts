import type { RateLimitDecision, RateLimitPolicy, RateLimitState } from "./rate-limiter-port";

// ─────────────────────────────────────────────────────────────────────────────
// ARITHMÉTIQUE DE LA FENÊTRE DE LIMITATION — module PUR
//
// Aucune dépendance à la base ni à l'horloge : `nowMs` est toujours un argument.
// C'est ce qui rend ces règles testables sans base et sans faux timers, et c'est
// pour ça qu'elles ne vivent pas dans l'adaptateur Postgres.
//
// ── CHOIX : FENÊTRE FIXE ANCRÉE SUR LA PREMIÈRE TENTATIVE ────────────────────
// On garde EXACTEMENT la sémantique du compteur mémoire existant : la première
// tentative ouvre une fenêtre de `windowSeconds`, les suivantes s'y ajoutent, et
// la fenêtre se referme d'un bloc à son expiration (le compteur repart à 1).
//
// Pourquoi pas une vraie fenêtre glissante (journal des horodatages) : elle exige
// de conserver une ligne PAR TENTATIVE et de la compter à chaque appel, soit une
// table qui grossit avec le trafic d'attaque — exactement ce qu'un attaquant
// cherche — et un `COUNT(*)` sur chaque connexion. La fenêtre fixe tient en UNE
// ligne par clé et UNE instruction atomique. Son défaut connu est le doublement
// de quota à la charnière (jusqu'à 2×limit à cheval sur deux fenêtres) ; sur un
// garde-fou anti-force-brute réglé à 10 essais / 15 min, 20 essais dans le pire
// cas restent très loin de rendre le bourrage praticable.
//
// La politique elle-même (10 / 15 min pour la connexion, 5 / 15 min pour le
// changement de mot de passe) est inchangée — cf. `index.ts`.
// ─────────────────────────────────────────────────────────────────────────────

// État d'un compteur tel que la base le renvoie, ramené à des types primitifs :
// le module pur ne connaît ni `Date` de Prisma ni forme de ligne SQL.
export type RateLimitCounter = {
  count: number;
  expiresAtMs: number;
};

// Fin de la fenêtre ouverte maintenant.
export function windowExpiresAtMs(nowMs: number, windowSeconds: number): number {
  return nowMs + windowSeconds * 1000;
}

// Une fenêtre échue ne compte plus : le prochain appel en rouvre une neuve.
export function isWindowExpired(counter: RateLimitCounter, nowMs: number): boolean {
  return counter.expiresAtMs <= nowMs;
}

// Toujours au moins 1 : annoncer « réessayez dans 0 seconde » à un utilisateur
// bloqué est un message faux, et une invitation à boucler immédiatement.
export function retryAfterSeconds(expiresAtMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil((expiresAtMs - nowMs) / 1000));
}

// Décision à partir du compteur RÉSULTANT de la tentative (post-incrément), tel
// que l'instruction d'upsert le renvoie. `count > limit` et non `>=` : la
// tentative n° `limit` est la dernière autorisée.
export function decideFromCounter(
  counter: RateLimitCounter,
  policy: RateLimitPolicy,
  nowMs: number
): RateLimitDecision {
  if (counter.count > policy.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: retryAfterSeconds(counter.expiresAtMs, nowMs),
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, policy.limit - counter.count),
    retryAfterSeconds: 0,
  };
}

// Lecture sans consommation. Une fenêtre échue vaut « pas bloqué » même si le
// compteur stocké dépasse la limite : la ligne n'a simplement pas encore été
// purgée.
export function stateFromCounter(
  counter: RateLimitCounter | null,
  policy: RateLimitPolicy,
  nowMs: number
): RateLimitState {
  if (!counter || isWindowExpired(counter, nowMs)) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  if (counter.count <= policy.limit) {
    return { blocked: false, retryAfterSeconds: 0 };
  }

  return { blocked: true, retryAfterSeconds: retryAfterSeconds(counter.expiresAtMs, nowMs) };
}

// ── FAIL-CLOSED ──────────────────────────────────────────────────────────────
// Base injoignable ⇒ la tentative est REFUSÉE, jamais laissée passer.
//
// Le raisonnement, écrit ici pour qu'il ne soit pas « corrigé » plus tard : un
// garde-fou anti-force-brute qui s'ouvre en panne offre à l'attaquant une
// stratégie évidente — saturer la base, puis bourrer les mots de passe sans
// aucun compteur. Une indisponibilité de connexion pendant une panne de base est
// de toute façon inévitable (l'authentification lit `users` juste après), donc
// s'ouvrir ne rendrait même pas le service : ça ne ferait que désarmer la garde.
//
// Le délai annoncé est la fenêtre entière : on ne connaît pas l'état réel du
// compteur, on ne peut donc pas promettre mieux.
export function failClosedDecision(policy: RateLimitPolicy): RateLimitDecision {
  return { allowed: false, remaining: 0, retryAfterSeconds: policy.windowSeconds };
}

export function failClosedState(policy: RateLimitPolicy): RateLimitState {
  return { blocked: true, retryAfterSeconds: policy.windowSeconds };
}

// ── PURGE OPPORTUNISTE ───────────────────────────────────────────────────────
// Les lignes échues ne servent plus à rien et la table ne doit pas croître sans
// borne. Pas de cron (l'énoncé l'exclut, et un cron est une pièce d'infra de plus
// à surveiller) : la purge est greffée sur l'instruction d'écriture elle-même, et
// n'est tirée qu'une fois sur cinquante en moyenne. Sur un volume de connexions
// réaliste, ça suffit très largement à évacuer les échues, pour un coût moyen
// négligeable (un balayage d'index `expires_at` toutes les 50 écritures).
export const PURGE_SAMPLE_RATE = 0.02;

// `sample` est injecté (jamais `Math.random()` lu ici) pour que la décision reste
// pure et testable.
export function shouldPurgeExpired(sample: number): boolean {
  return sample < PURGE_SAMPLE_RATE;
}
