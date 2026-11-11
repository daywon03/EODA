import { describe, expect, it } from "vitest";
import {
  ASSISTANT_ADDITION_REASON,
  additionInsertIndex,
  insertAssistantAddition,
  nextAssistantAdditionId,
  proposalFromParagraphs,
} from "./assistant-addition-service";
import { VERSION_OR_DATE_PLACEHOLDER, type CorrectionProposal } from "@/lib/llm/correction-proposal";

const base = (): CorrectionProposal =>
  proposalFromParagraphs(["3. Vos droits", "Vous êtes associé à « votre projet personnalisé ».", "4. Vos réclamations"]);
const ctx = { knownCriterionCodes: new Set(["1.2.5"]), originalText: "Version 1 du 04/11/2026" };

describe("additionInsertIndex", () => {
  it("place après le passage qui contient la citation, guillemets, casse et espaces ignorés", () => {
    expect(additionInsertIndex(base().segments, "vous êtes associé à   VOTRE projet")).toBe(2);
  });
  it("citation absente, trop courte ou introuvable : pas d'emplacement inventé", () => {
    expect(additionInsertIndex(base().segments, null)).toBeNull();
    expect(additionInsertIndex(base().segments, "Vos")).toBeNull();
    expect(additionInsertIndex(base().segments, "phrase qui n'existe nulle part")).toBeNull();
  });
  it("ne s'ancre jamais sur un autre ajout", () => {
    const withAddition: CorrectionProposal = {
      ...base(),
      segments: [{ kind: "AJOUT", id: "a", text: "Le recours est gratuit et ouvert.", criterionCode: null, reason: "", manualQuote: null, anchor: null }],
    };
    expect(additionInsertIndex(withAddition.segments, "Le recours est gratuit")).toBeNull();
  });
});

describe("insertAssistantAddition", () => {
  it("insère un AJOUT marqué comme venant de l'assistant, sans toucher l'original", () => {
    const original = base();
    const { proposal, addition, anchored } = insertAssistantAddition(
      original,
      { text: " Une personne qualifiée peut être saisie. ", anchor: "votre projet personnalisé", criterionCode: "1.2.5" },
      ctx
    );
    expect(anchored).toBe(true);
    expect(proposal.segments).toHaveLength(4);
    expect(proposal.segments[2]).toEqual(addition);
    expect(addition).toMatchObject({
      kind: "AJOUT",
      id: "assistant-1",
      text: "Une personne qualifiée peut être saisie.",
      criterionCode: "1.2.5",
      reason: ASSISTANT_ADDITION_REASON,
      manualQuote: null,
    });
    expect(original.segments).toHaveLength(3);
  });

  it("citation introuvable : en fin de document, et le dit", () => {
    const { proposal, anchored } = insertAssistantAddition(base(), { text: "Ajout.", anchor: "introuvable ici du tout", criterionCode: null }, ctx);
    expect(anchored).toBe(false);
    expect(proposal.segments.at(-1)).toMatchObject({ kind: "AJOUT" });
  });

  it("code de critère hors référentiel retiré ; date absente du document remplacée", () => {
    const { addition } = insertAssistantAddition(
      base(),
      { text: "Mis à jour le 12/12/2026.", anchor: null, criterionCode: "9.9.9" },
      ctx
    );
    expect(addition.criterionCode).toBeNull();
    expect(addition.text).toContain(VERSION_OR_DATE_PLACEHOLDER);
  });

  it("deux ajouts de l'assistant ne partagent jamais un identifiant", () => {
    const first = insertAssistantAddition(base(), { text: "Un.", anchor: null, criterionCode: null }, ctx).proposal;
    expect(nextAssistantAdditionId(first)).toBe("assistant-2");
  });
});
