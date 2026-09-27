"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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
const DELIVERABLES_HREF = "/dashboard/client/livrables";

export function ClientNav({
  hasUnansweredMessage = false,
  newDeliverablesCount = 0,
}: {
  hasUnansweredMessage?: boolean;
  // Livrables remis depuis la dernière ouverture de « Mes livrables »
  // (lib/actions/deliverables.ts).
  newDeliverablesCount?: number;
}) {
  const pathname = usePathname();

  // Le layout n'est pas rejoué d'une page du portail à l'autre : son compteur resterait
  // affiché après la lecture. Une fois l'onglet ouvert, la pastille s'éteint pour de
  // bon dans cette navigation — la date de lecture est déjà enregistrée en base.
  const isOnDeliverables = pathname.startsWith(DELIVERABLES_HREF);
  const [deliverablesOpened, setDeliverablesOpened] = useState(isOnDeliverables);
  if (isOnDeliverables && !deliverablesOpened) setDeliverablesOpened(true);
  const unseenDeliverables = deliverablesOpened ? 0 : newDeliverablesCount;

  const tabs = [
    {
      href: "/dashboard/client",
      label: "Mes documents",
      icon: FileText,
      match: (p: string) => p === "/dashboard/client",
    },
    {
      href: DELIVERABLES_HREF,
      label: "Mes livrables",
      icon: PackageOpen,
      match: (p: string) => p.startsWith(DELIVERABLES_HREF),
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
    <nav className="border-b border-gris-light bg-surface" aria-label="Navigation de l'espace client">
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
              {href === DELIVERABLES_HREF && unseenDeliverables > 0 && (
                <span className="rounded-full bg-terre px-1.5 py-px text-[11px] font-semibold leading-4 text-white">
                  {unseenDeliverables}
                  <span className="sr-only">
                    {" "}
                    nouveau{unseenDeliverables > 1 ? "x" : ""} document
                    {unseenDeliverables > 1 ? "s" : ""}
                  </span>
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
