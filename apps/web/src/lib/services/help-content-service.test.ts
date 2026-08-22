import { describe, expect, it } from "vitest";
import {
  HELP_ARTICLES,
  HELP_CATEGORY_ORDER,
  type HelpArticle,
} from "@/content/aide";
import {
  canReadHelpArticle,
  findHelpArticle,
  groupHelpArticlesByCategory,
  listHelpArticles,
  normalizeSearchText,
  searchHelpArticles,
} from "./help-content-service";

// Le centre d'aide est ouvert aux trois rôles (context/07-outil-pilotage-missions.md
// §12.5) mais son CONTENU est cloisonné : un CLIENT_USER ne doit jamais recevoir un
// article du pipeline commercial (CLAUDE.md §7). Les cas de refus sont testés sur le
// catalogue RÉEL, pas sur des articles fabriqués : c'est le contenu livré qu'on veut
// voir échouer si quelqu'un élargit une audience par inadvertance.

const FIXTURE: readonly HelpArticle[] = [
  {
    slug: "article-client",
    title: "Déposer un document",
    summary: "Pour le client",
    category: "DOCUMENTS",
    audiences: ["CLIENT_USER"],
    where: "Espace client",
    keywords: ["dépôt"],
    body: [{ kind: "paragraph", text: "Cliquez sur Déposer." }],
  },
  {
    slug: "article-cabinet",
    title: "Cotation des critères",
    summary: "Pour le cabinet",
    category: "EVALUATION",
    audiences: ["CABINET_ADMIN", "CABINET_EVALUATOR"],
    where: "Auto-évaluation",
    keywords: ["cotation"],
    body: [
      { kind: "steps", items: ["Ouvrir le chapitre"] },
      { kind: "list", items: ["Critère impératif"] },
      { kind: "note", tone: "warning", text: "NC interdit sur un impératif." },
    ],
  },
  {
    slug: "article-orphelin",
    title: "Sans audience",
    summary: "Personne",
    category: "PRISE_EN_MAIN",
    audiences: [],
    where: "Nulle part",
    keywords: [],
    body: [],
  },
];

describe("cloisonnement du guide par rôle", () => {
  it("ne montre à un CLIENT_USER que les articles qui le visent", () => {
    expect(listHelpArticles("CLIENT_USER", FIXTURE).map((a) => a.slug)).toEqual([
      "article-client",
    ]);
  });

  it("refuse un article Cabinet à un CLIENT_USER, sans distinguer refus et absence", () => {
    expect(findHelpArticle("article-cabinet", "CLIENT_USER", FIXTURE)).toBeNull();
    expect(findHelpArticle("slug-inexistant", "CLIENT_USER", FIXTURE)).toBeNull();
  });

  it("est fail-closed sur une audience vide", () => {
    for (const role of ["CABINET_ADMIN", "CABINET_EVALUATOR", "CLIENT_USER"] as const) {
      expect(canReadHelpArticle(FIXTURE[2] as HelpArticle, role)).toBe(false);
      expect(findHelpArticle("article-orphelin", role, FIXTURE)).toBeNull();
    }
  });

  it("sert l'article au rôle qui y a droit", () => {
    expect(findHelpArticle("article-cabinet", "CABINET_EVALUATOR", FIXTURE)?.title).toBe(
      "Cotation des critères"
    );
  });
});

describe("catalogue réellement livré", () => {
  it("n'expose aucun article du pipeline commercial hors CABINET_ADMIN", () => {
    for (const article of HELP_ARTICLES) {
      if (article.category !== "COMMERCIAL") continue;
      expect(article.audiences).toEqual(["CABINET_ADMIN"]);
    }
    const clientSlugs = listHelpArticles("CLIENT_USER").map((a) => a.slug);
    const evaluatorSlugs = listHelpArticles("CABINET_EVALUATOR").map((a) => a.slug);
    expect(clientSlugs).not.toContain("pipeline-commercial");
    expect(evaluatorSlugs).not.toContain("pipeline-commercial");
    expect(listHelpArticles("CABINET_ADMIN").map((a) => a.slug)).toContain("pipeline-commercial");
  });

  it("donne à chaque rôle au moins la prise en main", () => {
    for (const role of ["CABINET_ADMIN", "CABINET_EVALUATOR", "CLIENT_USER"] as const) {
      const slugs = listHelpArticles(role).map((a) => a.slug);
      expect(slugs).toContain("a-quoi-sert-la-plateforme");
      expect(slugs).toContain("se-connecter-et-changer-son-mot-de-passe");
    }
  });

  it("porte des slugs uniques, un titre, un résumé, un emplacement et un corps", () => {
    const slugs = HELP_ARTICLES.map((a) => a.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const article of HELP_ARTICLES) {
      expect(article.slug).toMatch(/^[a-z0-9-]+$/);
      expect(article.title.length).toBeGreaterThan(0);
      expect(article.summary.length).toBeGreaterThan(0);
      expect(article.where.length).toBeGreaterThan(0);
      expect(article.audiences.length).toBeGreaterThan(0);
      expect(article.body.length).toBeGreaterThan(0);
      expect(HELP_CATEGORY_ORDER).toContain(article.category);
    }
  });
});

describe("recherche", () => {
  it("ignore la casse et les accents", () => {
    expect(normalizeSearchText("  Critère IMPÉRATIF ")).toBe("critere imperatif");
    expect(searchHelpArticles(FIXTURE, "critere").map((a) => a.slug)).toEqual([
      "article-cabinet",
    ]);
  });

  it("exige tous les mots de la requête", () => {
    expect(searchHelpArticles(FIXTURE, "deposer document").map((a) => a.slug)).toEqual([
      "article-client",
    ]);
    expect(searchHelpArticles(FIXTURE, "deposer cotation")).toEqual([]);
  });

  it("cherche aussi dans les étapes, les listes et les encadrés", () => {
    expect(searchHelpArticles(FIXTURE, "NC interdit").map((a) => a.slug)).toEqual([
      "article-cabinet",
    ]);
    expect(searchHelpArticles(FIXTURE, "ouvrir le chapitre").map((a) => a.slug)).toEqual([
      "article-cabinet",
    ]);
  });

  it("ne filtre rien sur une requête vide ou blanche", () => {
    expect(searchHelpArticles(FIXTURE, "")).toEqual(FIXTURE);
    expect(searchHelpArticles(FIXTURE, "   ")).toEqual(FIXTURE);
  });
});

describe("regroupement par tâche", () => {
  it("suit l'ordre du référentiel de catégories et omet les groupes vides", () => {
    const groups = groupHelpArticlesByCategory(FIXTURE);
    expect(groups.map((g) => g.category)).toEqual(["PRISE_EN_MAIN", "DOCUMENTS", "EVALUATION"]);
    expect(groups[0]?.label).toBe("Prise en main");
  });

  it("ne perd aucun article du catalogue livré", () => {
    const grouped = groupHelpArticlesByCategory(HELP_ARTICLES).flatMap((g) => g.articles);
    expect(grouped).toHaveLength(HELP_ARTICLES.length);
  });
});
