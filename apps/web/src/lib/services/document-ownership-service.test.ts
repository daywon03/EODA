import { describe, expect, it } from "vitest";
import {
  buildContractualMention,
  buildOwnershipMention,
  EODA_LEGAL_NAME,
} from "./document-ownership-service";

describe("buildOwnershipMention", () => {
  const mention = buildOwnershipMention("ASSAD BENOIT");

  it("nomme l'auteur, le cadre, et le bénéficiaire du droit d'usage", () => {
    // Le texte a été dicté en séance : créé par EODA dans le cadre de
    // l'accompagnement, propriété EODA, droit d'exploitation concédé à la structure.
    expect(mention).toContain(EODA_LEGAL_NAME);
    expect(mention).toContain("ASSAD BENOIT");
    expect(mention).toContain("Propriété");
    expect(mention).toContain("droit d'exploitation");
  });

  it("reste lisible quand le nom de la structure manque", () => {
    // Une mention juridique avec un trou à la place du bénéficiaire ne vaut rien.
    expect(buildOwnershipMention("   ")).toContain("la structure accompagnée");
  });
});

describe("buildContractualMention", () => {
  const mention = buildContractualMention("ASSAD BENOIT");

  it("ne revendique aucune propriété sur un document contractuel", () => {
    // Prétendre détenir les droits sur un devis serait faux : EODA y propose, elle
    // n'y produit pas une œuvre pour le client.
    expect(mention).not.toContain("Propriété");
    expect(mention).not.toContain("droit d'exploitation");
  });

  it("rappelle que la prestation n'est pas une évaluation HAS officielle", () => {
    // Positionnement conseil, jamais évaluateur (CLAUDE.md §1).
    expect(mention).toContain("ne constitue pas une évaluation HAS officielle");
  });
});
