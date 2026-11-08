import { afterEach, describe, expect, it, vi } from "vitest";
import { describeShare, shareFiles, type SharedFile } from "./share-files";

const pdf: SharedFile = { fileName: "contrat.pdf", blob: new Blob(["%PDF"], { type: "application/pdf" }) };
const word: SharedFile = { fileName: "contrat.docx", blob: new Blob(["PK"]) };

// Comme Chrome sur Android : un PDF se partage, un Word non.
function tabletLike(share: (data: ShareData) => Promise<void>) {
  vi.stubGlobal("navigator", {
    canShare: (data: ShareData) => (data.files ?? []).every((f) => f.name.endsWith(".pdf")),
    share: vi.fn(share),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Envoyer : jamais un téléchargement à la place d'un envoi", () => {
  it("feuille refermée (Annuler) : rien n'est téléchargé", async () => {
    tabletLike(() => Promise.reject(new DOMException("Share canceled", "AbortError")));
    const download = vi.fn();
    const result = await shareFiles([pdf, word], "Dossier", download);
    expect(result.outcome).toBe("cancelled");
    expect(download).not.toHaveBeenCalled();
    expect(describeShare(result, "Envoyé.", "Téléchargé.")).toBeNull();
  });

  it("envoi raté : rien n'est téléchargé, l'écran le dit", async () => {
    tabletLike(() => Promise.reject(new DOMException("Permission denied", "NotAllowedError")));
    const download = vi.fn();
    const result = await shareFiles([pdf], "Dossier", download);
    expect(result.outcome).toBe("failed");
    expect(download).not.toHaveBeenCalled();
    expect(describeShare(result, "Envoyé.", "Téléchargé.")).toMatch(/Rien n'a été téléchargé/);
  });

  it("un Word que la tablette refuse : les PDF partent, le Word est nommé", async () => {
    let sent: string[] = [];
    tabletLike((data) => {
      sent = (data.files ?? []).map((f) => f.name);
      return Promise.resolve();
    });
    const download = vi.fn();
    const result = await shareFiles([word, pdf], "Dossier", download);
    expect(sent).toEqual(["contrat.pdf"]);
    expect(result).toEqual({ outcome: "shared", notSent: ["contrat.docx"] });
    expect(download).not.toHaveBeenCalled();
    expect(describeShare(result, "Envoyé.", "Téléchargé.")).toBe("Envoyé. Pas envoyé depuis la tablette : contrat.docx — utilisez « Télécharger ».");
  });

  it("rien de partageable : aucun téléchargement silencieux", async () => {
    tabletLike(() => Promise.resolve());
    const download = vi.fn();
    const result = await shareFiles([word], "Dossier", download);
    expect(result.outcome).toBe("failed");
    expect(download).not.toHaveBeenCalled();
  });

  it("appareil sans partage : on télécharge, et l'écran le dit", async () => {
    vi.stubGlobal("navigator", {});
    const download = vi.fn();
    const result = await shareFiles([pdf, word], "Dossier", download);
    expect(result.outcome).toBe("downloaded");
    expect(download).toHaveBeenCalledTimes(2);
    expect(describeShare(result, "Envoyé.", "Téléchargé.")).toBe("Téléchargé.");
  });
});
