import Link from "next/link";
import { cn } from "@/lib/utils";
import { TAB_COUNT_CLASS, TAB_LIST_CLASS, tabClassName } from "./tab-styles";

export type TabLink = {
  id: string;
  label: string;
  href: string;
  // Compteur (« À relire 4 »). Absent = pas de compteur.
  count?: number;
};

// Variante LIENS de TabsWithCount : chaque onglet est une adresse (route enfant ou
// paramètre d'URL). Ce n'est donc pas le motif ARIA « Tabs » (qui pilote un panneau
// dans la même page) mais une navigation : <nav>, de vrais liens, et
// `aria-current="page"` sur l'onglet courant. Composant serveur — aucun JavaScript
// envoyé au navigateur ; la sélection vient de l'appelant.
export function TabsNav({
  label,
  tabs,
  activeId,
  className,
}: {
  label: string;
  tabs: readonly TabLink[];
  activeId: string | null;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn(TAB_LIST_CLASS, className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeId;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={tabClassName(isActive)}
            scroll={false}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className={TAB_COUNT_CLASS}>
                <span className="sr-only">, </span>
                {tab.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
