import Link from "next/link";
import { cn } from "@/lib/utils";

// Pièces communes aux deux coquilles (cabinet, client) — une seule définition (D1).

export const MAIN_CONTENT_ID = "contenu";

// Premier élément focalisable de la page : le clavier saute la navigation d'un
// geste (WCAG 2.4.1). Invisible tant qu'il n'a pas le focus.
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-ink-fill focus:px-4 focus:py-3 focus:text-base focus:font-bold focus:text-on-ink"
    >
      Aller au contenu
    </a>
  );
}

// « ? Aide » — point d'entrée unique du centre d'aide, ouvert aux trois rôles et
// jamais conditionné à l'offre (context/07 §12.5). Bordure foncée : c'est le bouton
// que la maquette met en avant, pour qu'on le trouve sans le chercher.
export function HelpLink({ className }: { className?: string }) {
  return (
    <Link
      href="/dashboard/aide"
      className={cn(
        "inline-flex h-11 flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border-2 border-ink bg-card px-3.5 font-bold text-ink transition-colors hover:bg-soft",
        className
      )}
    >
      <span aria-hidden="true">?</span> Aide
    </Link>
  );
}
