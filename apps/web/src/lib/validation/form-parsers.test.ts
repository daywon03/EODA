import { describe, expect, it } from "vitest";
import {
  firstError,
  optionalEnum,
  optionalInt,
  optionalString,
  isEnumValue,
  optionalDate,
  requiredDate,
  requiredEmail,
  requiredEnum,
  requiredInt,
  requiredString,
} from "./form-parsers";

const Statut = { NOUVEAU: "NOUVEAU", SIGNE: "SIGNE" } as const;

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.append(key, value);
  return data;
}

describe("requiredString", () => {
  it("nettoie les espaces et accepte une valeur", () => {
    expect(requiredString(form({ nom: "  ASSAD  " }), "nom", "Le nom")).toEqual({
      ok: true,
      value: "ASSAD",
    });
  });

  it("refuse une chaîne vide ou uniquement composée d'espaces", () => {
    expect(requiredString(form({ nom: "   " }), "nom", "Le nom").ok).toBe(false);
    expect(requiredString(form({}), "nom", "Le nom").ok).toBe(false);
  });

  it("refuse au-delà de la longueur maximale", () => {
    expect(requiredString(form({ nom: "a".repeat(11) }), "nom", "Le nom", 10).ok).toBe(false);
  });
});

describe("requiredEnum", () => {
  it("accepte une valeur de l'enum", () => {
    expect(requiredEnum(form({ s: "SIGNE" }), "s", "Le statut", Statut)).toEqual({
      ok: true,
      value: "SIGNE",
    });
  });

  it("refuse une valeur hors enum — c'est le cas qu'un cast TypeScript laissait passer jusqu'à Prisma", () => {
    expect(requiredEnum(form({ s: "ADMIN" }), "s", "Le statut", Statut).ok).toBe(false);
  });

  it("refuse une valeur absente", () => {
    expect(requiredEnum(form({}), "s", "Le statut", Statut).ok).toBe(false);
  });
});

describe("isEnumValue", () => {
  it("valide un argument d'action serveur", () => {
    expect(isEnumValue("SIGNE", Statut)).toBe(true);
    expect(isEnumValue("AUTRE", Statut)).toBe(false);
    expect(isEnumValue(undefined, Statut)).toBe(false);
    expect(isEnumValue(42, Statut)).toBe(false);
  });
});

describe("requiredInt", () => {
  it("refuse une valeur non numérique au lieu de produire NaN", () => {
    // Number("abc") vaut NaN et passait silencieusement jusqu'à Prisma.
    expect(requiredInt(form({ n: "abc" }), "n", "Le montant").ok).toBe(false);
  });

  it("refuse un décimal quand un entier est attendu", () => {
    expect(requiredInt(form({ n: "12.5" }), "n", "Le montant").ok).toBe(false);
  });

  it("applique les bornes min et max", () => {
    expect(requiredInt(form({ n: "0" }), "n", "Les échéances", { min: 1, max: 6 }).ok).toBe(false);
    expect(requiredInt(form({ n: "7" }), "n", "Les échéances", { min: 1, max: 6 }).ok).toBe(false);
    expect(requiredInt(form({ n: "3" }), "n", "Les échéances", { min: 1, max: 6 })).toEqual({
      ok: true,
      value: 3,
    });
  });

  it("utilise la valeur par défaut quand le champ est absent", () => {
    expect(requiredInt(form({}), "n", "L'acompte", { defaultValue: 30 })).toEqual({
      ok: true,
      value: 30,
    });
  });

  it("refuse un nombre négatif quand min vaut 0", () => {
    expect(requiredInt(form({ n: "-5" }), "n", "Le prix", { min: 0 }).ok).toBe(false);
  });
});

describe("requiredDate / optionalDate", () => {
  it("refuse une date invalide au lieu de créer un Invalid Date", () => {
    expect(requiredDate(form({ d: "pas-une-date" }), "d", "La date").ok).toBe(false);
    expect(optionalDate(form({ d: "2026-13-45" }), "d", "La date").ok).toBe(false);
  });

  it("accepte une date ISO", () => {
    const result = requiredDate(form({ d: "2027-01-15" }), "d", "La date");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.getUTCFullYear()).toBe(2027);
  });

  it("accepte l'absence de date en optionnel", () => {
    expect(optionalDate(form({}), "d", "La date")).toEqual({ ok: true, value: null });
  });
});

describe("requiredEmail", () => {
  it("normalise la casse — sans quoi deux comptes distincts peuvent coexister", () => {
    expect(requiredEmail(form({ e: "Julien.Chevalier@Exemple.FR" }), "e", "L'email")).toEqual({
      ok: true,
      value: "julien.chevalier@exemple.fr",
    });
  });

  it("refuse les formes invalides", () => {
    for (const invalid of ["sans-arobase", "deux@@x.fr", "a@b", "a b@x.fr", "@x.fr"]) {
      expect(requiredEmail(form({ e: invalid }), "e", "L'email").ok).toBe(false);
    }
  });
});

describe("firstError", () => {
  it("renvoie la première erreur rencontrée, dans l'ordre des champs", () => {
    const a = requiredString(form({}), "a", "Le champ A");
    const b = requiredString(form({}), "b", "Le champ B");
    expect(firstError(a, b)).toBe("Le champ A est obligatoire.");
  });

  it("renvoie null quand tout est valide", () => {
    expect(firstError(requiredString(form({ a: "x" }), "a", "A"))).toBeNull();
  });
});

describe("parseurs optionnels", () => {
  it("optionalString accepte l'absence et borne la longueur", () => {
    expect(optionalString(form({}), "n", "Les notes")).toEqual({ ok: true, value: null });
    expect(optionalString(form({ n: "  " }), "n", "Les notes")).toEqual({ ok: true, value: null });
    expect(optionalString(form({ n: "ok" }), "n", "Les notes")).toEqual({ ok: true, value: "ok" });
    expect(optionalString(form({ n: "a".repeat(11) }), "n", "Les notes", 10).ok).toBe(false);
  });

  it("optionalEnum accepte l'absence mais refuse une valeur hors enum", () => {
    expect(optionalEnum(form({}), "s", "Le statut", Statut)).toEqual({ ok: true, value: null });
    expect(optionalEnum(form({ s: "SIGNE" }), "s", "Le statut", Statut)).toEqual({
      ok: true,
      value: "SIGNE",
    });
    expect(optionalEnum(form({ s: "ADMIN" }), "s", "Le statut", Statut).ok).toBe(false);
  });

  it("optionalInt accepte l'absence, refuse NaN et applique les bornes", () => {
    expect(optionalInt(form({}), "n", "Le montant")).toEqual({ ok: true, value: null });
    expect(optionalInt(form({ n: "1500" }), "n", "Le montant")).toEqual({ ok: true, value: 1500 });
    expect(optionalInt(form({ n: "abc" }), "n", "Le montant").ok).toBe(false);
    expect(optionalInt(form({ n: "-1" }), "n", "Le montant", { min: 0 }).ok).toBe(false);
  });

  it("ignore une valeur de FormData qui n'est pas une chaîne (fichier envoyé sur un champ texte)", () => {
    const data = new FormData();
    data.append("n", new File(["x"], "x.txt"));
    expect(requiredString(data, "n", "Le nom").ok).toBe(false);
  });
});
