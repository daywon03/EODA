import { describe, expect, it } from "vitest";
import { DEVIS_MAX_BYTES, detectDevisKind, devisCaption, devisExtension, devisFileProblem } from "./devis-service";

const bytes = (...values: number[]) => Uint8Array.from(values);

describe("detectDevisKind — la signature décide, jamais le nom du fichier", () => {
  it("reconnaît un PDF, un PNG, un JPEG", () => {
    expect(detectDevisKind(new TextEncoder().encode("%PDF-1.7"))).toBe("PDF");
    expect(detectDevisKind(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("PNG");
    expect(detectDevisKind(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("JPEG");
  });

  it("refuse un Word, un texte, un fichier vide ou trop lourd", () => {
    expect(detectDevisKind(bytes(0x50, 0x4b, 0x03, 0x04))).toBeNull();
    expect(devisFileProblem(new TextEncoder().encode("bonjour"))).toMatch(/ni un PDF ni une photo/);
    expect(devisFileProblem(new Uint8Array())).toMatch(/vide/);
    const heavy = new Uint8Array(DEVIS_MAX_BYTES + 1);
    heavy.set(new TextEncoder().encode("%PDF"));
    expect(devisFileProblem(heavy)).toMatch(/15 Mo/);
    expect(devisFileProblem(new TextEncoder().encode("%PDF-1.7 …"))).toBeNull();
  });
});

describe("devisCaption", () => {
  it("dit la date et le nombre de pages, et quand toutes ne sont pas reproduites", () => {
    const at = new Date("2026-10-30T10:00:00Z");
    expect(devisCaption({ importedAt: at, pageCount: 2, shownPages: 2 })).toBe("Devis remis à la personne, joint le 30/10/2026 — 2 pages.");
    expect(devisCaption({ importedAt: at, pageCount: 12, shownPages: 8 })).toMatch(/les 8 premières reproduites ; le devis complet est joint au contrat/);
  });

  it("garde l'extension du fichier d'origine", () => {
    expect(devisExtension("PDF")).toBe("pdf");
    expect(devisExtension("JPEG")).toBe("jpg");
  });
});
