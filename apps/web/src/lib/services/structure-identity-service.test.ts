import { describe, expect, it } from "vitest";
import {
  describeStructureIdentityLine,
  finessConflictError,
  finessFormatError,
  normaliseFiness,
  resolveSignatureDefaults,
  type StructureIdentity,
} from "./structure-identity-service";

function identity(overrides: Partial<StructureIdentity> = {}): StructureIdentity {
  return {
    finessNumber: null,
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

describe("resolveSignatureDefaults", () => {
  it("part des valeurs du prospect quand aucune fiche n'existe", () => {
    const prospect = identity({ finessNumber: "930034459", address: "Le Blanc-Mesnil" });
    expect(resolveSignatureDefaults({ prospect, establishment: null })).toEqual(prospect);
  });

  it("laisse la fiche primer sur le prospect — une fois créée, c'est elle qui fait foi", () => {
    const result = resolveSignatureDefaults({
      prospect: identity({ address: "ancienne adresse", establishmentType: "SAD_AIDE" }),
      establishment: identity({ address: "adresse de la fiche" }),
    });
    expect(result.address).toBe("adresse de la fiche");
    // Champ absent de la fiche : le prospect comble le trou plutôt que de laisser vide.
    expect(result.establishmentType).toBe("SAD_AIDE");
  });
});

describe("describeStructureIdentityLine", () => {
  it("compose adresse et FINESS", () => {
    expect(
      describeStructureIdentityLine(
        identity({ address: "12 rue des Lilas", finessNumber: "930034459" })
      )
    ).toBe("12 rue des Lilas · FINESS 930034459");
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
