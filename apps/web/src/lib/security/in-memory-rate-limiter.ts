import type { RateLimiterPort, RateLimitDecision, RateLimitState } from "./rate-limiter-port";

// Compteur en mémoire du processus — fenêtre glissante simple.
//
// ⚠️ Limite assumée : le compteur n'est pas partagé entre instances. Sur un
// déploiement multi-instances, un attaquant réparti sur plusieurs instances
// dispose du quota multiplié par le nombre d'instances. C'est suffisant pour
// ralentir un bourrage d'identifiants depuis une source unique (le cas réel visé
// ici, sur un déploiement mono-instance), et remplaçable par un adaptateur Redis
// sans toucher les appelants — c'est l'intérêt du port.
//
// Le state vit sur globalThis pour survivre au rechargement à chaud de Next.js en
// développement (sinon chaque édition de fichier remet les compteurs à zéro).

type Bucket = { count: number; expiresAtMs: number };

const globalForRateLimiter = globalThis as unknown as {
  eodaRateLimitBuckets?: Map<string, Bucket>;
};

const buckets: Map<string, Bucket> =
  globalForRateLimiter.eodaRateLimitBuckets ?? new Map<string, Bucket>();
globalForRateLimiter.eodaRateLimitBuckets = buckets;

// Purge des entrées expirées — évite une croissance non bornée de la Map sur un
// processus long. Déclenchée à l'écriture plutôt que sur un timer, pour ne pas
// garder un handle actif qui empêcherait l'arrêt du processus.
const MAX_TRACKED_KEYS = 10_000;

function purgeExpired(nowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.expiresAtMs <= nowMs) buckets.delete(key);
  }
}

export class InMemoryRateLimiter implements RateLimiterPort {
  async consume(
    key: string,
    options: { limit: number; windowSeconds: number }
  ): Promise<RateLimitDecision> {
    const { limit, windowSeconds } = options;
    const nowMs = Date.now();

    if (buckets.size > MAX_TRACKED_KEYS) purgeExpired(nowMs);

    const existing = buckets.get(key);

    if (!existing || existing.expiresAtMs <= nowMs) {
      buckets.set(key, { count: 1, expiresAtMs: nowMs + windowSeconds * 1000 });
      return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
    }

    existing.count += 1;

    if (existing.count > limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAtMs - nowMs) / 1000)),
      };
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - existing.count),
      retryAfterSeconds: 0,
    };
  }

  async peek(
    key: string,
    options: { limit: number; windowSeconds: number }
  ): Promise<RateLimitState> {
    const nowMs = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.expiresAtMs <= nowMs) {
      return { blocked: false, retryAfterSeconds: 0 };
    }

    return {
      blocked: existing.count > options.limit,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.expiresAtMs - nowMs) / 1000)),
    };
  }

  async reset(key: string): Promise<void> {
    buckets.delete(key);
  }
}
