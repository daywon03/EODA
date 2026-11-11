import { describe, expect, it } from "vitest";
import {
  activeStructureTabId,
  PRIMARY_STRUCTURE_TAB_IDS,
  splitStructureTabs,
  STRUCTURE_TABS,
  structureHref,
  visibleStructureTabs,
  type StructureTab,
} from "./structure-tabs";

describe("visibleStructureTabs", () => {
  it("montre les huit onglets livrés aux deux rôles qui écrivent, dans l'ordre de la maquette", () => {
    const expected = ["overview", "documents", "criteres", "plan-action", "evaluation", "equipe", "personnes", "enquetes", "mission", "echanges", "reglages"];
    expect(visibleStructureTabs("CABINET_ADMIN").map((t) => t.id)).toEqual(expected);
    expect(visibleStructureTabs("CABINET_EVALUATOR").map((t) => t.id)).toEqual(expected);
  });

  it("la lecture seule voit tout sauf les Réglages ; le commercial et le client, rien", () => {
    expect(visibleStructureTabs("CABINET_READONLY").map((t) => t.id)).not.toContain("reglages");
    expect(visibleStructureTabs("CABINET_READONLY").map((t) => t.id)).toContain("documents");
    expect(visibleStructureTabs("CABINET_COMMERCIAL")).toEqual([]);
    expect(visibleStructureTabs("CLIENT_USER")).toEqual([]);
  });

  it("annonce Critères (N4) et l'Équipe (N10)", () => {
    const ids = STRUCTURE_TABS.map((t) => t.id);
    expect(ids).toContain("criteres");
    expect(ids).toContain("equipe");
  });

  it("un onglet ajouté en une ligne suit la visibilité par rôle", () => {
    const withAdminTab: StructureTab[] = [
      ...STRUCTURE_TABS,
      { id: "admin-only", label: "Réservé", segment: "reserve", capability: "CABINET_SETTINGS" },
    ];
    expect(visibleStructureTabs("CABINET_ADMIN", withAdminTab).map((t) => t.id)).toContain("admin-only");
    expect(visibleStructureTabs("CABINET_EVALUATOR", withAdminTab).map((t) => t.id)).not.toContain("admin-only");
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

describe("splitStructureTabs — six onglets visibles, le reste dans « Plus »", () => {
  const ids = (tabs: readonly { id: string }[]) => tabs.map((t) => t.id);

  it("garde les six du quotidien, dans l'ordre de la fiche, et range les autres", () => {
    const { primary, more } = splitStructureTabs(STRUCTURE_TABS, "documents");
    expect(ids(primary)).toEqual(["overview", "documents", "criteres", "plan-action", "evaluation", "mission"]);
    expect(ids(more)).toEqual(["equipe", "personnes", "enquetes", "echanges", "reglages"]);
  });

  it("l'onglet ouvert rangé dans « Plus » rejoint la barre, à sa place", () => {
    const { primary, more } = splitStructureTabs(STRUCTURE_TABS, "enquetes");
    expect(ids(primary)).toContain("enquetes");
    expect(ids(more)).not.toContain("enquetes");
    expect(ids(primary).indexOf("enquetes")).toBeLessThan(ids(primary).indexOf("mission"));
  });

  it("aucun onglet perdu ni en double", () => {
    const { primary, more } = splitStructureTabs(STRUCTURE_TABS, null);
    expect([...ids(primary), ...ids(more)].sort()).toEqual(ids(STRUCTURE_TABS).sort());
  });

  it("chaque onglet principal existe dans la fiche", () => {
    for (const id of PRIMARY_STRUCTURE_TAB_IDS) expect(ids(STRUCTURE_TABS)).toContain(id);
  });

  it("sans les Réglages (lecture seule), « Plus » ne les propose pas", () => {
    const { more } = splitStructureTabs(visibleStructureTabs("CABINET_READONLY"), null);
    expect(ids(more)).not.toContain("reglages");
  });
});

