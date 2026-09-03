import Link from "next/link";
import { auth } from "@/auth";
import { logoutAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { Info, LogOut, UserRound } from "lucide-react";
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
        {/* Logo + marque — CLIQUABLE, et c'est ce qui manquait. Le centre d'aide vit
            hors de /cabinet comme de /client : aucune barre de navigation n'y est
            rendue, et le logo n'était pas un lien. Une fois dessus, la seule façon de
            revenir était le bouton Précédent du navigateur.
            `/dashboard` renvoie chacun chez lui selon son rôle : c'est ce qu'on attend
            d'un logo, et ça évite d'avoir à savoir où « chez soi » se trouve. */}
        <Link
          href="/dashboard"
          className="flex items-center gap-3 min-w-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ambre focus-visible:ring-offset-2 focus-visible:ring-offset-brun-ancre"
          aria-label="EODA conseil — revenir à mon espace"
        >
          <EodaMark size={36} />
          <div className="min-w-0">
            <span className="text-ivoire font-bold text-base sm:text-lg tracking-wide block truncate">
              EODA conseil
            </span>
            <span className="text-ambre text-[10px] sm:text-xs uppercase tracking-widest hidden sm:block">
              Expliquer · Observer · Démontrer · Accompagner
            </span>
          </div>
        </Link>

        {/* Droite — badge rôle + déconnexion */}
        {session && (
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="bg-terre text-ivoire text-xs font-semibold px-3 py-1.5 rounded-full tracking-wide whitespace-nowrap">
              {roleBadge}
            </span>
            <Link
              href="/dashboard/profil"
              className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gris-light transition-colors hover:bg-white/10 hover:text-ivoire focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ambre"
              aria-label="Mon profil et mes paramètres"
              title="Mon profil et mes paramètres"
            >
              <UserRound className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span className="hidden md:block truncate max-w-[180px]">
                {session.user?.name ?? session.user?.email}
              </span>
            </Link>
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
