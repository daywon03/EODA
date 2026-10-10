import { describe, expect, it } from "vitest";
import {
  activeStructureTabId,
  STRUCTURE_TABS,
  structureHref,
  visibleStructureTabs,
  type StructureTab,
} from "./structure-tabs";

describe("visibleStructureTabs", () => {
  it("montre les six onglets livrés aux deux rôles cabinet, dans l'ordre de la maquette", () => {
    const expected = ["overview", "documents", "evaluation", "mission", "echanges", "reglages"];
    expect(visibleStructureTabs("CABINET_ADMIN").map((t) => t.id)).toEqual(expected);
    expect(visibleStructureTabs("CABINET_EVALUATOR").map((t) => t.id)).toEqual(expected);
  });

  it("ne montre aucun onglet à un compte client", () => {
    expect(visibleStructureTabs("CLIENT_USER")).toEqual([]);
  });

  it("n'annonce pas les onglets des tranches suivantes (pas d'onglet vide)", () => {
    const ids = STRUCTURE_TABS.map((t) => t.id);
    expect(ids).not.toContain("criteres");
    expect(ids).not.toContain("plan");
    expect(ids).not.toContain("equipe");
  });

  it("un onglet ajouté en une ligne suit la visibilité par rôle", () => {
    const withAdminTab: StructureTab[] = [
      ...STRUCTURE_TABS,
      { id: "equipe", label: "Équipe", segment: "equipe", roles: ["CABINET_ADMIN"] },
    ];
    expect(visibleStructureTabs("CABINET_ADMIN", withAdminTab).map((t) => t.id)).toContain("equipe");
    expect(visibleStructureTabs("CABINET_EVALUATOR", withAdminTab).map((t) => t.id)).not.toContain("equipe");
  });
});

describe("structureHref", () => {
  it("construit l'adresse de la fiche et de ses onglets", () => {
    expect(structureHref("e1")).toBe("/dashboard/cabinet/etablissements/e1");
    expect(structureHref("e1", "documents")).toBe("/dashboard/cabinet/etablissements/e1/documents");
  });
});

describe("activeStructureTabId", () => {
  it("lit l'onglet dans l'adresse", () => {
    expect(activeStructureTabId("/dashboard/cabinet/etablissements/e1", "e1")).toBe("overview");
    expect(activeStructureTabId("/dashboard/cabinet/etablissements/e1/documents", "e1")).toBe("documents");
    expect(activeStructureTabId("/dashboard/cabinet/etablissements/e1/evaluation/chapitre/2", "e1")).toBe("evaluation");
  });

  it("range l'édition de la fiche sous Réglages", () => {
    expect(activeStructureTabId("/dashboard/cabinet/etablissements/e1/modifier", "e1")).toBe("reglages");
  });

  it("ne sélectionne rien hors de la fiche ou sur un segment inconnu", () => {
    expect(activeStructureTabId("/dashboard/cabinet/etablissements/e10", "e1")).toBeNull();
    expect(activeStructureTabId("/dashboard/cabinet/structures", "e1")).toBeNull();
    expect(activeStructureTabId("/dashboard/cabinet/etablissements/e1/inconnu", "e1")).toBeNull();
  });
});
