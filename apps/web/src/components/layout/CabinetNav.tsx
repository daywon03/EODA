"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Building2, Briefcase, CalendarDays, Library } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { isAdmin: boolean; pendingRequests?: number };

export function CabinetNav({ isAdmin, pendingRequests = 0 }: Props) {
  const pathname = usePathname();

  const tabs = [
    { href: "/dashboard/cabinet", label: "Établissements", icon: Building2, match: (p: string) => p === "/dashboard/cabinet" || p.startsWith("/dashboard/cabinet/etablissements") },
    {
      href: "/dashboard/cabinet/agenda",
      label: "Agenda",
      icon: CalendarDays,
      match: (p: string) => p.startsWith("/dashboard/cabinet/agenda"),
    },
    {
      // Bibliothèque de modèles : lecture ouverte à tout le cabinet, contrairement au
      // pipeline commercial. Un collaborateur doit pouvoir partir du gabarit à jour —
      // c'est l'objet même d'une bibliothèque. L'écriture, elle, reste réservée à
      // CABINET_ADMIN, et l'écran ne montre les formulaires qu'à lui.
      href: "/dashboard/cabinet/modeles",
      label: "Modèles",
      icon: Library,
      match: (p: string) => p.startsWith("/dashboard/cabinet/modeles"),
    },
    ...(isAdmin
      ? [
          {
            href: "/dashboard/cabinet/commercial",
            label: "Pipeline commercial",
            icon: Briefcase,
            match: (p: string) => p.startsWith("/dashboard/cabinet/commercial"),
          },
        ]
      : []),
  ];

  return (
    <nav className="border-b border-gris-light bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex gap-1">
          {tabs.map(({ href, label, icon: Icon, match }) => {
            const active = match(pathname);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
                  active
                    ? "border-terre text-terre"
                    : "border-transparent text-gris-mid hover:text-brun-ancre hover:border-gris-light"
                )}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Cloche autonome plutôt qu'une pastille noyée dans un onglet parmi
            d'autres — demande du 07/09/2026 : « ce n'est pas assez visible ».
            Mène directement à la file des demandes, sans passer par l'onglet. */}
        {isAdmin && (
          <Link
            href="/dashboard/cabinet/commercial"
            className="relative flex items-center justify-center w-9 h-9 rounded-lg text-gris-mid hover:text-terre hover:bg-ivoire transition-colors"
            aria-label={
              pendingRequests > 0
                ? `${pendingRequests} demande${pendingRequests > 1 ? "s" : ""} de prestation en attente`
                : "Aucune demande en attente"
            }
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
            {pendingRequests > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-terre px-1 py-0.5 text-[10px] font-semibold leading-none text-ivoire-light tabular-nums"
                aria-hidden="true"
              >
                {pendingRequests}
              </span>
            )}
          </Link>
        )}
      </div>
    </nav>
  );
}
