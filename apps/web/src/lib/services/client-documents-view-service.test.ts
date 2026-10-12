import { describe, expect, it } from "vitest";
import {
  DIPC_BLANK_MODEL_NOTICE,
  buildClientWorkList,
  canClientAcceptDocument,
  clientDocumentPill,
  countClientFilters,
  depositNoticeFor,
  deriveClientDocumentState,
  describeWorkList,
  documentsToDeposit,
  greetingFor,
  groupClientDocuments,
  isAcceptanceCurrent,
  isReviewedByEoda,
  parseClientDocumentFilter,
  toClientDocumentRow,
  type ClientDocumentFacts,
  type ClientDocumentRow,
} from "./client-documents-view-service";

const UPLOADED = new Date("2026-10-01T10:00:00Z");
const BEFORE = new Date("2026-09-20T10:00:00Z");
const AFTER = new Date("2026-10-02T10:00:00Z");

describe("isReviewedByEoda", () => {
  it("vrai sur une analyse relue", () => {
    expect(isReviewedByEoda({ analysisReviewedAt: AFTER, validatedAt: null, versionUploadedAt: UPLOADED })).toBe(true);
  });

  it("vrai sur une validation posée APRÈS le dépôt, faux sur une validation antérieure", () => {
    expect(isReviewedByEoda({ analysisReviewedAt: null, validatedAt: AFTER, versionUploadedAt: UPLOADED })).toBe(true);
    expect(isReviewedByEoda({ analysisReviewedAt: null, validatedAt: BEFORE, versionUploadedAt: UPLOADED })).toBe(false);
  });

  it("faux sans version", () => {
    expect(isReviewedByEoda({ analysisReviewedAt: AFTER, validatedAt: AFTER, versionUploadedAt: null })).toBe(false);
  });
});

describe("isAcceptanceCurrent — une nouvelle version rend l'acceptation caduque", () => {
  it("valable si posée après le dépôt de la version courante", () => {
    expect(isAcceptanceCurrent({ clientAcceptedAt: AFTER, versionUploadedAt: UPLOADED })).toBe(true);
  });

  it("caduque si une version a été déposée depuis", () => {
    expect(isAcceptanceCurrent({ clientAcceptedAt: BEFORE, versionUploadedAt: UPLOADED })).toBe(false);
  });

  it("fausse sans acceptation ou sans version", () => {
    expect(isAcceptanceCurrent({ clientAcceptedAt: null, versionUploadedAt: UPLOADED })).toBe(false);
    expect(isAcceptanceCurrent({ clientAcceptedAt: AFTER, versionUploadedAt: null })).toBe(false);
  });
});

describe("canClientAcceptDocument — seulement ce qu'on a montré", () => {
  const base = { hasVersion: true, analysisVisible: false, reviewedByEoda: false };

  it("accompagné : seulement relu par EODA", () => {
    expect(canClientAcceptDocument({ ...base, mode: "ACCOMPAGNE" })).toBe(false);
    expect(canClientAcceptDocument({ ...base, mode: "ACCOMPAGNE", analysisVisible: true })).toBe(false);
    expect(canClientAcceptDocument({ ...base, mode: "ACCOMPAGNE", reviewedByEoda: true })).toBe(true);
  });

  it("autonomie : l'analyse affichée suffit", () => {
    expect(canClientAcceptDocument({ ...base, mode: "AUTONOMIE" })).toBe(false);
    expect(canClientAcceptDocument({ ...base, mode: "AUTONOMIE", analysisVisible: true })).toBe(true);
  });

  it("jamais sans version", () => {
    expect(canClientAcceptDocument({ ...base, mode: "AUTONOMIE", hasVersion: false, analysisVisible: true })).toBe(false);
  });
});

describe("deriveClientDocumentState", () => {
  const facts = (overrides: Partial<ClientDocumentFacts>): ClientDocumentFacts => ({
    mode: "ACCOMPAGNE",
    status: "MISSING",
    declaredMissing: false,
    clientAccepted: false,
    hasVersion: false,
    analysisVisible: false,
    reviewedByEoda: false,
    ...overrides,
  });

  it("sans version : à déposer, à produire, ou non concerné", () => {
    expect(deriveClientDocumentState(facts({}))).toBe("TO_DEPOSIT");
    expect(deriveClientDocumentState(facts({ declaredMissing: true }))).toBe("TO_PRODUCE");
    expect(deriveClientDocumentState(facts({ status: "NOT_APPLICABLE" }))).toBe("NOT_CONCERNED");
  });

  it("avec version : à renouveler l'emporte, puis accepté, puis à vérifier, sinon en cours", () => {
    expect(deriveClientDocumentState(facts({ hasVersion: true, status: "EXPIRED", clientAccepted: true }))).toBe("RENEW");
    expect(deriveClientDocumentState(facts({ hasVersion: true, status: "UPLOADED", clientAccepted: true }))).toBe("ACCEPTED");
    expect(deriveClientDocumentState(facts({ hasVersion: true, status: "INCOMPLETE", reviewedByEoda: true }))).toBe("TO_CHECK");
    expect(deriveClientDocumentState(facts({ hasVersion: true, status: "ANALYZING" }))).toBe("IN_PROGRESS");
  });
});

describe("clientDocumentPill — vocabulaire D6 / D8", () => {
  it("accompagné : « Relu par EODA » puis « Accepté par vous »", () => {
    expect(clientDocumentPill("TO_CHECK", "ACCOMPAGNE").label).toBe("Relu par EODA");
    expect(clientDocumentPill("ACCEPTED", "ACCOMPAGNE").label).toBe("Accepté par vous");
  });

  it("autonomie : « À vérifier par vous » puis « Accepté par vous · non revérifié par un humain »", () => {
    expect(clientDocumentPill("TO_CHECK", "AUTONOMIE").label).toBe("À vérifier par vous");
    expect(clientDocumentPill("ACCEPTED", "AUTONOMIE").label).toBe("Accepté par vous · non revérifié par un humain");
  });

  // Test de bout en bout du 12/10 : « Accepté par vous · non revérifié par un
  // humain » s'affichait juste au-dessus de « Relu par EODA, le 12/10 ». Une
  // relecture EODA lève la réserve de l'autonomie : les deux mentions ne coexistent
  // jamais.
  it("autonomie mais relu par EODA : aucune réserve « non revérifié » contradictoire", () => {
    const reviewed = { reviewedByEoda: true };
    expect(clientDocumentPill("ACCEPTED", "AUTONOMIE", reviewed).label).toBe("Accepté par vous");
    expect(clientDocumentPill("TO_CHECK", "AUTONOMIE", reviewed).label).toBe("Relu par EODA");
  });

  it("jamais « Validé » ni « conforme » côté client, et toujours un glyphe", () => {
    for (const mode of ["ACCOMPAGNE", "AUTONOMIE"] as const) {
      for (const state of ["TO_DEPOSIT", "RENEW", "TO_CHECK", "TO_PRODUCE", "IN_PROGRESS", "ACCEPTED", "NOT_CONCERNED"] as const) {
        const pill = clientDocumentPill(state, mode);
        expect(pill.label).not.toMatch(/validé|conforme/i);
        expect(pill.glyph.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("toClientDocumentRow", () => {
  it("dérive l'état depuis la checklist et le mode", () => {
    const item = {
      documentTypeId: "dt-1",
      label: "Livret d'accueil",
      category: "LOI_2002_2" as const,
      status: "INCOMPLETE" as const,
      declaredMissing: false,
      clientAccepted: false,
      currentVersion: { analysis: { elementsManquants: [] }, reviewedByEoda: false },
    };
    expect(toClientDocumentRow(item, "AUTONOMIE").state).toBe("TO_CHECK");
    expect(toClientDocumentRow(item, "ACCOMPAGNE").state).toBe("IN_PROGRESS");
    expect(toClientDocumentRow({ ...item, currentVersion: null, status: "MISSING" }, "ACCOMPAGNE").state).toBe("TO_DEPOSIT");
  });
});

describe("filtres, groupes, accueil, liste de travail", () => {
  const rows: ClientDocumentRow[] = [
    { documentTypeId: "rh", label: "Plan de formation", category: "RH", state: "TO_DEPOSIT" },
    { documentTypeId: "livret", label: "Livret", category: "LOI_2002_2", state: "ACCEPTED" },
    { documentTypeId: "dipc", label: "DIPC", category: "LOI_2002_2", state: "TO_DEPOSIT" },
    { documentTypeId: "cvs", label: "CR CVS", category: "LOI_2002_2", state: "TO_PRODUCE" },
    { documentTypeId: "pca", label: "PCA", category: "QUALITE_RISQUES", state: "TO_CHECK" },
    { documentTypeId: "cpom", label: "CPOM", category: "FONCTIONNEMENT", state: "NOT_CONCERNED" },
  ];

  it("lit le filtre d'adresse et refuse l'inconnu", () => {
    expect(parseClientDocumentFilter("accepte")).toBe("accepte");
    expect(parseClientDocumentFilter(["en-cours", "x"])).toBe("en-cours");
    expect(parseClientDocumentFilter("toString")).toBeNull();
    expect(parseClientDocumentFilter(undefined)).toBeNull();
  });

  it("compte chaque document dans un filtre au plus (non concerné : aucun)", () => {
    expect(countClientFilters(rows)).toEqual({ "a-deposer": 2, "a-produire": 1, "en-cours": 1, accepte: 1 });
  });

  it("« à déposer » exclut ce qui est à produire : un document qu'on n'a pas ne se dépose pas", () => {
    const toDeposit = groupClientDocuments(rows, "a-deposer");
    expect([...toDeposit.obligatory, ...toDeposit.others].map((r) => r.documentTypeId)).not.toContain("cvs");
    const toProduce = groupClientDocuments(rows, "a-produire");
    expect([...toProduce.obligatory, ...toProduce.others].map((r) => r.documentTypeId)).toEqual(["cvs"]);
    expect(parseClientDocumentFilter("a-produire")).toBe("a-produire");
  });

  it("sépare les 7 obligatoires des autres, gestes d'abord", () => {
    const { obligatory, others } = groupClientDocuments(rows, null);
    expect(obligatory.map((r) => r.documentTypeId)).toEqual(["dipc", "cvs", "livret"]);
    expect(others.map((r) => r.documentTypeId)).toEqual(["rh", "pca", "cpom"]);
  });

  it("applique le filtre", () => {
    const { obligatory, others } = groupClientDocuments(rows, "a-deposer");
    expect([...obligatory, ...others].map((r) => r.documentTypeId)).toEqual(["dipc", "rh"]);
  });

  it("accueil : les pièces à déposer, obligatoires d'abord, bornées", () => {
    expect(documentsToDeposit(rows, 4).map((r) => r.documentTypeId)).toEqual(["dipc", "rh"]);
    expect(documentsToDeposit(rows, 1)).toHaveLength(1);
  });

  it("liste de travail = les documents déclarés absents", () => {
    expect(buildClientWorkList(rows).map((r) => r.documentTypeId)).toEqual(["cvs"]);
    expect(describeWorkList(0)).toBe("Votre liste de travail est vide.");
    expect(describeWorkList(1)).toBe("Il vous reste 1 document à créer vous-même.");
    expect(describeWorkList(3)).toBe("Il vous reste 3 documents à créer vous-même.");
  });
});

describe("DIPC : modèle vierge seulement (HDS)", () => {
  it("rappelle de ne jamais déposer un DIPC signé", () => {
    expect(depositNoticeFor("L2002_DIPC")).toBe(DIPC_BLANK_MODEL_NOTICE);
    expect(DIPC_BLANK_MODEL_NOTICE).toMatch(/modèle vierge/);
    expect(DIPC_BLANK_MODEL_NOTICE).toMatch(/signé/);
    expect(depositNoticeFor("L2002_LIVRET_ACCUEIL")).toBeNull();
  });
});

describe("greetingFor", () => {
  it("le prénom seul, ou « Bonjour. »", () => {
    expect(greetingFor("Camille Exemple")).toBe("Bonjour Camille.");
    expect(greetingFor("  ")).toBe("Bonjour.");
    expect(greetingFor(null)).toBe("Bonjour.");
  });
});
