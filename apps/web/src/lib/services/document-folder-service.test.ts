import { describe, expect, it } from "vitest";
import { documentFolderLabelError, foldersOfRows, groupRowsByFolder, nextFolderPosition } from "./document-folder-service";

describe("documentFolderLabelError", () => {
  it("accepte un nom neuf", () => {
    expect(documentFolderLabelError("Stratégie", ["Pilotage qualité"])).toBeNull();
  });

  it("refuse le vide, le trop long et les caractères de contrôle", () => {
    expect(documentFolderLabelError("   ", [])).toMatch(/obligatoire/);
    expect(documentFolderLabelError("a".repeat(81), [])).toMatch(/80 caractères/);
    expect(documentFolderLabelError("Strat\u0000égie", [])).toMatch(/invalides/);
    expect(documentFolderLabelError("--", [])).toMatch(/lettres ou des chiffres/);
  });

  it("nomme le doublon, accents et casse ignorés", () => {
    expect(documentFolderLabelError("strategie", ["Stratégie"])).toBe("Ce dossier existe déjà : « Stratégie ».");
  });
});

describe("nextFolderPosition", () => {
  it("place le nouveau dossier à la suite", () => {
    expect(nextFolderPosition([])).toBe(1);
    expect(nextFolderPosition([{ position: 3 }, { position: 7 }])).toBe(8);
  });
});

describe("groupRowsByFolder", () => {
  const folders = [
    { id: "b", label: "Pilotage qualité", position: 2 },
    { id: "a", label: "Sensibilisation des professionnels", position: 1 },
    { id: "c", label: "Stratégie", position: 3 },
  ];

  it("range dans l'ordre du cabinet, garde l'ordre des lignes, laisse les autres à plat", () => {
    const rows = [
      { name: "Note", folder: null },
      { name: "CR", folder: { id: "b" } },
      { name: "Fiche 1", folder: { id: "a" } },
      { name: "Fiche 2", folder: { id: "a" } },
    ];
    const grouped = groupRowsByFolder(rows, folders);
    expect(grouped.folders.map((f) => [f.label, f.rows.map((r) => r.name)])).toEqual([
      ["Sensibilisation des professionnels", ["Fiche 1", "Fiche 2"]],
      ["Pilotage qualité", ["CR"]],
    ]);
    expect(grouped.loose.map((r) => r.name)).toEqual(["Note"]);
  });

  it("n'affiche pas un dossier vide, ne perd pas une ligne au dossier inconnu", () => {
    const grouped = groupRowsByFolder([{ name: "X", folder: { id: "disparu" } }], folders);
    expect(grouped.folders).toEqual([]);
    expect(grouped.loose.map((r) => r.name)).toEqual(["X"]);
  });
});

describe("foldersOfRows", () => {
  it("rend chaque dossier une fois", () => {
    const folder = { id: "a", label: "Stratégie", position: 3 };
    expect(foldersOfRows([{ folder }, { folder: null }, { folder }])).toEqual([folder]);
  });
});
