import { describe, expect, it } from "vitest";
import { DOCUMENT_TYPE_SEEDS } from "@eoda/database/document-types";
import { DOCUMENT_FOLDER_SEEDS } from "@eoda/database/document-folders";
import {
  DOCUMENT_GROUP_BY_FOLDER,
  DOCUMENT_GROUP_CODES,
  DOCUMENT_GROUPS,
  documentGroupFor,
  documentGroupOf,
  groupDocumentTypes,
} from "./groupes";

// RÈGLE ZÉRO : « tout type de document a un groupe » n'est vrai que si une machine le
// vérifie. La liste des types vient de la source unique du seed.

const rankedCodes = DOCUMENT_GROUPS.flatMap(({ id }) => [...DOCUMENT_GROUP_CODES[id]]);

describe("rangement des types de document en sept groupes", () => {
  it("sept groupes, dans l'ordre de la maquette", () => {
    expect(DOCUMENT_GROUPS.map((g) => g.label)).toEqual([
      "Loi 2002-2",
      "Processus",
      "Gestion des risques",
      "Personne accompagnée",
      "Registres",
      "Ressources humaines",
      "Qualité",
    ]);
  });

  it("les libellés s'adressent à la structure : ni sigle interne, ni numérotation", () => {
    // « Processus P1-P7 » exposait nos codes de travail (P11/P12/P13/P14/P22) sur un
    // écran lu par la structure. La maquette écrit « Processus ».
    for (const { label } of DOCUMENT_GROUPS) expect(label).not.toMatch(/\bP\d/);
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

// Retour du 09/11/2026 (#9) : des fiches de sensibilisation des professionnels,
// rangées par le cabinet dans le dossier « Sensibilisation des professionnels »,
// apparaissaient sous « Ressources humaines ». Le rangement client ne lisait que le
// CODE : la fiche du référentiel (QUALITE_FICHE_SENSIBILISATION) était rangée en RH
// par choix écrit, et une ligne créée par le cabinet (EODA_…) n'avait aucun groupe.
// Règle : le dossier d'abord, puis le code, puis — pour une ligne du cabinet — la
// catégorie choisie à sa création.
describe("documentGroupFor — dossier, puis code, puis catégorie d'une ligne du cabinet", () => {
  it("une ligne du dossier « Sensibilisation des professionnels » va en Qualité, quel que soit son code", () => {
    const folder = { id: "docfolder-sensibilisation-pro" };
    expect(documentGroupFor({ code: "EODA_FICHE_RISQUE_CHUTE", category: "RH", folder })).toBe("QUALITE");
    expect(documentGroupFor({ code: "QUALITE_FICHE_SENSIBILISATION", category: "QUALITE_RISQUES", folder })).toBe(
      "QUALITE"
    );
  });

  it("une ligne du cabinet sans dossier suit sa catégorie quand elle se range", () => {
    expect(documentGroupFor({ code: "EODA_AFFICHE_X", category: "RH", folder: null })).toBe("RESSOURCES_HUMAINES");
    expect(documentGroupFor({ code: "EODA_PROCEDURE_X", category: "QUALITE_RISQUES" })).toBe("QUALITE");
    // « Fonctionnement » couvre des pièces de quatre groupes : rien ne se devine.
    expect(documentGroupFor({ code: "EODA_PLAQUETTE_X", category: "FONCTIONNEMENT" })).toBeNull();
  });

  it("un dossier créé par le cabinet (sans groupe connu) reste entier, à part — jamais coupé par les codes", () => {
    const folder = { id: "cm-dossier-cree-par-le-cabinet" };
    expect(documentGroupFor({ code: "RH_DUERP", category: "RH", folder })).toBeNull();
    expect(documentGroupFor({ code: "EODA_X", category: "RH", folder })).toBeNull();
  });

  // Observé à l'écran le 09/11/2026 sur le portail de la structure pilote : le dossier
  // « Sensibilisation des professionnels » coupé entre « Ressources humaines » (2) et
  // « Autres documents » (20), « Pilotage qualité » entre « Registres » et « Autres ».
  it("un dossier n'est JAMAIS coupé entre deux groupes, quels que soient les codes et catégories de ses lignes", () => {
    const lines = [
      { code: "QUALITE_FICHE_SENSIBILISATION", category: "QUALITE_RISQUES" as const },
      { code: "P12_REGISTRE", category: "QUALITE_RISQUES" as const },
      { code: "RH_DUERP", category: "RH" as const },
      { code: "L2002_DIPC", category: "LOI_2002_2" as const },
      { code: "EODA_FICHE_A", category: "RH" as const },
      { code: "EODA_FICHE_B", category: "QUALITE_RISQUES" as const },
      { code: "EODA_FICHE_C", category: "FONCTIONNEMENT" as const },
      { code: "TYPE_INCONNU", category: "FONCTIONNEMENT" as const },
    ];
    const folderIds = [...DOCUMENT_FOLDER_SEEDS.map((f) => f.id), "cm-dossier-cree-par-le-cabinet"];
    for (const id of folderIds) {
      const groups = new Set(lines.map((line) => documentGroupFor({ ...line, folder: { id } })));
      expect(groups.size, `dossier ${id}`).toBe(1);
    }
    // Le cas observé : un registre rangé dans « Pilotage qualité » suit le dossier.
    expect(documentGroupFor({ code: "P12_REGISTRE", category: "QUALITE_RISQUES", folder: { id: "docfolder-pilotage-qualite" } })).toBe(
      "QUALITE"
    );
  });

  it("un code ni rangé ni créé par le cabinet reste à part (jamais deviné)", () => {
    expect(documentGroupFor({ code: "TYPE_INCONNU", category: "RH" })).toBeNull();
  });

  it("groupDocumentTypes applique la même règle", () => {
    const result = groupDocumentTypes([
      { code: "EODA_FICHE_RISQUE_CHUTE", category: "RH" as const, folder: { id: "docfolder-sensibilisation-pro" } },
    ]);
    expect(result.groups.find((g) => g.id === "QUALITE")?.types).toHaveLength(1);
    expect(result.groups.find((g) => g.id === "RESSOURCES_HUMAINES")?.types).toHaveLength(0);
  });

  it("RÈGLE ZÉRO : chaque dossier posé par la migration a un groupe, et aucun dossier rangé n'est inconnu", () => {
    const seeded = DOCUMENT_FOLDER_SEEDS.map((f) => f.id).sort();
    expect(Object.keys(DOCUMENT_GROUP_BY_FOLDER).sort()).toEqual(seeded);
  });
});
