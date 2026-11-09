import { describe, expect, it } from "vitest";
import {
  describeClientNextStep,
  documentProgressPercent,
  isOptionSubscribed,
  listAvailableOptions,
  resolveContractDevis,
  resolveSubscribedOptions,
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
    priceIsFirm: true,
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
  const upload = new Date("2026-10-01T10:00:00Z");
  const after = new Date("2026-10-05T10:00:00Z");

  function item(
    status: DocumentObligation["status"],
    missingJustification: string | null = null,
    proof: Partial<DocumentObligation> = {}
  ): DocumentObligation {
    return {
      status,
      missingJustification,
      versionUploadedAt: status === "MISSING" ? null : upload,
      validatedAt: null,
      clientAcceptedAt: null,
      versionByCabinet: false,
      ...proof,
    };
  }

  it("compte zéro partout sur une checklist vide", () => {
    expect(summariseDocumentObligations([], "ACCOMPAGNE")).toEqual({
      total: 0,
      toDeposit: 0,
      justified: 0,
      inReview: 0,
      validated: 0,
      notApplicable: 0,
    });
  });

  it("sépare la pièce manquante muette de la pièce manquante commentée", () => {
    const summary = summariseDocumentObligations(
      [item("MISSING"), item("MISSING", "Pas de CVS, nous avons une autre instance.")],
      "ACCOMPAGNE"
    );
    expect(summary.toDeposit).toBe(1);
    expect(summary.justified).toBe(1);
  });

  // 08/11/2026 — Sandrine : « 0 Conformes » sur des documents validés. Le statut
  // COMPLIANT est posé par l'IA (aucun manque trouvé) : il ne dit rien d'EODA.
  it("regroupe en revue tout ce qui est déposé et pas encore validé, COMPLIANT compris", () => {
    const summary = summariseDocumentObligations(
      [
        item("UPLOADED"),
        item("ANALYZING"),
        item("INCOMPLETE"),
        item("EXPIRED"),
        item("COMPLIANT"),
        item("INCOMPLETE", null, { validatedAt: after }),
        item("NOT_APPLICABLE"),
      ],
      "ACCOMPAGNE"
    );
    expect(summary.inReview).toBe(5);
    expect(summary.validated).toBe(1);
    expect(summary.notApplicable).toBe(1);
    expect(summary.total).toBe(7);
  });

  it("en autonomie, compte ce que la structure a accepté", () => {
    const summary = summariseDocumentObligations(
      [item("UPLOADED", null, { clientAcceptedAt: after }), item("UPLOADED", null, { validatedAt: after })],
      "AUTONOMIE"
    );
    expect(summary.validated).toBe(1);
    expect(summary.inReview).toBe(1);
  });
});

describe("documentProgressPercent", () => {
  it("vaut 0 sans aucune pièce attendue (jamais une division par zéro)", () => {
    expect(documentProgressPercent(summariseDocumentObligations([], "ACCOMPAGNE"))).toBe(0);
  });

  it("rapporte les validées au total affiché, non applicables compris", () => {
    const upload = new Date("2026-10-01T10:00:00Z");
    const validated = new Date("2026-10-05T10:00:00Z");
    const deposited = { versionUploadedAt: upload, validatedAt: validated, clientAcceptedAt: null };
    const summary = summariseDocumentObligations(
      [
        { status: "INCOMPLETE", missingJustification: null, ...deposited },
        { status: "MISSING", missingJustification: null },
        { status: "NOT_APPLICABLE", missingJustification: null },
        { status: "UPLOADED", missingJustification: null, ...deposited },
      ],
      "ACCOMPAGNE"
    );
    expect(documentProgressPercent(summary)).toBe(50);
  });
});

// La bascule des options souscrites du devis vers la mission. Ce qui est protégé
// ici : un client dont la mission n'a pas encore de lignes d'options (créée avant
// la conversion automatique) ne doit pas voir son contrat se vider.
describe("resolveSubscribedOptions", () => {
  function option(id: string, label: string, priceIsFirm = true): SubscribedOption {
    return {
      catalogueOptionId: id,
      labelSnapshot: label,
      priceSnapshotEuros: 300,
      pricingUnitSnapshot: "FORFAIT",
      priceMaxSnapshotEuros: null,
      minQuantitySnapshot: null,
      priceIsFirm,
    };
  }

  it("retient les options de la MISSION quand elle en porte", () => {
    const resolved = resolveSubscribedOptions({
      missionOptions: [option("opt-a", "Depuis la mission")],
      devisOptions: [option("opt-b", "Depuis le devis")],
    });
    expect(resolved.map((o) => o.catalogueOptionId)).toEqual(["opt-a"]);
  });

  it("retombe sur les snapshots du devis pour une mission antérieure à la bascule", () => {
    const resolved = resolveSubscribedOptions({
      missionOptions: [],
      devisOptions: [option("opt-b", "Depuis le devis")],
    });
    expect(resolved.map((o) => o.catalogueOptionId)).toEqual(["opt-b"]);
  });

  it("rend un tableau vide quand ni la mission ni le devis ne portent d'option", () => {
    expect(resolveSubscribedOptions({ missionOptions: [], devisOptions: [] })).toEqual([]);
  });

  it("ne rend jamais le tableau reçu, pour qu'un appelant ne puisse pas le muter", () => {
    const missionOptions = [option("opt-a", "Depuis la mission")];
    const resolved = resolveSubscribedOptions({ missionOptions, devisOptions: [] });
    expect(resolved).not.toBe(missionOptions);
    expect(resolved).toEqual(missionOptions);
  });
});

describe("describeClientNextStep", () => {
  const empty = { total: 10, toDeposit: 0, justified: 0, inReview: 0, validated: 10, notApplicable: 0 };

  it("ne demande rien quand les dépôts sont fermés", () => {
    // La bibliothèque affiche déjà le message de fin d'accompagnement ; réclamer une
    // pièce qu'on ne peut plus déposer serait absurde.
    expect(describeClientNextStep({ ...empty, toDeposit: 3 }, false)).toBeNull();
  });

  it("met en avant ce qu'il reste à déposer, avant tout le reste", () => {
    const step = describeClientNextStep({ ...empty, toDeposit: 3, inReview: 2 }, true);
    expect(step?.tone).toBe("ACTION");
    expect(step?.title).toBe("3 pièces à déposer");
  });

  it("accorde au singulier", () => {
    expect(describeClientNextStep({ ...empty, toDeposit: 1 }, true)?.title).toBe("1 pièce à déposer");
  });

  it("dit explicitement qu'il n'y a rien à faire quand la balle est chez EODA", () => {
    const step = describeClientNextStep({ ...empty, inReview: 2 }, true);
    expect(step?.tone).toBe("ATTENTE");
    expect(step?.title).toContain("Rien à faire");
  });

  it("ne compte pas les pièces justifiées comme du travail restant", () => {
    // Répondre « ce document ne nous concerne pas » EST une réponse : le portail ne
    // doit pas continuer à la réclamer.
    const step = describeClientNextStep({ ...empty, justified: 4 }, true);
    expect(step?.tone).toBe("TERMINE");
  });

  it("renvoie vers « Mes documents » et le geste « Je ne l'ai pas »", () => {
    const step = describeClientNextStep({ ...empty, toDeposit: 2 }, true);
    expect(step?.detail).toContain("« Mes documents »");
    expect(step?.detail).toContain("« Je ne l'ai pas »");
  });

  it("en autonomie, un document lu attend la vérification de la STRUCTURE, pas d'EODA", () => {
    const step = describeClientNextStep({ ...empty, inReview: 2 }, true, "AUTONOMIE");
    expect(step?.tone).toBe("ACTION");
    expect(step?.title).toBe("2 documents à vérifier");
    expect(step?.detail).not.toContain("EODA");
  });

  it("en autonomie, ne promet aucun contact d'EODA une fois tout fourni", () => {
    const step = describeClientNextStep(empty, true, "AUTONOMIE");
    expect(step?.tone).toBe("TERMINE");
    expect(step?.detail).not.toContain("EODA");
  });
});

describe("summariseDocumentObligations — « Je ne l'ai pas » (N3)", () => {
  it("ne compte pas un document déclaré absent comme une pièce à déposer", () => {
    const summary = summariseDocumentObligations(
      [
        { status: "MISSING", missingJustification: null, declaredMissing: true },
        { status: "MISSING", missingJustification: null },
      ],
      "ACCOMPAGNE"
    );
    expect(summary.toDeposit).toBe(1);
    expect(summary.justified).toBe(1);
  });
});
