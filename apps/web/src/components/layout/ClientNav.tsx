"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, MessagesSquare, PackageOpen, ReceiptText, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// Navigation du portail client — cinq surfaces :
//   « Mes documents » : ce que je dépose (checklist documentaire) ;
//   « Mes livrables » : ce qu'EODA a produit et validé pour moi (CDC §5) ;
//   « Mon suivi »     : où en est le projet — phases, progression documentaire ;
//   « Mon contrat »   : ce que j'ai souscrit et son cadre financier ;
//   « Mes échanges »  : le fil avec la consultante (CDC §5).
// Décision du 07/09/2026 : « Mon accompagnement » mélangeait progression et
// argent — scindé en « Mon suivi » (projet) et « Mon contrat » (finances), pour
// qu'un client venu chercher une échéance ne traverse plus des montants.
// Même structure visuelle que CabinetNav (charte EODA : soulignement terre sur
// l'onglet actif) sans en partager le composant : les deux portails n'ont pas les
// mêmes règles de visibilité, les fusionner ferait apparaître un jour un onglet
// Cabinet dans la barre d'un client.
export function ClientNav({ hasUnansweredMessage = false }: { hasUnansweredMessage?: boolean }) {
  const pathname = usePathname();

  const tabs = [
    {
      href: "/dashboard/client",
      label: "Mes documents",
      icon: FileText,
      match: (p: string) => p === "/dashboard/client",
    },
    {
      href: "/dashboard/client/livrables",
      label: "Mes livrables",
      icon: PackageOpen,
      match: (p: string) => p.startsWith("/dashboard/client/livrables"),
    },
    {
      href: "/dashboard/client/suivi",
      label: "Mon suivi",
      icon: TrendingUp,
      match: (p: string) => p.startsWith("/dashboard/client/suivi"),
    },
    {
      href: "/dashboard/client/contrat",
      label: "Mon contrat",
      icon: ReceiptText,
      match: (p: string) => p.startsWith("/dashboard/client/contrat"),
    },
    {
      href: "/dashboard/client/echanges",
      label: "Mes échanges",
      icon: MessagesSquare,
      match: (p: string) => p.startsWith("/dashboard/client/echanges"),
    },
  ];

  return (
    <nav className="border-b border-gris-light bg-white" aria-label="Navigation de l'espace client">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex gap-1">
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
              <span className="relative">
                <Icon className="w-4 h-4" aria-hidden="true" />
                {href === "/dashboard/client/echanges" && hasUnansweredMessage && (
                  <span
                    className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-terre"
                    aria-hidden="true"
                  />
                )}
              </span>
              {label}
              {href === "/dashboard/client/echanges" && hasUnansweredMessage && (
                <span className="sr-only"> (nouveau message)</span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
