import { describe, expect, it } from "vitest";
import {
  describeStructureIdentityLine,
  finessConflictError,
  finessFormatError,
  normaliseFiness,
  normaliseSiret,
  resolveSignatureDefaults,
  siretFormatError,
  type StructureIdentity,
} from "./structure-identity-service";

function identity(overrides: Partial<StructureIdentity> = {}): StructureIdentity {
  return {
    finessNumber: null,
    siretNumber: null,
    address: null,
    establishmentType: null,
    hasEvaluationTargetDate: null,
    ...overrides,
  };
}

describe("normaliseFiness", () => {
  it("accepte les séparateurs de saisie", () => {
    // « 93 00 34 459 » est le même numéro que « 930034459 » : refuser la première
    // forme n'apprend rien à personne.
    expect(normaliseFiness("93 00 34 459")).toBe("930034459");
    expect(normaliseFiness("930-034.459")).toBe("930034459");
  });

  it("traite une saisie vide comme absente", () => {
    expect(normaliseFiness("   ")).toBeNull();
    expect(normaliseFiness(null)).toBeNull();
  });
});

describe("finessFormatError", () => {
  it("n'exige rien quand le champ est vide — il est facultatif au stade prospect", () => {
    expect(finessFormatError(null)).toBeNull();
  });

  it("accepte 9 chiffres", () => {
    expect(finessFormatError("930034459")).toBeNull();
  });

  it("refuse ce qui ne peut pas être un FINESS", () => {
    // Un FINESS faux sur un document remis à la HAS est un vrai problème.
    expect(finessFormatError("12345")).toContain("9 chiffres");
    expect(finessFormatError("93003445A")).toContain("9 chiffres");
    expect(finessFormatError("9300344599")).toContain("9 chiffres");
  });
});

describe("normaliseSiret", () => {
  it("accepte les groupes de saisie", () => {
    // Un SIRET s'écrit couramment « 802 341 209 00016 ».
    expect(normaliseSiret("802 341 209 00016")).toBe("80234120900016");
  });

  it("traite une saisie vide comme absente", () => {
    expect(normaliseSiret("  ")).toBeNull();
    expect(normaliseSiret(null)).toBeNull();
  });
});

describe("siretFormatError", () => {
  it("n'exige rien quand le champ est vide — il ne bloque aucune signature", () => {
    expect(siretFormatError(null)).toBeNull();
  });

  it("accepte 14 chiffres", () => {
    expect(siretFormatError("80234120900016")).toBeNull();
  });

  it("refuse un FINESS saisi dans la case SIRET", () => {
    // Le cas d'erreur réel : les deux numéros vivent côte à côte à l'écran, et ils
    // n'identifient pas la même chose.
    expect(siretFormatError("930034459")).toContain("14 chiffres");
    expect(siretFormatError("8023412090001A")).toContain("14 chiffres");
  });
});

describe("resolveSignatureDefaults", () => {
  it("part des valeurs du prospect quand aucune fiche n'existe", () => {
    const prospect = identity({ finessNumber: "930034459", address: "Le Blanc-Mesnil" });
    expect(resolveSignatureDefaults({ prospect, establishment: null })).toEqual(prospect);
  });

  it("laisse la fiche primer sur le prospect — une fois créée, c'est elle qui fait foi", () => {
    const result = resolveSignatureDefaults({
      prospect: identity({
        address: "ancienne adresse",
        establishmentType: "SAD_AIDE",
        siretNumber: "80234120900016",
      }),
      establishment: identity({ address: "adresse de la fiche" }),
    });
    expect(result.address).toBe("adresse de la fiche");
    // Le SIRET noté en prospection remonte sur la fiche qui ne l'a pas encore : c'est
    // exactement ce que la saisie au premier contact doit éviter de faire ressaisir.
    expect(result.siretNumber).toBe("80234120900016");
    // Champ absent de la fiche : le prospect comble le trou plutôt que de laisser vide.
    expect(result.establishmentType).toBe("SAD_AIDE");
  });
});

describe("describeStructureIdentityLine", () => {
  it("compose adresse, FINESS et SIRET", () => {
    expect(
      describeStructureIdentityLine(
        identity({
          address: "12 rue des Lilas",
          finessNumber: "930034459",
          siretNumber: "80234120900016",
        })
      )
    ).toBe("12 rue des Lilas · FINESS 930034459 · SIRET 80234120900016");
  });

  it("préfixe le nom de la structure quand on le lui donne — l'en-tête de contrat", () => {
    // Cette variante était une SECONDE fonction, dans contract-service. Elle est ici
    // pour que le SIRET n'ait pas eu à être ajouté deux fois.
    expect(
      describeStructureIdentityLine({
        ...identity({ finessNumber: "930034459" }),
        structureName: "ASSAD Benoit",
      })
    ).toBe("ASSAD Benoit · FINESS 930034459");
  });

  it("omet le SIRET absent plutôt que d'écrire un tiret", () => {
    expect(
      describeStructureIdentityLine(identity({ finessNumber: "930034459" }))
    ).toBe("FINESS 930034459");
  });

  it("rend null quand on ne sait encore rien, plutôt qu'une ligne de tirets", () => {
    expect(describeStructureIdentityLine(identity())).toBeNull();
  });
});

describe("finessConflictError", () => {
  it("ne dit rien quand le numéro est libre", () => {
    expect(finessConflictError(false)).toBeNull();
  });

  it("nomme le vrai problème plutôt que « conversion déjà enregistrée »", () => {
    // Sans ce message, la contrainte unique tombait dans le catch général de la
    // conversion, qui annonce le contraire de ce qui s'est passé.
    const error = finessConflictError(true);
    expect(error).toContain("déjà rattaché à une fiche client");
    expect(error).not.toContain("déjà enregistrée");
  });
});
