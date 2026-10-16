import { describe, expect, it } from "vitest";
import type { DocumentAnalysisResult } from "@/lib/llm";
import {
  buildReviewProposals,
  countPendingCriteria,
  countProposals,
  describePending,
  establishmentHref,
  nextQueueHref,
  pluralizeProposals,
  reviewItemHref,
  sortReviewQueue,
  toReviewQueueItem,
  REVIEW_QUEUE_BASE_PATH,
  type CriterionProposal,
  type ReviewQueueRow,
} from "./review-queue-service";

const row = (over: Partial<ReviewQueueRow> = {}): ReviewQueueRow => ({
  versionId: "v1",
  versionNumber: 2,
  uploadedAt: new Date("2026-09-28T10:00:00Z"),
  originalFilename: "livret.pdf",
  documentTypeLabel: "Livret d'accueil",
  establishmentId: "e1",
  establishmentName: "SAD Les Glycines (fictif)",
  proposalCount: 3,
  ...over,
});

const analysis = (over: Partial<DocumentAnalysisResult> = {}): DocumentAnalysisResult => ({
  elementsPresents: [],
  elementsManquants: ["Numéro FINESS absent"],
  suggestionsCorrection: ["Ajouter la date de révision", "Citer la charte"],
  sembleConforme: false,
  criteriaCoverage: [],
  criteresSupplementaires: [],
  ...over,
});

const criterion = (over: Partial<CriterionProposal> = {}): CriterionProposal => ({
  kind: "CRITERION",
  id: "s1",
  status: "PENDING",
  criterionCode: "1.2.3",
  criterionLabel: "Expression de la personne",
  isImperative: false,
  justification: "page 3",
  ...over,
});

describe("toReviewQueueItem", () => {
  it("nomme le document par son type, s'ouvre dans la file et mène à la fiche", () => {
    expect(toReviewQueueItem(row())).toEqual({
      versionId: "v1",
      establishmentId: "e1",
      documentLabel: "Livret d'accueil",
      establishmentName: "SAD Les Glycines (fictif)",
      versionLabel: "Version 2",
      uploadedAt: new Date("2026-09-28T10:00:00Z"),
      proposalCount: 3,
      href: "/dashboard/cabinet/a-relire?v=v1",
      establishmentHref: "/dashboard/cabinet/etablissements/e1",
    });
  });

  it("sans type attendu, le nom de fichier désigne le document", () => {
    expect(toReviewQueueItem(row({ documentTypeLabel: null })).documentLabel).toBe("livret.pdf");
  });
});

describe("adresses", () => {
  it("encode les identifiants (jamais concaténés tels quels)", () => {
    expect(reviewItemHref("a/b&c")).toBe("/dashboard/cabinet/a-relire?v=a%2Fb%26c");
    expect(establishmentHref("a/b")).toBe("/dashboard/cabinet/etablissements/a%2Fb");
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

describe("nextQueueHref", () => {
  const items = ["a", "b", "c"].map((id) => toReviewQueueItem(row({ versionId: id })));

  it("passe à l'élément suivant", () => {
    expect(nextQueueHref(items, "a")).toBe(reviewItemHref("b"));
  });

  it("au dernier, revient au premier restant", () => {
    expect(nextQueueHref(items, "c")).toBe(reviewItemHref("a"));
  });

  it("élément hors file (ouvert par l'URL) : le premier de la file", () => {
    expect(nextQueueHref(items, "z")).toBe(reviewItemHref("a"));
  });

  it("dernier élément de la file : la file vide", () => {
    expect(nextQueueHref([items[0]!], "a")).toBe(REVIEW_QUEUE_BASE_PATH);
  });
});

describe("propositions", () => {
  it("critères impératifs d'abord, puis par code ; constats manquants puis corrections", () => {
    const proposals = buildReviewProposals({
      analysis: analysis(),
      criteria: [criterion({ id: "s2", criterionCode: "3.1.2" }), criterion({ id: "s3", criterionCode: "3.14.1", isImperative: true }), criterion()],
    });
    expect(proposals.criteria.map((c) => c.id)).toEqual(["s3", "s1", "s2"]);
    expect(proposals.findings.map((f) => [f.kind, f.text])).toEqual([
      ["MISSING", "Numéro FINESS absent"],
      ["CORRECTION", "Ajouter la date de révision"],
      ["CORRECTION", "Citer la charte"],
    ]);
  });

  it("sans analyse lisible : aucun constat, les critères restent", () => {
    const proposals = buildReviewProposals({ analysis: null, criteria: [criterion()] });
    expect(proposals.findings).toEqual([]);
    expect(proposals.criteria).toHaveLength(1);
  });

  it("seuls les critères en attente restent à trancher", () => {
    const proposals = buildReviewProposals({
      analysis: null,
      criteria: [criterion(), criterion({ id: "s2", status: "CONFIRMED" }), criterion({ id: "s3", status: "REJECTED" })],
    });
    expect(countPendingCriteria(proposals)).toBe(1);
  });

  it("compte affiché dans la file : critères en attente + constats", () => {
    expect(countProposals(analysis(), 2)).toBe(5);
    expect(countProposals(null, 2)).toBe(2);
  });

  it("libellés accordés", () => {
    expect(pluralizeProposals(0)).toBe("aucune proposition");
    expect(pluralizeProposals(1)).toBe("1 proposition");
    expect(pluralizeProposals(4)).toBe("4 propositions");
    expect(describePending(0)).toBe("Tous les critères repérés sont tranchés.");
    expect(describePending(1)).toBe("1 critère repéré à vérifier");
    expect(describePending(3)).toBe("3 critères repérés à vérifier");
  });
});
