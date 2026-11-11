"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useDisclosure } from "@/components/ui/use-disclosure";

export type MoreActionLink = {
  id: string;
  label: string;
  href: string;
  // Document imprimable (contrat, rapport) : ouvert dans un nouvel onglet, comme
  // depuis l'ancienne fiche.
  newTab?: boolean;
};

const ITEM_CLASS = "flex min-h-11 w-full items-center rounded-md px-3 text-left text-base text-ink hover:bg-soft";

// « Plus d'actions » : regroupe les gestes secondaires de la fiche (modifier, logo,
// contrat, rapport, supprimer). Bouton de divulgation (`aria-expanded`), et non un
// `role="menu"` : ce sont des liens et un bouton ordinaires, atteints à la
// tabulation. Échap et un clic à l'extérieur referment ; le focus revient au bouton.
export function MoreActionsMenu({ links, footer }: { links: readonly MoreActionLink[]; footer?: ReactNode }) {
  const { open, setOpen, rootRef: root, triggerRef: trigger } = useDisclosure();
  const panelId = useId();

  return (
    <div ref={root} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line bg-card px-4 text-base text-ink hover:bg-soft"
      >
        Plus d&apos;actions
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-card p-1.5 shadow-eoda-md"
        >
          <ul>
            {links.map((link) => (
              <li key={link.id}>
                {link.newTab ? (
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className={ITEM_CLASS}>
                    {link.label}
                    <span className="sr-only"> (nouvel onglet)</span>
                  </a>
                ) : (
                  <Link href={link.href} className={ITEM_CLASS} onClick={() => setOpen(false)}>
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          {footer && <div className="mt-1 border-t border-line px-1.5 pt-2">{footer}</div>}
        </div>
      )}
    </div>
  );
}
