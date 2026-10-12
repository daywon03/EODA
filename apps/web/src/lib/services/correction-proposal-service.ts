import type { SupportMode } from "@eoda/database";
import type { AdditionSegment, CorrectionProposal } from "@/lib/llm/correction-proposal";

// ─────────────────────────────────────────────────────────────────────────────
// METTRE EN CONFORMITÉ CÔTE À CÔTE — règles pures (tranche N8).
//
// Une proposition (segments ORIGINAL / AJOUT) + une décision par ajout (Accepter /
// Refuser) donnent la version N+1 : l'original, plus les ajouts ACCEPTÉS — rien
// d'autre. Un ajout sans décision n'entre pas (« non retenu ») : rien n'atteint le
// document sans un geste humain. Les décisions sont figées sur la proposition au
// moment de l'enregistrement (`decisionsJson`), avec qui et quand : c'est ce qui
// fait le rapport des changements (« ce qui était demandé / ce qui a été fait »).
// ─────────────────────────────────────────────────────────────────────────────

export type ProposalDecision = "ACCEPTE" | "REFUSE";
export type DecisionMap = ReadonlyMap<string, ProposalDecision>;

export function additionsOf(proposal: CorrectionProposal): AdditionSegment[] {
  return proposal.segments.filter((s): s is AdditionSegment => s.kind === "AJOUT");
}

export type DecisionsCheck = { ok: true; decisions: Map<string, ProposalDecision> } | { ok: false; error: string };

// Les décisions viennent du navigateur : chaque identifiant doit exister dans la
// proposition, chaque valeur être ACCEPTE ou REFUSE. Rien n'est casté.
export function parseDecisions(raw: unknown, proposal: CorrectionProposal): DecisionsCheck {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, error: "Décisions illisibles." };
  const known = new Set(additionsOf(proposal).map((a) => a.id));
  const decisions = new Map<string, ProposalDecision>();
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.has(id)) return { ok: false, error: "Un ajout décidé n'existe pas dans cette proposition." };
    if (value !== "ACCEPTE" && value !== "REFUSE") return { ok: false, error: "Une décision doit être Accepter ou Refuser." };
    decisions.set(id, value);
  }
  return { ok: true, decisions };
}

// Le document final : l'original + les ajouts acceptés, dans l'ordre. `decisions`
// absent = la proposition entière (aperçu, export avant décision).
export function proposalToMarkdown(proposal: CorrectionProposal, decisions?: DecisionMap): string {
  return proposal.segments
    .filter((s) => s.kind === "ORIGINAL" || !decisions || decisions.get(s.id) === "ACCEPTE")
    .map((s) => s.text)
    .join("\n\n");
}

export function countDecisions(proposal: CorrectionProposal, decisions: DecisionMap) {
  const additions = additionsOf(proposal);
  const accepted = additions.filter((a) => decisions.get(a.id) === "ACCEPTE").length;
  const refused = additions.filter((a) => decisions.get(a.id) === "REFUSE").length;
  return { total: additions.length, accepted, refused, pending: additions.length - accepted - refused };
}

// ── Champs à compléter ───────────────────────────────────────────────────────

const FIELD_PATTERN = /\[À compléter[^\]]*\]/g;

export function extractFieldsToComplete(text: string): string[] {
  return text.match(FIELD_PATTERN) ?? [];
}

export function countFieldsToComplete(proposal: CorrectionProposal, decisions?: DecisionMap): number {
  return extractFieldsToComplete(proposalToMarkdown(proposal, decisions)).length;
}

export type TextPart = { kind: "text" | "field"; value: string };

// Découpe un texte pour l'affichage : les champs à compléter sont rendus en pointillé.
export function splitFields(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(FIELD_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: "text", value: text.slice(last, index) });
    parts.push({ kind: "field", value: match[0] });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}

// ── Phrases de l'écran et des exports ────────────────────────────────────────

export function criterionCaption(addition: AdditionSegment, labels: ReadonlyMap<string, string>): string {
  if (!addition.criterionCode) return "Pour le critère : à identifier";
  const label = labels.get(addition.criterionCode);
  return `Pour le critère : ${addition.criterionCode}${label ? ` — ${label}` : ""}`;
}

// L'encart du document annoté (context/10 §4) : pourquoi l'ajout, et la ligne du
// manuel qui le réclame quand elle a pu être vérifiée.
export function additionInsert(addition: AdditionSegment): string {
  const head = addition.criterionCode
    ? `Ajouté car réclamé par le critère HAS ${addition.criterionCode}, absent de la version initiale.`
    : "Ajouté pour compléter le document, absent de la version initiale.";
  return addition.manualQuote ? `${head} Manuel HAS : « ${addition.manualQuote} »` : head;
}

export function describeProposalStatus(proposal: CorrectionProposal, decisions: DecisionMap): string {
  const { pending } = countDecisions(proposal, decisions);
  const fields = countFieldsToComplete(proposal);
  const head = pending > 0 ? `${pending} ajout${pending > 1 ? "s" : ""} à vérifier.` : "Tous les ajouts sont vérifiés.";
  return `${head} ${fields} champ${fields > 1 ? "s" : ""} à compléter.`;
}

// Avertissement affiché AVANT « Enregistrer la version N+1 » (décision Damon, 12/10) :
// un ajout non tranché n'empêche pas l'enregistrement — il n'entre simplement pas —
// mais la personne doit le savoir avant, pas le découvrir dans la version N+1.
export function describeUndecidedWarning(proposal: CorrectionProposal, decisions: DecisionMap): string | null {
  const { pending } = countDecisions(proposal, decisions);
  if (pending === 0) return null;
  return pending > 1
    ? `${pending} ajouts non décidés ne seront pas retenus dans la nouvelle version.`
    : "1 ajout non décidé ne sera pas retenu dans la nouvelle version.";
}

// ── Rapport des changements ──────────────────────────────────────────────────

export type ChangeReportRow = {
  criterion: string;
  requested: string;
  done: "Ajouté" | "Refusé" | "Non retenu";
  text: string;
};

export function buildChangeReport(
  proposal: CorrectionProposal,
  decisions: DecisionMap,
  labels: ReadonlyMap<string, string>
): ChangeReportRow[] {
  return additionsOf(proposal).map((addition) => {
    const decision = decisions.get(addition.id);
    return {
      criterion: criterionCaption(addition, labels).replace("Pour le critère : ", ""),
      requested: addition.reason,
      done: decision === "ACCEPTE" ? "Ajouté" : decision === "REFUSE" ? "Refusé" : "Non retenu",
      text: addition.text,
    };
  });
}

// Trace stockée sur la proposition à l'enregistrement de la version N+1.
export function buildDecisionsRecord(decisions: DecisionMap, decidedAt: Date) {
  return {
    schemaVersion: 1,
    decidedAt: decidedAt.toISOString(),
    decisions: [...decisions.entries()].map(([id, decision]) => ({ id, decision })),
  };
}

export function readDecisionsRecord(value: unknown): Map<string, ProposalDecision> {
  const decisions = new Map<string, ProposalDecision>();
  const list = (value as { decisions?: unknown } | null)?.decisions;
  if (!Array.isArray(list)) return decisions;
  for (const entry of list) {
    const e = entry as { id?: unknown; decision?: unknown } | null;
    if (typeof e?.id === "string" && (e.decision === "ACCEPTE" || e.decision === "REFUSE")) decisions.set(e.id, e.decision);
  }
  return decisions;
}

// ── Qui peut ouvrir l'écran ──────────────────────────────────────────────────

// Cabinet : toujours (dans son tenant). Structure : seulement en autonomie ET si
// l'offre comprend la génération de ce document (correctionRight) — en
// accompagnement, c'est EODA qui met en conformité et relit.
export function canUseComplianceWorkspace(facts: { isClient: boolean; mode: SupportMode; rightIncluded: boolean }): boolean {
  if (!facts.isClient) return true;
  return facts.mode === "AUTONOMIE" && facts.rightIncluded;
}

// « version 2 » : le numéro que prendra la nouvelle version.
export function nextVersionLabel(currentVersionNumber: number): string {
  return `Enregistrer la version ${currentVersionNumber + 1}`;
}
