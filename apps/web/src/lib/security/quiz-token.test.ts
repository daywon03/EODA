import { describe, expect, it } from "vitest";
import {
  decideInvitationState,
  generateQuizToken,
  hashQuizToken,
  isQuizTokenWellFormed,
  QUIZ_INVITATION_TTL_HOURS,
  quizInvitationExpiry,
  quizTokenHashesMatch,
} from "./quiz-token";

describe("jeton d'invitation au quiz", () => {
  it("est aléatoire, bien formé et différent à chaque tirage", () => {
    const a = generateQuizToken();
    const b = generateQuizToken();
    expect(isQuizTokenWellFormed(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("refuse un format inattendu avant toute lecture", () => {
    expect(isQuizTokenWellFormed("court")).toBe(false);
    expect(isQuizTokenWellFormed(`${"a".repeat(42)}/`)).toBe(false);
    expect(isQuizTokenWellFormed(undefined)).toBe(false);
  });

  it("ne stocke que l'empreinte, comparée en temps constant", () => {
    const token = generateQuizToken();
    const stored = hashQuizToken(token);
    expect(stored).not.toContain(token);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(quizTokenHashesMatch(stored, token)).toBe(true);
    expect(quizTokenHashesMatch(stored, generateQuizToken())).toBe(false);
    // Mauvaise empreinte (longueur différente) : refus, jamais d'exception.
    expect(quizTokenHashesMatch("abcd", token)).toBe(false);
    expect(quizTokenHashesMatch("", token)).toBe(false);
  });

  it("expire après une durée courte", () => {
    const now = new Date("2026-10-13T08:00:00Z");
    expect(quizInvitationExpiry(now).getTime() - now.getTime()).toBe(QUIZ_INVITATION_TTL_HOURS * 3600 * 1000);
  });

  it("valide, expiré ou déjà utilisé", () => {
    const now = new Date("2026-10-13T08:00:00Z");
    const later = new Date("2026-10-14T08:00:00Z");
    const earlier = new Date("2026-10-12T08:00:00Z");
    expect(decideInvitationState({ expiresAt: later, usedAt: null }, now)).toBe("VALID");
    expect(decideInvitationState({ expiresAt: earlier, usedAt: null }, now)).toBe("EXPIRED");
    expect(decideInvitationState({ expiresAt: now, usedAt: null }, now)).toBe("EXPIRED");
    expect(decideInvitationState({ expiresAt: later, usedAt: earlier }, now)).toBe("USED");
  });
});
