import { describe, expect, it } from "vitest";
import { readStoredAnalysis } from "./stored-analysis-service";

describe("readStoredAnalysis", () => {
  it("une analyse enregistrée avant le garde montre « [mot illisible] » au lieu du mot étranger", () => {
    const analysis = readStoredAnalysis({
      elementsPresents: [{ text: "Coordination", source: "La coordination est assurée." }],
      elementsManquants: ["la charte de bientraitance,构成uant le plan"],
      suggestionsCorrection: [],
      sembleConforme: false,
      criteriaCoverage: [],
      criteresSupplementaires: [{ criterionCode: "2.9.1", justification: "ce qui规范ise la coordination" }],
    });
    expect(analysis?.elementsManquants).toEqual(["la charte de bientraitance, [mot illisible] uant le plan"]);
    expect(analysis?.criteresSupplementaires[0]?.justification).toBe("ce qui [mot illisible] ise la coordination");
    expect(analysis?.elementsPresents[0]?.source).toBe("La coordination est assurée.");
  });

  it("rien d'exploitable reste « pas encore analysé »", () => {
    expect(readStoredAnalysis(null)).toBeNull();
  });
});
