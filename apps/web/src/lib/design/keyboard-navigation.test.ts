import { describe, expect, it } from "vitest";
import { FOCUSABLE_SELECTOR, focusTrapTarget, nextTabIndex } from "./keyboard-navigation";
import { clampPercent } from "./progress";

describe("nextTabIndex (onglets)", () => {
  it("flèche droite avance et boucle à la fin", () => {
    expect(nextTabIndex(0, "ArrowRight", 3)).toBe(1);
    expect(nextTabIndex(2, "ArrowRight", 3)).toBe(0);
  });

  it("flèche gauche recule et boucle au début", () => {
    expect(nextTabIndex(1, "ArrowLeft", 3)).toBe(0);
    expect(nextTabIndex(0, "ArrowLeft", 3)).toBe(2);
  });

  it("Début et Fin vont aux extrémités", () => {
    expect(nextTabIndex(1, "Home", 4)).toBe(0);
    expect(nextTabIndex(1, "End", 4)).toBe(3);
  });

  it("ignore les autres touches et une liste vide", () => {
    expect(nextTabIndex(0, "Enter", 3)).toBeNull();
    expect(nextTabIndex(0, "ArrowDown", 3)).toBeNull();
    expect(nextTabIndex(0, "ArrowRight", 0)).toBeNull();
  });
});

describe("focusTrapTarget (fenêtre modale)", () => {
  it("Tab sur le dernier élément revient au premier", () => {
    expect(focusTrapTarget(2, 3, false)).toBe(0);
  });

  it("Maj+Tab sur le premier élément va au dernier", () => {
    expect(focusTrapTarget(0, 3, true)).toBe(2);
  });

  it("au milieu, laisse le navigateur faire", () => {
    expect(focusTrapTarget(1, 3, false)).toBeNull();
    expect(focusTrapTarget(1, 3, true)).toBeNull();
  });

  it("focus hors de la fenêtre : y revient par le bon bout", () => {
    expect(focusTrapTarget(-1, 3, false)).toBe(0);
    expect(focusTrapTarget(-1, 3, true)).toBe(2);
  });

  it("fenêtre sans élément focalisable : rien à faire", () => {
    expect(focusTrapTarget(-1, 0, false)).toBeNull();
  });

  it("le sélecteur exclut les éléments désactivés et tabindex=-1", () => {
    expect(FOCUSABLE_SELECTOR).toContain("button:not([disabled])");
    expect(FOCUSABLE_SELECTOR).toContain("[tabindex]:not([tabindex='-1'])");
  });
});

describe("clampPercent", () => {
  it("borne entre 0 et 100 et arrondit", () => {
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(33.4)).toBe(33);
  });

  it("rapporte à un maximum", () => {
    expect(clampPercent(12, 20)).toBe(60);
  });

  it("valeur ou maximum invalide : 0, jamais NaN", () => {
    expect(clampPercent(Number.NaN)).toBe(0);
    expect(clampPercent(5, 0)).toBe(0);
    expect(clampPercent(5, Number.POSITIVE_INFINITY)).toBe(0);
  });
});
