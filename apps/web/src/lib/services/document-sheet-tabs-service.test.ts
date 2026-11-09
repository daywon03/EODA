import { describe, expect, it } from "vitest";
import { analysisMissingNotice, parseSheetTab, SHEET_TABS, withSheetTab } from "./document-sheet-tabs-service";

// « Je me perds dans le panneau de droite » (Sandrine, 09/11/2026) : trois onglets,
// portés par l'adresse (`?onglet=`) pour rester partageables et utilisables sans JS.
describe("parseSheetTab", () => {
  it("lit l'onglet de l'adresse, « Le document » par défaut ou sur une valeur inconnue", () => {
    expect(parseSheetTab("criteres")).toBe("criteres");
    expect(parseSheetTab(["analyse", "x"])).toBe("analyse");
    expect(parseSheetTab(undefined)).toBe("document");
    expect(parseSheetTab("<script>")).toBe("document");
  });

  it("trois onglets, dans l'ordre du travail", () => {
    expect(SHEET_TABS.map((t) => t.label)).toEqual(["Le document", "Critères HAS", "Analyse"]);
  });
});

describe("withSheetTab", () => {
  const base = "/dashboard/cabinet/etablissements/e1/documents?tab=done&doc=dt-1";

  it("pose l'onglet sans perdre les filtres ni le document ouvert", () => {
    expect(withSheetTab(base, "analyse")).toBe("/dashboard/cabinet/etablissements/e1/documents?tab=done&doc=dt-1&onglet=analyse");
  });

  it("remplace un onglet déjà posé, et le retire pour l'onglet par défaut", () => {
    expect(withSheetTab(`${base}&onglet=analyse`, "criteres")).toBe(`${base}&onglet=criteres`);
    expect(withSheetTab(`${base}&onglet=analyse`, "document")).toBe(base);
  });
});

describe("analysisMissingNotice", () => {
  it("une phrase seulement quand l'analyse a relevé des manques", () => {
    expect(analysisMissingNotice(0)).toBeNull();
    expect(analysisMissingNotice(3)).toBe("L'analyse automatique a relevé des éléments manquants");
  });
});
