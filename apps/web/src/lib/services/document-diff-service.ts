import { diffWordsWithSpace } from "diff";

// ─────────────────────────────────────────────────────────────────────────────
// DIFF AVANT/APRÈS — brouillon de document corrigé généré par l'IA
//
// « Il faudra souligner les changements, l'avant/après » (Damon, 15/09/2026).
// Un diff mot à mot entre le texte original extrait et le Markdown généré : les
// deux documents n'ont pas la même structure ligne à ligne (l'IA en réécrit
// l'organisation), donc un diff par ligne produirait un bloc "tout supprimé /
// tout ajouté" illisible. Le diff par mot reste lisible même quand des phrases
// entières ont bougé de place.
//
// Fonction PURE : deux chaînes entrent, une liste de segments sort.
// ─────────────────────────────────────────────────────────────────────────────

export type DraftDiffSegment = { text: string; kind: "unchanged" | "added" | "removed" };

export function buildDraftDiff(originalText: string, draftMarkdown: string): DraftDiffSegment[] {
  return diffWordsWithSpace(originalText, draftMarkdown).map((part) => ({
    text: part.value,
    kind: part.added ? "added" : part.removed ? "removed" : "unchanged",
  }));
}
