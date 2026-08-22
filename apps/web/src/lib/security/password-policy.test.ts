import { describe, expect, it } from "vitest";
import {
  MAX_PASSWORD_BYTES,
  MIN_PASSWORD_LENGTH,
  validateNewPassword,
} from "./password-policy";

// Valeurs de test volontairement lisibles et à faible entropie : une chaîne
// d'apparence aléatoire ici déclenche le détecteur de secrets en pre-commit,
// et une allowlist qui grossit finit par masquer une vraie fuite.
//
// Le marqueur `not-a-real-secret` est en ANGLAIS et ce n'est pas un oubli. Les
// analyseurs de secrets reconnaissent les valeurs factices sur une liste de mots
// anglais (example, dummy, placeholder, not-a-real-secret…) : nos anciens libellés
// français, parfaitement explicites pour un humain, ne disaient rien à la machine et
// ont fait remonter deux faux positifs sur la PR #1 du 22/08/2026.
//
// Ne pas « traduire » ces valeurs. La solution alternative — inscrire le fichier dans
// une liste d'exceptions du scanner — exempterait AUSSI le vrai secret qu'on y
// collerait un jour par accident.
const VALID = {
  currentPassword: "placeholder-ancien-not-a-real-secret",
  newPassword: "placeholder-nouveau-not-a-real-secret",
  confirmation: "placeholder-nouveau-not-a-real-secret",
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
    const multibyte = "é".repeat(40) + "placeholder-not-a-real-secret";
    const result = validateNewPassword({
      ...VALID,
      newPassword: multibyte,
      confirmation: multibyte,
    });
    expect(result.ok).toBe(false);
  });

  it("refuse une confirmation qui ne correspond pas", () => {
    const result = validateNewPassword({ ...VALID, confirmation: "placeholder-autre-not-a-real-secret" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("confirmation");
  });

  it("refuse de reconduire le mot de passe actuel", () => {
    const result = validateNewPassword({
      currentPassword: "placeholder-identique-not-a-real-secret",
      newPassword: "placeholder-identique-not-a-real-secret",
      confirmation: "placeholder-identique-not-a-real-secret",
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
