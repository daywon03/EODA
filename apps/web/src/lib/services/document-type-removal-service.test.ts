import { describe, expect, it } from "vitest";
import { canRemoveDocumentType, planDocumentTypeRemoval } from "./document-type-removal-service";

// « Il manque des poubelles » (Sandrine, 09/11/2026). Une ligne créée par le cabinet se
// retire ; jamais utilisée elle disparaît, déjà utilisée elle est archivée (historique
// gardé). La loi 2002-2 et le référentiel ne se retirent pas.
const CABINET_LINE = { code: "EODA_FICHE_CANICULE", category: "QUALITE_RISQUES" as const, archivedAt: null };

describe("canRemoveDocumentType", () => {
  it("vrai pour une ligne du cabinet en service", () => {
    expect(canRemoveDocumentType(CABINET_LINE)).toBe(true);
  });

  it("faux pour la loi 2002-2, une ligne du référentiel, ou une ligne déjà archivée", () => {
    expect(canRemoveDocumentType({ code: "EODA_X", category: "LOI_2002_2", archivedAt: null })).toBe(false);
    expect(canRemoveDocumentType({ code: "P13_FICHE_DECLARATION", category: "QUALITE_RISQUES", archivedAt: null })).toBe(false);
    expect(canRemoveDocumentType({ ...CABINET_LINE, archivedAt: new Date("2026-11-09") })).toBe(false);
  });
});

describe("planDocumentTypeRemoval", () => {
  it("jamais utilisée (aucun document, aucun gabarit) : suppression réelle", () => {
    expect(planDocumentTypeRemoval(CABINET_LINE, { documents: 0, templates: 0 })).toEqual({ kind: "DELETE" });
  });

  it("utilisée dans une structure ou par un gabarit : archivage, rien n'est effacé", () => {
    expect(planDocumentTypeRemoval(CABINET_LINE, { documents: 3, templates: 0 })).toEqual({ kind: "ARCHIVE" });
    expect(planDocumentTypeRemoval(CABINET_LINE, { documents: 0, templates: 1 })).toEqual({ kind: "ARCHIVE" });
  });

  it("refuse la loi 2002-2, le référentiel, et une ligne déjà retirée", () => {
    expect(planDocumentTypeRemoval({ code: "L2002_DIPC", category: "LOI_2002_2", archivedAt: null }, { documents: 0, templates: 0 })).toEqual({
      kind: "REFUSED",
      error: expect.stringContaining("loi 2002-2"),
    });
    expect(planDocumentTypeRemoval({ code: "P13_FICHE", category: "QUALITE_RISQUES", archivedAt: null }, { documents: 0, templates: 0 })).toEqual({
      kind: "REFUSED",
      error: expect.stringContaining("référentiel"),
    });
    expect(planDocumentTypeRemoval({ ...CABINET_LINE, archivedAt: new Date() }, { documents: 0, templates: 0 })).toEqual({
      kind: "REFUSED",
      error: expect.stringContaining("déjà retirée"),
    });
  });
});
