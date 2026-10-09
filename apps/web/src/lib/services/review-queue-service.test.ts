import { describe, expect, it } from "vitest";
import { reviewItemHref, sortReviewQueue, toReviewQueueItem, type ReviewQueueRow } from "./review-queue-service";

const row = (over: Partial<ReviewQueueRow> = {}): ReviewQueueRow => ({
  versionId: "v1",
  versionNumber: 2,
  uploadedAt: new Date("2026-09-28T10:00:00Z"),
  originalFilename: "livret.pdf",
  documentTypeLabel: "Livret d'accueil",
  establishmentId: "e1",
  establishmentName: "SAD Les Glycines (fictif)",
  ...over,
});

describe("toReviewQueueItem", () => {
  it("nomme le document par son type et mène à la fiche de la structure", () => {
    expect(toReviewQueueItem(row())).toEqual({
      versionId: "v1",
      documentLabel: "Livret d'accueil",
      establishmentName: "SAD Les Glycines (fictif)",
      versionLabel: "Version 2",
      uploadedAt: new Date("2026-09-28T10:00:00Z"),
      href: "/dashboard/cabinet/etablissements/e1",
    });
  });

  it("sans type attendu, le nom de fichier désigne le document", () => {
    expect(toReviewQueueItem(row({ documentTypeLabel: null })).documentLabel).toBe("livret.pdf");
  });
});

describe("reviewItemHref", () => {
  it("encode l'identifiant (jamais concaténé tel quel dans une adresse)", () => {
    expect(reviewItemHref("a/b")).toBe("/dashboard/cabinet/etablissements/a%2Fb");
  });
});

describe("sortReviewQueue", () => {
  it("du plus ancien au plus récent, sans modifier la liste reçue", () => {
    const recent = toReviewQueueItem(row({ versionId: "recent", uploadedAt: new Date("2026-10-05") }));
    const old = toReviewQueueItem(row({ versionId: "old", uploadedAt: new Date("2026-09-01") }));
    const input = [recent, old];
    expect(sortReviewQueue(input).map((i) => i.versionId)).toEqual(["old", "recent"]);
    expect(input.map((i) => i.versionId)).toEqual(["recent", "old"]);
  });
});
