"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";
import { CLIENT_ACCOUNT_LINKS } from "@/lib/design/client-navigation";
import { initialsOf } from "@/lib/design/navigation";

const ITEM_CLASS =
  "flex h-12 w-full items-center rounded-lg px-3.5 text-left text-[17px] text-ink transition-colors hover:bg-paper";

// Menu du compte du portail client (maquette : Mon profil, Mon contrat, Se
// déconnecter). Motif « disclosure » — un bouton qui montre une liste de liens —
// plutôt qu'un role="menu" : des liens ordinaires se parcourent à la tabulation
// sans gestion de flèches à réimplémenter. Échap et un clic ailleurs le referment ;
// changer de page aussi.
export function AccountMenu({ name }: { name: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      button.current?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isOpen]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className="flex h-12 items-center gap-2 rounded-[10px] border border-line bg-card px-3 text-[17px] text-ink transition-colors hover:border-accent-text"
      >
        <span
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-accent-fill text-sm font-bold text-on-accent"
          aria-hidden="true"
        >
          {initialsOf(name, 1)}
        </span>
        <span className="sr-only sm:not-sr-only sm:max-w-[160px] sm:truncate">{name}</span>
        <span className="sr-only">, mon compte</span>
        <ChevronDown className="h-4 w-4 text-ink2" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-40 mt-2 flex min-w-[240px] flex-col rounded-xl border border-line bg-card p-2 shadow-eoda-lg"
        >
          <ul className="flex flex-col">
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
