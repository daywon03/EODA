import type { DocumentCategory, DocumentStatus, SupportMode } from "@eoda/database";
import { DOCUMENT_PILLS, type PillSpec } from "@/lib/design/status-vocabulary";
import type { DocumentStep } from "./document-workflow-service";
import type { FolderRef } from "./document-folder-service";

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
  // Qui doit produire un document encore manquant (deriveMissingOwner). Facultatif :
  // absent, la pastille reste « Manquant ».
  missingOwner?: MissingOwner | null;
  // Les fichiers déposés : la recherche porte aussi sur leur nom (call du 21/10/2026 —
  // « je vais taper enquête » ne trouvait rien sous « questionnaire vierge »).
  versions?: readonly { originalFilename: string }[];
};

// ── « À rédiger · EODA » / « Chez la structure » (N2) — dérivés, jamais stockés ─
export type MissingOwner = "EODA" | "STRUCTURE";

export function deriveMissingOwner(facts: {
  status: DocumentStatus;
  hasVersion: boolean;
  requestedFromClient: boolean;
  declaredMissing: boolean;
  mode: SupportMode;
}): MissingOwner | null {
  if (facts.hasVersion || facts.status !== "MISSING") return null;
  // En autonomie, EODA ne rédige rien (hors option) : ce que la structure n'a pas,
  // c'est elle qui le crée ; ce qu'on ne lui réclame pas n'a pas de rédacteur.
  if (facts.mode === "AUTONOMIE") return facts.requestedFromClient ? "STRUCTURE" : null;
  // Accompagnée : un document réclamé est attendu de la structure, sauf si elle a
  // répondu « Je ne l'ai pas » ; tout le reste est le plan de production d'EODA.
  return facts.requestedFromClient && !facts.declaredMissing ? "STRUCTURE" : "EODA";
}

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

// « Fourni par » (call du 18/10/2026 : un document déposé par EODA s'affichait « fourni
// par la structure »). La colonne lisait le RÉGLAGE du type (réclamé au client ou non),
// pas le fait. Avec une version déposée, c'est son AUTEUR qui répond — le même fait que
// l'historique des versions (`producedByCabinet`, rôle du déposant). Sans version, on
// dit qui doit la fournir, sans le confondre avec un dépôt.
export function documentProviderLabel(row: {
  requestedFromClient: boolean;
  currentVersion: { id: string } | null;
  versions: readonly { id: string; producedByCabinet: boolean }[];
}): string {
  if (row.currentVersion) {
    const current = row.versions.find((version) => version.id === row.currentVersion?.id);
    if (current) return current.producedByCabinet ? "EODA" : "La structure";
  }
  return row.requestedFromClient ? "Attendu de la structure" : "À produire par EODA";
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
      if (item.missingOwner === "EODA") return DOCUMENT_PILLS.aRedigerEoda;
      if (item.missingOwner === "STRUCTURE") return DOCUMENT_PILLS.chezLaStructure;
      if (item.status === "MISSING") return DOCUMENT_PILLS.manquant;
      if (item.status === "INCOMPLETE") return DOCUMENT_PILLS.analyseAVerifier;
      return DOCUMENT_PILLS.depose;
  }
}

// Phrase courte sous la pastille, pour l'écran : d'où vient « Analyse : à vérifier »
// (retour du 09/11/2026, #6 — un statut de l'IA lu comme un jugement). `null` pour
// toute autre pastille : elles se lisent seules.
export const ANALYSIS_TO_CHECK_NOTE = "L'analyse automatique a relevé des éléments manquants : ouvrez Analyse.";

export function documentRowPillNote(item: DocumentFacts): string | null {
  return documentRowPill(item) === DOCUMENT_PILLS.analyseAVerifier ? ANALYSIS_TO_CHECK_NOTE : null;
}

export function flattenChecklist<T extends DocumentFacts>(
  checklist: Partial<Record<DocumentCategory, readonly T[]>>
): DocumentRow<T>[] {
  return (Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]).flatMap((category) =>
    (checklist[category] ?? []).map((item) => ({ ...item, category }))
  );
}

// ── Paramètres d'adresse (entrées non fiables) ───────────────────────────────

// Tri (21/10/2026, « trier par ordre alphabétique pour faciliter la recherche ») :
// absent = l'ordre de la checklist ; « nom » = alphabétique, sans tenir compte des
// accents ni des majuscules. Flèches de colonne façon Excel (call du 29/10/2026) :
// nom, date et version, dans les deux sens.
export const DOCUMENT_SORTS = ["nom", "nom-desc", "date", "date-desc", "version", "version-desc"] as const;
export type DocumentSort = (typeof DOCUMENT_SORTS)[number];

// Filtres de COLONNE (call du 29/10/2026 : « des flèches sur la colonne, comme sur
// Excel » — filtrer par statut « À rédiger », par « Fourni par », par version). La
// valeur est le texte même de la cellule : ce qu'on voit est ce qu'on filtre.
export const DOCUMENT_COLUMN_FILTERS = ["statut", "fourni", "version"] as const;
export type DocumentColumnFilter = (typeof DOCUMENT_COLUMN_FILTERS)[number];

export type DocumentFilters = {
  bucket: DocumentBucket;
  query: string;
  category: DocumentCategory | null;
  sort?: DocumentSort | null;
  columns?: Partial<Record<DocumentColumnFilter, string>>;
};

type SortableRow = { label: string; currentVersion?: { uploadedAt: Date; versionNumber?: number } | null };

export function sortDocumentRows<T extends SortableRow>(rows: readonly T[], sort: DocumentSort | null | undefined): T[] {
  if (!sort) return [...rows];
  const direction = sort.endsWith("-desc") ? -1 : 1;
  const byName = (a: T, b: T) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" });
  // Sans dépôt : toujours en fin de liste, quel que soit le sens.
  const byNumber = (pick: (row: T) => number | null) => (a: T, b: T) => {
    const left = pick(a);
    const right = pick(b);
    if (left === null || right === null) return left === right ? byName(a, b) : left === null ? 1 : -1;
    return (left - right) * direction || byName(a, b);
  };
  if (sort.startsWith("date")) return [...rows].sort(byNumber((row) => row.currentVersion?.uploadedAt.getTime() ?? null));
  if (sort.startsWith("version")) return [...rows].sort(byNumber((row) => row.currentVersion?.versionNumber ?? null));
  return [...rows].sort((a, b) => byName(a, b) * direction);
}

// Texte de la cellule d'une ligne pour une colonne filtrable — le même que l'écran.
export type ColumnRow = Omit<DocumentFacts, "currentVersion" | "versions"> & {
  requestedFromClient: boolean;
  currentVersion: { id: string; uploadedAt: Date; analysisAwaitingReview: boolean; versionNumber: number } | null;
  versions: readonly { id: string; producedByCabinet: boolean; originalFilename: string }[];
};

export function documentColumnValue(row: ColumnRow, column: DocumentColumnFilter): string {
  if (column === "statut") return documentRowPill(row).label;
  if (column === "version") return row.currentVersion ? `v${row.currentVersion.versionNumber}` : "—";
  return documentProviderLabel(row);
}

// Valeurs proposées dans le menu d'une colonne : celles présentes, triées.
export function documentColumnOptions<T extends ColumnRow>(
  rows: readonly T[],
  column: DocumentColumnFilter
): string[] {
  const values = [...new Set(rows.map((row) => documentColumnValue(row, column)))];
  return values.sort((a, b) =>
    column === "version"
      ? (Number(a.slice(1)) || Infinity) - (Number(b.slice(1)) || Infinity)
      : a.localeCompare(b, "fr", { sensitivity: "base" })
  );
}

export function filterDocumentColumns<T extends ColumnRow>(
  rows: readonly T[],
  columns: Partial<Record<DocumentColumnFilter, string>> | undefined
): T[] {
  const active = Object.entries(columns ?? {}) as [DocumentColumnFilter, string][];
  if (active.length === 0) return [...rows];
  return rows.filter((row) => active.every(([column, value]) => documentColumnValue(row, column) === value));
}

const MAX_QUERY_LENGTH = 100;

function single(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

const MAX_COLUMN_VALUE_LENGTH = 80;

export function parseDocumentFilters(params: {
  tab?: string | string[];
  q?: string | string[];
  cat?: string | string[];
  tri?: string | string[];
  statut?: string | string[];
  fourni?: string | string[];
  version?: string | string[];
}): DocumentFilters {
  const tab = single(params.tab);
  const cat = single(params.cat);
  const tri = single(params.tri);
  const columns: Partial<Record<DocumentColumnFilter, string>> = {};
  for (const column of DOCUMENT_COLUMN_FILTERS) {
    const value = single(params[column])?.trim().slice(0, MAX_COLUMN_VALUE_LENGTH);
    if (value) columns[column] = value;
  }
  return {
    ...((DOCUMENT_SORTS as readonly string[]).includes(tri ?? "") && { sort: tri as DocumentSort }),
    ...(Object.keys(columns).length > 0 && { columns }),
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
      (needle === "" ||
        normalise(row.label).includes(needle) ||
        (row.versions ?? []).some((version) => normalise(version.originalFilename).includes(needle)))
  );
}

export function rowsInBucket<T extends DocumentFacts>(rows: readonly T[], bucket: DocumentBucket): T[] {
  return rows.filter((row) => documentBucket(row) === bucket);
}

// ── Dossiers × onglets (retour de Sandrine, 08/11/2026) ─────────────────────
// Un dossier n'affichait que les documents de l'onglet ouvert : un document validé,
// rangé dans « Pilotage qualité », semblait absent du dossier (« 2 documents »). Le
// dossier montre toujours les lignes de l'onglet, et DIT combien des siennes sont
// ailleurs ; il reste affiché tant qu'il contient un document dans n'importe quel
// onglet. `allRows` : mêmes recherche et filtres de colonne, tous onglets confondus.
export type ElsewhereCount = { bucket: DocumentBucket; count: number };
export type FolderTabView<T> = { id: string; label: string; rows: T[]; elsewhere: ElsewhereCount[] };

export function foldersForTab<T extends DocumentFacts & { folder: { id: string } | null }>(
  tabRows: readonly T[],
  allRows: readonly T[],
  folders: readonly FolderRef[],
  bucket: DocumentBucket
): { folders: FolderTabView<T>[]; loose: T[] } {
  const ordered = [...folders].sort((a, b) => a.position - b.position || a.label.localeCompare(b.label, "fr"));
  const known = new Set(ordered.map((folder) => folder.id));
  const views = ordered.map((folder) => {
    const counts = new Map<DocumentBucket, number>();
    for (const row of allRows) {
      if (row.folder?.id !== folder.id) continue;
      const rowBucket = documentBucket(row);
      if (rowBucket !== bucket) counts.set(rowBucket, (counts.get(rowBucket) ?? 0) + 1);
    }
    return {
      id: folder.id,
      label: folder.label,
      rows: tabRows.filter((row) => row.folder?.id === folder.id),
      elsewhere: DOCUMENT_BUCKETS.flatMap((b) => {
        const count = counts.get(b);
        return count ? [{ bucket: b, count }] : [];
      }),
    };
  });
  return {
    folders: views.filter((view) => view.rows.length > 0 || view.elsewhere.length > 0),
    loose: tabRows.filter((row) => !row.folder || !known.has(row.folder.id)),
  };
}

export function describeElsewhere(elsewhere: readonly ElsewhereCount[]): string {
  return elsewhere
    .map(({ bucket, count }) => `${count} autre${count > 1 ? "s" : ""} dans « ${DOCUMENT_BUCKET_LABELS[bucket]} »`)
    .join(", ");
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
  if (filters.sort) params.set("tri", filters.sort);
  if (filters.category) params.set("cat", filters.category);
  for (const column of DOCUMENT_COLUMN_FILTERS) {
    const value = filters.columns?.[column];
    if (value) params.set(column, value);
  }
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
