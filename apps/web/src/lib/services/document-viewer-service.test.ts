import { afterEach, describe, expect, it, vi } from "vitest";
import { documentPagesPrepareUrl, documentViewerSource, prepareDocumentPages } from "./document-viewer-service";

describe("prepareDocumentPages", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("prépare les pages d'un Excel, avec les cookies de la session", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(prepareDocumentPages("v1", "plan.xlsx")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/documents/v1/pdf?prepare=1", { credentials: "same-origin" });
  });

  it("ne lance rien pour un PDF ou une photo, servis tels quels", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect(prepareDocumentPages("v2", "projet.pdf")).toBe(false);
    expect(prepareDocumentPages("v3", "photo.jpg")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("avale un échec réseau : la préparation n'est qu'un confort", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("hors ligne")));
    expect(prepareDocumentPages("v4", "plan.xlsx")).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});

describe("documentViewerSource", () => {
  it("sert un PDF déposé tel quel, par la route qui contrôle l'accès", () => {
    expect(documentViewerSource("v1", "Projet de service.PDF")).toEqual({
      kind: "pdf",
      url: "/api/documents/v1/original",
    });
  });

  it("sert une photo telle quelle — jamais convertie en PDF pour un simple affichage", () => {
    expect(documentViewerSource("v2", "organigramme.jpeg")).toEqual({
      kind: "image",
      url: "/api/documents/v2/original",
    });
    expect(documentViewerSource("v3", "charte.png").kind).toBe("image");
  });

  it("dessine un Word dans le navigateur, mise en page comprise, depuis l'original (21/10/2026)", () => {
    expect(documentViewerSource("v7", "Livret Accueil.DOCX")).toEqual({
      kind: "docx",
      url: "/api/documents/v7/original",
      pagesUrl: "/api/documents/v7/pdf",
    });
  });

  it("montre les PAGES d'un Excel ou d'un CSV, et sait les préparer", () => {
    for (const name of ["plan.xlsx", "export.csv"]) {
      expect(documentViewerSource("v4", name)).toEqual({
        kind: "pages",
        url: "/api/documents/v4/pdf",
        prepareUrl: "/api/documents/v4/pdf?prepare=1",
      });
    }
  });

  it("retombe sur le texte extrait pour un format sans convertisseur", () => {
    expect(documentViewerSource("v5", "ancien.doc")).toEqual({ kind: "fallback" });
    expect(documentViewerSource("v6", "ancien.xls")).toEqual({ kind: "fallback" });
  });

  it("échappe l'identifiant dans l'adresse", () => {
    expect(documentPagesPrepareUrl("a/b")).toBe("/api/documents/a%2Fb/pdf?prepare=1");
  });
});
