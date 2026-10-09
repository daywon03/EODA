"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buildCabinetBreadcrumb } from "@/lib/design/cabinet-navigation";
import type { NavSection } from "@/lib/design/navigation";

// Fil d'Ariane de l'en-tête cabinet. La règle (quelle entrée, quels segments) est
// pure et testée dans cabinet-navigation.ts ; ce composant ne fait que la rendre.
// La dernière miette est la page courante : texte, pas lien, `aria-current`.
export function CabinetBreadcrumb({ sections }: { sections: readonly NavSection[] }) {
  const crumbs = buildCabinetBreadcrumb(sections, usePathname());
  if (crumbs.length === 0) return <span className="min-w-0 flex-1" />;

  return (
    <nav aria-label="Fil d'Ariane" className="min-w-0 flex-1 overflow-hidden">
      <ol className="flex min-w-0 items-center gap-2 whitespace-nowrap text-base text-ink2">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-2">
              {crumb.href ? (
                <Link href={crumb.href} className="truncate text-ink2 hover:text-ink hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span className={isLast ? "truncate font-bold text-ink" : "truncate"} aria-current={isLast ? "page" : undefined}>
                  {crumb.label}
                </span>
              )}
              {!isLast && (
                <span className="text-ink2" aria-hidden="true">
                  ›
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
