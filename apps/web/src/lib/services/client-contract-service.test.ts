import { describe, expect, it } from "vitest";
import {
  documentProgressPercent,
  isOptionSubscribed,
  listAvailableOptions,
  resolveContractDevis,
  summariseDocumentObligations,
  type CatalogueOptionRow,
  type ClientDevis,
  type DocumentObligation,
  type SubscribedOption,
} from "./client-contract-service";

// Ce que ce fichier protège réellement : la frontière entre « estimation » et
// « contrat ». Un devis mal résolu, c'est un montant faux affiché à un client
// comme s'il l'avait signé — le défaut le plus coûteux de cette page.

function devis(overrides: Partial<ClientDevis> = {}): ClientDevis {
  return {
    id: "devis-1",
    number: "DEVIS-2026-001",
    status: "SIGNE",
    formuleLabelSnapshot: "Performance",
    formulePriceSnapshotEuros: 6500,
    depositPercent: 40,
    installmentCount: 3,
    totalAmountEuros: 8000,
    depositAmountEuros: 3200,
    balanceAmountEuros: 4800,
    installmentAmountEuros: 1600,
    options: [],
    ...overrides,
  };
}

function option(overrides: Partial<CatalogueOptionRow> = {}): CatalogueOptionRow {
  return {
    id: "opt-1",
    code: "AUDIT_FLASH",
    label: "Audit de conformité flash",
    priceEuros: 800,
    pricingUnit: "FORFAIT",
    priceMaxEuros: null,
    minQuantity: null,
    ...overrides,
  };
}

function subscribed(catalogueOptionId: string): SubscribedOption {
  return {
    catalogueOptionId,
    labelSnapshot: "Audit de conformité flash",
    priceSnapshotEuros: 800,
    pricingUnitSnapshot: "FORFAIT",
    priceMaxSnapshotEuros: null,
    minQuantitySnapshot: null,
  };
}

describe("resolveContractDevis — quel devis fait contrat", () => {
  it("refuse d'afficher un montant quand aucun devis n'est rattaché", () => {
    expect(resolveContractDevis([])).toEqual({ kind: "NO_DEVIS" });
  });

  it("refuse d'afficher un montant quand aucun devis n'est SIGNÉ", () => {
    expect(
      resolveContractDevis([
        devis({ id: "a", status: "BROUILLON" }),
        devis({ id: "b", status: "ENVOYE" }),
        devis({ id: "c", status: "REFUSE" }),
      ])
    ).toEqual({ kind: "NO_DEVIS" });
  });

  it("ignore un devis ANNULE, même s'il a été signé auparavant", () => {
    expect(resolveContractDevis([devis({ status: "ANNULE" })])).toEqual({ kind: "NO_DEVIS" });
  });

  it("retient l'unique devis signé", () => {
    const signed = devis({ id: "signe" });
    const resolution = resolveContractDevis([devis({ id: "brouillon", status: "BROUILLON" }), signed]);
    expect(resolution).toEqual({ kind: "RESOLVED", devis: signed });
  });

  it("n'affiche AUCUN montant quand plusieurs devis sont signés (jamais deviner le contrat)", () => {
    const resolution = resolveContractDevis([devis({ id: "a" }), devis({ id: "b" })]);
    expect(resolution).toEqual({ kind: "AMBIGUOUS", signedCount: 2 });
  });
});

describe("listAvailableOptions — le paywall §12.6", () => {
  it("retire du catalogue les options déjà au contrat", () => {
    const available = listAvailableOptions({
      catalogue: [option({ id: "opt-1" }), option({ id: "opt-2", code: "KPI" })],
      subscribed: [subscribed("opt-1")],
      pendingRequestOptionIds: [],
    });
    expect(available.map((o) => o.id)).toEqual(["opt-2"]);
  });

  it("marque comme PENDING une option déjà demandée, sans la débloquer", () => {
    const available = listAvailableOptions({
      catalogue: [option({ id: "opt-2" })],
      subscribed: [],
      pendingRequestOptionIds: ["opt-2"],
    });
    expect(available[0]?.requestState).toBe("PENDING");
  });

  it("laisse NONE une option jamais demandée", () => {
    const available = listAvailableOptions({
      catalogue: [option({ id: "opt-2" })],
      subscribed: [],
      pendingRequestOptionIds: ["autre-option"],
    });
    expect(available[0]?.requestState).toBe("NONE");
  });

  it("ne propose rien quand tout est déjà souscrit", () => {
    expect(
      listAvailableOptions({
        catalogue: [option({ id: "opt-1" })],
        subscribed: [subscribed("opt-1")],
        pendingRequestOptionIds: [],
      })
    ).toEqual([]);
  });
});

describe("isOptionSubscribed — refus d'une demande sur une option déjà payée", () => {
  it("reconnaît une option au contrat", () => {
    expect(isOptionSubscribed([subscribed("opt-1")], "opt-1")).toBe(true);
  });

  it("ne reconnaît pas une option absente du contrat", () => {
    expect(isOptionSubscribed([subscribed("opt-1")], "opt-2")).toBe(false);
  });

  it("refuse tout sur un contrat sans option", () => {
    expect(isOptionSubscribed([], "opt-1")).toBe(false);
  });
});

describe("summariseDocumentObligations — « ce que je dois donner »", () => {
  function item(
    status: DocumentObligation["status"],
    missingJustification: string | null = null
  ): DocumentObligation {
    return { status, missingJustification };
  }

  it("compte zéro partout sur une checklist vide", () => {
    expect(summariseDocumentObligations([])).toEqual({
      total: 0,
      toDeposit: 0,
      justified: 0,
      inReview: 0,
      compliant: 0,
      notApplicable: 0,
    });
  });

  it("sépare la pièce manquante muette de la pièce manquante commentée", () => {
    const summary = summariseDocumentObligations([
      item("MISSING"),
      item("MISSING", "Pas de CVS, nous avons une autre instance."),
    ]);
    expect(summary.toDeposit).toBe(1);
    expect(summary.justified).toBe(1);
  });

  it("regroupe en revue tout ce qui est déposé mais pas encore conforme", () => {
    const summary = summariseDocumentObligations([
      item("UPLOADED"),
      item("ANALYZING"),
      item("INCOMPLETE"),
      item("EXPIRED"),
      item("COMPLIANT"),
      item("NOT_APPLICABLE"),
    ]);
    expect(summary.inReview).toBe(4);
    expect(summary.compliant).toBe(1);
    expect(summary.notApplicable).toBe(1);
    expect(summary.total).toBe(6);
  });
});

describe("documentProgressPercent", () => {
  it("vaut 0 sans aucune pièce attendue (jamais une division par zéro)", () => {
    expect(documentProgressPercent(summariseDocumentObligations([]))).toBe(0);
  });

  it("rapporte les conformes au total affiché, non applicables compris", () => {
    const summary = summariseDocumentObligations([
      { status: "COMPLIANT", missingJustification: null },
      { status: "MISSING", missingJustification: null },
      { status: "NOT_APPLICABLE", missingJustification: null },
      { status: "COMPLIANT", missingJustification: null },
    ]);
    expect(documentProgressPercent(summary)).toBe(50);
  });
});
