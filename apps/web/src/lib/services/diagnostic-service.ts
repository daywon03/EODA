import type { CommercialTier } from "@eoda/database";
import { chapterLabel } from "./chapter-label-service";
import { PROOF_PILLS, type CriterionProofRow, type ProofStatus } from "./criteria-proof-service";
import { getOfferScope } from "./offer-scope-service";

// ─────────────────────────────────────────────────────────────────────────────
// « MON DIAGNOSTIC » (client) — tranche N6, maquette « Portail Client v2 ».
//
// Rien n'est stocké ici : le diagnostic est une LECTURE des critères & preuves (N4,
// criteria-proof-service), mise en mots pour la structure. Trois choses en sortent :
//   1. le décompte des impératifs (« N critères impératifs sur 16 sont prouvés ») ;
//   2. les compteurs Prouvé / En partie / Sans preuve, chacun avec sa définition ;
//   3. les 3 actions prioritaires : parmi les impératifs SANS PREUVE, les documents
//      attendus qui en prouveraient le plus (« un même document peut prouver
//      plusieurs critères »).
// Plus la photo (`buildDiagnosticSnapshot`) que fige un geste de validation, et son
// empreinte, qui dit si ce qui a été relu est encore ce qu'on lit.
//
// Règles PURES : ni Prisma, ni horloge (la date de la photo est passée en entrée).
// ─────────────────────────────────────────────────────────────────────────────

// Les trois états que la structure voit, avec la phrase qui les définit (maquette).
// « Prouvé » n'est jamais « conforme » : c'est un fait de relecture, pas un verdict.
export const DIAGNOSTIC_STATES = ["PROUVE", "EN_PARTIE", "SANS_PREUVE"] as const satisfies readonly ProofStatus[];
export type DiagnosticState = (typeof DIAGNOSTIC_STATES)[number];

export const DIAGNOSTIC_STATE_DEFINITIONS: Record<DiagnosticState, string> = {
  PROUVE: "Les documents attendus sont déposés, puis relus par EODA ou acceptés par vous.",
  EN_PARTIE: "Un document est déposé, mais il manque une preuve ou une relecture.",
  SANS_PREUVE: "Rien n'est encore déposé. C'est là qu'il faut agir.",
};

export type DiagnosticCounter = {
  state: DiagnosticState;
  label: string;
  glyph: string;
  definition: string;
  count: number;
};

export type DiagnosticSummary = {
  // Les impératifs, toujours comptés à part (en-tête, photo, journal).
  imperatives: { proven: number; total: number };
  // Le périmètre du rapport, FILTRÉ PAR L'OFFRE de la mission (call du 09/11/2026) :
  // Essentiel = les impératifs seuls ; Performance, Excellence, bêta-test = tous les
  // critères applicables au profil. Les cartes ET la liste comptent ce périmètre.
  scope: { all: boolean; proven: number; total: number };
  counters: DiagnosticCounter[];
  // Critères du périmètre que la matrice ne rattache encore à aucun document : ni
  // prouvés ni « sans preuve » — on le dit à part plutôt que de les ranger de force.
  withoutExpectedDocument: number;
};

// `scopeAll` vient de l'offre de la MISSION (getOfferScope(...).criteriaScope),
// jamais de Establishment.commercialTier. Les lignes reçues sont déjà filtrées par
// applicabilité (un SAD aide ne voit jamais un critère SAD_MIXTE, read-criteria-proof).
export function buildDiagnosticSummary(rows: readonly CriterionProofRow[], scopeAll: boolean): DiagnosticSummary {
  const imperatives = rows.filter((r) => r.isImperative);
  const scoped = scopeAll ? rows : imperatives;
  const counters = DIAGNOSTIC_STATES.map((state) => ({
    state,
    label: PROOF_PILLS[state].label,
    glyph: PROOF_PILLS[state].glyph,
    definition: DIAGNOSTIC_STATE_DEFINITIONS[state],
    count: scoped.filter((r) => r.status === state).length,
  }));
  return {
    imperatives: countProven(imperatives),
    scope: { all: scopeAll, ...countProven(scoped) },
    counters,
    withoutExpectedDocument: scoped.filter((r) => r.status === "NON_RATTACHE").length,
  };
}

function countProven(rows: readonly CriterionProofRow[]): { proven: number; total: number } {
  return { proven: rows.filter((r) => r.status === "PROUVE").length, total: rows.length };
}

// Le titre du rapport nomme l'offre qui le filtre (call du 09/11/2026). Une mission
// sans offre (prestations à la carte) ou l'absence de mission : les impératifs.
// `undefined` = aucune mission ; `null` = mission sans offre.
const OFFER_NAMES: Record<Exclude<CommercialTier, "BETA">, string> = {
  ESSENTIEL: "Offre Essentiel",
  PERFORMANCE: "Offre Performance",
  EXCELLENCE: "Offre Excellence",
};

export function describeDiagnosticOffer(formule: CommercialTier | null | undefined, gratuit: boolean): string {
  const name =
    formule === undefined
      ? "Aucune mission"
      : gratuit || formule === "BETA"
        ? "Bêta-test"
        : formule === null
          ? "Prestations à la carte"
          : OFFER_NAMES[formule];
  const covered = formule !== undefined && getOfferScope(formule, gratuit).criteriaScope === "ALL";
  return `${name} : ${covered ? "tous les critères de votre périmètre" : "les critères impératifs seulement"}`;
}

// La phrase d'en-tête. Le total est celui des critères EN BASE pour ce profil (16 SAD
// aide, 17 SAD mixte — context/02 §4), jamais un nombre écrit en dur.
// `inProgress` : impératifs dont une partie des pièces est déjà là (21/10/2026) —
// sans lui, « 0 sur 16 » se lisait comme « rien n'est fait ».
export function describeDiagnosticLine(
  summary: Pick<DiagnosticSummary, "imperatives" | "scope">,
  inProgress = 0
): string {
  if (summary.scope.all) return describeFullScopeLine(summary);
  const imperatives = summary.imperatives;
  if (imperatives.total === 0) return "Aucun critère impératif n'est encore chargé pour votre structure.";
  const remaining = imperatives.total - imperatives.proven;
  const head = `${imperatives.proven} critère${imperatives.proven > 1 ? "s" : ""} impératif${imperatives.proven > 1 ? "s" : ""} sur ${imperatives.total} ${imperatives.proven > 1 ? "sont prouvés" : "est prouvé"}.`;
  if (remaining === 0) return `${head} Tous sont prouvés.`;
  const started = Math.min(inProgress, remaining);
  const progress =
    started > 0 ? ` (dont ${started} déjà en partie : une pièce attendue reste à relire ou à déposer)` : "";
  return `${head} ${remaining} ${remaining > 1 ? "restent" : "reste"} à travailler${progress}.`;
}

function describeFullScopeLine({ imperatives, scope }: Pick<DiagnosticSummary, "imperatives" | "scope">): string {
  if (scope.total === 0) return "Aucun critère n'est encore chargé pour votre structure.";
  const remaining = scope.total - scope.proven;
  const head = `${scope.proven} critère${scope.proven > 1 ? "s" : ""} sur ${scope.total} ${scope.proven > 1 ? "sont prouvés" : "est prouvé"}, dont ${imperatives.proven} impératif${imperatives.proven > 1 ? "s" : ""} sur ${imperatives.total}.`;
  if (remaining === 0) return `${head} Tous sont prouvés.`;
  return `${head} ${remaining} ${remaining > 1 ? "restent" : "reste"} à travailler.`;
}

// ── Les 3 actions prioritaires ───────────────────────────────────────────────

export type PriorityAction = {
  documentTypeId: string;
  documentLabel: string;
  // Les impératifs sans preuve que ce document prouverait (codes triés).
  proves: { code: string; label: string }[];
};

export const PRIORITY_LIMIT = 3;

// Impératifs SANS PREUVE × documents attendus : chaque type attendu est crédité des
// impératifs sans preuve qu'il couvre ; on garde ceux qui en couvrent le plus.
// Égalité : l'ordre du premier critère couvert (codes), puis le libellé — un ordre
// stable, pour que la liste ne saute pas d'un chargement à l'autre.
export function derivePriorityActions(
  rows: readonly CriterionProofRow[],
  documentLabels: ReadonlyMap<string, string>,
  limit = PRIORITY_LIMIT
): PriorityAction[] {
  const byType = new Map<string, { code: string; label: string }[]>();
  for (const row of rows) {
    if (!row.isImperative || row.status !== "SANS_PREUVE") continue;
    for (const typeId of new Set(row.expectedDocumentTypeIds)) {
      const list = byType.get(typeId) ?? [];
      list.push({ code: row.code, label: row.label });
      byType.set(typeId, list);
    }
  }
  return [...byType.entries()]
    .flatMap(([documentTypeId, proves]) => {
      const documentLabel = documentLabels.get(documentTypeId);
      return documentLabel ? [{ documentTypeId, documentLabel, proves }] : [];
    })
    .sort(
      (a, b) =>
        b.proves.length - a.proves.length ||
        a.proves[0]!.code.localeCompare(b.proves[0]!.code, "fr", { numeric: true }) ||
        a.documentLabel.localeCompare(b.documentLabel, "fr")
    )
    .slice(0, limit);
}

export function describePriorityProves(action: PriorityAction): string {
  const n = action.proves.length;
  return `Prouve ${n} critère${n > 1 ? "s" : ""} impératif${n > 1 ? "s" : ""} : ${action.proves.map((p) => p.code).join(", ")}`;
}

// ── Chapitres ────────────────────────────────────────────────────────────────

export type DiagnosticChapter = {
  number: number;
  title: string;
  rows: CriterionProofRow[];
  summary: string;
};

// Les trois chapitres HAS, dans l'ordre, chacun résumé en un mot (« 3 prouvés sur
// 7 ») pour qu'une section repliée ne cache pas une inconnue. `scopeAll` : l'offre
// couvre tout le référentiel (sinon les impératifs seuls, comme l'auto-évaluation).
export function groupDiagnosticChapters(
  rows: readonly CriterionProofRow[],
  chapters: readonly { number: number; name: string }[],
  scopeAll: boolean
): DiagnosticChapter[] {
  const visible = scopeAll ? rows : rows.filter((r) => r.isImperative);
  return [...chapters]
    .sort((a, b) => a.number - b.number)
    .map((chapter) => {
      const chapterRows = visible.filter((r) => r.chapterNumber === chapter.number);
      const proven = chapterRows.filter((r) => r.status === "PROUVE").length;
      return {
        number: chapter.number,
        title: chapterLabel(chapter),
        rows: chapterRows,
        summary:
          chapterRows.length === 0
            ? scopeAll
              ? "aucun critère"
              : "aucun critère impératif"
            : provenOf(proven, chapterRows.length) + (scopeAll ? imperativesPart(chapterRows) : ""),
      };
    });
}

function provenOf(proven: number, total: number): string {
  return `${proven} prouvé${proven > 1 ? "s" : ""} sur ${total}`;
}

// Liste complète : les impératifs du chapitre, à part (retour de Sandrine, 08/11/2026 —
// les cartes du haut ne comptent qu'eux, la liste montre tout le périmètre).
function imperativesPart(chapterRows: readonly CriterionProofRow[]): string {
  const imperatives = chapterRows.filter((r) => r.isImperative);
  // Aucun impératif, ou rien d'autre : la précision n'apprendrait rien.
  if (imperatives.length === 0 || imperatives.length === chapterRows.length) return "";
  return ` · impératifs : ${provenOf(imperatives.filter((r) => r.status === "PROUVE").length, imperatives.length)}`;
}

// Ce que montre la liste des chapitres : depuis le 09/11/2026, toujours la même chose
// que les cartes du haut (le périmètre de l'offre). `total` = summary.scope.total.
export function describeChaptersScope(scopeAll: boolean, total: number): string {
  return scopeAll
    ? `La liste montre les ${total} critères de votre périmètre, les mêmes que les cartes du haut. Les critères impératifs sont marqués ▲ Impératif.`
    : `La liste montre vos ${total} critères impératifs, les mêmes que les cartes du haut.`;
}

// ── La photo figée par un geste de validation ────────────────────────────────

export const DIAGNOSTIC_SNAPSHOT_VERSION = 1;

export type DiagnosticSnapshot = {
  version: typeof DIAGNOSTIC_SNAPSHOT_VERSION;
  takenAt: string;
  imperatives: { proven: number; total: number };
  rows: { code: string; label: string; isImperative: boolean; status: ProofStatus }[];
};

export function buildDiagnosticSnapshot(rows: readonly CriterionProofRow[], takenAt: Date): DiagnosticSnapshot {
  return {
    version: DIAGNOSTIC_SNAPSHOT_VERSION,
    takenAt: takenAt.toISOString(),
    imperatives: countProven(rows.filter((r) => r.isImperative)),
    rows: rows.map((r) => ({ code: r.code, label: r.label, isImperative: r.isImperative, status: r.status })),
  };
}

// Empreinte : codes et statuts, dans l'ordre des codes. Deux diagnostics de même
// empreinte disent la même chose à la structure — la photo est encore « à jour ».
export function diagnosticFingerprint(rows: readonly { code: string; status: ProofStatus }[]): string {
  return [...rows]
    .sort((a, b) => a.code.localeCompare(b.code, "fr", { numeric: true }))
    .map((r) => `${r.code}=${r.status}`)
    .join(";");
}

const PROOF_STATUSES: readonly string[] = ["PROUVE", "EN_PARTIE", "SANS_PREUVE", "NON_RATTACHE"];

// Lecture DÉFENSIVE d'une colonne Json (même doctrine que parseAnalysisResult) : une
// photo illisible vaut « pas de photo », donc une validation qui n'est plus à jour —
// jamais une validation présumée valable.
export function parseDiagnosticSnapshot(value: unknown): DiagnosticSnapshot | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== DIAGNOSTIC_SNAPSHOT_VERSION || typeof v.takenAt !== "string" || !Array.isArray(v.rows)) return null;
  const imp = v.imperatives as Record<string, unknown> | undefined;
  if (!imp || typeof imp.proven !== "number" || typeof imp.total !== "number") return null;
  const rows: DiagnosticSnapshot["rows"] = [];
  for (const raw of v.rows) {
    if (typeof raw !== "object" || raw === null) return null;
    const r = raw as Record<string, unknown>;
    if (
      typeof r.code !== "string" ||
      typeof r.label !== "string" ||
      typeof r.isImperative !== "boolean" ||
      typeof r.status !== "string" ||
      !PROOF_STATUSES.includes(r.status)
    ) {
      return null;
    }
    rows.push({ code: r.code, label: r.label, isImperative: r.isImperative, status: r.status as ProofStatus });
  }
  return { version: DIAGNOSTIC_SNAPSHOT_VERSION, takenAt: v.takenAt, imperatives: { proven: imp.proven, total: imp.total }, rows };
}

export const DIAGNOSTIC_DISCLAIMER =
  "Auto-évaluation préparatoire — pas une évaluation officielle de la HAS.";
