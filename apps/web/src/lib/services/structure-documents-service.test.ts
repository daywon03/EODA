import { describe, expect, it } from "vitest";
import { DOCUMENT_PILLS } from "@/lib/design/status-vocabulary";
import {
  countDocumentBuckets,
  deriveMissingOwner,
  documentBucket,
  documentProviderLabel,
  documentRowPill,
  documentRowPillNote,
  documentsHref,
  filterDocumentRows,
  findDocumentRow,
  flattenChecklist,
  parseDocumentFilters,
  sortDocumentRows,
  documentColumnOptions,
  documentColumnValue,
  filterDocumentColumns,
  rowsInBucket,
  foldersForTab,
  describeElsewhere,
  type DocumentFacts,
} from "./structure-documents-service";

const version = (awaiting = false) => ({ id: "v1", uploadedAt: new Date(2026, 8, 1), analysisAwaitingReview: awaiting });

const doc = (over: Partial<DocumentFacts> = {}): DocumentFacts => ({
  documentTypeId: "t1",
  label: "Livret d'accueil",
  status: "UPLOADED",
  step: "DEPOSE",
  currentVersion: version(),
  ...over,
});

describe("documentProviderLabel — qui a fourni, d'après l'auteur du dépôt", () => {
  const cabinetVersion = { id: "v1", producedByCabinet: true };
  const clientVersion = { id: "v1", producedByCabinet: false };

  it("dit EODA quand EODA a déposé, même pour un document réclamé à la structure", () => {
    expect(
      documentProviderLabel({ requestedFromClient: true, currentVersion: { id: "v1" }, versions: [cabinetVersion] })
    ).toBe("EODA");
  });

  it("dit la structure quand c'est elle qui a déposé", () => {
    expect(
      documentProviderLabel({ requestedFromClient: false, currentVersion: { id: "v1" }, versions: [clientVersion] })
    ).toBe("La structure");
  });

  it("sans dépôt, dit qui doit le fournir", () => {
    expect(documentProviderLabel({ requestedFromClient: true, currentVersion: null, versions: [] })).toBe(
      "Attendu de la structure"
    );
    expect(documentProviderLabel({ requestedFromClient: false, currentVersion: null, versions: [] })).toBe(
      "À produire par EODA"
    );
  });
});

describe("documentBucket — chaque document dans UN onglet", () => {
  it("non concerné et à renouveler se lisent sur le statut, avant tout le reste", () => {
    expect(documentBucket(doc({ status: "NOT_APPLICABLE", currentVersion: null }))).toBe("notConcerned");
    // Périmé : reste à refaire même s'il avait été validé.
    expect(documentBucket(doc({ status: "EXPIRED", step: "VALIDE" }))).toBe("renew");
  });

  it("une analyse qui attend la relecture humaine passe avant la validation", () => {
    expect(documentBucket(doc({ step: "ANALYSE", currentVersion: version(true) }))).toBe("review");
  });

  it("validé = étape VALIDE (validatedAt posé par EODA)", () => {
    expect(documentBucket(doc({ status: "COMPLIANT", step: "VALIDE" }))).toBe("validated");
  });

  it("tout le reste est à faire : manquant, à corriger, déposé, relu mais non validé", () => {
    expect(documentBucket(doc({ status: "MISSING", step: "ATTENDU", currentVersion: null }))).toBe("todo");
    expect(documentBucket(doc({ status: "INCOMPLETE", step: "RELU" }))).toBe("todo");
    expect(documentBucket(doc({ status: "UPLOADED", step: "DEPOSE" }))).toBe("todo");
  });
});

describe("countDocumentBuckets", () => {
  it("compte chaque onglet ; la somme fait le nombre de documents", () => {
    const items = [
      doc({ status: "MISSING", step: "ATTENDU", currentVersion: null }),
      doc({ currentVersion: version(true), step: "ANALYSE" }),
      doc({ currentVersion: version(true), step: "ANALYSE" }),
      doc({ status: "COMPLIANT", step: "VALIDE" }),
      doc({ status: "EXPIRED" }),
      doc({ status: "NOT_APPLICABLE", currentVersion: null }),
    ];
    const counts = countDocumentBuckets(items);
    expect(counts).toEqual({ todo: 1, review: 2, validated: 1, renew: 1, notConcerned: 1 });
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(items.length);
  });

  it("aucun document : tous les compteurs à zéro", () => {
    expect(countDocumentBuckets([])).toEqual({ todo: 0, review: 0, validated: 0, renew: 0, notConcerned: 0 });
  });
});

describe("documentRowPill", () => {
  it("distingue manquant, analyse à vérifier et déposé dans « À faire »", () => {
    expect(documentRowPill(doc({ status: "MISSING", currentVersion: null }))).toBe(DOCUMENT_PILLS.manquant);
    expect(documentRowPill(doc({ status: "INCOMPLETE" }))).toBe(DOCUMENT_PILLS.analyseAVerifier);
    expect(documentRowPill(doc({ status: "UPLOADED" }))).toBe(DOCUMENT_PILLS.depose);
  });

  // Retour du 09/11/2026 (#6) : « ! À corriger » présentait le statut INCOMPLETE, posé
  // par l'IA, comme un jugement. C'est une analyse à vérifier par la consultante, et
  // l'écran dit d'où elle vient.
  it("un statut posé par l'analyse n'est jamais un jugement : « Analyse : à vérifier », ton review", () => {
    const pill = documentRowPill(doc({ status: "INCOMPLETE" }));
    expect(pill.label).toBe("Analyse : à vérifier");
    expect(pill.tone).toBe("review");
    expect(pill.label).not.toMatch(/corriger/i);
  });

  it("documentRowPillNote explique l'origine de « Analyse : à vérifier », et seulement elle", () => {
    expect(documentRowPillNote(doc({ status: "INCOMPLETE" }))).toBe(
      "L'analyse automatique a relevé des éléments manquants : ouvrez Analyse."
    );
    expect(documentRowPillNote(doc({ status: "UPLOADED" }))).toBeNull();
    expect(documentRowPillNote(doc({ status: "MISSING", currentVersion: null }))).toBeNull();
  });

  it("suit l'onglet pour les autres cas", () => {
    expect(documentRowPill(doc({ currentVersion: version(true) }))).toBe(DOCUMENT_PILLS.aRelire);
    expect(documentRowPill(doc({ step: "VALIDE" }))).toBe(DOCUMENT_PILLS.valide);
    expect(documentRowPill(doc({ status: "EXPIRED" }))).toBe(DOCUMENT_PILLS.aRenouveler);
    expect(documentRowPill(doc({ status: "NOT_APPLICABLE" }))).toBe(DOCUMENT_PILLS.nonConcerne);
  });

  it("dit QUI doit produire un document manquant (N2) — dérivé, jamais stocké", () => {
    const missing = { status: "MISSING" as const, currentVersion: null };
    expect(documentRowPill(doc({ ...missing, missingOwner: "EODA" }))).toBe(DOCUMENT_PILLS.aRedigerEoda);
    expect(documentRowPill(doc({ ...missing, missingOwner: "STRUCTURE" }))).toBe(DOCUMENT_PILLS.chezLaStructure);
    expect(documentRowPill(doc({ ...missing, missingOwner: null }))).toBe(DOCUMENT_PILLS.manquant);
  });
});

describe("deriveMissingOwner", () => {
  const base = {
    status: "MISSING" as const,
    hasVersion: false,
    requestedFromClient: true,
    declaredMissing: false,
    mode: "ACCOMPAGNE" as const,
  };

  it("accompagné : réclamé → chez la structure ; « Je ne l'ai pas » ou non réclamé → EODA", () => {
    expect(deriveMissingOwner(base)).toBe("STRUCTURE");
    expect(deriveMissingOwner({ ...base, declaredMissing: true })).toBe("EODA");
    expect(deriveMissingOwner({ ...base, requestedFromClient: false })).toBe("EODA");
  });

  it("autonomie : EODA ne rédige rien ; ce que la structure n'a pas, elle le crée", () => {
    expect(deriveMissingOwner({ ...base, mode: "AUTONOMIE", declaredMissing: true })).toBe("STRUCTURE");
    expect(deriveMissingOwner({ ...base, mode: "AUTONOMIE", requestedFromClient: false })).toBeNull();
  });

  it("rien à dire sur un document déposé ou non concerné", () => {
    expect(deriveMissingOwner({ ...base, hasVersion: true })).toBeNull();
    expect(deriveMissingOwner({ ...base, status: "NOT_APPLICABLE" })).toBeNull();
  });
});

describe("flattenChecklist, filtres et recherche", () => {
  const rows = flattenChecklist({
    LOI_2002_2: [doc({ documentTypeId: "a", label: "Règlement de fonctionnement" })],
    QUALITE_RISQUES: [doc({ documentTypeId: "b", label: "Procédure plaintes et réclamations", status: "MISSING", currentVersion: null })],
  });

  it("aplatit dans l'ordre des catégories en gardant la catégorie", () => {
    expect(rows.map((r) => [r.documentTypeId, r.category])).toEqual([
      ["a", "LOI_2002_2"],
      ["b", "QUALITE_RISQUES"],
    ]);
  });

  it("recherche sans tenir compte des accents ni de la casse", () => {
    expect(filterDocumentRows(rows, { query: "REGLEMENT", category: null }).map((r) => r.documentTypeId)).toEqual(["a"]);
    expect(filterDocumentRows(rows, { query: "", category: "QUALITE_RISQUES" }).map((r) => r.documentTypeId)).toEqual(["b"]);
    expect(filterDocumentRows(rows, { query: "plaintes", category: "LOI_2002_2" })).toEqual([]);
  });

  it("cherche aussi dans le nom des fichiers déposés (call du 21/10/2026)", () => {
    const withFile = [{ ...rows[0]!, label: "Autre forme de participation", versions: [{ originalFilename: "ENQUETE-SATISFACTION_v1.6.docx" }] }];
    expect(filterDocumentRows(withFile, { query: "enquête", category: null })).toHaveLength(1);
    expect(filterDocumentRows(withFile, { query: "plainte", category: null })).toHaveLength(0);
  });

  it("rowsInBucket ne garde que l'onglet demandé", () => {
    expect(rowsInBucket(rows, "todo")).toHaveLength(2);
    expect(rowsInBucket(rows, "validated")).toHaveLength(0);
  });

  it("le panneau ne trouve que les documents de CETTE structure (sinon null → notFound)", () => {
    expect(findDocumentRow(rows, "b")?.label).toBe("Procédure plaintes et réclamations");
    expect(findDocumentRow(rows, "type-d-un-autre-tenant")).toBeNull();
    expect(findDocumentRow(rows, undefined)).toBeNull();
  });
});

describe("parseDocumentFilters — entrées non fiables", () => {
  it("valeurs connues acceptées", () => {
    expect(parseDocumentFilters({ tab: "review", q: "  livret ", cat: "RH" })).toEqual({
      bucket: "review",
      query: "livret",
      category: "RH",
    });
  });

  it("valeurs inconnues ou détournées ramenées aux défauts", () => {
    expect(parseDocumentFilters({ tab: "admin", cat: "toString" })).toEqual({ bucket: "todo", query: "", category: null });
    expect(parseDocumentFilters({ tab: ["validated", "todo"], q: "x".repeat(500) }).query).toHaveLength(100);
    expect(parseDocumentFilters({ tab: ["validated", "todo"] }).bucket).toBe("validated");
  });
});

describe("documentsHref", () => {
  it("n'écrit que les paramètres utiles", () => {
    expect(documentsHref("/f/documents", { bucket: "todo" })).toBe("/f/documents");
    expect(documentsHref("/f/documents", { bucket: "review", query: "livret", category: "RH", doc: "t1" })).toBe(
      "/f/documents?tab=review&q=livret&cat=RH&doc=t1"
    );
  });
});

describe("tri alphabétique (21/10/2026)", () => {
  it("par nom, sans accents ni majuscules ; ordre d'origine sans tri", () => {
    const rows = [{ label: "Règlement de fonctionnement" }, { label: "accusés de réception" }, { label: "Livret d'accueil" }];
    expect(sortDocumentRows(rows, "nom").map((r) => r.label)).toEqual([
      "accusés de réception",
      "Livret d'accueil",
      "Règlement de fonctionnement",
    ]);
    expect(sortDocumentRows(rows, null)).toEqual(rows);
    expect(parseDocumentFilters({ tri: "nom" }).sort).toBe("nom");
    expect(parseDocumentFilters({ tri: "autre" }).sort).toBeUndefined();
  });
});

describe("menus de colonne façon Excel (call du 29/10/2026)", () => {
  const version = (n: number, day: number) => ({
    id: `v${n}-${day}`,
    uploadedAt: new Date(2026, 9, day),
    analysisAwaitingReview: false,
    versionNumber: n,
  });
  const row = (label: string, current: ReturnType<typeof version> | null, extra: Partial<{ requestedFromClient: boolean }> = {}) => ({
    documentTypeId: label,
    label,
    status: current ? ("UPLOADED" as const) : ("MISSING" as const),
    step: current ? ("DEPOSE" as const) : ("ATTENDU" as const),
    currentVersion: current,
    missingOwner: current ? null : ("EODA" as const),
    requestedFromClient: extra.requestedFromClient ?? false,
    versions: current ? [{ id: current.id, producedByCabinet: true, originalFilename: `${label}.docx` }] : [],
  });
  const rows = [row("Bientraitance", version(5, 20)), row("Affiche", null), row("Crise", version(2, 28))];

  it("trie par date et par version dans les deux sens, les lignes sans dépôt toujours à la fin", () => {
    expect(sortDocumentRows(rows, "date-desc").map((r) => r.label)).toEqual(["Crise", "Bientraitance", "Affiche"]);
    expect(sortDocumentRows(rows, "date").map((r) => r.label)).toEqual(["Bientraitance", "Crise", "Affiche"]);
    expect(sortDocumentRows(rows, "version-desc").map((r) => r.label)).toEqual(["Bientraitance", "Crise", "Affiche"]);
    expect(sortDocumentRows(rows, "nom-desc").map((r) => r.label)).toEqual(["Crise", "Bientraitance", "Affiche"]);
  });

  it("filtre par le texte même de la cellule, et propose les valeurs présentes", () => {
    expect(documentColumnValue(rows[1]!, "statut")).toBe(DOCUMENT_PILLS.aRedigerEoda.label);
    expect(documentColumnOptions(rows, "version")).toEqual(["v2", "v5", "—"]);
    expect(documentColumnOptions(rows, "fourni")).toEqual(["À produire par EODA", "EODA"]);
    expect(filterDocumentColumns(rows, { version: "v5" }).map((r) => r.label)).toEqual(["Bientraitance"]);
    expect(filterDocumentColumns(rows, { statut: DOCUMENT_PILLS.aRedigerEoda.label, fourni: "À produire par EODA" }).map((r) => r.label)).toEqual(["Affiche"]);
  });

  it("l'adresse garde tri et filtres de colonne, et l'entrée est bornée", () => {
    const parsed = parseDocumentFilters({ tri: "date-desc", statut: "À rédiger · EODA", version: ["v2", "v3"], fourni: "  " });
    expect(parsed.sort).toBe("date-desc");
    expect(parsed.columns).toEqual({ statut: "À rédiger · EODA", version: "v2" });
    expect(parseDocumentFilters({ statut: "x".repeat(500) }).columns?.statut).toHaveLength(80);
    expect(documentsHref("/f/documents", { bucket: "todo", sort: "date-desc", columns: { statut: "Manquant" } })).toBe(
      "/f/documents?tri=date-desc&statut=Manquant"
    );
  });
});

// Retour de Sandrine (08/11/2026, deux fois) : un document rangé dans « Pilotage
// qualité » n'apparaissait pas — il était VALIDÉ, donc dans l'onglet « Validé », et le
// dossier n'affichait que l'onglet ouvert (« 2 documents »). Le dossier dit
// désormais combien de ses documents sont dans les autres onglets, et reste affiché
// même quand l'onglet ouvert n'en contient aucun.
describe("foldersForTab — un dossier dit ce qu'il contient ailleurs", () => {
  const pilotage = { id: "f1", label: "Pilotage qualité", position: 1 };
  const sensib = { id: "f2", label: "Sensibilisation", position: 0 };
  const validated = { step: "VALIDE" as const };
  const inFolder = (folder: typeof pilotage | null, over: Partial<DocumentFacts>) => ({ ...doc(over), folder });
  const rows = [
    inFolder(pilotage, { documentTypeId: "a" }),
    inFolder(pilotage, { documentTypeId: "b" }),
    inFolder(pilotage, { documentTypeId: "c", ...validated }),
    inFolder(sensib, { documentTypeId: "d", ...validated }),
    inFolder(null, { documentTypeId: "e" }),
  ];
  const todo = rows.filter((r) => documentBucket(r) === "todo");

  it("compte, par dossier, les documents des autres onglets", () => {
    const view = foldersForTab(todo, rows, [pilotage, sensib], "todo");
    const p = view.folders.find((f) => f.id === "f1");
    expect(p?.rows.map((r) => r.documentTypeId)).toEqual(["a", "b"]);
    expect(p?.elsewhere).toEqual([{ bucket: "validated", count: 1 }]);
  });

  it("garde un dossier dont tous les documents sont dans un autre onglet", () => {
    const view = foldersForTab(todo, rows, [pilotage, sensib], "todo");
    const s = view.folders.find((f) => f.id === "f2");
    expect(s?.rows).toEqual([]);
    expect(s?.elsewhere).toEqual([{ bucket: "validated", count: 1 }]);
  });

  it("range les dossiers dans leur ordre, et laisse à plat les lignes sans dossier", () => {
    const view = foldersForTab(todo, rows, [pilotage, sensib], "todo");
    expect(view.folders.map((f) => f.id)).toEqual(["f2", "f1"]);
    expect(view.loose.map((r) => r.documentTypeId)).toEqual(["e"]);
  });

  it("n'affiche pas un dossier vide partout", () => {
    const empty = { id: "f3", label: "Vide", position: 2 };
    expect(foldersForTab(todo, rows, [pilotage, sensib, empty], "todo").folders.map((f) => f.id)).not.toContain("f3");
  });

  it("dit l'onglet en clair, au singulier et au pluriel", () => {
    expect(describeElsewhere([{ bucket: "validated", count: 1 }])).toBe("1 autre dans « Validé »");
    expect(describeElsewhere([{ bucket: "validated", count: 2 }, { bucket: "review", count: 1 }])).toBe(
      "2 autres dans « Validé », 1 autre dans « À relire »"
    );
    expect(describeElsewhere([])).toBe("");
  });
});
