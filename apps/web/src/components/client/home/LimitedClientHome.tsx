import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CLIENT_ACCESS_ROLE_LABELS, type ClientAccessRole } from "@/lib/auth/capabilities";
import { buildClientNav } from "@/lib/design/client-navigation";
import { NAV_ICONS } from "@/components/layout/nav-icons";

// Accueil d'un rôle d'accès qui n'a pas les documents de la structure (intervenant,
// N9) : pas de compteurs qu'il ne pourrait pas ouvrir, seulement ce qu'il peut faire,
// en gros boutons. Phrases courtes (FALC, CLAUDE.md §6).
export function LimitedClientHome({ accessRole }: { accessRole: ClientAccessRole }) {
  const entries = buildClientNav({ hasUnansweredMessage: false, accessRole }).filter((item) => item.id !== "home");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[36px] font-bold leading-tight">Bonjour.</h1>
        <p className="mt-2 max-w-[60ch] text-[21px]">
          Votre accès : {CLIENT_ACCESS_ROLE_LABELS[accessRole].label}. Voici ce que vous pouvez faire.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {entries.map((entry) => {
          const Icon = NAV_ICONS[entry.icon];
          return (
            <li key={entry.id}>
              <Link
                href={entry.href}
                className="flex min-h-16 items-center gap-4 rounded-xl border border-line bg-card px-5 py-4 text-[20px] font-bold text-ink hover:border-accent-text/40"
              >
                <Icon className="h-7 w-7 flex-shrink-0 text-accent-text" aria-hidden="true" />
                <span className="flex-1">{entry.label}</span>
                <ChevronRight className="h-6 w-6 flex-shrink-0" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
