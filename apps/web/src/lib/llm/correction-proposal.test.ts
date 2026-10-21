import { describe, expect, it } from "vitest";
import {
  CORRECTION_PROPOSAL_JSON_SCHEMA,
  InvalidProposalError,
  parseCorrectionProposalJson,
  protectVersionsAndDates,
  readStoredProposal,
  VERSION_OR_DATE_PLACEHOLDER,
  sanitizeProposal,
  validateCorrectionProposal,
} from "./correction-proposal";
import { buildStubProposal } from "./stub-analysis-adapter";

// Le JSON du modèle est une entrée non fiable : validé contre le schéma, puis purgé de
// ce qui n'est pas prouvable (code inconnu, citation absente des extraits).

const RAW = {
  segments: [
    { kind: "ORIGINAL", id: "", text: "Article 1", criterionCode: "", reason: "", manualQuote: "", anchor: "" },
    { kind: "AJOUT", id: "a1", text: "Permanence.", criterionCode: "3.12.1", reason: "Informer.", manualQuote: "Le service informe", anchor: "Article 1" },
  ],
};

describe("schéma de sortie", () => {
  it("le schéma imposé exige tous les champs, sans champ libre", () => {
    expect(CORRECTION_PROPOSAL_JSON_SCHEMA.properties.segments.items.required).toEqual([
      "kind", "id", "text", "criterionCode", "reason", "manualQuote", "anchor",
    ]);
    expect(CORRECTION_PROPOSAL_JSON_SCHEMA.additionalProperties).toBe(false);
  });

  it("lit une sortie conforme ; les chaînes vides deviennent « sans information »", () => {
    const proposal = parseCorrectionProposalJson(JSON.stringify(RAW));
    expect(proposal.schemaVersion).toBe(1);
    expect(proposal.segments[0]).toEqual({ kind: "ORIGINAL", text: "Article 1" });
    expect(proposal.segments[1]).toMatchObject({ kind: "AJOUT", id: "a1", criterionCode: "3.12.1", anchor: "Article 1" });
  });

  it("refuse un JSON illisible, sans segments, ou vide", () => {
    expect(() => parseCorrectionProposalJson("pas du json")).toThrow(InvalidProposalError);
    expect(() => validateCorrectionProposal({ document: "texte" })).toThrow(InvalidProposalError);
    expect(() => validateCorrectionProposal({ segments: [{ kind: "INCONNU", text: "x" }, { kind: "ORIGINAL", text: " " }, "x"] })).toThrow(
      InvalidProposalError
    );
  });

  it("écarte un segment malformé, attribue un identifiant unique aux ajouts", () => {
    const proposal = validateCorrectionProposal({
      segments: [
        { kind: "AJOUT", id: "a1", text: "Un" },
        { kind: "AJOUT", id: "a1", text: "Deux" },
        { kind: "AJOUT", text: "Trois", reason: 4 },
        { kind: "ORIGINAL", text: 12 },
      ],
    });
    const ids = proposal.segments.map((s) => (s.kind === "AJOUT" ? s.id : ""));
    expect(new Set(ids).size).toBe(3);
    expect(proposal.segments[2]).toMatchObject({ reason: expect.stringContaining("Ajout proposé") });
  });

  it("une proposition stockée illisible vaut null", () => {
    expect(readStoredProposal({ nope: true })).toBeNull();
    expect(readStoredProposal(RAW)).not.toBeNull();
  });
});

describe("sanitizeProposal", () => {
  const proposal = validateCorrectionProposal(RAW);

  it("garde un code connu et une citation retrouvée mot pour mot dans les extraits (espaces et casse près)", () => {
    const clean = sanitizeProposal(proposal, {
      knownCriterionCodes: new Set(["3.12.1"]),
      knowledgeExcerpts: ["Critère 3.12.1 : le   service INFORME la personne."],
      originalText: "Article 1",
    });
    expect(clean.segments[1]).toMatchObject({ criterionCode: "3.12.1", manualQuote: "Le service informe" });
  });

  it("retire un code inventé et une citation introuvable", () => {
    const clean = sanitizeProposal(proposal, { knownCriterionCodes: new Set(["2.2.2"]), knowledgeExcerpts: ["Autre texte."], originalText: "Article 1" });
    expect(clean.segments[1]).toMatchObject({ criterionCode: null, manualQuote: null });
    expect(clean.segments[0]).toEqual(proposal.segments[0]);
  });
});

// Call du 18/10/2026 : l'IA ne touche jamais aux numéros de version ni aux dates.
describe("versions et dates", () => {
  const ORIGINAL_TEXT = "Règlement de fonctionnement — Version 3 du 12/03/2025. Loi n° 2002-2 du 2 janvier 2002.";
  const ctx = { knownCriterionCodes: new Set<string>(), knowledgeExcerpts: [] as string[], originalText: ORIGINAL_TEXT };

  it("garde les versions et dates qui figurent dans la source", () => {
    expect(protectVersionsAndDates("Version 3 du 12/03/2025, loi du 2 janvier 2002", ORIGINAL_TEXT.toLowerCase())).toBe(
      "Version 3 du 12/03/2025, loi du 2 janvier 2002"
    );
  });

  it("remplace une version « corrigée » dans un segment recopié de l'original", () => {
    const clean = sanitizeProposal(validateCorrectionProposal({ segments: [{ kind: "ORIGINAL", text: "Version 4 du 21/10/2026" }] }), ctx);
    expect(clean.segments[0]?.text).toBe(`${VERSION_OR_DATE_PLACEHOLDER} du ${VERSION_OR_DATE_PLACEHOLDER}`);
  });

  it("ne laisse aucun ajout inventer une version ou une date", () => {
    const clean = sanitizeProposal(
      validateCorrectionProposal({ segments: [{ kind: "AJOUT", id: "a1", text: "Mis à jour le 1er octobre 2026 (v2.1)." }] }),
      ctx
    );
    expect(clean.segments[0]?.text).toBe(`Mis à jour le ${VERSION_OR_DATE_PLACEHOLDER} (${VERSION_OR_DATE_PLACEHOLDER}).`);
  });

  it("n'altère pas un texte sans version ni date", () => {
    expect(protectVersionsAndDates("Article 12 : la personne est informée.", "")).toBe("Article 12 : la personne est informée.");
    // Un code de critère HAS n'est pas une date.
    expect(protectVersionsAndDates("Critères 1.10.12 et 3.12.1.", "")).toBe("Critères 1.10.12 et 3.12.1.");
  });
});

describe("adaptateur de repli (local)", () => {
  it("produit une proposition structurée plausible : l'original entier, deux ajouts, des champs à compléter", () => {
    const proposal = buildStubProposal({
      documentTypeLabel: "Règlement",
      extractedText: "Article 1\n\nArticle 2",
      linkedCriteria: [{ code: "3.12.1", label: "Plaintes" }],
      elementsManquants: [],
      suggestionsCorrection: [],
    });
    expect(proposal.segments.filter((s) => s.kind === "ORIGINAL").map((s) => s.text)).toEqual(["Article 1", "Article 2"]);
    const additions = proposal.segments.filter((s) => s.kind === "AJOUT");
    expect(additions).toHaveLength(2);
    expect(additions[0]).toMatchObject({ criterionCode: "3.12.1" });
    expect(additions[0]!.text).toContain("[À compléter");
    expect(buildStubProposal({ documentTypeLabel: "X", extractedText: "", linkedCriteria: [], elementsManquants: [], suggestionsCorrection: [] }).segments[1]).toMatchObject({
      criterionCode: null,
    });
  });
});
