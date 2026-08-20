import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PAGE_SIZE_STEP,
  hasMore,
  nextPageSize,
  parsePageSize,
} from "./pagination-service";

// `taille` vient de la query string : entrée non fiable. Le plafond dur est la
// seule chose qui empêche `?taille=999999` de recharger la table entière — donc
// c'est lui qu'on teste en premier.
describe("parsePageSize", () => {
  it("retombe sur la taille par défaut sans paramètre", () => {
    expect(parsePageSize(undefined)).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize("")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("retombe sur la taille par défaut sur une valeur non entière, nulle ou négative", () => {
    expect(parsePageSize("abc")).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize("12.5")).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize("0")).toBe(DEFAULT_PAGE_SIZE);
    expect(parsePageSize("-40")).toBe(DEFAULT_PAGE_SIZE);
  });

  it("accepte une valeur valide et replafonne au maximum", () => {
    expect(parsePageSize("40")).toBe(40);
    expect(parsePageSize("999999")).toBe(MAX_PAGE_SIZE);
  });
});

describe("nextPageSize", () => {
  it("avance d'un palier sans jamais dépasser le plafond", () => {
    expect(nextPageSize(DEFAULT_PAGE_SIZE)).toBe(DEFAULT_PAGE_SIZE + PAGE_SIZE_STEP);
    expect(nextPageSize(MAX_PAGE_SIZE)).toBe(MAX_PAGE_SIZE);
    expect(nextPageSize(MAX_PAGE_SIZE - 1)).toBe(MAX_PAGE_SIZE);
  });
});

describe("hasMore", () => {
  it("propose la suite tant qu'il reste des lignes sous le plafond", () => {
    expect(hasMore(20, 45, 20)).toBe(true);
  });

  it("ne propose rien quand tout est affiché", () => {
    expect(hasMore(20, 20, 20)).toBe(false);
  });

  it("ne propose rien une fois le plafond atteint, même s'il reste des lignes", () => {
    expect(hasMore(MAX_PAGE_SIZE, MAX_PAGE_SIZE + 50, MAX_PAGE_SIZE)).toBe(false);
  });
});
