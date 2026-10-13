import type { DocumentCategory, DocumentStatus, SupportMode } from "@eoda/database";
import { DOCUMENT_PILLS, type PillSpec } from "@/lib/design/status-vocabulary";

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

// Relu par EODA = la revue de l'analyse de CETTE version, ou la validation du
// document posée après son dépôt (une validation antérieure portait sur une autre
// version : `validatedAt` n'est pas remis à zéro au dépôt).
export function isReviewedByEoda(facts: {
  analysisReviewedAt: Date | null;
  validatedAt: Date | null;
  versionUploadedAt: Date | null;
}): boolean {
  if (!facts.versionUploadedAt) return false;
  if (facts.analysisReviewedAt) return true;
  return facts.validatedAt !== null && facts.validatedAt >= facts.versionUploadedAt;
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
  label: string;
  category: DocumentCategory;
  status: DocumentStatus;
  declaredMissing: boolean;
  clientAccepted: boolean;
  currentVersion: { analysis: unknown; reviewedByEoda: boolean } | null;
};

export function toClientDocumentRow<T extends ClientChecklistFacts>(item: T, mode: SupportMode): T & { state: ClientDocumentState } {
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
  label: string;
  category: DocumentCategory;
  state: ClientDocumentState;
};

// Ce qui demande un geste d'abord, ce qui est réglé ensuite.
const STATE_RANK: Record<ClientDocumentState, number> = Object.fromEntries(
  CLIENT_DOCUMENT_STATES.map((state, index) => [state, index])
) as Record<ClientDocumentState, number>;

// Les obligatoires d'abord : loi 2002-2, puis les preuves des objectifs impératifs
// et les procédures (qualité et risques), puis le reste.
const CATEGORY_RANK: Record<DocumentCategory, number> = {
  LOI_2002_2: 0,
  QUALITE_RISQUES: 1,
  FONCTIONNEMENT: 2,
  RH: 3,
};

function byPriority<T extends ClientDocumentRow>(a: T, b: T): number {
  return STATE_RANK[a.state] - STATE_RANK[b.state] || CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
}

export function groupClientDocuments<T extends ClientDocumentRow>(
  rows: readonly T[],
  filter: ClientDocumentFilter | null
): { obligatory: T[]; others: T[] } {
  const visible = rows.filter((row) => filter === null || clientFilterOf(row.state) === filter);
  const sorted = [...visible].sort(byPriority);
  return {
    obligatory: sorted.filter((row) => row.category === "LOI_2002_2"),
    others: sorted.filter((row) => row.category !== "LOI_2002_2"),
  };
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
  "Déposez le modèle vierge du DIPC, sans nom ni signature. N'envoyez jamais un DIPC signé par une personne accompagnée.";

export function depositNoticeFor(code: string): string | null {
  return code === DIPC_CODE ? DIPC_BLANK_MODEL_NOTICE : null;
}
