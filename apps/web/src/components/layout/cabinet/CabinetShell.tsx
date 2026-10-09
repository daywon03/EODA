import type { ReactNode } from "react";
import { requireCabinetSession } from "@/lib/auth/guards";
import { countDocumentsAwaitingReview } from "@/lib/actions/review-queue";
import { countPendingOptionRequests } from "@/lib/actions/option-request";
import { buildCabinetNav, canSeeCommercial } from "@/lib/design/cabinet-navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { HelpLink, MAIN_CONTENT_ID, SkipLink } from "../shell-parts";
import { CabinetSidebar } from "./CabinetSidebar";
import { CabinetMobileNav } from "./CabinetMobileNav";
import { CabinetBreadcrumb } from "./CabinetBreadcrumb";
import { CabinetProfile } from "./CabinetProfile";

// ─────────────────────────────────────────────────────────────────────────────
// COQUILLE DU PORTAIL CABINET — maquette « Portail Cabinet v2 ».
//
// Composant SERVEUR : il lit la session par la garde (rôle relu en base) et les
// deux compteurs, puis confie au client le strict nécessaire (repli, tiroir,
// adresse courante). La visibilité de la section Commercial suit le rôle ; la
// PROTECTION, elle, reste dans chaque lecture commerciale (requireCabinetAdminSession).
//
// Absents volontairement : « Voir comme le client » et la recherche ⌘K de la
// maquette. Ce sont des fonctionnalités, pas de l'habillage ; un bouton qui ne fait
// rien est une donnée factice (D6). Ils arriveront avec leur tranche.
// ─────────────────────────────────────────────────────────────────────────────
export async function CabinetShell({ children }: { children: ReactNode }) {
  const { session, role } = await requireCabinetSession();
  const isAdmin = canSeeCommercial(role);

  const [documentsAwaitingReview, pendingOptionRequests] = await Promise.all([
    countDocumentsAwaitingReview(),
    // Lecture commerciale : réservée à l'admin par sa propre garde, donc jamais
    // appelée pour un autre rôle (elle le renverrait ailleurs).
    isAdmin ? countPendingOptionRequests() : Promise.resolve(0),
  ]);

  const sections = buildCabinetNav(role, { documentsAwaitingReview, pendingOptionRequests });
  const profile = <CabinetProfile name={session.user.name ?? session.user.email ?? "Mon compte"} role={role} />;

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      <SkipLink />
      <CabinetSidebar sections={sections} profile={profile} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-paper px-4 sm:px-6 lg:px-8">
          <CabinetMobileNav sections={sections} profile={profile} />
          <CabinetBreadcrumb sections={sections} />
          <div className="flex flex-shrink-0 items-center gap-2">
            <ThemeToggle />
            <HelpLink />
          </div>
        </header>

        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
