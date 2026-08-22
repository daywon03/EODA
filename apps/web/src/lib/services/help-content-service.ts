import type { UserRole } from "@eoda/database";
import {
  HELP_ARTICLES,
  HELP_CATEGORY_LABELS,
  HELP_CATEGORY_ORDER,
  type HelpArticle,
  type HelpCategory,
} from "@/content/aide";

// ─────────────────────────────────────────────────────────────────────────────
// CENTRE D'AIDE — sélection et recherche, fonctions PURES
//
// Couche unique de périmétrage du guide : c'est ici, et nulle part ailleurs,
// qu'on décide si un rôle a le droit de lire un article. Le rôle vient de la
// couche d'autorisation (lib/auth/guards.ts), qui le relit en base ; il n'est
// jamais déduit d'une valeur envoyée par le navigateur.
//
// Le service ne connaît ni React ni Prisma : la même fonction de recherche est
// utilisée par le rendu serveur et par le filtre côté client, donc une seule
// implémentation à corriger (D1).
// ─────────────────────────────────────────────────────────────────────────────

export type HelpCategoryGroup = {
  category: HelpCategory;
  label: string;
  articles: readonly HelpArticle[];
};

export function canReadHelpArticle(article: HelpArticle, role: UserRole): boolean {
  return article.audiences.includes(role);
}

/** Articles lisibles par ce rôle. Fail-closed : une audience vide ne montre rien. */
export function listHelpArticles(
  role: UserRole,
  catalogue: readonly HelpArticle[] = HELP_ARTICLES
): readonly HelpArticle[] {
  return catalogue.filter((article) => canReadHelpArticle(article, role));
}

/**
 * Article demandé par son slug, s'il est lisible par ce rôle. `null` sinon —
 * l'appelant répond notFound(), sans distinguer « n'existe pas » de « pas pour
 * vous » : un CLIENT_USER ne doit pas pouvoir déduire l'existence d'un article
 * Cabinet en essayant des adresses.
 */
export function findHelpArticle(
  slug: string,
  role: UserRole,
  catalogue: readonly HelpArticle[] = HELP_ARTICLES
): HelpArticle | null {
  const article = catalogue.find((candidate) => candidate.slug === slug);
  if (!article) return null;
  return canReadHelpArticle(article, role) ? article : null;
}

// Recherche insensible à la casse ET aux accents : « critere impératif » doit
// trouver « critère impératif ». La normalisation Unicode retire les diacritiques.
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function articleHaystack(article: HelpArticle): string {
  const blockText = article.body
    .map((block) => {
      if (block.kind === "steps" || block.kind === "list") return block.items.join(" ");
      return block.text;
    })
    .join(" ");
  return normalizeSearchText(
    [article.title, article.summary, article.where, article.keywords.join(" "), blockText].join(" ")
  );
}

/** Tous les mots de la requête doivent apparaître. Requête vide = aucun filtre. */
export function searchHelpArticles(
  articles: readonly HelpArticle[],
  query: string
): readonly HelpArticle[] {
  const terms = normalizeSearchText(query).split(/\s+/).filter((term) => term.length > 0);
  if (terms.length === 0) return articles;
  return articles.filter((article) => {
    const haystack = articleHaystack(article);
    return terms.every((term) => haystack.includes(term));
  });
}

/** Regroupement par tâche, dans l'ordre du référentiel de catégories. */
export function groupHelpArticlesByCategory(
  articles: readonly HelpArticle[]
): readonly HelpCategoryGroup[] {
  return HELP_CATEGORY_ORDER.map((category) => ({
    category,
    label: HELP_CATEGORY_LABELS[category],
    articles: articles.filter((article) => article.category === category),
  })).filter((group) => group.articles.length > 0);
}
