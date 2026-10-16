import { describe, expect, it } from "vitest";
import {
  parseSelfServiceFormule,
  resolveSignupTenant,
  SELF_SERVICE_FORMULES,
  SELF_SERVICE_OFFERS,
  signupThrottleKeys,
  validateSignupInput,
} from "./self-service-service";

const VALID = {
  structureName: "SAD Les Glycines (fictif)",
  structureType: "ASSOCIATION",
  establishmentType: "SAD_AIDE",
  finessNumber: "99 00 00 017",
  formule: "ESSENTIEL",
  firstName: "Nadia (fictif)",
  email: "  Direction@Glycines.example.org ",
  password: "une phrase de passe longue",
};

describe("validateSignupInput — trois étapes revérifiées côté serveur", () => {
  it("accepte une inscription complète, normalise l'e-mail et le FINESS", () => {
    const result = validateSignupInput(VALID);
    expect(result).toEqual({
      ok: true,
      value: {
        structureName: "SAD Les Glycines (fictif)",
        structureType: "ASSOCIATION",
        establishmentType: "SAD_AIDE",
        finessNumber: "990000017",
        formule: "ESSENTIEL",
        firstName: "Nadia (fictif)",
        email: "direction@glycines.example.org",
        password: "une phrase de passe longue",
      },
    });
  });

  it("FINESS facultatif", () => {
    const result = validateSignupInput({ ...VALID, finessNumber: "" });
    expect(result.ok && result.value.finessNumber).toBeNull();
  });

  it.each([
    [{ structureName: " " }, "nom de votre structure"],
    [{ structureName: "x".repeat(201) }, "nom de votre structure"],
    [{ establishmentType: "EHPAD" }, "SAD Aide ou SAD Mixte"],
    [{ structureType: "AUTRE" }, "statut de la structure"],
    [{ finessNumber: "12345" }, "9 chiffres"],
    [{ formule: "BETA" }, "Choisissez une offre"],
    [{ formule: ["ESSENTIEL"] }, "Choisissez une offre"],
    [{ firstName: "" }, "prénom"],
    [{ email: "pas-une-adresse" }, "adresse e-mail"],
    [{ email: "a@b" }, "adresse e-mail"],
    [{ password: "court" }, "au moins 12"],
    [{ password: "é".repeat(40) }, "trop long"],
    [{ password: 123456789012 }, "au moins 12"],
  ])("refuse %o", (override, message) => {
    const result = validateSignupInput({ ...VALID, ...override });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  it("le bêta-test ne se choisit pas en ligne", () => {
    expect(SELF_SERVICE_FORMULES).toEqual(["ESSENTIEL", "PERFORMANCE", "EXCELLENCE"]);
    expect(SELF_SERVICE_OFFERS.EXCELLENCE.who).toBe("Avec EODA");
    expect(SELF_SERVICE_OFFERS.ESSENTIEL.who).toBe("Seul");
  });

  it("aucun texte d'offre ne nomme une personne ni n'invente un prix", () => {
    const all = JSON.stringify(SELF_SERVICE_OFFERS);
    expect(all).not.toMatch(/Sandrine/);
    expect(all).not.toMatch(/\d+\s?€/);
  });
});

describe("rattachement de l'inscription au cabinet", () => {
  it("un seul cabinet en base : celui-là ; zéro ou plusieurs : inscription fermée", () => {
    expect(resolveSignupTenant(["t1"])).toBe("t1");
    expect(resolveSignupTenant([])).toBeNull();
    expect(resolveSignupTenant(["t1", "t2"])).toBeNull();
  });
});

describe("limitation de débit", () => {
  it("deux compteurs : l'IP et l'adresse demandée (normalisée)", () => {
    expect(signupThrottleKeys("203.0.113.5", " A@Example.org ")).toEqual({
      ip: "signup:ip:203.0.113.5",
      email: "signup:email:a@example.org",
    });
  });
});

describe("offre demandée dans l'adresse", () => {
  it("valeur connue ou null, jamais castée", () => {
    expect(parseSelfServiceFormule("PERFORMANCE")).toBe("PERFORMANCE");
    expect(parseSelfServiceFormule("BETA")).toBeNull();
    expect(parseSelfServiceFormule(undefined)).toBeNull();
  });
});
