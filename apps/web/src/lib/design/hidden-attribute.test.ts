import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findHiddenAttributeRules, hiddenAttributeWins } from "./hidden-attribute";

// ─────────────────────────────────────────────────────────────────────────────
// L'ATTRIBUT `hidden` MASQUE, MÊME SOUS UNE CLASSE D'AFFICHAGE.
//
// Ce que ce fichier empêche de revenir (constaté le 16/10/2026, groupe « Réglages »
// de la barre latérale cabinet) : `.flex` et le préflight de Tailwind ont la même
// spécificité (0,1,0) — le `:where()` annule celle de l'attribut — et `.flex` vient
// plus tard, donc il gagnait. Le chevron tournait, « 4 entrées masquées » s'affichait,
// et les quatre entrées restaient visibles et tabulables.
//
// Le contrôle porte sur globals.css LUI-MÊME : une table recopiée dans un test
// finirait par décrire un CSS que personne ne sert (même doctrine que
// theme-contrast.test.ts).
// ─────────────────────────────────────────────────────────────────────────────

describe("findHiddenAttributeRules", () => {
  it("lit les règles d'un sélecteur d'attribut, et ignore les autres", () => {
    const css = `
      .flex { display: flex; }
      [hidden] { display: none; }
    `;

    expect(findHiddenAttributeRules(css)).toEqual([
      { selector: "[hidden]", declarations: " display: none; " },
    ]);
  });

  it("ne lit pas une règle citée en commentaire", () => {
    const css = "/* [hidden]:where(:not([hidden=until-found])) { display: none !important; } */";

    expect(findHiddenAttributeRules(css)).toEqual([]);
    expect(hiddenAttributeWins(css)).toBe(false);
  });

  it("traverse un at-rule et écarte la règle d'un bloc sans accolades", () => {
    const css = `
      @layer base {
        [hidden] { display: none !important; }
      }
      @page { margin: 14mm; }
    `;

    expect(findHiddenAttributeRules(css).map((rule) => rule.selector)).toEqual(["[hidden]"]);
  });

  it("ignore la forme à valeur : `[hidden=until-found]` ne cible pas l'attribut présent", () => {
    expect(findHiddenAttributeRules("[hidden=until-found] { display: none; }")).toEqual([]);
  });
});

describe("hiddenAttributeWins", () => {
  it("vrai pour la règle de fond qui force `display: none !important`", () => {
    const css = '[hidden]:where(:not([hidden="until-found"])) { display: none !important; }';

    expect(hiddenAttributeWins(css)).toBe(true);
  });

  it("vrai quand l'espace avant `!important` est absent", () => {
    expect(hiddenAttributeWins('[hidden]:where(:not([hidden="until-found"])){display:none!important}')).toBe(true);
  });

  it("faux pour le préflight de Tailwind v3 : sans `!important`, `.flex` gagne", () => {
    // La règle exacte émise par Tailwind, et c'est ELLE le bug.
    expect(hiddenAttributeWins("[hidden]:where(:not([hidden=until-found])){display:none}")).toBe(false);
  });

  it("faux sans l'exception `until-found` : la recherche dans la page s'y appuie", () => {
    expect(hiddenAttributeWins("[hidden] { display: none !important; }")).toBe(false);
  });

  it("faux quand le `display` n'est pas `none`, ou pas marqué important", () => {
    expect(hiddenAttributeWins('[hidden]:not([hidden="until-found"]) { display: block !important; }')).toBe(false);
    expect(hiddenAttributeWins('[hidden]:not([hidden="until-found"]) { display: none; }')).toBe(false);
    expect(hiddenAttributeWins('[hidden]:not([hidden="until-found"]) { border: none; }')).toBe(false);
  });
});

// ── Règle zéro : la feuille réellement servie ─────────────────────────────────
const GLOBALS = readFileSync(path.resolve(__dirname, "../../app/globals.css"), "utf8");

describe("globals.css", () => {
  it("fait gagner l'attribut `hidden` sur toute classe d'affichage", () => {
    // Retirer le `!important` de cette règle rend `hidden={!isOpen}` décoratif — c'est
    // exactement la régression du 16/10/2026, et rien d'autre ne la verrait.
    expect(hiddenAttributeWins(GLOBALS)).toBe(true);
  });
});
