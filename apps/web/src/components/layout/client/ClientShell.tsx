import type { ReactNode } from "react";
import Link from "next/link";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { getClientHasUnansweredMessage } from "@/lib/actions/message";
import { buildClientNav, CLIENT_ROOT } from "@/lib/design/client-navigation";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { EodaMark } from "../EodaLogo";
import { HelpLink, MAIN_CONTENT_ID, SkipLink } from "../shell-parts";
import { AccountMenu } from "./AccountMenu";
import { ClientNavBar } from "./ClientNavBar";
import { ModeBanner } from "./ModeBanner";

// ─────────────────────────────────────────────────────────────────────────────
// COQUILLE DU PORTAIL CLIENT — maquette « Portail Client v2 ».
//
// Corps de texte 18 px et cibles de 48 px, ICI seulement : le portail client est
// lu par des directions et des administratifs qui n'y viennent pas tous les jours
// (« même un enfant de 12 ans », CLAUDE.md §6). Le cabinet garde 16 px.
//
// La structure affichée vient de la garde (lien EstablishmentUser), jamais d'un
// paramètre. Accès révoqué : la garde rend `establishment: null`, le bandeau dit
// alors simplement « Espace client ».
// ─────────────────────────────────────────────────────────────────────────────
export async function ClientShell({ children }: { children: ReactNode }) {
  const [{ session, establishment }, hasUnansweredMessage] = await Promise.all([
    requireClientEstablishment(),
    getClientHasUnansweredMessage(),
  ]);
  const items = buildClientNav({ hasUnansweredMessage });
  const userName = session.user.name ?? session.user.email ?? "Mon compte";

  return (
    <div className="flex min-h-screen flex-col bg-paper text-lg text-ink">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-line bg-card">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link href={CLIENT_ROOT} className="mr-2 flex min-w-0 items-center gap-2.5 rounded-lg">
            <EodaMark size={40} className="flex-shrink-0" />
            {establishment?.logoDataUri && (
              // eslint-disable-next-line @next/next/no-img-element -- data URI déposée par le cabinet, sans optimisation possible
              <img src={establishment.logoDataUri} alt="" className="h-10 max-w-[96px] object-contain" />
            )}
            <span className="truncate font-bold">{establishment?.name ?? "Espace client"}</span>
          </Link>

          <ClientNavBar items={items} variant="top" />

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle className="h-12 rounded-[10px]" />
            <HelpLink className="h-12 rounded-[10px] text-[17px]" />
            <AccountMenu name={userName} />
          </div>
        </div>
      </header>

      <ModeBanner mode={null} offerLabel="" />

      {/* Marge basse sur mobile : la barre de navigation fixe ne doit pas recouvrir
          la fin de la page. */}
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 md:pb-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>

      <ClientNavBar items={items} variant="bottom" />
    </div>
  );
}
