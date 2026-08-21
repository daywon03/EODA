import { beforeEach, describe, expect, it, vi } from "vitest";
import { PostgresRateLimiter, type IncrementInput, type RateLimitCounterStore } from "./postgres-rate-limiter";
import type { RateLimitCounter } from "./rate-limit-window";

// Décision de l'adaptateur partagé, frontière base DOUBLÉE.
//
// Ce qui est vérifié ici est exactement ce dont dépend la protection contre la
// force brute sur Vercel : sous la limite on passe, au-delà on refuse, une
// fenêtre échue rouvre, `peek` n'écrit jamais, et une base injoignable REFUSE.
//
// Ce qui n'est PAS vérifiable sans base réelle — l'atomicité du
// `INSERT … ON CONFLICT DO UPDATE … RETURNING` — est porté par PostgreSQL
// lui-même (verrou de ligne sur la ligne en conflit) et documenté dans
// prisma-rate-limit-store.ts. Le contrat que ce test verrouille côté application,
// c'est que la décision se prend sur le compteur RENVOYÉ par l'écriture, jamais
// sur une lecture préalable.

const POLICY = { limit: 3, windowSeconds: 60 };
const NOW = 1_700_000_000_000;

// Double de la frontière : une fenêtre fixe en mémoire, sans SQL. Il reproduit
// la sémantique attendue de l'instruction atomique (incrément, ou remise à 1 si
// la fenêtre trouvée est échue).
class FakeStore implements RateLimitCounterStore {
  rows = new Map<string, RateLimitCounter>();
  increments = 0;
  reads = 0;
  removals = 0;
  lastPurgeRequested: boolean | null = null;

  async incrementWithinWindow(input: IncrementInput): Promise<RateLimitCounter> {
    this.increments += 1;
    this.lastPurgeRequested = input.purgeExpired;

    if (input.purgeExpired) {
      for (const [key, row] of this.rows) {
        if (row.expiresAtMs <= input.nowMs && key !== input.key) this.rows.delete(key);
      }
    }

    const existing = this.rows.get(input.key);
    const next: RateLimitCounter =
      !existing || existing.expiresAtMs <= input.nowMs
        ? { count: 1, expiresAtMs: input.windowExpiresAtMs }
        : { count: existing.count + 1, expiresAtMs: existing.expiresAtMs };

    this.rows.set(input.key, next);
    return next;
  }

  async read(key: string): Promise<RateLimitCounter | null> {
    this.reads += 1;
    return this.rows.get(key) ?? null;
  }

  async remove(key: string): Promise<void> {
    this.removals += 1;
    this.rows.delete(key);
  }
}

// Frontière en panne : toute opération lève, comme une base injoignable.
class BrokenStore implements RateLimitCounterStore {
  async incrementWithinWindow(): Promise<RateLimitCounter> {
    throw new Error("connexion à la base refusée");
  }

  async read(): Promise<RateLimitCounter | null> {
    throw new Error("connexion à la base refusée");
  }

  async remove(): Promise<void> {
    throw new Error("connexion à la base refusée");
  }
}

describe("PostgresRateLimiter", () => {
  let store: FakeStore;
  let now: number;
  let limiter: PostgresRateLimiter;

  beforeEach(() => {
    store = new FakeStore();
    now = NOW;
    // Horloge et tirage au sort injectés : aucun test ne dépend du temps réel ni
    // du hasard (D7). `sample` à 1 ⇒ jamais de purge, sauf test dédié.
    limiter = new PostgresRateLimiter(store, { now: () => now, sample: () => 1 });
  });

  describe("limite non atteinte", () => {
    it("autorise et décompte les tentatives restantes", async () => {
      expect(await limiter.consume("k", POLICY)).toEqual({
        allowed: true,
        remaining: 2,
        retryAfterSeconds: 0,
      });
      expect(await limiter.consume("k", POLICY)).toEqual({
        allowed: true,
        remaining: 1,
        retryAfterSeconds: 0,
      });
      expect(await limiter.consume("k", POLICY)).toEqual({
        allowed: true,
        remaining: 0,
        retryAfterSeconds: 0,
      });
    });

    it("cloisonne les compteurs par clé", async () => {
      for (let i = 0; i < POLICY.limit + 1; i++) await limiter.consume("k", POLICY);
      expect((await limiter.consume("autre", POLICY)).allowed).toBe(true);
    });
  });

  describe("limite atteinte", () => {
    it("refuse la tentative suivante et annonce un délai", async () => {
      for (let i = 0; i < POLICY.limit; i++) await limiter.consume("k", POLICY);

      const refused = await limiter.consume("k", POLICY);
      expect(refused.allowed).toBe(false);
      expect(refused.remaining).toBe(0);
      expect(refused.retryAfterSeconds).toBe(60);
    });

    it("reste refusée tant que la fenêtre court", async () => {
      for (let i = 0; i < POLICY.limit + 1; i++) await limiter.consume("k", POLICY);

      now = NOW + 59_000;
      expect((await limiter.consume("k", POLICY)).allowed).toBe(false);
    });

    it("prend sa décision sur le compteur RENVOYÉ par l'écriture, sans lecture préalable", async () => {
      // Non-régression de la course : un read-then-write laisserait deux requêtes
      // simultanées passer sur le dernier créneau. `consume` ne doit jamais lire.
      await limiter.consume("k", POLICY);
      expect(store.reads).toBe(0);
      expect(store.increments).toBe(1);
    });
  });

  describe("fenêtre expirée", () => {
    it("rouvre une fenêtre neuve une fois le délai écoulé", async () => {
      for (let i = 0; i < POLICY.limit + 1; i++) await limiter.consume("k", POLICY);
      expect((await limiter.consume("k", POLICY)).allowed).toBe(false);

      now = NOW + 60_001;
      const afterWindow = await limiter.consume("k", POLICY);
      expect(afterWindow.allowed).toBe(true);
      expect(afterWindow.remaining).toBe(POLICY.limit - 1);
    });
  });

  describe("peek", () => {
    it("ne consomme aucune tentative", async () => {
      await limiter.consume("k", POLICY);

      for (let i = 0; i < 5; i++) {
        const state = await limiter.peek("k", POLICY);
        expect(state.blocked).toBe(false);
      }

      // Une seule écriture au total : celle du `consume`.
      expect(store.increments).toBe(1);
      expect(store.rows.get("k")?.count).toBe(1);
      // Le créneau consommé reste disponible pour de vraies tentatives.
      expect((await limiter.consume("k", POLICY)).remaining).toBe(1);
    });

    it("signale le blocage et le délai restant", async () => {
      for (let i = 0; i < POLICY.limit + 1; i++) await limiter.consume("k", POLICY);

      now = NOW + 30_000;
      expect(await limiter.peek("k", POLICY)).toEqual({ blocked: true, retryAfterSeconds: 30 });
    });

    it("ne bloque pas sur une clé inconnue", async () => {
      expect(await limiter.peek("jamais-vue", POLICY)).toEqual({
        blocked: false,
        retryAfterSeconds: 0,
      });
    });
  });

  describe("reset", () => {
    it("libère un compteur bloqué après une authentification réussie", async () => {
      for (let i = 0; i < POLICY.limit + 1; i++) await limiter.consume("k", POLICY);
      await limiter.reset("k");

      expect(store.removals).toBe(1);
      expect((await limiter.peek("k", POLICY)).blocked).toBe(false);
    });
  });

  describe("purge des lignes échues", () => {
    it("ne la demande pas sur une écriture ordinaire", async () => {
      await limiter.consume("k", POLICY);
      expect(store.lastPurgeRequested).toBe(false);
    });

    it("la demande sur l'écriture tirée au sort, et évacue les clés échues", async () => {
      const purging = new PostgresRateLimiter(store, { now: () => now, sample: () => 0 });
      store.rows.set("vieille", { count: 9, expiresAtMs: NOW - 1 });

      await purging.consume("k", POLICY);

      expect(store.lastPurgeRequested).toBe(true);
      expect(store.rows.has("vieille")).toBe(false);
    });
  });

  describe("panne de base", () => {
    const broken = new PostgresRateLimiter(new BrokenStore(), { now: () => NOW, sample: () => 1 });

    it("REFUSE la tentative — un garde-fou anti-force-brute ne s'ouvre pas en panne", async () => {
      expect(await broken.consume("k", POLICY)).toEqual({
        allowed: false,
        remaining: 0,
        retryAfterSeconds: POLICY.windowSeconds,
      });
    });

    it("annonce l'état bloqué en lecture aussi", async () => {
      expect(await broken.peek("k", POLICY)).toEqual({
        blocked: true,
        retryAfterSeconds: POLICY.windowSeconds,
      });
    });

    it("n'empêche pas une authentification déjà réussie de se terminer", async () => {
      // Seule exception au fail-closed : un `reset` raté ne laisse qu'un compteur
      // qui expirera seul. Le refuser pénaliserait l'utilisateur légitime.
      await expect(broken.reset("k")).resolves.toBeUndefined();
    });
  });

  describe("horloge et hasard par défaut", () => {
    it("utilise Date.now() et Math.random() quand rien n'est injecté", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.5);
      const defaults = new PostgresRateLimiter(store);

      const decision = await defaults.consume("defaut", POLICY);

      expect(decision.allowed).toBe(true);
      expect(store.lastPurgeRequested).toBe(false);
      vi.restoreAllMocks();
    });
  });
});
