import { auth } from "@/auth";
import { logoutAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

// SVG logo officiel EODA — context/04-charte-eoda.md
function EodaLogo() {
  return (
    <svg viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 flex-shrink-0">
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
    <header className="bg-brun-ancre sticky top-0 z-50 shadow-[0_3px_12px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between px-7 py-3">
        {/* Logo + marque */}
        <div className="flex items-center gap-3.5">
          <EodaLogo />
          <div>
            <span className="text-ivoire font-bold text-xl tracking-wide block">
              EODA conseil
            </span>
            <span className="text-ambre text-xs uppercase tracking-widest block mt-0.5">
              Expliquer · Observer · Démontrer · Accompagner
            </span>
          </div>
        </div>

        {/* Droite — badge rôle + déconnexion */}
        {session && (
          <div className="flex items-center gap-4">
            <span className="bg-terre text-ivoire text-xs font-semibold px-3.5 py-1.5 rounded-full tracking-wide">
              {roleBadge}
            </span>
            <span className="text-gris-light text-sm hidden sm:block">
              {session.user?.name ?? session.user?.email}
            </span>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-ivoire hover:text-ambre hover:bg-transparent"
                title="Se déconnecter"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
