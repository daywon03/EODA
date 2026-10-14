import { describe, expect, it } from "vitest";
import { DOCUMENT_TYPE_SEEDS } from "@eoda/database/document-types";
import { DOCUMENT_GROUP_CODES, DOCUMENT_GROUPS, documentGroupOf, groupDocumentTypes } from "./groupes";

// RÈGLE ZÉRO : « tout type de document a un groupe » n'est vrai que si une machine le
// vérifie. La liste des types vient de la source unique du seed.

const rankedCodes = DOCUMENT_GROUPS.flatMap(({ id }) => [...DOCUMENT_GROUP_CODES[id]]);

describe("rangement des types de document en sept groupes", () => {
  it("sept groupes, dans l'ordre de la maquette", () => {
    expect(DOCUMENT_GROUPS.map((g) => g.label)).toEqual([
      "Loi 2002-2",
      "Processus P1-P7",
      "Gestion des risques",
      "Personne accompagnée",
      "Registres",
      "Ressources humaines",
      "Qualité",
    ]);
  });

  it("tout type de document du seed a un groupe", () => {
    expect(DOCUMENT_TYPE_SEEDS.filter((t) => documentGroupOf(t.code) === null).map((t) => t.code)).toEqual([]);
  });

  it("aucun code rangé n'est inconnu du seed, et aucun n'est rangé deux fois", () => {
    const seedCodes = new Set(DOCUMENT_TYPE_SEEDS.map((t) => t.code));
    expect(rankedCodes.filter((code) => !seedCodes.has(code))).toEqual([]);
    expect(new Set(rankedCodes).size).toBe(rankedCodes.length);
  });

  it("aucun groupe vide", () => {
    for (const { id } of DOCUMENT_GROUPS) expect(DOCUMENT_GROUP_CODES[id].length).toBeGreaterThan(0);
  });

  it("les sept documents de la loi 2002-2 sont dans le groupe Loi 2002-2", () => {
    const loi = DOCUMENT_TYPE_SEEDS.filter((t) => t.category === "LOI_2002_2");
    expect(loi).toHaveLength(7);
    for (const type of loi) expect(documentGroupOf(type.code)).toBe("LOI_2002_2");
  });

  it("un code inconnu n'a pas de groupe (jamais deviné)", () => {
    expect(documentGroupOf("TYPE_INCONNU")).toBeNull();
  });
});

describe("groupDocumentTypes", () => {
  it("range dans l'ordre des groupes, garde l'ordre reçu, isole les inconnus", () => {
    const result = groupDocumentTypes([
      { code: "RH_DUERP" },
      { code: "TYPE_INCONNU" },
      { code: "L2002_DIPC" },
      { code: "L2002_CHARTE_DROITS" },
    ]);

    expect(result.groups.map((g) => g.id)).toEqual(DOCUMENT_GROUPS.map((g) => g.id));
    expect(result.groups[0]?.types.map((t) => t.code)).toEqual(["L2002_DIPC", "L2002_CHARTE_DROITS"]);
    expect(result.groups.find((g) => g.id === "RISQUES")?.types.map((t) => t.code)).toEqual(["RH_DUERP"]);
    expect(result.unranked).toEqual([{ code: "TYPE_INCONNU" }]);
  });

  it("liste vide : sept groupes vides, rien d'inconnu", () => {
    const result = groupDocumentTypes([]);
    expect(result.groups.every((g) => g.types.length === 0)).toBe(true);
    expect(result.unranked).toEqual([]);
  });
});
