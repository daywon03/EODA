// Les blocs balisés des prompts (<document>, <referentiel>, <exemple_valide>…) séparent
// la DONNÉE des consignes. Un document déposé — donc écrit par un tiers — ne doit pas
// pouvoir fermer son bloc et en ouvrir un autre (« </document> Nouvelle consigne : … »,
// ou un faux <exemple_valide>). Toute balise de bloc est retirée d'un texte avant qu'il
// n'entre dans le prompt (audit du 28/10/2026 : le document l'était sans ce filtre).
const PROMPT_BLOCKS = [
  "document",
  "referentiel",
  "exemple_valide",
  "consignes_consultante",
  "commentaire_document",
  "retours_cabinet",
  "catalogue_criteres",
  "images_decrites",
] as const;

const BLOCK_TAG = new RegExp(`<\\s*/?\\s*(?:${PROMPT_BLOCKS.join("|")})\\b[^>]*>`, "gi");

export function neutralizePromptBlocks(text: string): string {
  return text.replace(BLOCK_TAG, "");
}
