// DocumentCategorizationService — suggestion automatique de DocumentType par
// heuristique mots-clés (nom de fichier + début du texte extrait), jamais
// une certitude : toujours une suggestion, correction manuelle possible.
// Volontairement sans appel LLM ici — cf. specs/02-architecture-technique.md §3
// (l'analyse LLM du contenu est le périmètre de DocumentAnalysisService, Jalon 3).

const STOPWORDS = new Set([
  "le", "la", "les", "de", "des", "du", "un", "une", "et", "ou", "en",
  "au", "aux", "pour", "par", "sur", "dans", "si", "concerné", "concernee",
  "concernees", "concernes", "derniers", "dernieres", "derniers", "3",
]);

function normalize(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents (marques diacritiques combinantes)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

export type CategorizationCandidate = { id: string; code: string; label: string };

export type CategorizationSuggestion = {
  documentTypeId: string;
  score: number;
};

export function suggestDocumentType(
  candidates: CategorizationCandidate[],
  filename: string,
  extractedTextSample?: string | null
): CategorizationSuggestion | null {
  const filenameTokens = normalize(filename.replace(/\.[a-z0-9]+$/i, ""));
  const textTokens = extractedTextSample ? normalize(extractedTextSample.slice(0, 500)) : [];
  const inputTokens = new Set([...filenameTokens, ...textTokens]);

  if (inputTokens.size === 0) return null;

  let best: CategorizationSuggestion | null = null;

  for (const candidate of candidates) {
    const keywordTokens = new Set([
      ...normalize(candidate.label),
      ...candidate.code.toLowerCase().split("_"),
    ]);
    if (keywordTokens.size === 0) continue;

    let matches = 0;
    for (const keyword of keywordTokens) {
      if (inputTokens.has(keyword)) matches++;
    }
    if (matches === 0) continue;

    const score = matches / keywordTokens.size;
    if (!best || score > best.score) {
      best = { documentTypeId: candidate.id, score };
    }
  }

  // Seuil minimal : évite de suggérer sur une correspondance trop faible
  // (ex: un seul mot-clé générique commun à plusieurs types).
  return best && best.score >= 0.2 ? best : null;
}
