"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Briefcase, CalendarDays } from "lucide-react";
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
    ...(isAdmin
      ? [
          {
            href: "/dashboard/cabinet/commercial",
            label: "Pipeline commercial",
            icon: Briefcase,
            badge: pendingRequests,
            match: (p: string) => p.startsWith("/dashboard/cabinet/commercial"),
          },
        ]
      : []),
  ];

  return (
    <nav className="border-b border-gris-light bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex gap-1">
        {tabs.map(({ href, label, icon: Icon, match, badge = 0 }) => {
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
              {badge > 0 && (
                // Chiffre ET libellé pour les lecteurs d'écran : une pastille muette
                // ne dit rien à qui ne la voit pas.
                <span
                  className="inline-flex min-w-5 items-center justify-center rounded-full bg-terre px-1.5 py-0.5 text-[11px] font-semibold text-ivoire-light tabular-nums"
                  aria-label={`${badge} demande${badge > 1 ? "s" : ""} en attente`}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
