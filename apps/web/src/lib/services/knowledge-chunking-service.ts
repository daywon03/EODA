// Découpage d'un document de référence en chunks pour l'embedding — fonction pure,
// aucune dépendance à Prisma ni à un fournisseur d'embeddings.
//
// Tailles choisies en caractères (pas en tokens) : un compte de tokens exact
// exigerait le tokenizer du modèle d'embedding pour une précision que ce cas
// d'usage ne demande pas — un manuel HAS ou un texte réglementaire, pas un corpus
// à optimiser au token près.
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

export function chunkText(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];
  if (trimmed.length <= CHUNK_SIZE) return [trimmed];

  const chunks: string[] = [];
  let start = 0;
  while (start < trimmed.length) {
    const end = Math.min(start + CHUNK_SIZE, trimmed.length);
    const chunk = trimmed.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);
    if (end === trimmed.length) break;
    // Chevauchement : une phrase coupée pile à la frontière d'un chunk garde son
    // contexte dans le chunk suivant plutôt que de perdre le sens des deux côtés.
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}
