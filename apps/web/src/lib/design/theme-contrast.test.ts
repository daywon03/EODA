import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AA_NORMAL_TEXT, contrastRatio, parseRgbChannels, relativeLuminance } from "./contrast";
import { mergeTokens, readCustomProperties, resolveToken, type TokenMap } from "./css-tokens";

describe("contrastRatio (WCAG 2.x)", () => {
  it("noir sur blanc = 21:1, une couleur sur elle-même = 1:1", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([128, 64, 32], [128, 64, 32])).toBe(1);
  });

  it("est symétrique", () => {
    expect(contrastRatio([62, 44, 38], [250, 243, 235])).toBeCloseTo(
      contrastRatio([250, 243, 235], [62, 44, 38]),
      10
    );
  });

  it("valeur de référence : #777777 sur blanc ≈ 4.48:1 (juste sous AA)", () => {
    expect(contrastRatio([119, 119, 119], [255, 255, 255])).toBeCloseTo(4.48, 2);
  });

  it("luminance relative : blanc 1, noir 0, branche linéaire des canaux très sombres", () => {
    expect(relativeLuminance([255, 255, 255])).toBeCloseTo(1, 10);
    expect(relativeLuminance([0, 0, 0])).toBe(0);
    expect(relativeLuminance([5, 5, 5])).toBeCloseTo(5 / 255 / 12.92, 10);
  });
});

describe("parseRgbChannels", () => {
  it("lit le format des variables de charte", () => {
    expect(parseRgbChannels(" 62 44 38 ")).toEqual([62, 44, 38]);
  });

  it.each(["#3E2C26", "62 44", "62 44 38 1", "62 44 300", "a b c"])("refuse « %s »", (value) => {
    expect(() => parseRgbChannels(value)).toThrow();
  });
});

describe("css-tokens", () => {
  const css = `
    /* --ignored: 1 2 3; */
    :root { --a: 1 2 3; --b: var(--a); }
    :root[data-theme="dark"] { --a: 9 9 9; }
    :root[data-theme="dark"] { color-scheme: dark; --c: var(--c); }
  `;

  it("lit les variables d'un sélecteur exact, commentaires exclus", () => {
    expect(readCustomProperties(css, ":root")).toEqual({ a: "1 2 3", b: "var(--a)" });
  });

  it("fusionne plusieurs blocs du même sélecteur", () => {
    expect(readCustomProperties(css, ':root[data-theme="dark"]')).toEqual({ a: "9 9 9", c: "var(--c)" });
  });

  it("résout un alias contre les valeurs finales du thème", () => {
    const dark = mergeTokens(readCustomProperties(css, ":root"), readCustomProperties(css, ':root[data-theme="dark"]'));
    expect(resolveToken(dark, "b")).toBe("9 9 9");
  });

  it("refuse une variable absente et une référence circulaire", () => {
    const tokens: TokenMap = { c: "var(--c)" };
    expect(() => resolveToken(tokens, "absent")).toThrow(/introuvable/);
    expect(() => resolveToken(tokens, "c")).toThrow(/circulaire/);
  });
});

// ── Règle zéro : les paires réelles de globals.css ────────────────────────────
const GLOBALS = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");
const LIGHT = readCustomProperties(GLOBALS, ":root");
const DARK_EXPLICIT = readCustomProperties(GLOBALS, ':root[data-theme="dark"]');
const DARK_SYSTEM = readCustomProperties(GLOBALS, ':root:not([data-theme="light"])');

const THEMES: [string, TokenMap][] = [
  ["clair", LIGHT],
  ["sombre", mergeTokens(LIGHT, DARK_EXPLICIT)],
];

// Paires de TEXTE : premier plan, fond. Toutes doivent tenir 4.5:1 (texte normal).
const TEXT_PAIRS: [string, string][] = [
  ["ink", "paper"],
  ["ink", "card"],
  ["ink", "soft"],
  ["ink2", "card"],
  ["ink2", "paper"],
  ["accent-text", "paper"],
  ["accent-text", "card"],
  ["accent-text", "soft"],
  ["danger-text", "card"],
  ["danger-text", "paper"],
  ["ok-text", "card"],
  ["ok-text", "ok-soft"],
  ["on-accent", "accent-fill"],
  ["on-accent", "danger-fill"],
  // Bouton secondaire.
  ["soft", "ink2"],
  ["on-ink", "ink-fill"],
  // Pastilles de statut : texte encre sur aplat ambre ou vert.
  ["ink", "amber-fill"],
  ["ink", "green-fill"],
];

describe("globals.css — contrastes des tokens de rôle", () => {
  it("les deux voies du sombre (système et choix explicite) déclarent les mêmes valeurs", () => {
    expect(DARK_SYSTEM).toEqual(DARK_EXPLICIT);
  });

  for (const [themeName, tokens] of THEMES) {
    it.each(TEXT_PAIRS)(`${themeName} : --%s sur --%s ≥ 4.5:1`, (fg, bg) => {
      const ratio = contrastRatio(
        parseRgbChannels(resolveToken(tokens, fg)),
        parseRgbChannels(resolveToken(tokens, bg))
      );
      expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
  }

  it("le sombre sépare le fond doux de la carte (ivoire ≠ surface)", () => {
    const dark = mergeTokens(LIGHT, DARK_EXPLICIT);
    expect(resolveToken(dark, "soft")).not.toBe(resolveToken(dark, "card"));
    expect(resolveToken(dark, "paper")).not.toBe(resolveToken(dark, "card"));
  });

  it("les couleurs de cotation HAS ne sont pas des variables de thème", () => {
    expect(Object.keys(LIGHT).some((k) => k.startsWith("cot-"))).toBe(false);
  });
});
