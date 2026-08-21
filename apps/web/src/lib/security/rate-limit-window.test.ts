import { describe, expect, it, vi } from "vitest";
import {
  PURGE_SAMPLE_RATE,
  decideFromCounter,
  failClosedDecision,
  failClosedState,
  isWindowExpired,
  retryAfterSeconds,
  shouldPurgeExpired,
  stateFromCounter,
  windowExpiresAtMs,
} from "./rate-limit-window";

// `./index` câble l'adaptateur Postgres, qui importe le client Prisma. On double
// la frontière base : ce fichier ne teste que des constantes et des fonctions
// pures, il n'a aucune raison d'ouvrir une connexion.
vi.mock("@eoda/database", () => ({ prisma: {}, Prisma: { sql: () => null, empty: null } }));

const { LOGIN_RATE_LIMIT, PASSWORD_CHANGE_RATE_LIMIT } = await import("./index");

// Arithmétique pure de la fenêtre : aucune base, aucune horloge réelle, `nowMs`
// toujours passé en argument (règle D7 — un test ne dépend pas de l'horloge).

const NOW = 1_700_000_000_000;
const POLICY = { limit: 3, windowSeconds: 60 };

describe("windowExpiresAtMs", () => {
  it("ouvre une fenêtre de la durée demandée à partir de maintenant", () => {
    expect(windowExpiresAtMs(NOW, 60)).toBe(NOW + 60_000);
    expect(windowExpiresAtMs(NOW, 15 * 60)).toBe(NOW + 900_000);
  });
});

describe("isWindowExpired", () => {
  it("considère échue une fenêtre dont l'instant de fin est atteint", () => {
    expect(isWindowExpired({ count: 9, expiresAtMs: NOW }, NOW)).toBe(true);
    expect(isWindowExpired({ count: 9, expiresAtMs: NOW - 1 }, NOW)).toBe(true);
  });

  it("considère ouverte une fenêtre qui court encore", () => {
    expect(isWindowExpired({ count: 1, expiresAtMs: NOW + 1 }, NOW)).toBe(false);
  });
});

describe("retryAfterSeconds", () => {
  it("arrondit au-dessus", () => {
    expect(retryAfterSeconds(NOW + 1_500, NOW)).toBe(2);
  });

  it("ne renvoie jamais 0 — « réessayez dans 0 seconde » est un message faux", () => {
    expect(retryAfterSeconds(NOW, NOW)).toBe(1);
    expect(retryAfterSeconds(NOW - 10_000, NOW)).toBe(1);
  });
});

describe("decideFromCounter", () => {
  it("autorise jusqu'à la limite incluse et décompte les tentatives restantes", () => {
    expect(decideFromCounter({ count: 1, expiresAtMs: NOW + 60_000 }, POLICY, NOW)).toEqual({
      allowed: true,
      remaining: 2,
      retryAfterSeconds: 0,
    });
    expect(decideFromCounter({ count: 3, expiresAtMs: NOW + 60_000 }, POLICY, NOW)).toEqual({
      allowed: true,
      remaining: 0,
      retryAfterSeconds: 0,
    });
  });

  it("refuse au-delà de la limite, avec un délai de réouverture", () => {
    const decision = decideFromCounter({ count: 4, expiresAtMs: NOW + 30_000 }, POLICY, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.remaining).toBe(0);
    expect(decision.retryAfterSeconds).toBe(30);
  });
});

describe("stateFromCounter", () => {
  it("n'est pas bloqué sans compteur", () => {
    expect(stateFromCounter(null, POLICY, NOW)).toEqual({ blocked: false, retryAfterSeconds: 0 });
  });

  it("n'est pas bloqué sous la limite", () => {
    expect(stateFromCounter({ count: 3, expiresAtMs: NOW + 60_000 }, POLICY, NOW).blocked).toBe(
      false
    );
  });

  it("est bloqué au-delà de la limite, fenêtre ouverte", () => {
    expect(stateFromCounter({ count: 4, expiresAtMs: NOW + 60_000 }, POLICY, NOW)).toEqual({
      blocked: true,
      retryAfterSeconds: 60,
    });
  });

  it("n'est plus bloqué quand la fenêtre est échue, même si le compteur dépasse", () => {
    // La ligne n'a simplement pas encore été purgée : elle ne doit pas bloquer.
    expect(stateFromCounter({ count: 99, expiresAtMs: NOW - 1 }, POLICY, NOW)).toEqual({
      blocked: false,
      retryAfterSeconds: 0,
    });
  });
});

describe("repli fail-closed", () => {
  it("refuse et annonce la fenêtre entière", () => {
    expect(failClosedDecision(POLICY)).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
    });
    expect(failClosedState(POLICY)).toEqual({ blocked: true, retryAfterSeconds: 60 });
  });
});

describe("shouldPurgeExpired", () => {
  it("ne purge que sur une petite fraction des écritures", () => {
    expect(shouldPurgeExpired(0)).toBe(true);
    expect(shouldPurgeExpired(PURGE_SAMPLE_RATE)).toBe(false);
    expect(shouldPurgeExpired(0.9)).toBe(false);
  });
});

describe("politiques en vigueur", () => {
  // Verrou de non-régression : la bascule vers le compteur partagé ne devait
  // RIEN changer aux quotas. Si quelqu'un les modifie, il le fait sciemment.
  it("conserve 10 tentatives / 15 min sur la connexion", () => {
    expect(LOGIN_RATE_LIMIT).toEqual({ limit: 10, windowSeconds: 900 });
  });

  it("conserve 5 tentatives / 15 min sur le changement de mot de passe", () => {
    expect(PASSWORD_CHANGE_RATE_LIMIT).toEqual({ limit: 5, windowSeconds: 900 });
  });
});
