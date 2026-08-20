import { describe, expect, it } from "vitest";
import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  validateNewPassword,
} from "./password-policy";

// Valeurs de test volontairement lisibles et à faible entropie : une chaîne
// d'apparence aléatoire ici déclenche le détecteur de secrets en pre-commit,
// et une allowlist qui grossit finit par masquer une vraie fuite.
const VALID = {
  currentPassword: "ancien-mot-de-passe-de-test",
  newPassword: "phrase-de-passe-longue",
  confirmation: "phrase-de-passe-longue",
};

describe("validateNewPassword", () => {
  it("accepte une phrase de passe suffisamment longue et confirmée", () => {
    expect(validateNewPassword(VALID)).toEqual({ ok: true });
  });

  it("refuse un mot de passe trop court", () => {
    const result = validateNewPassword({
      ...VALID,
      newPassword: "court",
      confirmation: "court",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it("refuse un mot de passe dépassant la limite exploitable par bcrypt", () => {
    const tooLong = "a".repeat(MAX_PASSWORD_BYTES + 1);
    const result = validateNewPassword({ ...VALID, newPassword: tooLong, confirmation: tooLong });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(String(MAX_PASSWORD_BYTES));
  });

  it("compte des OCTETS et non des caractères pour la limite haute", () => {
    // 40 caractères, 120 octets en UTF-8 : accepté si l'on comptait des caractères.
    const multibyte = "é".repeat(40) + "phrase-de-passe";
    const result = validateNewPassword({
      ...VALID,
      newPassword: multibyte,
      confirmation: multibyte,
    });
    expect(result.ok).toBe(false);
  });

  it("refuse une confirmation qui ne correspond pas", () => {
    const result = validateNewPassword({ ...VALID, confirmation: "phrase-de-passe-autre" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("confirmation");
  });

  it("refuse de reconduire le mot de passe actuel", () => {
    const result = validateNewPassword({
      currentPassword: "phrase-de-passe-longue",
      newPassword: "phrase-de-passe-longue",
      confirmation: "phrase-de-passe-longue",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("différent");
  });

  it("accepte un mot de passe fait uniquement d'espaces significatifs (aucun trim)", () => {
    const withSpaces = "  phrase de passe  ";
    expect(
      validateNewPassword({ ...VALID, newPassword: withSpaces, confirmation: withSpaces })
    ).toEqual({ ok: true });
  });
});
