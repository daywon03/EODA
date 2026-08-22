import { CABINET_ARTICLES } from "./cabinet";
import { DOCUMENT_ARTICLES } from "./documents";
import { PRISE_EN_MAIN_ARTICLES } from "./prise-en-main";
import type { HelpArticle } from "./types";

// Catalogue complet du centre d'aide. Ajouter un article = ajouter une entrée
// dans l'un des fichiers ci-dessus, rien d'autre : aucune page, aucune route,
// aucun composant à toucher.
export const HELP_ARTICLES: readonly HelpArticle[] = [
  ...PRISE_EN_MAIN_ARTICLES,
  ...DOCUMENT_ARTICLES,
  ...CABINET_ARTICLES,
];

export * from "./types";
