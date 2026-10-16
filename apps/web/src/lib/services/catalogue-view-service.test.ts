import { describe, expect, it } from "vitest";
import { describeStructuresOnOffer, splitOfferItems } from "./catalogue-view-service";

describe("contenu d'une offre en lignes", () => {
  it("coupe aux retours à la ligne et aux « · », sans ligne vide", () => {
    expect(splitOfferItems("Diagnostic sur la plateforme\nRapport · Plan d'action\n\n")).toEqual([
      "Diagnostic sur la plateforme",
      "Rapport",
      "Plan d'action",
    ]);
  });

  it("sans description, aucune ligne inventée", () => {
    expect(splitOfferItems(null)).toEqual([]);
    expect(splitOfferItems("   ")).toEqual([]);
  });
});

describe("structures sur une offre", () => {
  it("accorde le nombre", () => {
    expect(describeStructuresOnOffer(0)).toBe("Aucune structure sur cette offre");
    expect(describeStructuresOnOffer(1)).toBe("1 structure sur cette offre");
    expect(describeStructuresOnOffer(3)).toBe("3 structures sur cette offre");
  });
});
