import { auth } from "@/auth";
import { logoutAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

// SVG logo officiel EODA — context/04-charte-eoda.md
function EodaLogo() {
  return (
    <svg viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-9 flex-shrink-0">
      <circle cx="21" cy="21" r="19" stroke="#D69646" strokeWidth="2" />
      <circle cx="21" cy="21" r="7" stroke="#D69646" strokeWidth="2" />
      <line x1="21" y1="2" x2="21" y2="10" stroke="#D69646" strokeWidth="2" strokeLinecap="round" />
      <line x1="21" y1="32" x2="21" y2="40" stroke="#D69646" strokeWidth="2" strokeLinecap="round" />
      <line x1="2" y1="21" x2="10" y2="21" stroke="#D69646" strokeWidth="2" strokeLinecap="round" />
      <line x1="32" y1="21" x2="40" y2="21" stroke="#D69646" strokeWidth="2" strokeLinecap="round" />
      <circle cx="21" cy="21" r="3" fill="#D69646" />
    </svg>
  );
}

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
          <EodaLogo />
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
