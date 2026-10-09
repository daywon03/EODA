"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { accessibleItemLabel, resolveActiveItem, type NavItem, type NavSection } from "@/lib/design/navigation";
import { NAV_ICONS } from "../nav-icons";

type Props = {
  sections: readonly NavSection[];
  collapsed: boolean;
  // Appelé au clic sur une entrée : le tiroir mobile se referme.
  onNavigate?: () => void;
};

// Liste des entrées du cabinet, commune à la barre latérale et au tiroir mobile.
// Repliée : icône seule à l'écran, mais le libellé reste le nom accessible du lien
// (aria-label, pastille comprise) et s'affiche en infobulle au survol ET au focus
// clavier — jamais d'icône ni d'initiales seules.
export function CabinetNavList({ sections, collapsed, onNavigate }: Props) {
  const pathname = usePathname();
  const activeId = resolveActiveItem(sections, pathname)?.id ?? null;

  return (
    <div className={cn("flex flex-1 flex-col gap-0.5 px-3 py-1", collapsed ? "overflow-visible" : "overflow-y-auto")}>
      {sections.map((section, index) => (
        <div key={section.id} className="flex flex-col gap-0.5">
          {index > 0 && <div className="mx-1 my-2.5 h-px bg-line" aria-hidden="true" />}
          {section.label && !collapsed && (
            <h2 className="px-3 pb-1.5 pt-0.5 text-sm font-bold text-ink2">{section.label}</h2>
          )}
          <ul className="flex flex-col gap-0.5" aria-label={section.label ?? undefined}>
            {section.items.map((item) => (
              <li key={item.id}>
                <NavEntry item={item} isActive={item.id === activeId} collapsed={collapsed} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
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
        isActive ? "bg-card font-bold shadow-eoda-sm" : "hover:bg-line"
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center">
          <Icon className={cn("h-5 w-5", isActive ? "text-accent-text" : "text-ink2")} aria-hidden="true" />
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
