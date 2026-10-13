import { describe, expect, it } from "vitest";
import {
  decideOneTimeTokenState,
  generateOneTimeToken,
  hashOneTimeToken,
  isOneTimeTokenWellFormed,
  oneTimeTokenExpiry,
  oneTimeTokenMatches,
} from "./one-time-token";

// Socle partagé par le quiz et la confirmation d'adresse (tranche 11).
describe("jeton à usage unique", () => {
  it("256 bits base64url, bien formé, jamais deux fois le même", () => {
    const a = generateOneTimeToken();
    expect(isOneTimeTokenWellFormed(a)).toBe(true);
    expect(a).not.toBe(generateOneTimeToken());
    expect(isOneTimeTokenWellFormed("court")).toBe(false);
    expect(isOneTimeTokenWellFormed(null)).toBe(false);
  });

  it("l'empreinte correspond au seul jeton d'origine", () => {
    const token = generateOneTimeToken();
    const hash = hashOneTimeToken(token);
    expect(oneTimeTokenMatches(hash, token)).toBe(true);
    expect(oneTimeTokenMatches(hash, generateOneTimeToken())).toBe(false);
    expect(oneTimeTokenMatches("", token)).toBe(false);
  });

  it("usage unique et expiration", () => {
    const now = new Date("2026-10-13T10:00:00Z");
    const expiresAt = oneTimeTokenExpiry(now, 24);
    expect(expiresAt.toISOString()).toBe("2026-10-14T10:00:00.000Z");
    expect(decideOneTimeTokenState({ expiresAt, usedAt: null }, now)).toBe("VALID");
    expect(decideOneTimeTokenState({ expiresAt, usedAt: now }, now)).toBe("USED");
    expect(decideOneTimeTokenState({ expiresAt: now, usedAt: null }, now)).toBe("EXPIRED");
  });
});
