import { describe, expect, it } from "vitest";
import {
  avenantStartingTotalEuros,
  buildAvenantFileName,
  describeContractReference,
  needsAvenant,
  selectAvenantLines,
  type MissionOptionLine,
} from "./avenant-service";

function option(overrides: Partial<MissionOptionLine> = {}): MissionOptionLine {
  return {
    catalogueOptionId: "opt-1",
    labelSnapshot: "Sensibilisation des équipes",
    priceSnapshotEuros: 900,
    pricingUnitSnapshot: "FORFAIT",
    priceMaxSnapshotEuros: null,
    minQuantitySnapshot: null,
    priceIsFirm: false,
    ...overrides,
  };
}

describe("selectAvenantLines", () => {
  it("ne retient que les options hors contrat initial", () => {
    // Une option issue d'un devis signé est DÉJÀ au contrat : la remettre dans
    // l'avenant ferait signer deux fois la même chose.
    const lines = selectAvenantLines([
      option({ catalogueOptionId: "a", priceIsFirm: true }),
      option({ catalogueOptionId: "b", priceIsFirm: false }),
    ]);

    expect(lines.map((l) => l.catalogueOptionId)).toEqual(["b"]);
  });
});

describe("needsAvenant", () => {
  it("est faux quand tout le périmètre vient du devis signé", () => {
    expect(needsAvenant([option({ priceIsFirm: true })])).toBe(false);
  });

  it("est faux sur une mission sans option", () => {
    expect(needsAvenant([])).toBe(false);
  });

  it("est vrai dès une option rattachée à la main", () => {
    expect(needsAvenant([option({ priceIsFirm: true }), option({ priceIsFirm: false })])).toBe(true);
  });
});

describe("avenantStartingTotalEuros", () => {
  it("additionne les seules lignes de l'avenant", () => {
    const total = avenantStartingTotalEuros([
      option({ priceSnapshotEuros: 900, priceIsFirm: false }),
      option({ catalogueOptionId: "b", priceSnapshotEuros: 1500, priceIsFirm: false }),
      option({ catalogueOptionId: "c", priceSnapshotEuros: 6500, priceIsFirm: true }),
    ]);

    expect(total).toBe(2400);
  });
});

describe("buildAvenantFileName", () => {
  const issuedOn = new Date(2026, 7, 26);

  it("suit la convention EODA et référence le devis initial", () => {
    expect(
      buildAvenantFileName({
        structureName: "ASSAD Benoit",
        issuedOn,
        contractReference: "DEV-2026-014",
      })
    ).toBe("20260826_AVENANT_ASSAD-Benoit_DEV-2026-014_v01_Externe.pdf");
  });

  it("n'invente pas de référence contractuelle quand il n'y a pas de devis", () => {
    expect(
      buildAvenantFileName({ structureName: "ASSAD Benoit", issuedOn, contractReference: null })
    ).toContain("_Perimetre-mission_");
  });
});

describe("describeContractReference", () => {
  it("rattache l'avenant au devis signé, date comprise", () => {
    const phrase = describeContractReference({
      contractReference: "DEV-2026-014",
      signedOn: new Date("2026-07-01T00:00:00Z"),
    });

    expect(phrase).toContain("DEV-2026-014");
    expect(phrase).toContain("juillet 2026");
    expect(phrase).toContain("conditions restent inchangées");
  });

  it("ne parle pas d'un devis inexistant", () => {
    // Un document contractuel faux est pire qu'un document absent.
    const phrase = describeContractReference({ contractReference: null, signedOn: null });
    expect(phrase).not.toContain("devis");
  });

  it("omet la date quand la signature n'est pas datée", () => {
    const phrase = describeContractReference({ contractReference: "DEV-1", signedOn: null });
    expect(phrase).toContain("DEV-1");
    expect(phrase).not.toContain("signé le");
  });
});
