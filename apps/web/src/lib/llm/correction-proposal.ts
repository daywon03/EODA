// ─────────────────────────────────────────────────────────────────────────────
// SORTIE STRUCTURÉE DE LA MISE EN CONFORMITÉ (N8) — le contrat entre le modèle et
// l'écran côte à côte.
//
// Le document est une suite ORDONNÉE de segments : ce qui vient de l'original
// (ORIGINAL), et ce que le modèle propose d'ajouter (AJOUT), à sa place. La position
// EST l'emplacement ; `anchor` le redit en citant le passage qui précède, pour qu'un
// humain le retrouve dans l'original. Chaque ajout porte le critère HAS qui le
// justifie et, quand le manuel est fourni, la ligne qui le réclame.
//
// Le JSON du modèle est une ENTRÉE NON FIABLE : `parseCorrectionProposalJson` le
// valide contre le schéma (et lève si rien n'est exploitable) ; `sanitizeProposal`
// retire ensuite ce que le modèle ne peut pas prouver (un code de critère inconnu,
// une citation du manuel introuvable dans les extraits fournis).
// Pur : aucun accès réseau ni base.
// ─────────────────────────────────────────────────────────────────────────────

export const PROPOSAL_SCHEMA_VERSION = 1;

export type OriginalSegment = { kind: "ORIGINAL"; text: string };
export type AdditionSegment = {
  kind: "AJOUT";
  id: string;
  text: string;
  criterionCode: string | null;
  reason: string;
  manualQuote: string | null;
  anchor: string | null;
};
export type ProposalSegment = OriginalSegment | AdditionSegment;

export type CorrectionProposal = {
  schemaVersion: typeof PROPOSAL_SCHEMA_VERSION;
  segments: ProposalSegment[];
};

// Schéma imposé au modèle (sortie structurée côté Anthropic, consigne côté
// OpenRouter). Aucun champ nullable : une chaîne vide dit « pas d'information », ce
// que tous les fournisseurs savent produire.
export const CORRECTION_PROPOSAL_JSON_SCHEMA = {
  type: "object",
  properties: {
    segments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["ORIGINAL", "AJOUT"] },
          id: { type: "string" },
          text: { type: "string" },
          criterionCode: { type: "string" },
          reason: { type: "string" },
          manualQuote: { type: "string" },
          anchor: { type: "string" },
        },
        required: ["kind", "id", "text", "criterionCode", "reason", "manualQuote", "anchor"],
        additionalProperties: false,
      },
    },
  },
  required: ["segments"],
  additionalProperties: false,
} as const;

export class InvalidProposalError extends Error {}

function optionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Valide la forme. Un segment malformé est écarté ; un document sans aucun segment
// exploitable est une sortie invalide (on ne présente jamais une proposition vide
// comme « rien à ajouter »).
export function validateCorrectionProposal(value: unknown): CorrectionProposal {
  if (typeof value !== "object" || value === null || !Array.isArray((value as { segments?: unknown }).segments)) {
    throw new InvalidProposalError("Sortie de mise en conformité sans liste de segments.");
  }
  const usedIds = new Set<string>();
  let counter = 0;
  const segments: ProposalSegment[] = [];
  for (const raw of (value as { segments: unknown[] }).segments) {
    if (typeof raw !== "object" || raw === null) continue;
    const s = raw as Record<string, unknown>;
    const text = typeof s.text === "string" ? s.text.trim() : "";
    if (text.length === 0) continue;
    if (s.kind === "ORIGINAL") {
      segments.push({ kind: "ORIGINAL", text });
    } else if (s.kind === "AJOUT") {
      // Identifiant stable dans la proposition : celui du modèle s'il est unique,
      // sinon un identifiant attribué ici (les décisions s'y rattachent).
      let id = optionalString(s.id);
      if (!id || usedIds.has(id)) {
        do id = `a${++counter}`;
        while (usedIds.has(id));
      }
      usedIds.add(id);
      segments.push({
        kind: "AJOUT",
        id,
        text,
        criterionCode: optionalString(s.criterionCode),
        reason: optionalString(s.reason) ?? "Ajout proposé pour compléter le document.",
        manualQuote: optionalString(s.manualQuote),
        anchor: optionalString(s.anchor),
      });
    }
  }
  if (segments.length === 0) throw new InvalidProposalError("Sortie de mise en conformité vide.");
  return { schemaVersion: PROPOSAL_SCHEMA_VERSION, segments };
}

export function parseCorrectionProposalJson(raw: string): CorrectionProposal {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidProposalError("Sortie de mise en conformité non parsable en JSON.");
  }
  return validateCorrectionProposal(parsed);
}

function normalizeSpaces(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

// Numéros de version et dates (call du 18/10/2026 : « l'IA ne doit jamais toucher
// aux numéros de version »). Ils appartiennent à la structure et à son circuit de
// validation : un « v3 » devenu « v4 », ou une date de mise à jour inventée, ferait
// mentir le document le jour où l'évaluateur le lit.
const MONTHS = "janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre";
const VERSION_OR_DATE = new RegExp(
  [
    String.raw`\bv(?:ersion)?\s?\d+(?:[.,]\d+)*\b`,
    String.raw`\b\d{1,2}([/-])\d{1,2}\1\d{2,4}\b`,
    // Point comme séparateur : année sur quatre chiffres seulement — sinon un code
    // de critère HAS (« 1.10.12 ») passerait pour une date.
    String.raw`\b\d{1,2}\.\d{1,2}\.\d{4}\b`,
    String.raw`\b\d{4}-\d{2}-\d{2}\b`,
    String.raw`\b\d{1,2}(?:er)?\s+(?:${MONTHS})\s+\d{4}\b`,
  ].join("|"),
  "gi"
);
export const VERSION_OR_DATE_PLACEHOLDER = "[À compléter : version ou date]";

// Toute version ou date du texte qui n'existe pas dans la SOURCE (le document
// d'origine, plus les extraits du manuel fournis) est remplacée par un champ à
// compléter : le modèle ne peut ni en changer une ni en inventer une. Une date qui
// figure déjà dans la source (une loi citée, la date du document) passe telle quelle.
export function protectVersionsAndDates(text: string, normalizedSource: string): string {
  return text.replace(VERSION_OR_DATE, (match) =>
    normalizedSource.includes(normalizeSpaces(match)) ? match : VERSION_OR_DATE_PLACEHOLDER
  );
}

// Ce que le modèle ne peut pas prouver est retiré, jamais deviné : un code de
// critère hors référentiel devient « critère à identifier », une citation absente
// des extraits du manuel fournis disparaît, une version ou une date absente de la
// source devient un champ à compléter (segments ORIGINAL compris : le modèle les
// recopie, il pourrait les « corriger »).
export function sanitizeProposal(
  proposal: CorrectionProposal,
  context: {
    knownCriterionCodes: ReadonlySet<string>;
    knowledgeExcerpts: readonly string[];
    // Texte du document d'origine, tel qu'envoyé au modèle.
    originalText: string;
  }
): CorrectionProposal {
  const corpus = normalizeSpaces(context.knowledgeExcerpts.join("\n"));
  const source = `${normalizeSpaces(context.originalText)}\n${corpus}`;
  return {
    ...proposal,
    segments: proposal.segments.map((segment) => {
      const text = protectVersionsAndDates(segment.text, source);
      if (segment.kind !== "AJOUT") return { ...segment, text };
      const criterionCode =
        segment.criterionCode && context.knownCriterionCodes.has(segment.criterionCode) ? segment.criterionCode : null;
      const quote = segment.manualQuote ? normalizeSpaces(segment.manualQuote) : "";
      const manualQuote = quote.length > 0 && corpus.includes(quote) ? segment.manualQuote : null;
      return { ...segment, text, criterionCode, manualQuote };
    }),
  };
}

// Lecture défensive d'une proposition stockée (colonne Json).
export function readStoredProposal(value: unknown): CorrectionProposal | null {
  try {
    return validateCorrectionProposal(value);
  } catch {
    return null;
  }
}
