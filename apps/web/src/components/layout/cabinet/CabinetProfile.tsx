import Link from "next/link";
import { LogOut } from "lucide-react";
import type { UserRole } from "@eoda/database";
import { logoutAction } from "@/lib/auth-actions";
import { initialsOf } from "@/lib/design/navigation";

const ROLE_LABELS: Record<UserRole, string> = {
  CABINET_ADMIN: "Cabinet · administration",
  CABINET_EVALUATOR: "Cabinet · évaluation",
  CLIENT_USER: "Structure",
};

// Bloc profil en bas de la barre latérale (et du tiroir mobile). Composant SERVEUR :
// la déconnexion est un formulaire vers une action serveur, sans JavaScript client.
// Dans la barre repliée, seuls la pastille et le bouton restent visibles ; le nom
// passe en lecture d'écran (`group-data-[collapsed=true]/sidebar`).
export function CabinetProfile({ name, role }: { name: string; role: UserRole }) {
  return (
    <div className="flex items-center gap-2.5 border-t border-line px-4 py-3.5 group-data-[collapsed=true]/sidebar:flex-col group-data-[collapsed=true]/sidebar:px-2">
      <Link
        href="/dashboard/profil"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg"
        title="Mon profil"
      >
        <span className="sr-only">Mon profil : </span>
        <span
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-ink-fill text-sm font-bold text-on-ink"
          aria-hidden="true"
        >
          {initialsOf(name)}
        </span>
        <span className="min-w-0 whitespace-nowrap group-data-[collapsed=true]/sidebar:sr-only">
          <span className="block truncate font-bold text-ink">{name}</span>
          <span className="block truncate text-sm text-ink2">{ROLE_LABELS[role]}</span>
        </span>
      </Link>
      <form action={logoutAction}>
        <button
          type="submit"
          aria-label="Se déconnecter"
          title="Se déconnecter"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-ink2 transition-colors hover:bg-line hover:text-ink"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
