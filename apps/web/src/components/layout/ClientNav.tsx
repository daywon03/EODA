"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, PackageOpen, ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";

// Navigation du portail client — trois surfaces, et trois seulement :
//   « Mes documents »      : ce que je dépose (checklist documentaire) ;
//   « Mes livrables »      : ce qu'EODA a produit et validé pour moi (CDC §5) ;
//   « Mon accompagnement » : ce que j'ai souscrit et ce que je dois en retour.
// Même structure visuelle que CabinetNav (charte EODA : soulignement terre sur
// l'onglet actif) sans en partager le composant : les deux portails n'ont pas les
// mêmes règles de visibilité, les fusionner ferait apparaître un jour un onglet
// Cabinet dans la barre d'un client.
export function ClientNav() {
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
      href: "/dashboard/client/accompagnement",
      label: "Mon accompagnement",
      icon: ReceiptText,
      match: (p: string) => p.startsWith("/dashboard/client/accompagnement"),
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
              <Icon className="w-4 h-4" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
