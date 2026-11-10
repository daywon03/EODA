import { describe, expect, it } from "vitest";
import { parseBrandColors, readBrandColors, toDocxColor } from "./brand-color-service";

// E1 (call du 09/11/2026) : « stocke la charte couleur par client pour que quand il
// refait un document ça ressorte bien ». Deux couleurs saisies par le cabinet, en
// hexadécimal, validées côté serveur ; la principale colore les TITRES du document
// final, elle doit donc se lire sur le papier blanc.

describe("parseBrandColors — saisie du cabinet", () => {
  it("normalise #RRGGBB, RRGGBB et #RGB en #RRGGBB majuscules", () => {
    expect(parseBrandColors({ primary: "#1a4d8f", secondary: "e3a41c" })).toEqual({
      ok: true,
      colors: { primary: "#1A4D8F", secondary: "#E3A41C" },
    });
    expect(parseBrandColors({ primary: " #036 ", secondary: "" })).toEqual({ ok: true, colors: { primary: "#003366", secondary: null } });
  });

  it("deux champs vides effacent la charte (rendu EODA par défaut)", () => {
    expect(parseBrandColors({ primary: "", secondary: null })).toEqual({ ok: true, colors: { primary: null, secondary: null } });
  });

  it.each(["bleu", "#12345", "#GGGGGG", "rgb(0,0,0)", "#1234567"])("refuse une valeur qui n'est pas un hexadécimal (%s)", (value) => {
    expect(parseBrandColors({ primary: value, secondary: "" })).toEqual({ ok: false, error: expect.stringMatching(/hexadécimal/) });
  });

  it("refuse une couleur principale illisible sur le blanc (titres), en le disant", () => {
    const result = parseBrandColors({ primary: "#FFEE88", secondary: "" });
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/trop claire/) });
  });

  it("une secondaire sans principale est refusée : la secondaire accompagne la principale", () => {
    expect(parseBrandColors({ primary: "", secondary: "#E3A41C" })).toEqual({
      ok: false,
      error: expect.stringMatching(/couleur principale/),
    });
  });

  it("une entrée qui n'est pas du texte est refusée, jamais castée", () => {
    expect(parseBrandColors({ primary: 42, secondary: "" })).toEqual({ ok: false, error: expect.any(String) });
  });
});

describe("readBrandColors — lecture défensive de la base", () => {
  it("rend null sans couleur principale valide (rendu actuel inchangé)", () => {
    expect(readBrandColors({ brandPrimaryColor: null, brandSecondaryColor: "#E3A41C" })).toBeNull();
    expect(readBrandColors({ brandPrimaryColor: "pas une couleur", brandSecondaryColor: null })).toBeNull();
  });

  it("la secondaire retombe sur la principale quand elle manque", () => {
    expect(readBrandColors({ brandPrimaryColor: "#1A4D8F", brandSecondaryColor: null })).toEqual({ primary: "#1A4D8F", secondary: "#1A4D8F" });
  });
});

describe("toDocxColor", () => {
  it("retire le dièse (format attendu par Word)", () => {
    expect(toDocxColor("#1A4D8F")).toBe("1A4D8F");
  });
});
