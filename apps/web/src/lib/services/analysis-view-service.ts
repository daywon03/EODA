import type { DocumentAnalysisResult } from "@/lib/llm";

// ─────────────────────────────────────────────────────────────────────────────
// LECTURE DU RÉSULTAT D'ANALYSE — la moitié manquante du module n°1.
//
// L'analyse était produite à chaque dépôt, payée (un appel LLM), écrite en base
// dans `DocumentVersion.analysisResultJson`… et lue par personne. Le module le plus
// rentable de la plateforme s'arrêtait juste avant de rendre son résultat.
//
// Ce service transforme cette colonne en quelque chose d'affichable — et le fait
// DÉFENSIVEMENT. `analysisResultJson` est une colonne `Json` : elle contient ce que
// le modèle a renvoyé le jour du dépôt, sous la forme qu'avait le contrat ce jour-là.
// Un tableau devenu objet, une clé disparue, un `null` : le rendu ne doit pas casser
// une page de checklist entière pour un document analysé il y a six mois. Ce qui
// n'est pas reconnu est ignoré, jamais deviné.
//
// Règles PURES : ni Prisma, ni React.
// ─────────────────────────────────────────────────────────────────────────────

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

// Rend `null` quand rien d'exploitable n'a été trouvé — l'appelant affiche alors
// « pas encore analysé », ce qui est vrai, plutôt qu'une analyse vide qui laisserait
// croire qu'un document est sans manque.
export function parseAnalysisResult(value: unknown): DocumentAnalysisResult | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;

  const raw = value as Record<string, unknown>;
  const elementsPresents = toStringList(raw.elementsPresents);
  const elementsManquants = toStringList(raw.elementsManquants);
  const suggestionsCorrection = toStringList(raw.suggestionsCorrection);
  const sembleConforme = raw.sembleConforme === true;

  const hasContent =
    elementsPresents.length > 0 ||
    elementsManquants.length > 0 ||
    suggestionsCorrection.length > 0;

  // Une analyse qui ne dit RIEN et ne conclut pas n'est pas une analyse : c'est le
  // résultat de l'adaptateur de repli (StubAnalysisAdapter) ou d'un appel qui a
  // échoué. L'afficher ferait passer un document non analysé pour un document sans
  // reproche.
  if (!hasContent && !sembleConforme) return null;

  return { elementsPresents, elementsManquants, suggestionsCorrection, sembleConforme };
}

export type AnalysisSummary = {
  missingCount: number;
  suggestionCount: number;
  presentCount: number;
  // Reprend `sembleConforme` du modèle SANS le retraiter : la décision de conformité
  // reste celle de l'évaluatrice (CLAUDE.md §1 — la plateforme prépare, elle ne
  // décide pas). Le mot « semble » n'est pas une précaution de style.
  seemsCompliant: boolean;
};

export function summariseAnalysis(analysis: DocumentAnalysisResult): AnalysisSummary {
  return {
    missingCount: analysis.elementsManquants.length,
    suggestionCount: analysis.suggestionsCorrection.length,
    presentCount: analysis.elementsPresents.length,
    seemsCompliant: analysis.sembleConforme,
  };
}

// Phrase d'en-tête du panneau. Écrite ici plutôt que dans le composant : c'est la
// seule formulation qui sort d'une analyse automatique vers un écran client, et elle
// doit rester la même partout — dans le portail client comme côté cabinet.
export function describeAnalysis(summary: AnalysisSummary): string {
  if (summary.missingCount === 0) {
    return summary.seemsCompliant
      ? "Aucun élément manquant détecté — à confirmer par votre consultant."
      : "Aucun élément manquant détecté, mais la conformité reste à confirmer.";
  }

  const plural = summary.missingCount > 1;
  return plural
    ? `${summary.missingCount} éléments attendus n'ont pas été retrouvés dans ce document.`
    : "1 élément attendu n'a pas été retrouvé dans ce document.";
}
