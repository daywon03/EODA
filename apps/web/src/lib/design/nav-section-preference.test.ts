import { describe, expect, it } from "vitest";
import {
  NAV_SECTION_STORAGE_KEY,
  parseNavSectionPreference,
  preferenceFor,
  readNavSectionPreference,
  withSectionPreference,
  writeNavSectionPreference,
} from "./nav-section-preference";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  };
}

const failing = () => {
  throw new Error("SecurityError");
};

describe("préférence de section de navigation", () => {
  it("relit ce qu'elle a écrit", () => {
    const storage = memoryStorage();
    writeNavSectionPreference(() => storage, { reglages: true });
    expect(storage.data.get(NAV_SECTION_STORAGE_KEY)).toBe('{"reglages":true}');
    expect(readNavSectionPreference(() => storage)).toEqual({ reglages: true });
  });

  it("une seule section change, les autres restent", () => {
    const before = { reglages: false, commercial: false };
    expect(withSectionPreference(before, "reglages", true)).toEqual({ reglages: true, commercial: false });
    expect(before).toEqual({ reglages: false, commercial: false });
  });

  it("« jamais rien dit » n'est pas « refermée »", () => {
    // La distinction porte la règle d'ouverture : sans choix mémorisé, une section
    // repliable s'ouvre d'elle-même sur la page courante (isSectionOpen).
    expect(preferenceFor({}, "reglages")).toBeNull();
    expect(preferenceFor({ reglages: false }, "reglages")).toBe(false);
    expect(preferenceFor({ reglages: true }, "reglages")).toBe(true);
    // Un identifiant de section hérité d'une version antérieure ne déborde pas.
    expect(preferenceFor({ autrefois: true }, "reglages")).toBeNull();
  });

  it("ce que le navigateur rend n'est jamais cru sur parole", () => {
    expect(parseNavSectionPreference(null)).toEqual({});
    expect(parseNavSectionPreference("")).toEqual({});
    expect(parseNavSectionPreference("pas du json")).toEqual({});
    expect(parseNavSectionPreference("[true]")).toEqual({});
    expect(parseNavSectionPreference('"reglages"')).toEqual({});
    expect(parseNavSectionPreference("null")).toEqual({});
    // Seuls les booléens sont gardés : une valeur d'un autre type est ignorée, pas
    // convertie (une chaîne "false" ferait une section ouverte par accident).
    expect(parseNavSectionPreference('{"reglages":true,"commercial":"false","x":1}')).toEqual({ reglages: true });
  });

  it("stockage refusé : ni plantage en lecture, ni en écriture", () => {
    expect(readNavSectionPreference(failing)).toEqual({});
    expect(() => writeNavSectionPreference(failing, { reglages: true })).not.toThrow();
  });

  it("une clé posée à la main avec autre chose qu'un objet ne casse pas la barre", () => {
    const storage = memoryStorage({ [NAV_SECTION_STORAGE_KEY]: "[]" });
    expect(readNavSectionPreference(() => storage)).toEqual({});
  });
});
