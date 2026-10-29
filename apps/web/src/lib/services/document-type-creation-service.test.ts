import { describe, expect, it } from "vitest";
import {
  documentTypeCode,
  documentTypeCreationError,
  documentTypeLabelKey,
  documentTypeRenameError,
  normalizeCriterionQuery,
  normalizeDocumentTypeLabel,
  parseCriterionCodes,
  shouldAnnounceNewDocumentType,
} from "./document-type-creation-service";

describe("libellé", () => {
  it("resserre les espaces", () => {
    expect(normalizeDocumentTypeLabel("  Plan  de\tformation ")).toBe("Plan de formation");
  });

  it("la clé ignore accents, casse et ponctuation", () => {
    expect(documentTypeLabelKey("Procédure — Bientraitance !")).toBe(documentTypeLabelKey("procedure bientraitance"));
  });
});

describe("documentTypeCreationError", () => {
  const base = { label: "Plan de formation", category: "RH", existingLabels: ["Registre des plaintes"] };

  it("accepte un libellé nouveau dans une catégorie ouverte", () => {
    expect(documentTypeCreationError(base)).toBeNull();
  });

  it("refuse un vide, un trop court, un trop long, des caractères de contrôle", () => {
    expect(documentTypeCreationError({ ...base, label: "   " })).toMatch(/obligatoire/);
    expect(documentTypeCreationError({ ...base, label: "ab" })).toMatch(/trop court/);
    expect(documentTypeCreationError({ ...base, label: "x".repeat(161) })).toMatch(/160/);
    expect(documentTypeCreationError({ ...base, label: "Plan\u0007 test" })).toMatch(/invalides/);
    expect(documentTypeCreationError({ ...base, label: "— — —" })).toMatch(/lettres/);
  });

  it("refuse la loi 2002-2 (liste légale) et une catégorie inconnue", () => {
    expect(documentTypeCreationError({ ...base, category: "LOI_2002_2" })).toMatch(/loi 2002-2/);
    expect(documentTypeCreationError({ ...base, category: "AUTRE" })).toMatch(/Catégorie/);
  });

  it("refuse un doublon et le nomme, accents et casse compris", () => {
    expect(documentTypeCreationError({ ...base, label: "registre des PLAINTES" })).toBe(
      "Ce document existe déjà dans la liste : « Registre des plaintes »."
    );
  });
});

describe("documentTypeRenameError", () => {
  it("accepte un nouveau nom, refuse un doublon d'une AUTRE ligne", () => {
    expect(documentTypeRenameError({ label: "Gestion de crise", category: "QUALITE_RISQUES", otherLabels: ["Registre"] })).toBeNull();
    expect(documentTypeRenameError({ label: "registre", category: "QUALITE_RISQUES", otherLabels: ["Registre"] })).toMatch(
      /existe déjà/
    );
  });

  it("les documents de la loi 2002-2 gardent leur nom", () => {
    expect(documentTypeRenameError({ label: "Autre nom", category: "LOI_2002_2", otherLabels: [] })).toMatch(/loi 2002-2/);
  });

  it("mêmes règles de forme que la création", () => {
    expect(documentTypeRenameError({ label: " ", category: "RH", otherLabels: [] })).toMatch(/obligatoire/);
  });
});

describe("codes de critères tapés à la main", () => {
  it("accepte points, tirets et espaces, sépare par virgule ou point-virgule, sans doublon", () => {
    expect(parseCriterionCodes("3.14.2, 3-14-2 ; 1 2\n2.4.1.")).toEqual(["3.14.2", "1.2", "2.4.1"]);
    expect(parseCriterionCodes("  ")).toEqual([]);
  });

  it("une recherche par mot reste un mot", () => {
    expect(normalizeCriterionQuery("3-14-2")).toBe("3.14.2");
    expect(normalizeCriterionQuery("  gestion   de crise ")).toBe("gestion de crise");
  });
});

describe("documentTypeCode", () => {
  it("dérive le code du libellé, préfixé EODA_", () => {
    expect(documentTypeCode("Plan de formation 2027", [])).toBe("EODA_PLAN_DE_FORMATION_2027");
  });

  it("suffixe un code déjà pris", () => {
    expect(documentTypeCode("Plan", ["EODA_PLAN", "EODA_PLAN_2"])).toBe("EODA_PLAN_3");
  });

  it("borne la longueur sans finir par un souligné", () => {
    const code = documentTypeCode("a ".repeat(50), []);
    expect(code.length).toBeLessThanOrEqual(45);
    expect(code.endsWith("_")).toBe(false);
  });
});

describe("shouldAnnounceNewDocumentType", () => {
  it("annonce aux structures accompagnées dont l'offre suit la catégorie", () => {
    expect(shouldAnnounceNewDocumentType({ access: "ACTIVE", coveredCategories: ["RH"], category: "RH" })).toBe(true);
  });

  it("n'annonce ni hors périmètre, ni sans mission, ni en bibliothèque ou révoquée", () => {
    expect(shouldAnnounceNewDocumentType({ access: "ACTIVE", coveredCategories: ["FONCTIONNEMENT"], category: "RH" })).toBe(false);
    expect(shouldAnnounceNewDocumentType({ access: "ACTIVE", coveredCategories: null, category: "RH" })).toBe(false);
    expect(shouldAnnounceNewDocumentType({ access: "LIBRARY", coveredCategories: ["RH"], category: "RH" })).toBe(false);
    expect(shouldAnnounceNewDocumentType({ access: "REVOKED", coveredCategories: ["RH"], category: "RH" })).toBe(false);
  });
});
