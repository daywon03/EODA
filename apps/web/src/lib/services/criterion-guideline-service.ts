// ─────────────────────────────────────────────────────────────────────────────
// GUIDELINES DU CABINET SUR L'ANALYSE IA — cf. CriterionGuideline dans le schéma
// pour le raisonnement complet (portée tenant, ancrée sur le critère HAS, pas le
// type de document, append-only, pas de recherche vectorielle).
// ─────────────────────────────────────────────────────────────────────────────

// COURTE et volontairement : un aide-mémoire d'une phrase, pas un commentaire
// libre. Un modèle retient mieux cinq phrases courtes qu'un paragraphe dense, et
// ça borne la taille du prompt quel que soit le nombre de guidelines accumulées
// (décision de Damon, 10/09/2026, en remplacement de la limite à 2000 caractères
// du DocumentTypeCorrection initial).
export const MAX_GUIDELINE_LENGTH = 280;

// Rappelées à CHAQUE analyse d'un document rattaché à ce critère (cf.
// analysis-prompt.ts) : non bornées en nombre en base (append-only), mais seules
// les plus récentes sont effectivement envoyées au modèle.
export const MAX_GUIDELINES_INJECTED = 8;

export function validateGuidelineNote(raw: string): { ok: true; value: string } | { ok: false; error: string } {
  const value = raw.trim();
  if (value.length === 0) return { ok: false, error: "Le commentaire ne peut pas être vide." };
  if (value.length > MAX_GUIDELINE_LENGTH) {
    return {
      ok: false,
      error: `Le commentaire dépasse ${MAX_GUIDELINE_LENGTH} caractères — vise une phrase courte, pas un paragraphe.`,
    };
  }
  return { ok: true, value };
}
