import { describe, expect, it } from "vitest";
import {
  buildContractFileName,
  canIssueContract,
  countOptionsPendingAvenant,
  describeContractBasis,
  describePendingAvenant,
  selectContractOptions,
} from "./contract-service";

describe("canIssueContract", () => {
  it("refuse un contrat sans devis signé — il n'y aurait aucun montant ferme à signer", () => {
    expect(
      canIssueContract({ devisNumber: null, totalAmountEuros: null, gratuit: false })
    ).toBe(false);
  });

  it("refuse un contrat dont le devis existe mais sans montant", () => {
    expect(
      canIssueContract({ devisNumber: "D-2026-001", totalAmountEuros: null, gratuit: false })
    ).toBe(false);
  });

  it("accepte le bêta-test gratuit, dont la contrepartie n'est pas financière", () => {
    expect(canIssueContract({ devisNumber: null, totalAmountEuros: null, gratuit: true })).toBe(
      true
    );
  });

  it("accepte un devis signé chiffré", () => {
    expect(
      canIssueContract({ devisNumber: "D-2026-001", totalAmountEuros: 6500, gratuit: false })
    ).toBe(true);
  });
});

describe("describeContractBasis", () => {
  it("renvoie au devis et à sa date quand il existe", () => {
    const text = describeContractBasis({
      devisNumber: "D-2026-004",
      signedOn: new Date("2026-08-20T10:00:00Z"),
      gratuit: false,
    });
    expect(text).toContain("D-2026-004");
    expect(text).toContain("20/08/2026");
  });

  it("dit la gratuité plutôt que d'annoncer un montant nul", () => {
    const text = describeContractBasis({ devisNumber: null, signedOn: null, gratuit: true });
    expect(text).toContain("gracieux");
    expect(text).not.toContain("devis");
  });

  it("ne prétend pas qu'un devis existe quand il n'y en a pas", () => {
    const text = describeContractBasis({ devisNumber: null, signedOn: null, gratuit: false });
    expect(text).not.toContain("devis");
  });
});

describe("selectContractOptions", () => {
  const options = [
    { labelSnapshot: "Audit flash", priceIsFirm: true },
    { labelSnapshot: "Diagnostic RGPD", priceIsFirm: false },
  ];

  it("ne retient que les options au montant ferme", () => {
    expect(selectContractOptions(options).map((o) => o.labelSnapshot)).toEqual(["Audit flash"]);
  });

  it("compte celles qui restent à régulariser par avenant", () => {
    expect(countOptionsPendingAvenant(options)).toBe(1);
  });

  // La complémentarité des deux fonctions n'est pas décorative : une option qui
  // sortirait des deux listes disparaîtrait du contrat sans que rien ne le signale.
  it("couvre toutes les options entre contrat et avenant", () => {
    expect(selectContractOptions(options).length + countOptionsPendingAvenant(options)).toBe(
      options.length
    );
  });
});

describe("buildContractFileName", () => {
  it("suit la convention EODA et cite le devis d'origine", () => {
    expect(
      buildContractFileName({
        structureName: "ASSAD Générique",
        issuedOn: new Date("2026-09-01T08:00:00Z"),
        devisNumber: "D-2026-004",
      })
    ).toBe("20260901_CONTRAT_ASSAD-Generique_Accompagnement-D-2026-004_v01_Externe.pdf");
  });

  it("nomme l'objet sans inventer de référence quand aucun devis n'existe", () => {
    expect(
      buildContractFileName({
        structureName: "Structure test",
        issuedOn: new Date("2026-09-01T08:00:00Z"),
        devisNumber: null,
      })
    ).toContain("_Accompagnement_v01_Externe.pdf");
  });
});

describe("describePendingAvenant", () => {
  it("ne dit rien quand tout est au contrat", () => {
    expect(describePendingAvenant(0)).toBeNull();
  });

  it("accorde au singulier", () => {
    expect(describePendingAvenant(1)).toContain("Une prestation");
  });

  it("accorde au pluriel", () => {
    expect(describePendingAvenant(3)).toContain("3 prestations");
  });
});
