import { describe, expect, it } from "vitest";
import {
  documentPagesUrlFor,
  previewForVersion,
} from "./document-row-preview-service";

describe("documentPagesUrlFor", () => {
  it("construit l'adresse de la route gardée", () => {
    expect(documentPagesUrlFor("v1")).toBe("/api/documents/v1/pdf");
  });
});

describe("previewForVersion", () => {
  it("sans version courante, pas d'aperçu", () => {
    expect(previewForVersion(null)).toBeNull();
  });

  it("un .docx pointe les pages rendues côté serveur, sans requête préalable", () => {
    expect(previewForVersion({ id: "v1", originalFilename: "Projet de service.docx" })).toEqual({
      kind: "document",
      url: "/api/documents/v1/pdf",
      filename: "Projet de service.docx",
    });
  });

  it("un .xlsx et un .csv passent par le même rendu paginé", () => {
    expect(previewForVersion({ id: "x", originalFilename: "Grille.XLSX" })?.kind).toBe("document");
    expect(previewForVersion({ id: "c", originalFilename: "suivi.csv" })?.kind).toBe("document");
  });

  it("un PDF utilise l'adresse signée fournie", () => {
    expect(
      previewForVersion({ id: "p", originalFilename: "livret.pdf" }, { p: "https://signed/p" })
    ).toEqual({ kind: "pdf", url: "https://signed/p", filename: "livret.pdf" });
  });

  it("une image utilise l'adresse signée et se rend en image, pas en pages", () => {
    expect(
      previewForVersion({ id: "i", originalFilename: "Photo.JPG" }, { i: "https://signed/i" })
    ).toEqual({ kind: "image", url: "https://signed/i", filename: "Photo.JPG" });
  });

  it("un PDF sans adresse signée n'invente pas d'URL", () => {
    expect(previewForVersion({ id: "p", originalFilename: "livret.pdf" })).toBeNull();
  });

  it("un .doc (OLE2) n'a aucun aperçu — jamais des pages vides", () => {
    expect(previewForVersion({ id: "d", originalFilename: "ancien.doc" })).toBeNull();
    expect(previewForVersion({ id: "d", originalFilename: "ancien.xls" })).toBeNull();
  });
});
