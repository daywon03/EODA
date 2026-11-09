import { describe, expect, it } from "vitest";
import {
  CLIENT_DOCUMENT_VIEWS,
  clientViewOf,
  countClientViews,
  describeClientTodo,
  describeClientView,
  describeEmptyView,
  groupClientDocumentsForView,
  parseClientDocumentView,
  primaryCardAction,
  resolveClientView,
} from "./client-documents-page-service";
import { CLIENT_DOCUMENT_STATES, type ClientDocumentRow, type ClientDocumentState } from "./client-documents-view-service";

const row = (id: string, state: ClientDocumentState, label = id, code = "RH_PLAN_FORMATION"): ClientDocumentRow => ({
  documentTypeId: id,
  code,
  label,
  category: "RH",
  state,
});

describe("clientViewOf — chaque état tombe dans UN onglet, et un seul", () => {
  it("accompagnée : ce que la structure doit faire, ce qu'EODA fait, ce qui est fini", () => {
    expect(clientViewOf("TO_DEPOSIT", "ACCOMPAGNE")).toBe("a-faire");
    expect(clientViewOf("RENEW", "ACCOMPAGNE")).toBe("a-faire");
    // Relu par EODA, pas encore accepté : c'est à la structure de dire « je l'accepte ».
    expect(clientViewOf("TO_CHECK", "ACCOMPAGNE")).toBe("a-faire");
    // Déclaré absent : EODA le produit.
    expect(clientViewOf("TO_PRODUCE", "ACCOMPAGNE")).toBe("en-cours");
    // Déposé, EODA relit.
    expect(clientViewOf("IN_PROGRESS", "ACCOMPAGNE")).toBe("en-cours");
    expect(clientViewOf("ACCEPTED", "ACCOMPAGNE")).toBe("fait");
    expect(clientViewOf("NOT_CONCERNED", "ACCOMPAGNE")).toBe("fait");
  });

  it("autonomie : un document absent est à créer par la structure, personne d'autre ne le fera", () => {
    expect(clientViewOf("TO_PRODUCE", "AUTONOMIE")).toBe("a-faire");
    // À vérifier puis accepter : la structure seule.
    expect(clientViewOf("TO_CHECK", "AUTONOMIE")).toBe("a-faire");
    expect(clientViewOf("TO_DEPOSIT", "AUTONOMIE")).toBe("a-faire");
    expect(clientViewOf("RENEW", "AUTONOMIE")).toBe("a-faire");
    // Reçu, analyse indisponible : rien à cliquer, la carte dit quoi faire.
    expect(clientViewOf("IN_PROGRESS", "AUTONOMIE")).toBe("en-cours");
    expect(clientViewOf("ACCEPTED", "AUTONOMIE")).toBe("fait");
    expect(clientViewOf("NOT_CONCERNED", "AUTONOMIE")).toBe("fait");
  });

  it("aucun état n'est perdu : la somme des onglets est le nombre de documents", () => {
    for (const mode of ["ACCOMPAGNE", "AUTONOMIE"] as const) {
      const rows = CLIENT_DOCUMENT_STATES.map((state) => row(state, state));
      const counts = countClientViews(rows, mode);
      expect(counts["a-faire"] + counts["en-cours"] + counts.fait).toBe(rows.length);
    }
  });
});

describe("describeClientView — un mot, un pictogramme, une phrase", () => {
  it("accompagnée : « EODA s'en occupe » ; autonomie : jamais (personne ne relit)", () => {
    expect(describeClientView("en-cours", "ACCOMPAGNE").label).toBe("EODA s'en occupe");
    expect(describeClientView("en-cours", "AUTONOMIE").label).not.toMatch(/EODA/);
    expect(describeClientView("a-faire", "ACCOMPAGNE").label).toBe("À faire par vous");
    expect(describeClientView("fait", "AUTONOMIE").label).toBe("C'est fait");
  });

  it("chaque onglet dit en une phrase ce qu'il contient, sans « validé » ni « conforme »", () => {
    for (const mode of ["ACCOMPAGNE", "AUTONOMIE"] as const) {
      for (const view of CLIENT_DOCUMENT_VIEWS) {
        const { sentence, icon } = describeClientView(view, mode);
        expect(sentence.length).toBeGreaterThan(0);
        expect(sentence).not.toMatch(/validé|conforme/i);
        expect(icon).toBeTruthy();
      }
    }
    expect(describeClientView("fait", "ACCOMPAGNE").sentence).toMatch(/acceptés par vous/);
  });
});

describe("parseClientDocumentView — l'adresse, et les anciens liens", () => {
  it("lit ?vue=, refuse l'inconnu", () => {
    expect(parseClientDocumentView({ vue: "fait" }, "ACCOMPAGNE")).toBe("fait");
    expect(parseClientDocumentView({ vue: ["en-cours", "x"] }, "ACCOMPAGNE")).toBe("en-cours");
    expect(parseClientDocumentView({ vue: "toString" }, "ACCOMPAGNE")).toBeNull();
    expect(parseClientDocumentView({}, "ACCOMPAGNE")).toBeNull();
  });

  it("traduit les anciens ?filtre= vers l'onglet qui contient ces documents", () => {
    expect(parseClientDocumentView({ filtre: "a-deposer" }, "ACCOMPAGNE")).toBe("a-faire");
    expect(parseClientDocumentView({ filtre: "accepte" }, "ACCOMPAGNE")).toBe("fait");
    expect(parseClientDocumentView({ filtre: "en-cours" }, "ACCOMPAGNE")).toBe("en-cours");
    expect(parseClientDocumentView({ filtre: "a-produire" }, "ACCOMPAGNE")).toBe("en-cours");
    expect(parseClientDocumentView({ filtre: "a-produire" }, "AUTONOMIE")).toBe("a-faire");
    expect(parseClientDocumentView({ filtre: "n'importe" }, "ACCOMPAGNE")).toBeNull();
  });

  it("?vue= l'emporte sur un ancien ?filtre=", () => {
    expect(parseClientDocumentView({ vue: "fait", filtre: "a-deposer" }, "ACCOMPAGNE")).toBe("fait");
  });
});

describe("resolveClientView — l'onglet affiché", () => {
  const counts = { "a-faire": 0, "en-cours": 2, fait: 5 };

  it("par défaut : « À faire par vous », même vide (il dit alors « Rien à faire »)", () => {
    expect(resolveClientView(null, counts, "")).toBe("a-faire");
  });

  it("une recherche sans onglet choisi ouvre le premier onglet qui a un résultat", () => {
    // Le diagnostic renvoie vers « Mes documents?q=<nom> » : le document cherché peut
    // être déjà accepté — l'onglet par défaut le cacherait.
    expect(resolveClientView(null, counts, "livret")).toBe("en-cours");
    expect(resolveClientView(null, { "a-faire": 0, "en-cours": 0, fait: 0 }, "livret")).toBe("a-faire");
  });

  it("un onglet choisi reste choisi", () => {
    expect(resolveClientView("fait", counts, "livret")).toBe("fait");
  });
});

describe("describeClientTodo — « que dois-je faire ? »", () => {
  it("accompagnée : à déposer, à accepter, puis ce qu'EODA prépare", () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => row(`d${i}`, "TO_DEPOSIT")),
      ...Array.from({ length: 21 }, (_, i) => row(`c${i}`, "TO_CHECK")),
      ...Array.from({ length: 12 }, (_, i) => row(`p${i}`, "TO_PRODUCE")),
      ...Array.from({ length: 7 }, (_, i) => row(`i${i}`, "IN_PROGRESS")),
      row("ok", "ACCEPTED"),
    ];
    expect(describeClientTodo(rows, "ACCOMPAGNE")).toBe(
      "Vous avez 3 documents à déposer et 21 à accepter. EODA prépare 19 documents."
    );
  });

  it("accorde au singulier, et nomme le renouvellement", () => {
    expect(describeClientTodo([row("a", "TO_DEPOSIT"), row("b", "RENEW"), row("c", "TO_CHECK")], "ACCOMPAGNE")).toBe(
      "Vous avez 1 document à déposer, 1 à renouveler et 1 à accepter."
    );
    expect(describeClientTodo([row("c", "TO_CHECK"), row("p", "IN_PROGRESS")], "ACCOMPAGNE")).toBe(
      "Vous avez 1 document à accepter. EODA prépare 1 document."
    );
  });

  it("rien à faire : on le dit", () => {
    expect(describeClientTodo([row("ok", "ACCEPTED")], "ACCOMPAGNE")).toBe("Rien à faire pour l'instant.");
    expect(describeClientTodo([], "AUTONOMIE")).toBe("Rien à faire pour l'instant.");
    expect(describeClientTodo([row("p", "IN_PROGRESS")], "ACCOMPAGNE")).toBe(
      "Rien à faire pour l'instant. EODA prépare 1 document."
    );
  });

  it("autonomie : à créer et à vérifier — et jamais « EODA prépare »", () => {
    const rows = [row("d", "TO_DEPOSIT"), row("p1", "TO_PRODUCE"), row("p2", "TO_PRODUCE"), row("c", "TO_CHECK"), row("i", "IN_PROGRESS")];
    const sentence = describeClientTodo(rows, "AUTONOMIE");
    expect(sentence).toBe("Vous avez 1 document à déposer, 2 à créer et 1 à vérifier.");
    expect(sentence).not.toMatch(/EODA/);
  });
});

describe("describeEmptyView — un onglet vide parle", () => {
  it("dit « Rien à faire » sur l'onglet par défaut", () => {
    expect(describeEmptyView("a-faire", "ACCOMPAGNE", "")).toBe("Rien à faire pour l'instant.");
  });

  it("une recherche sans résultat cite ce qui a été cherché", () => {
    expect(describeEmptyView("fait", "ACCOMPAGNE", "livret")).toContain("« livret »");
  });

  it("autonomie : ne parle pas d'EODA", () => {
    for (const view of CLIENT_DOCUMENT_VIEWS) {
      expect(describeEmptyView(view, "AUTONOMIE", "")).not.toMatch(/EODA/);
    }
  });
});

describe("groupClientDocumentsForView — rubriques d'un onglet", () => {
  const rows = [
    row("rh2", "TO_DEPOSIT", "Registre du personnel", "RH_PLAN_FORMATION"),
    row("rh1", "TO_CHECK", "Plan de formation", "RH_PLAN_FORMATION"),
    row("livret", "ACCEPTED", "Livret d'accueil", "L2002_LIVRET_ACCUEIL"),
    row("dipc", "TO_DEPOSIT", "Contrat", "L2002_DIPC"),
  ];

  it("ne montre que les documents de l'onglet, et pas une rubrique vide", () => {
    const groups = groupClientDocumentsForView(rows, "fait", "ACCOMPAGNE", "");
    expect(groups.map((g) => g.id)).toEqual(["LOI_2002_2"]);
    expect(groups[0]?.rows.map((r) => r.documentTypeId)).toEqual(["livret"]);
  });

  it("range par ordre alphabétique dans chaque rubrique", () => {
    const groups = groupClientDocumentsForView(rows, "a-faire", "ACCOMPAGNE", "");
    const rh = groups.find((g) => g.id === "RESSOURCES_HUMAINES");
    expect(rh?.rows.map((r) => r.label)).toEqual(["Plan de formation", "Registre du personnel"]);
  });

  it("applique la recherche", () => {
    const groups = groupClientDocumentsForView(rows, "a-faire", "ACCOMPAGNE", "registre");
    expect(groups.flatMap((g) => g.rows.map((r) => r.documentTypeId))).toEqual(["rh2"]);
  });
});

describe("primaryCardAction — UN geste principal par carte", () => {
  it("déposer ce qui manque ou est périmé", () => {
    expect(primaryCardAction("TO_DEPOSIT", { canAct: true, hasViewable: false })).toBe("DEPOSIT");
    expect(primaryCardAction("RENEW", { canAct: true, hasViewable: true })).toBe("DEPOSIT");
  });

  it("accepter ce qui a été montré", () => {
    expect(primaryCardAction("TO_CHECK", { canAct: true, hasViewable: true })).toBe("ACCEPT");
  });

  it("on ne demande pas d'accepter une pièce qu'on ne peut pas ouvrir (QA du 09/11/2026)", () => {
    // Analyse relue par EODA sur une version d'EODA pas encore validée : la pièce
    // n'est pas visible côté structure, « Je l'accepte » ne se propose pas.
    expect(primaryCardAction("TO_CHECK", { canAct: true, hasViewable: false })).toBeNull();
  });

  it("sinon voir le document, s'il y en a un", () => {
    expect(primaryCardAction("ACCEPTED", { canAct: true, hasViewable: true })).toBe("VIEW");
    expect(primaryCardAction("IN_PROGRESS", { canAct: true, hasViewable: true })).toBe("VIEW");
    expect(primaryCardAction("TO_PRODUCE", { canAct: true, hasViewable: false })).toBeNull();
  });

  it("en bibliothèque (accompagnement terminé), on ne dépose ni n'accepte : on voit", () => {
    expect(primaryCardAction("TO_DEPOSIT", { canAct: false, hasViewable: false })).toBeNull();
    expect(primaryCardAction("TO_CHECK", { canAct: false, hasViewable: true })).toBe("VIEW");
  });
});
