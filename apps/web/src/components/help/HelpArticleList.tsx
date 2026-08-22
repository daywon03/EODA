"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import type { HelpArticle } from "@/content/aide";
import {
  groupHelpArticlesByCategory,
  searchHelpArticles,
} from "@/lib/services/help-content-service";

// Les articles reçus en props sont DÉJÀ filtrés par rôle côté serveur : ce
// composant ne connaît aucun rôle et n'en décide rien. Il ne fait que grouper et
// filtrer sur du texte, avec la même fonction pure que le serveur.
export function HelpArticleList({ articles }: { articles: readonly HelpArticle[] }) {
  const [query, setQuery] = useState("");

  const groups = useMemo(
    () => groupHelpArticlesByCategory(searchHelpArticles(articles, query)),
    [articles, query]
  );

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search
          className="w-4 h-4 text-gris-mid absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher : déposer un document, cotation, mot de passe…"
          aria-label="Rechercher dans le guide"
          className="w-full rounded-lg border border-gris-light bg-white pl-9 pr-3 py-2.5 text-sm text-brun-ancre placeholder:text-gris-mid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre"
        />
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-gris-mid bg-white border border-gris-light rounded-xl px-5 py-8 text-center">
          Aucun article ne correspond à cette recherche. Écrivez à{" "}
          <a href="mailto:EODAconseil@outlook.com" className="text-terre underline">
            EODAconseil@outlook.com
          </a>{" "}
          si votre question n&apos;est pas couverte par le guide.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.category} className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gris-mid">
              {group.label}
            </h2>
            <ul className="divide-y divide-gris-light border border-gris-light rounded-xl bg-white overflow-hidden">
              {group.articles.map((article) => (
                <li key={article.slug}>
                  <Link
                    href={`/dashboard/aide/${article.slug}`}
                    className="flex items-start justify-between gap-3 px-5 py-4 hover:bg-ivoire transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-inset"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-brun-ancre">
                        {article.title}
                      </span>
                      <span className="block text-sm text-gris-mid mt-0.5">{article.summary}</span>
                      <span className="block text-xs text-ambre mt-1">{article.where}</span>
                    </span>
                    <ChevronRight
                      className="w-4 h-4 text-gris-mid flex-shrink-0 mt-1"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
