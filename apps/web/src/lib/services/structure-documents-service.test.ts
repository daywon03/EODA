import { describe, expect, it } from "vitest";
import { DOCUMENT_PILLS } from "@/lib/design/status-vocabulary";
import {
  countDocumentBuckets,
  documentBucket,
  documentRowPill,
  documentsHref,
  filterDocumentRows,
  findDocumentRow,
  flattenChecklist,
  parseDocumentFilters,
  rowsInBucket,
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
  it("distingue manquant, à corriger et déposé dans « À faire »", () => {
    expect(documentRowPill(doc({ status: "MISSING", currentVersion: null }))).toBe(DOCUMENT_PILLS.manquant);
    expect(documentRowPill(doc({ status: "INCOMPLETE" }))).toBe(DOCUMENT_PILLS.aCorriger);
    expect(documentRowPill(doc({ status: "UPLOADED" }))).toBe(DOCUMENT_PILLS.depose);
  });

  it("suit l'onglet pour les autres cas", () => {
    expect(documentRowPill(doc({ currentVersion: version(true) }))).toBe(DOCUMENT_PILLS.aRelire);
    expect(documentRowPill(doc({ step: "VALIDE" }))).toBe(DOCUMENT_PILLS.valide);
    expect(documentRowPill(doc({ status: "EXPIRED" }))).toBe(DOCUMENT_PILLS.aRenouveler);
    expect(documentRowPill(doc({ status: "NOT_APPLICABLE" }))).toBe(DOCUMENT_PILLS.nonConcerne);
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
