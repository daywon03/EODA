import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { ADMISSION_HANDED_DOCUMENTS, allAdmissionPoints } from "@/content/admission/explications";
import { dipcDocumentBlocks, frenchDateTime, planAdmissionDocument, type AdmissionDocumentInput } from "./admission-document-service";
import { prepareDipcForTablet } from "./dipc-tablet-preparation";
import { pngDataUrlToBytes, renderAdmissionPdf, sanitizeForFont, wrapText } from "./admission-pdf";
import { EMPTY_AID, EMPTY_CONTACT, EMPTY_IDENTITY } from "./admission-service";

// PNG 1 × 1 transparent, valide.
const PNG_1X1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const signedAt = new Date("2026-10-26T09:10:00Z");

const input: AdmissionDocumentInput = {
  structureName: "SAD Les Glycines (fictif)",
  identity: { ...EMPTY_IDENTITY, birthName: "Durand", firstName: "Paulette", birthDate: "1938-04-12" },
  aid: { ...EMPTY_AID, kinds: ["APA"], weekdayHours: "20" },
  contact: { ...EMPTY_CONTACT, kind: "CURATEUR", lastName: "Leroy", firstName: "Marc" },
  dipc: { versionNumber: 3, validatedOn: "2026-10-01", sha256: "f".repeat(64), blocks: prepareDipcForTablet("Article 1 — Objet\n\nLe présent document…\r\n  Article 2 — Durée  ").blocks },
  explained: Object.fromEntries(allAdmissionPoints().map((p) => [p.id, "2026-10-26T08:00:00Z"])),
  handed: Object.fromEntries(ADMISSION_HANDED_DOCUMENTS.map((d) => [d.id, "2026-10-26T08:05:00Z"])),
  explanationsVersion: 1,
  staffName: "Camille (fictif)",
  signedAt,
};

describe("plan du contrat", () => {
  const blocks = planAdmissionDocument(input);
  const all = JSON.stringify(blocks);

  it("pose les parties, le texte d'EODA tel quel, puis la trace", () => {
    expect(blocks[0]).toEqual({ kind: "title", text: "Document individuel de prise en charge (DIPC)" });
    expect(all).toContain("DIPC version 3, validé par EODA le 01/10/2026.");
    expect(all).toContain('"value":"DURAND"');
    expect(blocks.filter((b) => b.kind === "paragraph").map((b) => (b as { text: string }).text).slice(0, 3)).toEqual([
      "Article 1 — Objet",
      "Le présent document…",
      "Article 2 — Durée",
    ]);
  });

  it("chaque point expliqué porte son heure et ses critères HAS", () => {
    expect(all).toContain("expliqué à 09:00 · HAS 1.2.3");
    expect(blocks.filter((b) => b.kind === "check")).toHaveLength(allAdmissionPoints().length + ADMISSION_HANDED_DOCUMENTS.length);
  });

  it("sous curatelle : trois signatures, et la note de preuve porte l'empreinte", () => {
    expect(blocks.filter((b) => b.kind === "signature").map((b) => (b as { signer: string }).signer)).toEqual(["PERSONNE", "REPRESENTANT", "SERVICE"]);
    expect(all).toContain(`Empreinte SHA-256 du texte du DIPC validé par EODA : ${"f".repeat(64)}`);
  });

  it("aperçu avant signature : « à signer »", () => {
    expect(JSON.stringify(planAdmissionDocument({ ...input, signedAt: null }))).toContain('"when":"à signer"');
  });

  it("dates à l'heure de Paris", () => {
    expect(frenchDateTime(signedAt)).toBe("26/10/2026 à 10:10");
    expect(dipcDocumentBlocks([{ kind: "heading", text: "Volet aide" }, { kind: "bullet", text: "Le livret" }])).toEqual([
      { kind: "heading", text: "Volet aide" },
      { kind: "paragraph", text: "• Le livret" },
    ]);
  });
});

describe("rendu PDF", () => {
  it("coupe les lignes, et un mot trop long lettre à lettre", () => {
    const measure = (s: string) => s.length;
    expect(wrapText("un deux trois quatre", measure, 9)).toEqual(["un deux", "trois", "quatre"]);
    expect(wrapText("abcdefghij", measure, 4)).toEqual(["abcd", "efgh", "ij"]);
    expect(wrapText("", measure, 4)).toEqual([""]);
  });

  it("remplace ce que la police ne sait pas écrire au lieu d'échouer", () => {
    const latin = new Set([..."Ae >=-?".split("").map((c) => c.codePointAt(0)!)]);
    expect(sanitizeForFont("A e ≥ 😀", latin)).toBe("A e >= ?");
    // Caractères mesurés dans un vrai DIPC (27/10/2026) : cases, ciseau, retour de note.
    const withBrackets = new Set([..."[ ]x-".split("").map((c) => c.codePointAt(0)!)]);
    expect(sanitizeForFont("□ ☐ ✂-- ↑​", withBrackets)).toBe("[ ] [ ] -- ");
  });

  it("produit un PDF valide, paginé, signé, titré", async () => {
    const png = pngDataUrlToBytes(PNG_1X1)!;
    const long = { ...input, dipc: { ...input.dipc, blocks: prepareDipcForTablet(Array.from({ length: 120 }, (_, i) => `Article ${i} — Œuvre, « été » à 100 € ; ≥ ✓ ☒ 😀`).join("\n")).blocks } };
    const bytes = await renderAdmissionPdf({
      blocks: planAdmissionDocument(long),
      signatures: { PERSONNE: png, REPRESENTANT: png, SERVICE: png },
      footer: "DIPC — SAD Les Glycines (fictif) — DURAND Paulette",
      title: "DIPC — DURAND Paulette",
      signedAt,
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(2);
    expect(doc.getTitle()).toBe("DIPC — DURAND Paulette");
    expect(doc.getCreationDate()?.toISOString()).toBe(signedAt.toISOString());
  });

  it("refuse une image qui n'est pas un PNG en data URL", () => {
    expect(pngDataUrlToBytes("data:image/jpeg;base64,AAAA")).toBeNull();
    expect(pngDataUrlToBytes("javascript:alert(1)")).toBeNull();
  });
});
