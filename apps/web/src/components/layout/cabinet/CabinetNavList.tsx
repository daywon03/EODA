"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  accessibleItemLabel,
  isSectionOpen,
  resolveActiveItem,
  sectionHoldsActiveItem,
  type NavItem,
  type NavSection,
} from "@/lib/design/navigation";
import {
  preferenceFor,
  readNavSectionPreference,
  withSectionPreference,
  writeNavSectionPreference,
  type NavSectionPreference,
} from "@/lib/design/nav-section-preference";
import { NAV_ICONS } from "../nav-icons";

type Props = {
  sections: readonly NavSection[];
  collapsed: boolean;
  // Appelé au clic sur une entrée : le tiroir mobile se referme.
  onNavigate?: () => void;
};

const browserStorage = () => window.localStorage;

// Liste des entrées du cabinet, commune à la barre latérale et au tiroir mobile.
// Repliée : icône seule à l'écran, mais le libellé reste le nom accessible du lien
// (aria-label, pastille comprise) et s'affiche en infobulle au survol ET au focus
// clavier — jamais d'icône ni d'initiales seules.
//
// Une section `collapsible` (les Réglages) a un intertitre cliquable, replié par
// défaut : la barre redevient ce qu'on consulte tous les jours, comme la maquette.
// En mode replié (76 px) il n'y a plus d'intertitre lisible : la section s'affiche
// donc à plat, sans bouton — un dépliant dont on ne peut pas lire le titre ne
// déplie rien.
export function CabinetNavList({ sections, collapsed, onNavigate }: Props) {
  const pathname = usePathname();
  const active = resolveActiveItem(sections, pathname);
  const activeItem = active ?? null;
  // Préfixe stable pour les `id` de corps de section : la liste est rendue deux fois
  // dans la page (barre latérale et tiroir mobile), les `id` doivent rester uniques.
  const navId = useId();

  // Aucun choix mémorisé au premier rendu (c'est le serveur qui rend, la préférence
  // vit dans le navigateur) ; elle arrive au montage. D'ici là, `isSectionOpen`
  // applique sa règle : ouverte si la page courante est dedans.
  const [preference, setPreference] = useState<NavSectionPreference>({});
  useEffect(() => {
    setPreference(readNavSectionPreference(browserStorage));
  }, []);

  function setSectionOpen(section: NavSection, isOpen: boolean) {
    const next = withSectionPreference(preference, section.id, isOpen);
    setPreference(next);
    writeNavSectionPreference(browserStorage, next);
  }

  return (
    <div className={cn("flex flex-1 flex-col gap-0.5 px-3 py-1", collapsed ? "overflow-visible" : "overflow-y-auto")}>
      {sections.map((section, index) => {
        const canCollapse = section.collapsible === true && !collapsed;
        const isOpen = canCollapse
          ? isSectionOpen(section, activeItem, preferenceFor(preference, section.id))
          : true;
        const bodyId = `${navId}-section-${section.id}`;

        return (
          <div key={section.id} className="flex flex-col gap-0.5">
            {index > 0 && <div className="mx-1 my-2.5 h-px bg-line" aria-hidden="true" />}
            {section.label && !collapsed && !canCollapse && (
              <h2 className="px-3 pb-1.5 pt-0.5 text-sm font-bold uppercase tracking-wide text-ink2">{section.label}</h2>
            )}
            {canCollapse && section.label && (
              <SectionToggle
                section={section}
                bodyId={bodyId}
                isOpen={isOpen}
                holdsActiveItem={sectionHoldsActiveItem(section, activeItem)}
                onToggle={() => setSectionOpen(section, !isOpen)}
              />
            )}
            <ul
              id={bodyId}
              className="flex flex-col gap-0.5"
              aria-label={section.label ?? undefined}
              hidden={!isOpen}
            >
              {section.items.map((item) => (
                <li key={item.id}>
                  <NavEntry item={item} isActive={item.id === activeItem?.id} collapsed={collapsed} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// Intertitre dépliant d'une section repliable. `holdsActiveItem` ne change pas le
// geste : il ajoute un repère visible quand la section est refermée sur la page
// qu'on est en train de lire (et que le poste a choisi de la garder fermée).
function SectionToggle({
  section,
  bodyId,
  isOpen,
  holdsActiveItem,
  onToggle,
}: {
  section: NavSection;
  bodyId: string;
  isOpen: boolean;
  holdsActiveItem: boolean;
  onToggle: () => void;
}) {
  const hiddenCount = section.items.length;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={bodyId}
      className="flex h-11 items-center gap-1.5 rounded-lg px-3 text-start text-sm font-bold uppercase tracking-wide text-ink2 transition-colors hover:bg-line"
    >
      <ChevronRight
        className={cn("h-4 w-4 flex-shrink-0 transition-transform motion-reduce:transition-none", isOpen && "rotate-90")}
        aria-hidden="true"
      />
      <span>{section.label}</span>
      {!isOpen && (
        <span className="ml-auto flex items-center gap-1.5">
          {holdsActiveItem && <span className="h-2 w-2 rounded-full bg-accent-fill" aria-hidden="true" />}
          <span aria-hidden="true" className="text-sm font-normal tabular-nums text-ink2">
            {hiddenCount}
          </span>
          <span className="sr-only">
            , {hiddenCount > 1 ? `${hiddenCount} entrées masquées` : "1 entrée masquée"}
            {holdsActiveItem ? ", dont la page courante" : ""}
          </span>
        </span>
      )}
    </button>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      className="flex h-6 min-w-[26px] items-center justify-center rounded-full bg-accent-fill px-2 text-sm font-bold tabular-nums text-on-accent"
      aria-hidden="true"
    >
      {count}
    </span>
  );
}

// Entrée de navigation. La page courante se reconnaît à la carte (`bg-card`) et à la
// graisse — c'est ce que fait la maquette : elle ne colore jamais l'icône en accent et
// ne pose aucune ombre. L'icône garde donc `ink2` dans les deux états, y compris
// repliée où la carte seule marque la position.
function NavEntry({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  collapsed: boolean;
  onNavigate: (() => void) | undefined;
}) {
  const Icon = NAV_ICONS[item.icon];
  const hasCount = (item.count ?? 0) > 0;
  const label = accessibleItemLabel(item);

  return (
    <Link
      href={item.href}
      onClick={() => onNavigate?.()}
      aria-current={isActive ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "group/item relative flex h-11 items-center gap-3 whitespace-nowrap rounded-lg px-2.5 text-base text-ink transition-colors",
        collapsed ? "justify-center" : "justify-between",
        isActive ? "bg-card font-bold" : "hover:bg-line"
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center">
          <Icon className="h-5 w-5 text-ink2" aria-hidden="true" />
          {collapsed && (hasCount || item.attentionLabel) && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-accent-fill" aria-hidden="true" />
          )}
        </span>
        {!collapsed && <span className="truncate">{item.label}</span>}
      </span>
      {!collapsed && hasCount && (
        <>
          <CountBadge count={item.count ?? 0} />
          <span className="sr-only">, {item.countLabel}</span>
        </>
      )}
      {collapsed && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 rounded-md bg-ink-fill px-2.5 py-1 text-sm font-normal text-on-ink shadow-eoda-md group-hover/item:block group-focus-visible/item:block"
        >
          {label}
        </span>
      )}
    </Link>
  );
}
