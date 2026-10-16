import { describe, expect, it } from "vitest";
import { buildPacTitle, proposePacActions, type PacCriterionInput } from "./pac-proposal-service";

function criterion(overrides: Partial<PacCriterionInput>): PacCriterionInput {
  return { criterionId: "c", code: "1.1.1", label: "Critère", score: 2, isImperative: false, documents: [], ...overrides };
}

describe("proposePacActions — context/10 §6", () => {
  it("seuls les critères cotés SOUS 4 génèrent une action (★ = 4, non coté = rien)", () => {
    const proposals = proposePacActions(
      [
        criterion({ criterionId: "a", score: 3.5 }),
        criterion({ criterionId: "b", score: 4 }),
        criterion({ criterionId: "c", score: null }),
      ],
      new Set()
    );
    expect(proposals.map((p) => p.criterionId)).toEqual(["a"]);
  });

  it("verbe + document : rédiger ce qui manque d'abord, sinon compléter ; pilote = une fonction", () => {
    const [p] = proposePacActions(
      [
        criterion({
          code: "2.2.5",
          documents: [
            { documentTypeLabel: "Livret d'accueil", documentId: "d-livret", deposited: true },
            { documentTypeLabel: "Formulaire droit à l'image", documentId: null, deposited: false },
          ],
        }),
      ],
      new Set()
    );
    expect(p?.title).toBe("Rédiger « Formulaire droit à l'image » pour le critère 2.2.5");
    expect(p?.linkedDocumentId).toBeNull();
    // Confiée à la structure, sans fonction : personne n'a choisi de pilote, l'écran
    // ne doit donc pas annoncer « Responsable Qualité » (test de bout en bout, 12/10).
    expect(p?.ownerFunction).toBeNull();
    expect(buildPacTitle("1.2.1", { documentTypeLabel: "DIPC", documentId: "d", deposited: true })).toBe(
      "Compléter « DIPC » pour le critère 1.2.1"
    );
    expect(buildPacTitle("1.2.1", null)).toBe("Définir et tracer la preuve du critère 1.2.1");
  });

  it("pas de seconde action PAC sur un critère qui en a déjà une ouverte", () => {
    expect(proposePacActions([criterion({ criterionId: "a" })], new Set(["a"]))).toEqual([]);
  });

  it("impératifs d'abord, puis l'ordre des codes", () => {
    const proposals = proposePacActions(
      [
        criterion({ criterionId: "x", code: "1.10.1" }),
        criterion({ criterionId: "y", code: "1.2.1" }),
        criterion({ criterionId: "z", code: "3.11.1", isImperative: true }),
      ],
      new Set()
    );
    expect(proposals.map((p) => p.criterionId)).toEqual(["z", "y", "x"]);
  });
});
