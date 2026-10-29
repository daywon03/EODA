import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decidePinAttempt, hashPin, MAX_PIN_FAILURES, pinFormatError, pinMatches, unlockedPinState } from "./tablet-pin";
import { createTabletSessionToken, readTabletSessionToken, tabletSessionExpiry } from "./tablet-session";

const NOW = new Date("2026-10-14T10:00:00Z");
const SECRET = "s".repeat(32);

describe("code tablette", () => {
  it("exige 6 chiffres et refuse les suites évidentes", () => {
    expect(pinFormatError("12345")).toContain("6 chiffres");
    expect(pinFormatError("12a456")).toContain("6 chiffres");
    expect(pinFormatError("000000")).toContain("même chiffre");
    expect(pinFormatError("123456")).toContain("suite");
    expect(pinFormatError("987654")).toContain("suite");
    expect(pinFormatError("284719")).toBeNull();
  });

  it("ne stocke qu'une empreinte salée, vérifiée en temps constant", async () => {
    const hash = await hashPin("284719");
    expect(hash).not.toContain("284719");
    expect(hash).not.toBe(await hashPin("284719"));
    expect(await pinMatches(hash, "284719")).toBe(true);
    expect(await pinMatches(hash, "284710")).toBe(false);
    expect(await pinMatches(hash, "abc")).toBe(false);
    expect(await pinMatches("bcrypt$x$y", "284719")).toBe(false);
  });

  it("bloque au 5e échec, reste bloqué même avec le bon code, se débloque par la direction", () => {
    let state = unlockedPinState();
    for (let i = 1; i < MAX_PIN_FAILURES; i++) {
      const attempt = decidePinAttempt(state, false, NOW);
      expect(attempt.outcome).toBe("REJECTED");
      if (attempt.outcome === "REJECTED") expect(attempt.remaining).toBe(MAX_PIN_FAILURES - i);
      state = attempt.next;
    }
    const fifth = decidePinAttempt(state, false, NOW);
    expect(fifth).toEqual({ outcome: "LOCKED", next: { failedAttempts: 5, lockedAt: NOW } });
    expect(decidePinAttempt(fifth.next, true, NOW).outcome).toBe("LOCKED");
    expect(decidePinAttempt(unlockedPinState(), true, NOW)).toEqual({ outcome: "ACCEPTED", next: { failedAttempts: 0, lockedAt: null } });
  });

  it("remet le compteur à zéro après un code juste", () => {
    expect(decidePinAttempt({ failedAttempts: 3, lockedAt: null }, true, NOW).next.failedAttempts).toBe(0);
  });
});

describe("session tablette", () => {
  const claims = { staffMemberId: "staff-1", deviceEnrollmentId: "device-1", expiresAt: tabletSessionExpiry(NOW), pinStamp: "empreinte-du-code" };

  it("relit un jeton valide", () => {
    expect(readTabletSessionToken(createTabletSessionToken(claims, SECRET), SECRET, NOW)).toEqual(claims);
  });

  it("refuse un jeton absent, expiré, falsifié ou signé avec un autre secret", () => {
    const token = createTabletSessionToken(claims, SECRET);
    expect(readTabletSessionToken(undefined, SECRET, NOW)).toBeNull();
    expect(readTabletSessionToken(token, SECRET, new Date(claims.expiresAt))).toBeNull();
    expect(readTabletSessionToken(token, "autre".repeat(8), NOW)).toBeNull();
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload!, "base64url").toString()), staffMemberId: "x" })).toString("base64url");
    expect(readTabletSessionToken(`${forged}.${signature}`, SECRET, NOW)).toBeNull();
    expect(readTabletSessionToken("sans-point", SECRET, NOW)).toBeNull();
  });

  it("refuse une charge utile signée mais d'un autre type ou illisible", () => {
    const sign = (p: string) => createHmac("sha256", `${SECRET}:tablet-session`).update(p).digest("base64url");
    const otherType = Buffer.from(JSON.stringify({ t: "access", ...claims })).toString("base64url");
    expect(readTabletSessionToken(`${otherType}.${sign(otherType)}`, SECRET, NOW)).toBeNull();
    const garbage = Buffer.from("pas du json").toString("base64url");
    expect(readTabletSessionToken(`${garbage}.${sign(garbage)}`, SECRET, NOW)).toBeNull();
  });
});
