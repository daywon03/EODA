import { describe, expect, it } from "vitest";
import { frenchDay, requiredSigners, signerName, EMPTY_IDENTITY } from "./admission-service";
import {
  EMPTY_TRUSTED_PERSON,
  isTrustedPersonDesignated,
  parseTrustedPerson,
  trustedPersonName,
  trustedPersonProblems,
  trustedPersonValues,
} from "./trusted-person-service";

const jeanne = { ...EMPTY_TRUSTED_PERSON, presence: "PRESENTE" as const, lastName: "Exemple", firstName: "Jeanne", birthDate: "1970-05-04", birthPlace: "Ville-Fictive", relation: "Fille", address: "3 allée Fictive", postalCode: "93000", city: "Ville-Fictive", email: "jeanne@exemple.fr" };

describe("personne de confiance (annexe 3.2)", () => {
  it("aucune désignée : un choix valable, rien n'est exigé ni écrit", () => {
    expect(isTrustedPersonDesignated(EMPTY_TRUSTED_PERSON)).toBe(false);
    expect(trustedPersonProblems(EMPTY_TRUSTED_PERSON)).toEqual([]);
    expect(trustedPersonName(null)).toBe("");
    expect(Object.values(trustedPersonValues(null, frenchDay)).every((v) => v === "")).toBe(true);
  });

  it("désignée : nom et prénom exigés ; absente, l'e-mail aussi (pour lui envoyer le formulaire)", () => {
    expect(trustedPersonProblems({ ...EMPTY_TRUSTED_PERSON, presence: "PRESENTE" })).toEqual(["Écrivez le nom et le prénom de la personne de confiance."]);
    expect(trustedPersonProblems({ ...jeanne, presence: "ABSENTE", email: "" })).toEqual([
      "Écrivez l'e-mail de la personne de confiance, pour lui envoyer le formulaire à cosigner.",
    ]);
    expect(trustedPersonProblems({ ...jeanne, email: "x", phone: "abc", postalCode: "1", birthDate: "04/05/1970", relation: "x".repeat(200) })).toHaveLength(5);
  });

  it("remplit les champs de l'annexe", () => {
    expect(trustedPersonValues(jeanne, frenchDay)).toEqual({
      "confiance.nom": "Jeanne EXEMPLE",
      "confiance.naissance": "04/05/1970 à Ville-Fictive",
      "confiance.qualite": "Fille",
      "confiance.adresse": "3 allée Fictive, 93000 Ville-Fictive",
      "confiance.telephone": "",
      "confiance.email": "jeanne@exemple.fr",
    });
  });

  it("présente, elle cosigne ; absente, sa cosignature se recueille ensuite", () => {
    expect(requiredSigners(null, jeanne)).toEqual(["PERSONNE", "CONFIANCE", "SERVICE"]);
    expect(requiredSigners({ kind: "TUTEUR" } as never, jeanne)).toEqual(["REPRESENTANT", "CONFIANCE", "SERVICE"]);
    expect(requiredSigners(null, { ...jeanne, presence: "ABSENTE" })).toEqual(["PERSONNE", "SERVICE"]);
    expect(signerName("CONFIANCE", EMPTY_IDENTITY, null, "Camille", jeanne)).toBe("EXEMPLE Jeanne");
  });

  it("relit défensivement ce que la tablette a rangé", () => {
    expect(parseTrustedPerson(null)).toBeNull();
    expect(parseTrustedPerson({ presence: "PEUT-ETRE" })).toBeNull();
    expect(parseTrustedPerson({ ...jeanne, birthDate: "hier", email: 42 })).toEqual({ ...jeanne, birthDate: "", email: "" });
  });
});
