import type { SupportMode } from "@eoda/database";
import {
  groupClientDocuments,
  matchesClientSearch,
  parseClientDocumentFilter,
  type ClientDocumentFilter,
  type ClientDocumentGroup,
  type ClientDocumentRow,
  type ClientDocumentState,
} from "./client-documents-view-service";

// ─────────────────────────────────────────────────────────────────────────────
// « MES DOCUMENTS » — LES TROIS ONGLETS (retours du 09/11/2026, Lot B).
//
// « 13 acceptés, 1 déposé, tout 76, à déposer, à produire 19, reçu en cours — je
// comprends rien » (la directrice du pilote, et Sandrine). Cinq bulles d'état et huit
// bulles de rubriques disaient l'état de CHAQUE document ; la personne demandait
// seulement : « qu'est-ce que je dois faire ? ». Trois onglets répondent à ça :
//
//   À faire par vous   — déposer, renouveler, accepter (ou vérifier), créer (autonomie)
//   EODA s'en occupe   — accompagnée : EODA produit ou relit ; autonomie : « Reçus »
//   C'est fait         — accepté par vous, ou ne vous concerne pas
//
// Règles pures : l'état de chaque document reste dérivé ailleurs
// (client-documents-view-service) ; ce module ne fait que le RANGER. Aucune règle de
// visibilité ni d'autorisation n'est ici.
// ─────────────────────────────────────────────────────────────────────────────

export const CLIENT_DOCUMENT_VIEWS = ["a-faire", "en-cours", "fait"] as const;
export type ClientDocumentView = (typeof CLIENT_DOCUMENT_VIEWS)[number];

// Une seule correspondance, totale (le type l'impose). En autonomie, personne d'autre
// que la structure ne produit un document qu'elle n'a pas : « À produire » y est donc
// « à créer », dans l'onglet de ce qu'elle doit faire. « Reçu » (IN_PROGRESS) reste à
// part : l'analyse n'a pas abouti, il n'y a aucun geste à proposer (la carte le dit).
export function clientViewOf(state: ClientDocumentState, mode: SupportMode): ClientDocumentView {
  switch (state) {
    case "TO_DEPOSIT":
    case "RENEW":
    case "TO_CHECK":
      return "a-faire";
    case "TO_PRODUCE":
      return mode === "AUTONOMIE" ? "a-faire" : "en-cours";
    case "IN_PROGRESS":
      return "en-cours";
    case "ACCEPTED":
    case "NOT_CONCERNED":
      return "fait";
  }
}

export type ClientViewIcon = "todo" | "waiting" | "done";

export type ClientViewDescription = { label: string; sentence: string; icon: ClientViewIcon };

export function describeClientView(view: ClientDocumentView, mode: SupportMode): ClientViewDescription {
  const autonomy = mode === "AUTONOMIE";
  switch (view) {
    case "a-faire":
      return {
        label: "À faire par vous",
        icon: "todo",
        sentence: autonomy
          ? "Les documents à déposer, à créer, ou à vérifier puis accepter."
          : "Les documents à déposer, et ceux qu'EODA a relus : à vous de les accepter.",
      };
    case "en-cours":
      return autonomy
        ? {
            label: "Reçus",
            icon: "waiting",
            sentence: "Vous les avez déposés. L'analyse n'est pas disponible : relisez-les vous-même.",
          }
        : {
            label: "EODA s'en occupe",
            icon: "waiting",
            sentence: "EODA prépare ces documents, ou relit ceux que vous avez déposés. Vous n'avez rien à faire.",
          };
    case "fait":
      return {
        label: "C'est fait",
        icon: "done",
        sentence: "Les documents acceptés par vous, et ceux qui ne vous concernent pas.",
      };
  }
}

// Les anciens liens (`?filtre=`, avant le 09/11/2026) ouvrent l'onglet qui contient
// ces documents aujourd'hui : un favori ne doit pas tomber sur une page qui ne
// ressemble plus à rien. `?vue=` l'emporte. Entrée non fiable : l'inconnu = rien.
const VIEW_OF_LEGACY_FILTER: Record<ClientDocumentFilter, (mode: SupportMode) => ClientDocumentView> = {
  "a-deposer": () => "a-faire",
  "a-produire": (mode) => clientViewOf("TO_PRODUCE", mode),
  "en-cours": () => "en-cours",
  accepte: () => "fait",
};

export function parseClientDocumentView(
  params: { vue?: string | string[]; filtre?: string | string[] },
  mode: SupportMode
): ClientDocumentView | null {
  const raw = Array.isArray(params.vue) ? params.vue[0] : params.vue;
  const view = CLIENT_DOCUMENT_VIEWS.find((candidate) => candidate === raw);
  if (view) return view;
  const legacy = parseClientDocumentFilter(params.filtre);
  return legacy ? VIEW_OF_LEGACY_FILTER[legacy](mode) : null;
}

export type ClientViewCounts = Record<ClientDocumentView, number>;

export function countClientViews(rows: readonly ClientDocumentRow[], mode: SupportMode): ClientViewCounts {
  const counts: ClientViewCounts = { "a-faire": 0, "en-cours": 0, fait: 0 };
  for (const row of rows) counts[clientViewOf(row.state, mode)] += 1;
  return counts;
}

// Sans onglet choisi : « À faire par vous ». Sauf pendant une recherche — le
// diagnostic renvoie vers « Mes documents?q=<nom> », et le document cherché peut être
// déjà accepté : on ouvre le premier onglet qui a un résultat.
export function resolveClientView(
  requested: ClientDocumentView | null,
  counts: ClientViewCounts,
  query: string
): ClientDocumentView {
  if (requested) return requested;
  if (query.length === 0) return "a-faire";
  return CLIENT_DOCUMENT_VIEWS.find((view) => counts[view] > 0) ?? "a-faire";
}

// Rubriques d'un onglet, ordre alphabétique dans chacune (le tri « A à Z » n'est plus
// un bouton, c'est l'ordre). Une rubrique sans document dans l'onglet n'est pas rendue.
export function groupClientDocumentsForView<T extends ClientDocumentRow>(
  rows: readonly T[],
  view: ClientDocumentView,
  mode: SupportMode,
  query: string
): ClientDocumentGroup<T>[] {
  const inView = rows.filter((row) => clientViewOf(row.state, mode) === view && matchesClientSearch(row, query));
  return groupClientDocuments(inView, null, mode, { sort: "nom" });
}

const plural = (count: number, word: string) => `${count} ${word}${count > 1 ? "s" : ""}`;

function joinParts(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} et ${parts[parts.length - 1]}`;
}

// La phrase d'en-tête : « Vous avez 3 documents à déposer et 21 à accepter. EODA
// prépare 19 documents. » Le premier nombre porte le mot « document(s) », les suivants
// le sous-entendent (FALC : une phrase courte, pas une liste de compteurs).
export function describeClientTodo(rows: readonly ClientDocumentRow[], mode: SupportMode): string {
  const count = (state: ClientDocumentState) => rows.filter((row) => row.state === state).length;
  const autonomy = mode === "AUTONOMIE";
  const todo: [number, string][] = [
    [count("TO_DEPOSIT"), "à déposer"],
    [count("RENEW"), "à renouveler"],
    [autonomy ? count("TO_PRODUCE") : 0, "à créer"],
    [count("TO_CHECK"), autonomy ? "à vérifier" : "à accepter"],
  ];
  const present = todo.filter(([n]) => n > 0);
  const first = present[0];
  const mine = first
    ? `Vous avez ${joinParts(present.map(([n, what], index) => (index === 0 ? `${plural(n, "document")} ${what}` : `${n} ${what}`)))}.`
    : "Rien à faire pour l'instant.";
  if (autonomy) return mine;
  const eoda = count("TO_PRODUCE") + count("IN_PROGRESS");
  return eoda > 0 ? `${mine} EODA prépare ${plural(eoda, "document")}.` : mine;
}

export function describeEmptyView(view: ClientDocumentView, mode: SupportMode, query: string): string {
  if (query.length > 0) return `Aucun document ne correspond à « ${query} » dans cette liste.`;
  switch (view) {
    case "a-faire":
      return "Rien à faire pour l'instant.";
    case "en-cours":
      return mode === "AUTONOMIE" ? "Aucun document en attente." : "EODA n'a aucun document en préparation.";
    case "fait":
      return "Aucun document n'est encore terminé.";
  }
}

// Le geste principal d'une carte (B4) : déposer ce qui manque, accepter ce qu'on a
// montré, sinon voir le document. Les autres gestes restent, en secondaire.
export type PrimaryCardAction = "DEPOSIT" | "ACCEPT" | "VIEW";

export function primaryCardAction(
  state: ClientDocumentState,
  facts: { canAct: boolean; hasViewable: boolean }
): PrimaryCardAction | null {
  if (facts.canAct && (state === "TO_DEPOSIT" || state === "RENEW")) return "DEPOSIT";
  // On ne demande pas d'accepter une pièce qu'on ne peut pas ouvrir (QA du 09/11/2026 :
  // analyse relue sur une version d'EODA pas encore validée, donc invisible ici).
  if (!facts.hasViewable) return null;
  if (facts.canAct && state === "TO_CHECK") return "ACCEPT";
  return "VIEW";
}
