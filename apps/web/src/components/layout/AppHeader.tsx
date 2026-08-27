import Link from "next/link";
import { auth } from "@/auth";
import { logoutAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Info, LogOut } from "lucide-react";
import { EodaMark } from "./EodaLogo";

export async function AppHeader() {
  const session = await auth();
  const role = session?.user?.role;

  const roleBadge =
    role === "CABINET_ADMIN" || role === "CABINET_EVALUATOR"
      ? "Cabinet EODA"
      : "Espace Client";

  return (
    <header className="bg-brun-ancre sticky top-0 z-50 border-b border-black/10">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4 px-6 py-3">
        {/* Logo + marque */}
        <div className="flex items-center gap-3 min-w-0">
          <EodaMark size={36} />
          <div className="min-w-0">
            <span className="text-ivoire font-bold text-base sm:text-lg tracking-wide block truncate">
              EODA conseil
            </span>
            <span className="text-ambre text-[10px] sm:text-xs uppercase tracking-widest hidden sm:block">
              Expliquer · Observer · Démontrer · Accompagner
            </span>
          </div>
        </div>

        {/* Droite — badge rôle + déconnexion */}
        {session && (
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="bg-terre text-ivoire text-xs font-semibold px-3 py-1.5 rounded-full tracking-wide whitespace-nowrap">
              {roleBadge}
            </span>
            <span className="text-gris-light text-sm hidden md:block truncate max-w-[180px]">
              {session.user?.name ?? session.user?.email}
            </span>
            {/* Point d'entrée unique du centre d'aide — ouvert aux trois rôles, jamais
                conditionné à l'offre (context/07-outil-pilotage-missions.md §12.5).
                Bouton à icône seule : le libellé accessible est obligatoire. */}
            <Button
              variant="ghost"
              size="icon"
              className="text-ivoire hover:text-ambre hover:bg-white/10"
              title="Aide et guide d'utilisation"
              asChild
            >
              <Link href="/dashboard/aide" aria-label="Aide et guide d'utilisation">
                <Info className="w-4 h-4" aria-hidden="true" />
              </Link>
            </Button>

            <form action={logoutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                className="text-ivoire hover:text-ambre hover:bg-white/10"
                title="Se déconnecter"
                aria-label="Se déconnecter"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
              </Button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
