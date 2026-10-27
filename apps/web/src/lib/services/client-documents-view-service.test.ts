import { describe, expect, it } from "vitest";
import {
  matchesClientSearch,
  clientSearchableFilenames,
  parseClientGroupFilter,
  parseClientSearch,
  DIPC_BLANK_MODEL_NOTICE,
  UNRANKED_GROUP_LABEL,
  buildClientWorkList,
  canClientAcceptDocument,
  clientDocumentPill,
  countClientFilters,
  depositNoticeFor,
  deriveClientDocumentState,
  describeGroupProgress,
  describeWorkList,
  documentsToDeposit,
  greetingFor,
  groupClientDocuments,
  isAcceptanceCurrent,
  isReviewedByEoda,
  isSettledForClient,
  parseClientDocumentFilter,
  toClientDocumentRow,
  versionsVisibleToClient,
  viewableVersionFor,
  type ClientDocumentFacts,
  type ClientDocumentRow,
} from "./client-documents-view-service";

const UPLOADED = new Date("2026-10-01T10:00:00Z");
const BEFORE = new Date("2026-09-20T10:00:00Z");
const AFTER = new Date("2026-10-02T10:00:00Z");

describe("versionsVisibleToClient — ce que la structure peut ouvrir", () => {
  const clientVersion = { id: "c", producedByCabinet: false, uploadedAt: BEFORE };
  const eodaVersion = { id: "e", producedByCabinet: true, uploadedAt: UPLOADED };

  it("montre toujours les dépôts de la structure", () => {
    expect(versionsVisibleToClient([clientVersion], null).map((v) => v.id)).toEqual(["c"]);
  });

  it("cache une version d'EODA tant que le document n'a jamais été validé", () => {
    expect(versionsVisibleToClient([eodaVersion, clientVersion], null).map((v) => v.id)).toEqual(["c"]);
  });

  it("une version d'EODA déposée APRÈS la validation se voit : elle est le livrable (21/10/2026)", () => {
    expect(versionsVisibleToClient([eodaVersion, clientVersion], BEFORE).map((v) => v.id)).toEqual(["e", "c"]);
  });

  it("montre la version d'EODA dès que le document est validé", () => {
    expect(versionsVisibleToClient([eodaVersion, clientVersion], AFTER).map((v) => v.id)).toEqual(["e", "c"]);
  });
});

describe("isReviewedByEoda", () => {
  it("vrai sur une analyse relue", () => {
    expect(isReviewedByEoda({ analysisReviewedAt: AFTER, validatedAt: null, versionUploadedAt: UPLOADED, versionByCabinet: false })).toBe(true);
  });

  it("vrai sur une validation posée APRÈS le dépôt, faux sur une validation antérieure", () => {
    expect(isReviewedByEoda({ analysisReviewedAt: null, validatedAt: AFTER, versionUploadedAt: UPLOADED, versionByCabinet: false })).toBe(true);
    expect(isReviewedByEoda({ analysisReviewedAt: null, validatedAt: BEFORE, versionUploadedAt: UPLOADED, versionByCabinet: false })).toBe(false);
  });

  it("faux sans version", () => {
    expect(isReviewedByEoda({ analysisReviewedAt: AFTER, validatedAt: AFTER, versionUploadedAt: null, versionByCabinet: false })).toBe(false);
  });

  it("une version d'EODA déposée sur un document validé est « Relu par EODA » (le livret du pilote, 21/10/2026)", () => {
    expect(isReviewedByEoda({ analysisReviewedAt: null, validatedAt: BEFORE, versionUploadedAt: UPLOADED, versionByCabinet: true })).toBe(true);
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

  // En autonomie, personne ne relit : une version reçue sans analyse lisible affiche
  // « Analyse indisponible — votre document est bien reçu ». La pastille ne promet
  // donc plus un traitement « en cours » qui n'aura pas lieu.
  it("autonomie : une version sans analyse est « Reçu », pas « en cours »", () => {
    expect(clientDocumentPill("IN_PROGRESS", "AUTONOMIE").label).toBe("Reçu");
    expect(clientDocumentPill("IN_PROGRESS", "ACCOMPAGNE").label).toBe("Reçu, en cours");
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
      code: "L2002_LIVRET_ACCUEIL",
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
    // Le code du type remonte à la ligne : il porte le rangement en sept groupes.
    expect(toClientDocumentRow(item, "ACCOMPAGNE").code).toBe("L2002_LIVRET_ACCUEIL");
  });
});

describe("les sept groupes de « Mes documents »", () => {
  // Codes réels du seed (content/documents/groupes.ts) : un rangement testé sur des
  // codes inventés ne dirait rien du rangement réel.
  const rows: ClientDocumentRow[] = [
    { documentTypeId: "rh", code: "RH_PLAN_FORMATION", label: "Plan de formation", category: "RH", state: "TO_DEPOSIT" },
    { documentTypeId: "livret", code: "L2002_LIVRET_ACCUEIL", label: "Livret", category: "LOI_2002_2", state: "ACCEPTED" },
    { documentTypeId: "dipc", code: "L2002_DIPC", label: "DIPC", category: "LOI_2002_2", state: "TO_DEPOSIT" },
    { documentTypeId: "cvs", code: "L2002_CR_CVS", label: "CR CVS", category: "LOI_2002_2", state: "TO_PRODUCE" },
    { documentTypeId: "pca", code: "P14_PCA_REDIGE", label: "PCA", category: "QUALITE_RISQUES", state: "TO_CHECK" },
    { documentTypeId: "cpom", code: "FONCT_CPOM", label: "CPOM", category: "FONCTIONNEMENT", state: "NOT_CONCERNED" },
  ];
  const ids = (groups: readonly { rows: readonly ClientDocumentRow[] }[]) =>
    groups.flatMap((g) => g.rows.map((r) => r.documentTypeId));

  it("rangé dans l'ordre de la maquette, groupes vides omis", () => {
    // Processus, Personne accompagnée et Registres n'ont aucune ligne ici : un
    // intertitre suivi du vide ne renseigne personne.
    expect(groupClientDocuments(rows, null, "ACCOMPAGNE").map((g) => g.label)).toEqual([
      "Loi 2002-2",
      "Gestion des risques",
      "Ressources humaines",
      "Qualité",
    ]);
    // …mais l'ordre des groupes présents reste celui de la liste complète.
    expect(groupClientDocuments(rows, null, "ACCOMPAGNE").map((g) => g.id)).toEqual([
      "LOI_2002_2",
      "RISQUES",
      "RESSOURCES_HUMAINES",
      "QUALITE",
    ]);
  });

  it("ne perd aucun document, et garde les gestes d'abord à l'intérieur d'un groupe", () => {
    expect(ids(groupClientDocuments(rows, null, "ACCOMPAGNE"))).toHaveLength(rows.length);
    expect(groupClientDocuments(rows, null, "ACCOMPAGNE")[0]?.rows.map((r) => r.documentTypeId)).toEqual([
      "dipc",
      "cvs",
      "livret",
    ]);
  });

  it("l'avancement d'un groupe parle le vocabulaire du mode, jamais « validé »", () => {
    const accompagne = groupClientDocuments(rows, null, "ACCOMPAGNE");
    expect(accompagne[0]?.progress).toBe("1 relu par EODA sur 3");
    expect(accompagne[1]?.progress).toBe("1 relu par EODA sur 1");
    expect(accompagne[2]?.progress).toBe("Aucun relu par EODA sur 1");
    // En autonomie personne ne relit : « relu par EODA » y serait faux.
    expect(groupClientDocuments(rows, null, "AUTONOMIE")[0]?.progress).toBe("1 accepté par vous sur 3");
    expect(groupClientDocuments(rows, null, "AUTONOMIE")[1]?.progress).toBe("Aucun accepté par vous sur 1");
    for (const group of [...accompagne, ...groupClientDocuments(rows, null, "AUTONOMIE")]) {
      expect(group.progress).not.toMatch(/validé/i);
    }
  });

  it("le compte décrit ce qui est affiché sous lui, pas le total du groupe", () => {
    // Sous le filtre « À déposer », le groupe Loi 2002-2 ne montre plus que le DIPEC :
    // annoncer « 1 relu sur 3 » juste au-dessus d'une ligne serait faux.
    const filtered = groupClientDocuments(rows, "a-deposer", "ACCOMPAGNE");
    expect(filtered.map((g) => g.label)).toEqual(["Loi 2002-2", "Ressources humaines"]);
    expect(filtered[0]?.progress).toBe("Aucun relu par EODA sur 1");
  });

  it("un filtre vide ne laisse aucun groupe", () => {
    const nonConcerne: ClientDocumentRow[] = [
      { documentTypeId: "dipc", code: "L2002_DIPC", label: "DIPC", category: "LOI_2002_2", state: "NOT_CONCERNED" },
    ];
    expect(groupClientDocuments(nonConcerne, "a-deposer", "ACCOMPAGNE")).toEqual([]);
  });

  it("un type créé en base sans rangement est montré à part, jamais perdu", () => {
    // Un CABINET_ADMIN peut ajouter un type de document : son code n'est alors rangé
    // nulle part. Le faire disparaître du portail cacherait une pièce déposée.
    const avecInconnu = [...rows, { documentTypeId: "x", code: "TYPE_INCONNU", label: "Pièce nouvelle", category: "FONCTIONNEMENT" as const, state: "TO_DEPOSIT" as const }];
    const groups = groupClientDocuments(avecInconnu, null, "ACCOMPAGNE");
    expect(groups[groups.length - 1]).toMatchObject({ id: "AUTRES", label: UNRANKED_GROUP_LABEL });
    expect(ids(groups)).toContain("x");
  });
});

describe("isSettledForClient", () => {
  it("accompagnée : relu par EODA, ou accepté (ce qui suppose la relecture)", () => {
    expect(isSettledForClient("TO_CHECK", "ACCOMPAGNE")).toBe(true);
    expect(isSettledForClient("ACCEPTED", "ACCOMPAGNE")).toBe(true);
    expect(isSettledForClient("RENEW", "ACCOMPAGNE")).toBe(false);
    expect(isSettledForClient("TO_DEPOSIT", "ACCOMPAGNE")).toBe(false);
  });

  it("autonomie : seul l'accord de la structure compte", () => {
    expect(isSettledForClient("ACCEPTED", "AUTONOMIE")).toBe(true);
    expect(isSettledForClient("TO_CHECK", "AUTONOMIE")).toBe(false);
  });
});

describe("describeGroupProgress", () => {
  it("accorde le participe, et ne dit jamais « aucun … sur 0 »", () => {
    expect(describeGroupProgress(0, 9, "ACCOMPAGNE")).toBe("Aucun relu par EODA sur 9");
    expect(describeGroupProgress(1, 9, "ACCOMPAGNE")).toBe("1 relu par EODA sur 9");
    expect(describeGroupProgress(4, 9, "ACCOMPAGNE")).toBe("4 relus par EODA sur 9");
    expect(describeGroupProgress(0, 0, "AUTONOMIE")).toBe("Aucun accepté par vous sur 0");
    expect(describeGroupProgress(2, 2, "AUTONOMIE")).toBe("2 acceptés par vous sur 2");
  });
});

describe("filtres, accueil, liste de travail", () => {
  const rows: ClientDocumentRow[] = [
    { documentTypeId: "rh", code: "RH_PLAN_FORMATION", label: "Plan de formation", category: "RH", state: "TO_DEPOSIT" },
    { documentTypeId: "livret", code: "L2002_LIVRET_ACCUEIL", label: "Livret", category: "LOI_2002_2", state: "ACCEPTED" },
    { documentTypeId: "dipc", code: "L2002_DIPC", label: "DIPC", category: "LOI_2002_2", state: "TO_DEPOSIT" },
    { documentTypeId: "cvs", code: "L2002_CR_CVS", label: "CR CVS", category: "LOI_2002_2", state: "TO_PRODUCE" },
    { documentTypeId: "pca", code: "P14_PCA_REDIGE", label: "PCA", category: "QUALITE_RISQUES", state: "TO_CHECK" },
    { documentTypeId: "cpom", code: "FONCT_CPOM", label: "CPOM", category: "FONCTIONNEMENT", state: "NOT_CONCERNED" },
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
    const toDeposit = groupClientDocuments(rows, "a-deposer", "ACCOMPAGNE").flatMap((g) => g.rows.map((r) => r.documentTypeId));
    expect(toDeposit).not.toContain("cvs");
    const toProduce = groupClientDocuments(rows, "a-produire", "ACCOMPAGNE").flatMap((g) => g.rows.map((r) => r.documentTypeId));
    expect(toProduce).toEqual(["cvs"]);
    expect(parseClientDocumentFilter("a-produire")).toBe("a-produire");
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

describe("DIPEC : modèle vierge seulement (HDS)", () => {
  it("rappelle de ne jamais déposer un DIPEC signé", () => {
    expect(depositNoticeFor("L2002_DIPC")).toBe(DIPC_BLANK_MODEL_NOTICE);
    expect(DIPC_BLANK_MODEL_NOTICE).toMatch(/modèle vierge/);
    expect(DIPC_BLANK_MODEL_NOTICE).toMatch(/signé/);
    expect(depositNoticeFor("L2002_LIVRET_ACCUEIL")).toBeNull();
    // Ligne « Autre forme de participation » : la démarche, jamais des réponses nominatives.
    expect(depositNoticeFor("QUALITE_ENQUETE_QUESTIONNAIRE")).toMatch(/Jamais les réponses d.une personne/);
  });
});

describe("viewableVersionFor — ce que la structure peut ouvrir depuis « Mes documents »", () => {
  const own = (n: number) => ({
    id: `v${n}`,
    versionNumber: n,
    originalFilename: `client-v${n}.pdf`,
    producedByCabinet: false,
  });
  const cabinet = (n: number) => ({
    id: `v${n}`,
    versionNumber: n,
    originalFilename: `eoda-v${n}.docx`,
    producedByCabinet: true,
  });

  it("montre la pièce déposée par la structure, quelle que soit l'étape", () => {
    const item = {
      validatedAt: null,
      currentVersion: own(1),
      versions: [own(1)],
    };
    expect(viewableVersionFor(item)).toMatchObject({ id: "v1", filename: "client-v1.pdf", producedByCabinet: false });
  });

  it("ne montre PAS un brouillon produit par EODA avant validation", () => {
    const item = { validatedAt: null, currentVersion: cabinet(2), versions: [own(1), cabinet(2)] };
    // Rien à montrer de la version en cours — mais le dépôt du client reste accessible.
    expect(viewableVersionFor(item)).toEqual({
      id: "v1",
      filename: "client-v1.pdf",
      versionNumber: 1,
      producedByCabinet: false,
    });
  });

  it("ne montre rien quand EODA n'a produit qu'un brouillon non validé", () => {
    expect(
      viewableVersionFor({ validatedAt: null, currentVersion: cabinet(1), versions: [cabinet(1)] })
    ).toBeNull();
  });

  it("montre la pièce d'EODA une fois le document validé", () => {
    const item = { validatedAt: AFTER, currentVersion: cabinet(2), versions: [own(1), cabinet(2)] };
    expect(viewableVersionFor(item)).toEqual({
      id: "v2",
      filename: "eoda-v2.docx",
      versionNumber: 2,
      producedByCabinet: true,
    });
  });

  it("ne montre rien sans version", () => {
    expect(viewableVersionFor({ validatedAt: null, currentVersion: null, versions: [] })).toBeNull();
  });

  it("origine inconnue = traitée comme produite par le cabinet (on ne publie pas un doute)", () => {
    expect(
      viewableVersionFor({
        validatedAt: null,
        currentVersion: { id: "orpheline", versionNumber: 3, originalFilename: "x.pdf" },
        versions: [],
      })
    ).toBeNull();
  });
});

describe("greetingFor", () => {
  it("le prénom seul, ou « Bonjour. »", () => {
    expect(greetingFor("Camille Exemple")).toBe("Bonjour Camille.");
    expect(greetingFor("  ")).toBe("Bonjour.");
    expect(greetingFor(null)).toBe("Bonjour.");
  });
});

describe("rubrique et recherche du portail (21/10/2026)", () => {
  it("lit une rubrique connue, ignore le reste", () => {
    expect(parseClientGroupFilter("PROCESSUS")).toBe("PROCESSUS");
    expect(parseClientGroupFilter("AUTRES")).toBe("AUTRES");
    expect(parseClientGroupFilter("'; DROP")).toBeNull();
    expect(parseClientGroupFilter(undefined)).toBeNull();
  });

  it("cherche sans accents ni majuscules, borne la saisie", () => {
    expect(matchesClientSearch({ label: "Règlement de fonctionnement" }, "reglement")).toBe(true);
    expect(matchesClientSearch({ label: "Livret d'accueil" }, "LIVRET")).toBe(true);
    expect(matchesClientSearch({ label: "Livret d'accueil" }, "plainte")).toBe(false);
    // Le nom du fichier compte aussi (call du 21/10/2026).
    expect(matchesClientSearch({ label: "Autre forme de participation", searchableFilenames: ["ENQUETE-satisfaction.docx"] }, "enquête")).toBe(true);
  });

  it("ne cherche que dans les fichiers que la structure voit — jamais un brouillon d'EODA non validé", () => {
    const at = new Date("2026-10-01");
    const versions = [
      { producedByCabinet: true, uploadedAt: at, originalFilename: "brouillon-eoda.docx" },
      { producedByCabinet: false, uploadedAt: at, originalFilename: "depot-structure.pdf" },
    ];
    expect(clientSearchableFilenames({ versions, validatedAt: null })).toEqual(["depot-structure.pdf"]);
    expect(clientSearchableFilenames({ versions, validatedAt: at })).toEqual(["brouillon-eoda.docx", "depot-structure.pdf"]);
    expect(matchesClientSearch({ label: "Livret d'accueil" }, "")).toBe(true);
    expect(parseClientSearch("  x".padEnd(200, "y")).length).toBe(80);
  });
});
