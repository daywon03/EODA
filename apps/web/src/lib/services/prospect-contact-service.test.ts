import { describe, expect, it } from "vitest";
import {
  describeAcquisitionChannel,
  describeContactRole,
  formatContactIdentity,
  keepPrecisionOnlyForOther,
  otherPrecisionError,
} from "./prospect-contact-service";

describe("otherPrecisionError", () => {
  it("exige une précision quand la valeur est AUTRE", () => {
    expect(otherPrecisionError("AUTRE", null, "le canal")).toContain("Précisez le canal");
  });

  it("refuse une précision vide ou faite d'espaces", () => {
    expect(otherPrecisionError("AUTRE", "   ", "la fonction")).not.toBeNull();
  });

  it("accepte AUTRE dès qu'une précision est saisie", () => {
    expect(otherPrecisionError("AUTRE", "Salon des ESSMS", "le canal")).toBeNull();
  });

  it("n'exige rien sur une valeur listée", () => {
    expect(otherPrecisionError("LINKEDIN", null, "le canal")).toBeNull();
  });
});

describe("keepPrecisionOnlyForOther", () => {
  it("efface la précision quand la valeur n'est plus AUTRE", () => {
    // Sinon un commentaire orphelin survit et contredit le champ affiché.
    expect(keepPrecisionOnlyForOther("LINKEDIN", "Salon des ESSMS")).toBeNull();
  });

  it("conserve la précision sur AUTRE", () => {
    expect(keepPrecisionOnlyForOther("AUTRE", "Salon des ESSMS")).toBe("Salon des ESSMS");
  });
});

describe("formatContactIdentity", () => {
  const base = { civility: null, contactName: null, contactRole: null, contactRoleOther: null };

  it("compose civilité, nom et fonction", () => {
    expect(
      formatContactIdentity({
        ...base,
        civility: "MADAME",
        contactName: "Dupont",
        contactRole: "DIRECTION",
      })
    ).toBe("Mme Dupont (Direction)");
  });

  it("se contente du nom quand la fonction manque", () => {
    expect(formatContactIdentity({ ...base, contactName: "Dupont" })).toBe("Dupont");
  });

  it("affiche la fonction seule quand le nom manque", () => {
    expect(formatContactIdentity({ ...base, contactRole: "COORDINATION" })).toBe("Coordination");
  });

  it("rend null quand on ne sait rien — jamais une chaîne vide", () => {
    expect(formatContactIdentity(base)).toBeNull();
  });

  it("préfère la précision au libellé « Autre »", () => {
    // Afficher « Autre » alors qu'on a saisi le vrai rôle perd l'information au
    // moment précis où elle sert.
    expect(
      describeContactRole({ contactRole: "AUTRE", contactRoleOther: "Chargée de mission qualité" })
    ).toBe("Chargée de mission qualité");
  });

  it("retombe sur « Autre » si la précision manque sur une fiche ancienne", () => {
    expect(describeContactRole({ contactRole: "AUTRE", contactRoleOther: null })).toBe("Autre");
  });
});

describe("describeAcquisitionChannel", () => {
  it("enrichit « Autre » de sa précision", () => {
    expect(describeAcquisitionChannel({ channel: "AUTRE", channelOther: "Salon des ESSMS" })).toBe(
      "Autre — Salon des ESSMS"
    );
  });

  it("rend le libellé du canal listé", () => {
    expect(describeAcquisitionChannel({ channel: "BOUCHE_A_OREILLE", channelOther: null })).toBe(
      "Bouche-à-oreille"
    );
  });

  it("ignore une précision restée sur un canal listé", () => {
    expect(describeAcquisitionChannel({ channel: "LINKEDIN", channelOther: "résidu" })).toBe(
      "LinkedIn"
    );
  });
});
