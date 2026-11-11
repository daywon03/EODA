import { formatDate } from "./date-format-service";

// ─────────────────────────────────────────────────────────────────────────────
// LE FIL DE COMMENTAIRES D'UN DOCUMENT — règles PURES (retour de Sandrine, 10/11/2026 :
// « J'ai cumulé les commentaires, car je ne vois pas l'historique » ; décision de
// Damon : un fil, chaque commentaire daté, rien ne s'écrase, l'IA relit tous ceux qui
// sont « pris en compte »).
//
// `DocumentComment` est append-only. L'ancien champ unique (`Document.missingJustification`)
// reste la justification que la structure donne quand une pièce manque — les
// relances et le contrat la lisent — et chaque nouvelle version de cette
// justification rejoint aussi le fil. La migration a recopié les commentaires
// existants dans le fil ; l'ancien champ n'est relu par l'IA que si le fil est vide.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_DOCUMENT_COMMENT_LENGTH = 2000;

export type CommentForAnalysis = { text: string; aiEnabled: boolean; createdAt: Date };

// Le texte remis à l'IA (balisé ensuite par renderDocumentComment) : une ligne datée
// par commentaire coché, du plus ancien au plus récent.
export function commentsForAnalysis(
  entries: readonly CommentForAnalysis[],
  legacy: { text: string | null; usedByAi: boolean } | null
): string | undefined {
  if (entries.length === 0) {
    const text = legacy?.text?.trim();
    return legacy?.usedByAi && text ? text : undefined;
  }
  const lines = [...entries]
    .filter((e) => e.aiEnabled && e.text.trim().length > 0)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((e) => `- ${formatDate(e.createdAt)} : ${e.text.trim()}`);
  return lines.length > 0 ? lines.join("\n") : undefined;
}

export function newDocumentCommentError(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return "Le commentaire est vide.";
  if (trimmed.length > MAX_DOCUMENT_COMMENT_LENGTH) {
    return `Un commentaire tient en ${MAX_DOCUMENT_COMMENT_LENGTH} caractères au plus.`;
  }
  return null;
}

// Une justification qui change (« Il arrive », « Je ne l'ai pas »…) rejoint le fil :
// seulement un texte non vide, différent du précédent.
export function isNewJustification(previous: string | null, next: string | null): boolean {
  const text = next?.trim() ?? "";
  return text.length > 0 && text !== (previous?.trim() ?? "");
}
