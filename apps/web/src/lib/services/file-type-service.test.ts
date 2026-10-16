import { describe, expect, it } from "vitest";
import { canRenderDocumentPages, isImageFile, isPdfFile } from "./file-type-service";

// Ces prédicats portent sur le NOM du fichier, et c'est assumé : ils décident de
// l'affichage d'un bouton, avant tout accès au contenu. Le rendu, lui, ne s'y fie
// pas — il détecte le type par signature et refuse ce qu'il ne sait pas lire
// (document-pdf-render-service). Ce test fixe donc la LISTE des formats, pas une
// garantie de ce que contient le fichier.

describe("isImageFile", () => {
  it("reconnaît jpg, jpeg et png, insensible à la casse", () => {
    expect(isImageFile("photo.jpg")).toBe(true);
    expect(isImageFile("PHOTO.JPEG")).toBe(true);
    expect(isImageFile("scan.png")).toBe(true);
  });

  it("refuse les autres formats", () => {
    expect(isImageFile("document.docx")).toBe(false);
    expect(isImageFile("rapport.pdf")).toBe(false);
    // Un SVG n'est pas une image de ce point de vue : il peut porter du script, et
    // n'est pas accepté au dépôt.
    expect(isImageFile("schema.svg")).toBe(false);
  });
});

describe("isPdfFile", () => {
  it("reconnaît un PDF, insensible à la casse", () => {
    expect(isPdfFile("rapport.pdf")).toBe(true);
    expect(isPdfFile("RAPPORT.PDF")).toBe(true);
  });

  it("ne confond pas un nom qui contient « pdf » avec un PDF", () => {
    expect(isPdfFile("pdf-annote.docx")).toBe(false);
    expect(isPdfFile("document.pdfx")).toBe(false);
  });
});

describe("canRenderDocumentPages", () => {
  it("accepte ce que le dépôt sait convertir en pages", () => {
    expect(canRenderDocumentPages("projet-de-service.docx")).toBe(true);
    expect(canRenderDocumentPages("registre.xlsx")).toBe(true);
    expect(canRenderDocumentPages("export.csv")).toBe(true);
    expect(canRenderDocumentPages("charte.jpg")).toBe(true);
    expect(canRenderDocumentPages("PLAN.PNG")).toBe(true);
  });

  it("refuse les formats anciens, qu'aucun convertisseur ne prend en charge", () => {
    // Un bouton qui répondrait « aperçu indisponible » vaut moins que pas de bouton.
    expect(canRenderDocumentPages("ancien.doc")).toBe(false);
    expect(canRenderDocumentPages("tableau.xls")).toBe(false);
  });

  it("refuse un PDF : il est déjà paginé, le navigateur l'affiche nativement", () => {
    // Le faire passer par Chromium ne gagnerait rien et coûterait un rendu.
    expect(canRenderDocumentPages("rapport.pdf")).toBe(false);
  });
});
