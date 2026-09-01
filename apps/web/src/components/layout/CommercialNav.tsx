"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, FileText, Users } from "lucide-react";
import { cn } from "@/lib/utils";

// Sous-navigation du pipeline commercial.
//
// Les quatre surfaces du module existaient sans qu'aucun lien n'y mène : le catalogue
// et la liste des devis n'étaient atteignables qu'en tapant l'URL. C'est le défaut
// que la règle `nav-hierarchy` décrit — une navigation primaire (les onglets Cabinet)
// sans navigation secondaire pour ce qu'elle contient.
//
// Deux principes tenus ici :
//   - icône ET libellé (`nav-label-icon`) : une barre d'icônes seules ne se découvre
//     pas ;
//   - l'emplacement courant est marqué visuellement ET pour les lecteurs d'écran
//     (`nav-state-active` + `aria-current`), jamais par la couleur seule.
//
// Composant distinct de `CabinetNav` : ce sont deux niveaux de hiérarchie, et les
// mélanger produirait exactement l'anti-pattern `avoid-mixed-patterns`.
const TABS = [
  {
    href: "/dashboard/cabinet/commercial",
    label: "Vue d'ensemble",
    icon: BarChart3,
    exact: true,
  },
  {
    href: "/dashboard/cabinet/commercial/prospects",
    label: "Prospects",
    icon: Users,
    exact: false,
  },
  { href: "/dashboard/cabinet/commercial/devis", label: "Devis", icon: FileText, exact: false },
  {
    href: "/dashboard/cabinet/commercial/catalogue",
    label: "Catalogue",
    icon: BookOpen,
    exact: false,
  },
] as const;

export function CommercialNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigation du pipeline commercial">
      {/* `overflow-x-auto` plutôt qu'un repliement : quatre onglets tiennent sur un
          écran de 375 px en défilement horizontal LOCAL, ce qui ne fait pas défiler la
          page entière (`horizontal-scroll`). */}
      <ul className="flex gap-1 overflow-x-auto border-b border-gris-light">
        {TABS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="flex-shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  // 44 px de hauteur utile : la cible tactile minimale, y compris sur
                  // la tablette que Sandrine emmène en visite.
                  "flex items-center gap-2 border-b-2 -mb-px px-3.5 py-3 text-sm font-medium transition-colors duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terre focus-visible:ring-inset",
                  active
                    ? "border-terre text-terre"
                    : "border-transparent text-gris-mid hover:border-gris-light hover:text-brun-ancre"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
