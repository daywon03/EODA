import { isValidationCurrent } from "./document-workflow-service";
import type { DocumentCategory, DocumentStatus, SupportMode } from "@eoda/database";
import { DOCUMENT_PILLS, type PillSpec } from "@/lib/design/status-vocabulary";
import { DOCUMENT_GROUPS, groupDocumentTypes, type DocumentGroupId } from "@/content/documents/groupes";
import { isVersionVisibleToClient } from "./deliverables-service";

// ─────────────────────────────────────────────────────────────────────────────
// « MES DOCUMENTS » VU PAR LA STRUCTURE — règles pures (tranches N2, N3, R6).
//
// L'état d'un document côté client est DÉRIVÉ des faits déjà là (version, analyse
// visible, relecture EODA, acceptation du client, réponse « Je ne l'ai pas »). Rien
// n'est stocké pour l'occasion (CLAUDE.md §7).
//
// Vocabulaire (D6, D8) : jamais « Validé » ni « conforme » côté client sans
// relecture EODA. Accompagné : « Relu par EODA » puis « Accepté par vous ».
// Autonomie : « À vérifier par vous » puis « Accepté par vous · non revérifié par
// un humain ».
// ─────────────────────────────────────────────────────────────────────────────

// Relu par EODA = la revue de l'analyse de CETTE version, ou une validation qui vaut
// pour elle — la MÊME règle que le panneau cabinet et l'onglet Critères
// (isValidationCurrent, 21/10/2026) : une version d'EODA déposée sur un document
// validé reste validée ; une version de la structure déposée après est à relire.
// Le livret du pilote était « Validé » côté cabinet et « Reçu, en cours » ici.
export function isReviewedByEoda(facts: {
  analysisReviewedAt: Date | null;
  validatedAt: Date | null;
  versionUploadedAt: Date | null;
  versionByCabinet: boolean;
}): boolean {
  if (!facts.versionUploadedAt) return false;
  if (facts.analysisReviewedAt) return true;
  return isValidationCurrent({
    validatedAt: facts.validatedAt,
    versionUploadedAt: facts.versionUploadedAt,
    versionByCabinet: facts.versionByCabinet,
  });
}

// Les versions qu'une STRUCTURE peut ouvrir dans « Mes documents » (21/10/2026 —
// retour de Damon : « il faut qu'il puisse voir les documents faits pour eux par EODA
// ou qu'eux ont mis, et pas que dans Mes livrables »). Ses propres dépôts, toujours.
// Une version produite par EODA, seulement une fois le document VALIDÉ : avant, c'est
// un travail en cours, et le montrer serait promettre à la place de la consultante.
// Une version d'EODA déposée APRÈS la validation compte comme validée — elle devient
// le livrable sur-le-champ (isValidationCurrent, même règle que les livrables).
export function versionsVisibleToClient<T extends { producedByCabinet: boolean; uploadedAt: Date }>(
  versions: readonly T[],
  validatedAt: Date | null
): T[] {
  return versions.filter((version) =>
    isVersionVisibleToClient({ producedByCabinet: version.producedByCabinet, validatedAt })
  );
}

// Une acceptation vaut pour la version courante au moment du geste : une version
// déposée ensuite la rend caduque — dérivé, jamais remis à zéro en base.
export function isAcceptanceCurrent(facts: {
  clientAcceptedAt: Date | null;
  versionUploadedAt: Date | null;
}): boolean {
  return (
    facts.clientAcceptedAt !== null &&
    facts.versionUploadedAt !== null &&
    facts.clientAcceptedAt >= facts.versionUploadedAt
  );
}

export type AcceptabilityFacts = {
  mode: SupportMode;
  hasVersion: boolean;
  // Une analyse est montrée au client (déjà passée par analysisVisibleTo).
  analysisVisible: boolean;
  reviewedByEoda: boolean;
};

// La structure peut-elle dire « Je l'accepte » ? Seulement sur ce qu'on lui a
// MONTRÉ : relu par EODA si elle est accompagnée ; en autonomie, l'analyse affichée
// sous la réserve. Même fonction pour l'écran et pour l'action serveur.
export function canClientAcceptDocument(facts: AcceptabilityFacts): boolean {
  if (!facts.hasVersion) return false;
  if (facts.reviewedByEoda) return true;
  return facts.mode === "AUTONOMIE" && facts.analysisVisible;
}

export const CLIENT_DOCUMENT_STATES = [
  "TO_DEPOSIT",
  "RENEW",
  "TO_CHECK",
  "TO_PRODUCE",
  "IN_PROGRESS",
  "ACCEPTED",
  "NOT_CONCERNED",
] as const;
export type ClientDocumentState = (typeof CLIENT_DOCUMENT_STATES)[number];

export type ClientDocumentFacts = AcceptabilityFacts & {
  status: DocumentStatus;
  declaredMissing: boolean;
  clientAccepted: boolean;
};

export function deriveClientDocumentState(facts: ClientDocumentFacts): ClientDocumentState {
  if (!facts.hasVersion) {
    if (facts.status === "NOT_APPLICABLE") return "NOT_CONCERNED";
    return facts.declaredMissing ? "TO_PRODUCE" : "TO_DEPOSIT";
  }
  if (facts.status === "EXPIRED") return "RENEW";
  if (facts.clientAccepted) return "ACCEPTED";
  return canClientAcceptDocument(facts) ? "TO_CHECK" : "IN_PROGRESS";
}

const pill = (label: string, glyph: string, tone: PillSpec["tone"]): PillSpec => ({ label, glyph, tone });

// La réserve de l'autonomie (« À vérifier par vous », « non revérifié par un
// humain ») ne vaut que tant qu'EODA n'a rien relu : une relecture EODA la lève,
// sinon la carte annoncerait « non revérifié » juste au-dessus de « Relu par EODA »
// (test de bout en bout du 12/10).
export function clientDocumentPill(
  state: ClientDocumentState,
  mode: SupportMode,
  facts: { reviewedByEoda: boolean } = { reviewedByEoda: false }
): PillSpec {
  const showsReserve = mode === "AUTONOMIE" && !facts.reviewedByEoda;
  switch (state) {
    case "TO_DEPOSIT":
      return pill("À déposer", "○", "todo");
    case "TO_PRODUCE":
      return pill("À produire", "✎", "progress");
    case "NOT_CONCERNED":
      return DOCUMENT_PILLS.nonConcerne;
    case "RENEW":
      return DOCUMENT_PILLS.aRenouveler;
    case "IN_PROGRESS":
      // En autonomie, rien ne suit : l'analyse a tourné au dépôt (ou n'a pas abouti).
      return mode === "AUTONOMIE" ? pill("Reçu", "◔", "progress") : pill("Reçu, en cours", "◔", "progress");
    case "TO_CHECK":
      return showsReserve ? pill("À vérifier par vous", "?", "review") : pill("Relu par EODA", "◉", "review");
    case "ACCEPTED":
      return showsReserve
        ? pill("Accepté par vous · non revérifié par un humain", "✓", "ok")
        : DOCUMENT_PILLS.accepteParVous;
  }
}

// Ce que la checklist (lib/actions/checklist.ts) porte déjà, au plus étroit.
export type ClientChecklistFacts = {
  documentTypeId: string;
  // Code du TYPE (« L2002_DIPC ») : c'est lui qui porte le rangement en sept groupes
  // (content/documents/groupes.ts). Un libellé se réécrit, un code non.
  code: string;
  label: string;
  category: DocumentCategory;
  status: DocumentStatus;
  declaredMissing: boolean;
  clientAccepted: boolean;
  currentVersion: { analysis: unknown; reviewedByEoda: boolean } | null;
};

export function toClientDocumentRow<T extends ClientChecklistFacts>(
  item: T,
  mode: SupportMode
): T & { state: ClientDocumentState } {
  const state = deriveClientDocumentState({
    mode,
    status: item.status,
    declaredMissing: item.declaredMissing,
    clientAccepted: item.clientAccepted,
    hasVersion: item.currentVersion !== null,
    analysisVisible: item.currentVersion?.analysis != null,
    reviewedByEoda: item.currentVersion?.reviewedByEoda ?? false,
  });
  return { ...item, state };
}

// ── Voir la pièce depuis « Mes documents » (20/10/2026) ──────────────────────
//
// La structure voyait ses documents seulement dans « Mes livrables », qui ne
// contient QUE ce qu'EODA a produit et validé : sa propre pièce déposée n'était
// consultable nulle part, pas plus qu'un document produit pour elle mais pas
// encore validé. « Voir » vit donc aussi sur la carte de « Mes documents ».
//
// Deux règles, et pas une de plus :
//   1. la pièce qu'elle a DÉPOSÉE est toujours visible — c'est son fichier ;
//   2. une pièce produite par le cabinet n'est visible qu'une fois le document
//      VALIDE. Avant, c'est un brouillon de travail : le montrer au client, c'est
//      lui remettre un document que la consultante n'a pas encore pris sur elle
//      (même verrou que `selectDeliverables`, CDC §5).
//
// Si EODA a déposé un brouillon par-dessus la pièce du client, la carte n'affiche
// pas la version en cours (muette) mais le DERNIER dépôt du client : le faire
// disparaître de son propre portail le temps d'une relecture serait une régression.
export type ViewableVersion = {
  id: string;
  filename: string;
  versionNumber: number;
  producedByCabinet: boolean;
};

export function viewableVersionFor(item: {
  validatedAt: Date | null;
  currentVersion: { id: string; originalFilename: string; versionNumber: number } | null;
  versions: readonly {
    id: string;
    versionNumber: number;
    originalFilename: string;
    producedByCabinet: boolean;
  }[];
}): ViewableVersion | null {
  const current = item.currentVersion;
  if (!current) return null;

  // Origine de la version en cours, lue dans l'historique déjà chargé (pas de
  // colonne de plus). Origine inconnue ⇒ traitée comme produite par le cabinet :
  // on préfère ne pas montrer que publier un brouillon.
  const producedByCabinet =
    item.versions.find((version) => version.id === current.id)?.producedByCabinet ?? true;

  if (isVersionVisibleToClient({ producedByCabinet, validatedAt: item.validatedAt })) {
    return {
      id: current.id,
      filename: current.originalFilename,
      versionNumber: current.versionNumber,
      producedByCabinet,
    };
  }

  const own = item.versions
    .filter((version) => !version.producedByCabinet)
    .sort((a, b) => b.versionNumber - a.versionNumber)[0];
  return own
    ? {
        id: own.id,
        filename: own.originalFilename,
        versionNumber: own.versionNumber,
        producedByCabinet: false,
      }
    : null;
}

// ── Filtres (« À déposer » / « À produire » / « Reçu, en cours » / « Accepté ») ─
//
// « À produire » est séparé de « À déposer » : un document déclaré absent ne se
// dépose pas, il se crée (en autonomie) ou EODA le produit (accompagné). Le
// compter dans « à déposer » réclamait à la structure ce qu'elle a dit ne pas avoir.

export const CLIENT_DOCUMENT_FILTERS = ["a-deposer", "a-produire", "en-cours", "accepte"] as const;
export type ClientDocumentFilter = (typeof CLIENT_DOCUMENT_FILTERS)[number];

export const CLIENT_DOCUMENT_FILTER_LABELS: Record<ClientDocumentFilter, string> = {
  "a-deposer": "À déposer",
  "a-produire": "À produire",
  "en-cours": "Reçu, en cours",
  accepte: "Accepté",
};

const FILTER_OF_STATE: Record<ClientDocumentState, ClientDocumentFilter | null> = {
  TO_DEPOSIT: "a-deposer",
  RENEW: "a-deposer",
  TO_PRODUCE: "a-produire",
  TO_CHECK: "en-cours",
  IN_PROGRESS: "en-cours",
  ACCEPTED: "accepte",
  NOT_CONCERNED: null,
};

export function clientFilterOf(state: ClientDocumentState): ClientDocumentFilter | null {
  return FILTER_OF_STATE[state];
}

// Paramètre d'adresse : entrée non fiable, une valeur inconnue = « Tout ».
export function parseClientDocumentFilter(raw: string | string[] | undefined): ClientDocumentFilter | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (CLIENT_DOCUMENT_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as ClientDocumentFilter)
    : null;
}

// ── Groupes, ordre, accueil, liste de travail ────────────────────────────────

export type ClientDocumentRow = {
  documentTypeId: string;
  // Code du type : porte le rangement en sept groupes.
  code: string;
  label: string;
  category: DocumentCategory;
  state: ClientDocumentState;
  // Noms des fichiers que la structure a le droit de voir (`clientSearchableFilenames`),
  // jamais ceux d'un brouillon d'EODA non validé : la recherche ne doit pas révéler ce
  // que « Voir » cache.
  searchableFilenames?: readonly string[];
};

// Ce qui demande un geste d'abord, ce qui est réglé ensuite.
const STATE_RANK: Record<ClientDocumentState, number> = Object.fromEntries(
  CLIENT_DOCUMENT_STATES.map((state, index) => [state, index])
) as Record<ClientDocumentState, number>;

// À l'intérieur d'un groupe, et pour les listes qui n'en ont pas : loi 2002-2, puis les
// preuves des objectifs impératifs et les procédures (qualité et risques), puis le reste.
const CATEGORY_RANK: Record<DocumentCategory, number> = {
  LOI_2002_2: 0,
  QUALITE_RISQUES: 1,
  FONCTIONNEMENT: 2,
  RH: 3,
};

function byPriority<T extends ClientDocumentRow>(a: T, b: T): number {
  return STATE_RANK[a.state] - STATE_RANK[b.state] || CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
}

// « AUTRES » n'est pas un huitième groupe de rangement : c'est le filet des types dont
// le code a été créé en base sans être rangé (un CABINET_ADMIN peut en ajouter un).
// L'écran le montre en dernier — perdre la ligne ferait disparaître du portail un
// document que la structure a déposé.
export type ClientDocumentGroupId = DocumentGroupId | "AUTRES";

export type ClientDocumentGroup<T> = {
  id: ClientDocumentGroupId;
  label: string;
  rows: T[];
  // « 3 relus par EODA sur 9 » — le compte décrit la liste juste en dessous de lui,
  // jamais un total qu'on ne voit pas.
  progress: string;
};

export const UNRANKED_GROUP_LABEL = "Autres documents";

// Les sept groupes de la maquette « structure accompagnée » (« Loi 2002-2 · Processus ·
// Gestion des risques · Personne accompagnée · Registres · Ressources humaines ·
// Qualité »), dans cet ordre — un classement de CONTENU propre à EODA, jamais la
// catégorie réglementaire (CLAUDE.md §7). Un groupe sans ligne visible n'est pas rendu :
// un intertitre suivi du vide ne renseigne personne.
// ── Rubrique et recherche (21/10/2026 — « dans toutes, devoir descendre tout en bas,
// ce n'est pas intuitif, alors que le cabinet filtre par catégorie ») ─────────────
// Mêmes sept rubriques que l'affichage (content/documents/groupes.ts), plus « Autres ».
// Une valeur reçue de l'adresse est une entrée non fiable : inconnue ⇒ aucun filtre.
export type ClientGroupFilter = ClientDocumentGroupId;

export function parseClientGroupFilter(raw: string | string[] | undefined): ClientGroupFilter | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "AUTRES") return "AUTRES";
  return DOCUMENT_GROUPS.find((group) => group.id === value)?.id ?? null;
}

export function parseClientSearch(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().slice(0, 80);
}

// Sans accents ni majuscules : « reglement » trouve « Règlement de fonctionnement ».
function foldForSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchesClientSearch(
  row: Pick<ClientDocumentRow, "label" | "searchableFilenames">,
  query: string
): boolean {
  if (query.length === 0) return true;
  const needle = foldForSearch(query);
  return (
    foldForSearch(row.label).includes(needle) ||
    (row.searchableFilenames ?? []).some((name) => foldForSearch(name).includes(needle))
  );
}

// Les noms cherchables d'un document côté structure : ceux des versions qu'elle voit,
// par la MÊME règle que la carte et les routes (`versionsVisibleToClient`).
export function clientSearchableFilenames(item: {
  versions: readonly { producedByCabinet: boolean; uploadedAt: Date; originalFilename: string }[];
  validatedAt: Date | null;
}): string[] {
  return versionsVisibleToClient(item.versions, item.validatedAt).map((version) => version.originalFilename);
}

// Nombre de documents par rubrique, après le filtre d'état et la recherche — ce que
// la personne obtiendra en cliquant.
export function countClientGroups<T extends ClientDocumentRow>(
  rows: readonly T[],
  filter: ClientDocumentFilter | null,
  query: string,
  mode: SupportMode
): { id: ClientGroupFilter; label: string; count: number }[] {
  return groupClientDocuments(rows, filter, mode, { query }).map((group) => ({
    id: group.id,
    label: group.label,
    count: group.rows.length,
  }));
}

export function groupClientDocuments<T extends ClientDocumentRow>(
  rows: readonly T[],
  filter: ClientDocumentFilter | null,
  mode: SupportMode,
  // `sort: "nom"` (21/10/2026) : alphabétique dans chaque rubrique, au lieu de l'ordre
  // « ce qui demande un geste d'abord ».
  options: { group?: ClientGroupFilter | null; query?: string; sort?: "nom" | null } = {}
): ClientDocumentGroup<T>[] {
  const query = options.query ?? "";
  const visible = rows.filter(
    (row) => (filter === null || clientFilterOf(row.state) === filter) && matchesClientSearch(row, query)
  );
  const sorted = [...visible].sort(
    options.sort === "nom" ? (a, b) => a.label.localeCompare(b.label, "fr", { sensitivity: "base" }) : byPriority
  );
  const { groups, unranked } = groupDocumentTypes(sorted);

  const ranked: ClientDocumentGroup<T>[] = groups
    .filter((group) => group.types.length > 0)
    .map((group) => ({
      id: group.id,
      label: group.label,
      rows: group.types,
      progress: groupProgress(group.types, mode),
    }));

  const all: ClientDocumentGroup<T>[] =
    unranked.length === 0
      ? ranked
      : [...ranked, { id: "AUTRES", label: UNRANKED_GROUP_LABEL, rows: unranked, progress: groupProgress(unranked, mode) }];
  return options.group ? all.filter((group) => group.id === options.group) : all;
}

function groupProgress<T extends ClientDocumentRow>(rows: readonly T[], mode: SupportMode): string {
  return describeGroupProgress(rows.filter((row) => isSettledForClient(row.state, mode)).length, rows.length, mode);
}

// Un document est-il « réglé » du point de vue de la structure selon le mode ?
// Accompagnée : relu par EODA (l'état « Relu par EODA », ou « Accepté par vous » qui
// suppose la relecture dans ce mode). En autonomie : accepté par elle — « relu par
// EODA » y serait faux, personne ne relit.
export function isSettledForClient(state: ClientDocumentState, mode: SupportMode): boolean {
  if (mode === "AUTONOMIE") return state === "ACCEPTED";
  return state === "TO_CHECK" || state === "ACCEPTED";
}

// L'avancement d'un groupe, dit avec le vocabulaire du portail (D6/D8) : « validé » est
// banni côté client tant qu'un humain n'a pas relu (le mot n'existe nulle part dans les
// pastilles, ce n'est pas pour le remettre dans un intertitre).
export function describeGroupProgress(count: number, total: number, mode: SupportMode): string {
  const what = mode === "AUTONOMIE" ? ["accepté par vous", "acceptés par vous"] : ["relu par EODA", "relus par EODA"];
  if (count === 0) return `Aucun ${what[0]} sur ${total}`;
  return `${count} ${count > 1 ? what[1] : what[0]} sur ${total}`;
}

export function countClientFilters(rows: readonly ClientDocumentRow[]): Record<ClientDocumentFilter, number> {
  const counts: Record<ClientDocumentFilter, number> = {
    "a-deposer": 0,
    "a-produire": 0,
    "en-cours": 0,
    accepte: 0,
  };
  for (const row of rows) {
    const filter = clientFilterOf(row.state);
    if (filter) counts[filter] += 1;
  }
  return counts;
}

// Accueil : les pièces à déposer (ou à renouveler), obligatoires d'abord.
export function documentsToDeposit<T extends ClientDocumentRow>(rows: readonly T[], limit: number): T[] {
  return rows
    .filter((row) => row.state === "TO_DEPOSIT" || row.state === "RENEW")
    .sort((a, b) => CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category])
    .slice(0, limit);
}

// Liste de travail (« Il vous reste N documents à créer vous-même ») : les
// documents déclarés absents. Dérivée, jamais une table.
export function buildClientWorkList<T extends ClientDocumentRow>(rows: readonly T[]): T[] {
  return rows
    .filter((row) => row.state === "TO_PRODUCE")
    .sort((a, b) => CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category]);
}

// « Bonjour Nadia. » — le prénom seul (premier mot du nom du compte) ; sans nom,
// « Bonjour. ».
export function greetingFor(name: string | null): string {
  const firstName = name?.trim().split(/\s+/)[0];
  return firstName ? `Bonjour ${firstName}.` : "Bonjour.";
}

export function describeWorkList(count: number): string {
  if (count === 0) return "Votre liste de travail est vide.";
  return count === 1
    ? "Il vous reste 1 document à créer vous-même."
    : `Il vous reste ${count} documents à créer vous-même.`;
}

// Le DIPC se réclame en MODÈLE VIERGE, jamais en exemplaire signé : un DIPC signé
// est une donnée de santé nominative (CLAUDE.md §6, HDS) qui ne doit pas atteindre
// l'hébergement actuel.
export const DIPC_CODE = "L2002_DIPC";
export const DIPC_BLANK_MODEL_NOTICE =
  "Déposez le modèle vierge personnalisé du DIPC, sans nom ni signature. N'envoyez jamais un DIPC signé par une personne accompagnée.";

// La ligne « Autre forme de participation des usagers » (21/10/2026) ne dit plus
// « questionnaire vierge » : la règle HDS se dit donc au dépôt — la démarche, jamais
// les réponses d'une personne.
export const PARTICIPATION_SURVEY_CODE = "QUALITE_ENQUETE_QUESTIONNAIRE";
export const PARTICIPATION_SURVEY_NOTICE =
  "Déposez votre démarche : le questionnaire de l'enquête et les affiches d'information. Jamais les réponses d'une personne (aucun nom, aucune information de santé).";

export function depositNoticeFor(code: string): string | null {
  if (code === DIPC_CODE) return DIPC_BLANK_MODEL_NOTICE;
  if (code === PARTICIPATION_SURVEY_CODE) return PARTICIPATION_SURVEY_NOTICE;
  return null;
}
