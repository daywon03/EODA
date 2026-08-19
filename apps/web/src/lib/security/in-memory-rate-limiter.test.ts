import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryRateLimiter } from "./in-memory-rate-limiter";
import { loginThrottleKey, clientIpFromHeaders } from "./login-throttle";

// Test de régression. Le défaut d'origine n'était pas dans ce compteur mais dans son
// point d'appel : la limitation vivait dans l'action serveur du formulaire, alors que
// POST /api/auth/callback/credentials est joignable directement — 12 tentatives en curl
// passaient sans être comptées. Le contrôle a été déplacé dans authorize().
// Ce que ces tests verrouillent : la mécanique de comptage, et surtout la dérivation de
// clé (IP + email), qui est ce qui empêche un blocage global d'un compte par un tiers.

const POLICY = { limit: 3, windowSeconds: 60 };

describe("InMemoryRateLimiter", () => {
  let limiter: InMemoryRateLimiter;
  let key: string;
  let counter = 0;

  beforeEach(() => {
    limiter = new InMemoryRateLimiter();
    // Clé distincte par test : le compteur vit sur globalThis pour survivre au
    // rechargement à chaud, donc il est partagé entre les cas de test.
    counter += 1;
    key = `test-${counter}`;
  });

  it("autorise jusqu'à la limite puis bloque", async () => {
    for (let attempt = 1; attempt <= POLICY.limit; attempt++) {
      const decision = await limiter.consume(key, POLICY);
      expect(decision.allowed, `tentative ${attempt}`).toBe(true);
    }

    const blocked = await limiter.consume(key, POLICY);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("décrémente le nombre de tentatives restantes", async () => {
    expect((await limiter.consume(key, POLICY)).remaining).toBe(2);
    expect((await limiter.consume(key, POLICY)).remaining).toBe(1);
    expect((await limiter.consume(key, POLICY)).remaining).toBe(0);
  });

  it("reste bloqué même pour une tentative par ailleurs valide", async () => {
    // C'est la propriété qui compte : après dépassement, on refuse AVANT de vérifier le
    // mot de passe. Vérifié aussi de bout en bout — le bon mot de passe est refusé.
    for (let i = 0; i < POLICY.limit + 1; i++) await limiter.consume(key, POLICY);
    expect((await limiter.consume(key, POLICY)).allowed).toBe(false);
  });

  it("cloisonne les compteurs par clé", async () => {
    for (let i = 0; i < POLICY.limit + 1; i++) await limiter.consume(key, POLICY);
    expect((await limiter.consume(`${key}-autre`, POLICY)).allowed).toBe(true);
  });

  it("peek ne consomme pas de tentative", async () => {
    await limiter.consume(key, POLICY);

    for (let i = 0; i < 5; i++) {
      const state = await limiter.peek(key, POLICY);
      expect(state.blocked).toBe(false);
    }

    // Deux tentatives restantes : si peek avait consommé, celles-ci échoueraient.
    expect((await limiter.consume(key, POLICY)).allowed).toBe(true);
    expect((await limiter.consume(key, POLICY)).allowed).toBe(true);
  });

  it("peek signale le blocage après dépassement", async () => {
    for (let i = 0; i < POLICY.limit + 1; i++) await limiter.consume(key, POLICY);
    const state = await limiter.peek(key, POLICY);
    expect(state.blocked).toBe(true);
    expect(state.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("peek renvoie non bloqué sur une clé inconnue", async () => {
    expect(await limiter.peek("clé-jamais-vue", POLICY)).toEqual({
      blocked: false,
      retryAfterSeconds: 0,
    });
  });

  it("reset libère la clé après une authentification réussie", async () => {
    for (let i = 0; i < POLICY.limit + 1; i++) await limiter.consume(key, POLICY);
    expect((await limiter.consume(key, POLICY)).allowed).toBe(false);

    await limiter.reset(key);
    expect((await limiter.consume(key, POLICY)).allowed).toBe(true);
  });

  it("repart à zéro une fois la fenêtre expirée", async () => {
    const shortWindow = { limit: 1, windowSeconds: 0 };
    await limiter.consume(key, shortWindow);
    // Fenêtre de 0 seconde : l'entrée est déjà expirée au deuxième appel.
    expect((await limiter.consume(key, shortWindow)).allowed).toBe(true);
  });
});

describe("dérivation de la clé de limitation", () => {
  it("indexe sur le couple IP + email, pas sur l'email seul", () => {
    // Sinon un tiers bloque le compte de n'importe qui en épuisant le quota : un déni
    // de service sur un compte nominatif. Vérifié de bout en bout : une IP non
    // pénalisée se connecte normalement pendant qu'une autre est bloquée.
    const a = loginThrottleKey("203.0.113.1", "sandrine@exemple.fr");
    const b = loginThrottleKey("198.51.100.2", "sandrine@exemple.fr");
    expect(a).not.toBe(b);
  });

  it("normalise l'email pour qu'une variation de casse ne réinitialise pas le compteur", () => {
    expect(loginThrottleKey("203.0.113.1", "Sandrine@Exemple.FR ")).toBe(
      loginThrottleKey("203.0.113.1", "sandrine@exemple.fr")
    );
  });

  it("prend la première adresse de x-forwarded-for, celle du client réel", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1, 10.0.0.2" });
    expect(clientIpFromHeaders(headers)).toBe("203.0.113.9");
  });

  it("retombe sur x-real-ip puis sur une valeur explicite", () => {
    expect(clientIpFromHeaders(new Headers({ "x-real-ip": "203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIpFromHeaders(new Headers())).toBe("ip-inconnue");
  });
});
