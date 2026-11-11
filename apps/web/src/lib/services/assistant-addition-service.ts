import {
  PROPOSAL_SCHEMA_VERSION,
  sanitizeProposal,
  type AdditionSegment,
  type CorrectionProposal,
  type ProposalSegment,
} from "@/lib/llm/correction-proposal";
import { additionsOf } from "./correction-proposal-service";

// ─────────────────────────────────────────────────────────────────────────────
// UN AJOUT PROPOSÉ PAR L'ASSISTANT, POSÉ DANS LA MISE EN CONFORMITÉ (11/11/2026 —
// « voir le document se modifier en même temps »).
//
// L'assistant ne réécrit JAMAIS le document. Confirmer sa carte « Ajout au document »
// insère un segment AJOUT dans la proposition de mise en conformité ouverte — la même
// que celle du modèle de génération : il s'affiche surligné dans le document, et se
// décide comme les autres (Accepter / Corriger / Refuser) avant « Enregistrer la
// version N+1 ». Rien n'entre dans le document sans cette décision.
//
// Emplacement : après le passage ORIGINAL qui contient la citation « après » de
// l'assistant (espaces, casse et guillemets ignorés), sinon à la fin. Une citation
// qui ne se retrouve pas n'invente pas d'emplacement : l'ajout part en fin de
// document, et l'écran le montre où il est.
//
// Mêmes protections que la génération (sanitizeProposal) : un code de critère hors
// référentiel est retiré, une version ou une date absente du document devient un
// champ à compléter. Pur.
// ─────────────────────────────────────────────────────────────────────────────

export const ASSISTANT_ADDITION_REASON = "Proposé par l'assistant, à vérifier.";
const ID_PREFIX = "assistant-";
const MIN_ANCHOR_LENGTH = 8;

export type AssistantAdditionInput = { text: string; anchor: string | null; criterionCode: string | null };

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[«»"“”'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Une proposition neuve, faite des seuls paragraphes de l'original : le point de
// départ quand aucune mise en conformité n'est ouverte sur cette version.
export function proposalFromParagraphs(paragraphs: readonly string[]): CorrectionProposal {
  return {
    schemaVersion: PROPOSAL_SCHEMA_VERSION,
    segments: paragraphs.map((text): ProposalSegment => ({ kind: "ORIGINAL", text })),
  };
}

export function nextAssistantAdditionId(proposal: CorrectionProposal): string {
  const taken = new Set(additionsOf(proposal).map((a) => a.id));
  let n = 1;
  while (taken.has(`${ID_PREFIX}${n}`)) n += 1;
  return `${ID_PREFIX}${n}`;
}

// Index où insérer : juste après le DERNIER passage original qui contient la
// citation ; null si la citation est absente, trop courte ou introuvable.
export function additionInsertIndex(segments: readonly ProposalSegment[], anchor: string | null): number | null {
  const wanted = anchor ? normalize(anchor) : "";
  if (wanted.length < MIN_ANCHOR_LENGTH) return null;
  for (let i = segments.length - 1; i >= 0; i -= 1) {
    const segment = segments[i]!;
    if (segment.kind === "ORIGINAL" && normalize(segment.text).includes(wanted)) return i + 1;
  }
  return null;
}

export function insertAssistantAddition(
  base: CorrectionProposal,
  input: AssistantAdditionInput,
  context: { knownCriterionCodes: ReadonlySet<string>; originalText: string }
): { proposal: CorrectionProposal; addition: AdditionSegment; anchored: boolean } {
  const raw: AdditionSegment = {
    kind: "AJOUT",
    id: nextAssistantAdditionId(base),
    text: input.text.trim(),
    criterionCode: input.criterionCode?.trim() || null,
    reason: ASSISTANT_ADDITION_REASON,
    manualQuote: null,
    anchor: input.anchor?.trim() || null,
  };
  // Seul le NOUVEAU segment passe par la protection : les autres l'ont déjà été, et
  // une citation du manuel qu'ils portent ne doit pas tomber faute d'extraits ici.
  const [addition] = sanitizeProposal(
    { schemaVersion: PROPOSAL_SCHEMA_VERSION, segments: [raw] },
    { knownCriterionCodes: context.knownCriterionCodes, knowledgeExcerpts: [], originalText: context.originalText }
  ).segments as [AdditionSegment];
  const found = additionInsertIndex(base.segments, raw.anchor);
  const index = found ?? base.segments.length;
  const segments = [...base.segments.slice(0, index), addition, ...base.segments.slice(index)];
  return { proposal: { ...base, segments }, addition, anchored: found !== null };
}
