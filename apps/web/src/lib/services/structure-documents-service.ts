import type { DocumentCategory, DocumentStatus } from "@eoda/database";
import { DOCUMENT_PILLS, type PillSpec } from "@/lib/design/status-vocabulary";
import type { DocumentStep } from "./document-workflow-service";

// ─────────────────────────────────────────────────────────────────────────────
// ONGLET « DOCUMENTS » DE LA FICHE STRUCTURE — règles pures.
//
// Les cinq onglets-compteurs de la maquette (À faire / À relire / Validé / À
// renouveler / Non concerné) sont DÉRIVÉS des faits que la checklist porte déjà :
// statut (document-status-service, péremption appliquée par document-expiry-service),
// analyse en attente de relecture, étape du parcours (document-workflow-service).
// Aucun statut n'est stocké pour l'occasion. Chaque document tombe dans UN onglet
// exactement, pour que la somme des compteurs soit le nombre de documents.
// ─────────────────────────────────────────────────────────────────────────────

export const DOCUMENT_BUCKETS = ["todo", "review", "validated", "renew", "notConcerned"] as const;
export type DocumentBucket = (typeof DOCUMENT_BUCKETS)[number];

export const DOCUMENT_BUCKET_LABELS: Record<DocumentBucket, string> = {
  todo: "À faire",
  review: "À relire",
  validated: "Validé",
  renew: "À renouveler",
  notConcerned: "Non concerné",
};

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  LOI_2002_2: "Loi 2002-2",
  FONCTIONNEMENT: "Fonctionnement",
  QUALITE_RISQUES: "Qualité et risques",
  RH: "Ressources humaines",
};

// Ce dont le classement a besoin — étroit à dessein (un ChecklistItem s'y conforme).
export type DocumentFacts = {
  documentTypeId: string;
  label: string;
  status: DocumentStatus;
  step: DocumentStep;
  currentVersion: { id: string; uploadedAt: Date; analysisAwaitingReview: boolean } | null;
};

export type DocumentRow<T extends DocumentFacts = DocumentFacts> = T & { category: DocumentCategory };

// Ordre de priorité : « non concerné » et « à renouveler » se lisent sur le statut
// (un document périmé reste à refaire même s'il avait été validé) ; puis l'analyse
// qui attend la relecture humaine ; puis la validation d'EODA (`validatedAt`).
// Tout le reste — manquant, à corriger, déposé sans analyse, relu mais pas encore
// validé — est du travail en cours : « À faire ».
export function documentBucket(item: DocumentFacts): DocumentBucket {
  if (item.status === "NOT_APPLICABLE") return "notConcerned";
  if (item.status === "EXPIRED") return "renew";
  if (item.currentVersion?.analysisAwaitingReview) return "review";
  if (item.step === "VALIDE") return "validated";
  return "todo";
}

export function countDocumentBuckets(items: readonly DocumentFacts[]): Record<DocumentBucket, number> {
  const counts = Object.fromEntries(DOCUMENT_BUCKETS.map((b) => [b, 0])) as Record<DocumentBucket, number>;
  for (const item of items) counts[documentBucket(item)] += 1;
  return counts;
}

// Pastille de la ligne. « Validé » = relu ET validé par EODA ; jamais « accepté »,
// qui est un geste du client (D6) que le schéma ne porte pas encore.
export function documentRowPill(item: DocumentFacts): PillSpec {
  switch (documentBucket(item)) {
    case "notConcerned":
      return DOCUMENT_PILLS.nonConcerne;
    case "renew":
      return DOCUMENT_PILLS.aRenouveler;
    case "review":
      return DOCUMENT_PILLS.aRelire;
    case "validated":
      return DOCUMENT_PILLS.valide;
    case "todo":
      if (item.status === "MISSING") return DOCUMENT_PILLS.manquant;
      if (item.status === "INCOMPLETE") return DOCUMENT_PILLS.aCorriger;
      return DOCUMENT_PILLS.depose;
  }
}

export function flattenChecklist<T extends DocumentFacts>(
  checklist: Partial<Record<DocumentCategory, readonly T[]>>
): DocumentRow<T>[] {
  return (Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]).flatMap((category) =>
    (checklist[category] ?? []).map((item) => ({ ...item, category }))
  );
}

// ── Paramètres d'adresse (entrées non fiables) ───────────────────────────────

export type DocumentFilters = { bucket: DocumentBucket; query: string; category: DocumentCategory | null };

const MAX_QUERY_LENGTH = 100;

function single(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

export function parseDocumentFilters(params: {
  tab?: string | string[];
  q?: string | string[];
  cat?: string | string[];
}): DocumentFilters {
  const tab = single(params.tab);
  const cat = single(params.cat);
  return {
    bucket: (DOCUMENT_BUCKETS as readonly string[]).includes(tab ?? "") ? (tab as DocumentBucket) : "todo",
    query: (single(params.q) ?? "").trim().slice(0, MAX_QUERY_LENGTH),
    // `Object.hasOwn` et non `in` : « toString » est « dans » tout objet.
    category: cat && Object.hasOwn(DOCUMENT_CATEGORY_LABELS, cat) ? (cat as DocumentCategory) : null,
  };
}

function normalise(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// Recherche et catégorie s'appliquent AVANT le découpage en onglets : les compteurs
// disent combien de documents de la recherche courante tombent dans chaque onglet.
export function filterDocumentRows<T extends DocumentFacts>(
  rows: readonly DocumentRow<T>[],
  filters: Pick<DocumentFilters, "query" | "category">
): DocumentRow<T>[] {
  const needle = normalise(filters.query);
  return rows.filter(
    (row) =>
      (filters.category === null || row.category === filters.category) &&
      (needle === "" || normalise(row.label).includes(needle))
  );
}

export function rowsInBucket<T extends DocumentFacts>(rows: readonly T[], bucket: DocumentBucket): T[] {
  return rows.filter((row) => documentBucket(row) === bucket);
}

// Adresse d'un état de l'onglet Documents. Seuls les paramètres non vides sont
// écrits : l'adresse reste lisible, et « todo » (par défaut) n'y figure pas.
export function documentsHref(
  basePath: string,
  filters: Partial<DocumentFilters> & { doc?: string | null }
): string {
  const params = new URLSearchParams();
  if (filters.bucket && filters.bucket !== "todo") params.set("tab", filters.bucket);
  if (filters.query) params.set("q", filters.query);
  if (filters.category) params.set("cat", filters.category);
  if (filters.doc) params.set("doc", filters.doc);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

// Le panneau latéral désigne un TYPE de document (un document manquant n'a pas
// encore d'identifiant à lui). On ne le cherche que dans la checklist de CETTE
// structure, chargée sous la garde du tenant : un identifiant d'ailleurs ne trouve
// rien, et la page répond notFound().
export function findDocumentRow<T extends DocumentFacts>(
  rows: readonly DocumentRow<T>[],
  documentTypeId: string | undefined
): DocumentRow<T> | null {
  if (!documentTypeId) return null;
  return rows.find((row) => row.documentTypeId === documentTypeId) ?? null;
}
