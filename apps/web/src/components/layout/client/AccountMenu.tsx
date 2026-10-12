"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";
import { CLIENT_ACCOUNT_LINKS } from "@/lib/design/client-navigation";
import { initialsOf } from "@/lib/design/navigation";
import { useDisclosure } from "./use-disclosure";

const ITEM_CLASS =
  "flex h-12 w-full items-center rounded-lg px-3.5 text-left text-[17px] text-ink transition-colors hover:bg-paper";

// Menu du compte du portail client (maquette : Mon profil, Mon contrat, Se
// déconnecter). Ouverture / fermeture partagées avec « Plus » : useDisclosure.
// `settings` : réglages d'affichage (bascule de thème) placés dans le panneau — dans
// l'en-tête, ils faisaient passer la navigation sur deux lignes à 1440 px.
export function AccountMenu({ name, settings }: { name: string; settings?: ReactNode }) {
  const { isOpen, toggle, root, button } = useDisclosure();
  const panelId = useId();

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex h-12 items-center gap-2 rounded-[10px] border border-line bg-card px-3 text-[17px] text-ink transition-colors hover:border-accent-text"
      >
        <span
          className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-accent-fill text-sm font-bold text-on-accent"
          aria-hidden="true"
        >
          {initialsOf(name, 1)}
        </span>
        {/* Initiale seule dans l'en-tête (le nom faisait passer la navigation sur
            deux lignes) ; le nom est lu ici et écrit en tête du panneau. */}
        <span className="sr-only">{name}, mon compte</span>
        <ChevronDown className="h-4 w-4 text-ink2" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-40 mt-2 flex min-w-[240px] flex-col rounded-xl border border-line bg-card p-2 shadow-eoda-lg"
        >
          <p className="truncate px-3.5 pb-2 pt-1.5 text-base font-bold text-ink">{name}</p>
          {settings && <div className="border-b border-line px-1.5 pb-2">{settings}</div>}
          <ul className="flex flex-col pt-1">
            {CLIENT_ACCOUNT_LINKS.map((link) => (
              <li key={link.id}>
                <Link href={link.href} className={ITEM_CLASS}>
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <form action={logoutAction}>
                <button type="submit" className={ITEM_CLASS}>
                  Se déconnecter
                </button>
              </form>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
