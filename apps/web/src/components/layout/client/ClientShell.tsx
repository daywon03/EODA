import type { ReactNode } from "react";
import Link from "next/link";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { getClientHasUnansweredMessage } from "@/lib/actions/message";
import { getClientSupportContext } from "@/lib/actions/client-support";
import { describeModeTag, toUiSupportMode } from "@/lib/services/support-mode-service";
import { buildClientNav, clientAccountLinks, CLIENT_ROOT } from "@/lib/design/client-navigation";
import { clientAllows } from "@/lib/auth/capabilities";
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
  const [{ session, establishment, accessRole }, support] = await Promise.all([
    requireClientEstablishment("HOME"),
    getClientSupportContext(),
  ]);
  // Le signal « nouveau message » n'est lu que pour un rôle qui a les messages : sa
  // lecture est gardée et renverrait ailleurs au milieu du rendu de la coquille.
  const canReadMessages = !accessRole || clientAllows(accessRole, { module: "MESSAGES", mode: "READ" });
  const hasUnansweredMessage = canReadMessages ? await getClientHasUnansweredMessage() : false;
  const items = buildClientNav({ hasUnansweredMessage, accessRole });
  const userName = session.user.name ?? session.user.email ?? "Mon compte";

  return (
    <div className="flex min-h-screen flex-col bg-paper text-lg text-ink">
      <SkipLink />
      <header className="sticky top-0 z-30 border-b border-line bg-card">
        {/* Une seule ligne à toute largeur (≤ 72 px) : le nom de la structure se
            tronque, les entrées secondaires vivent dans « Plus ». */}
        <div className="mx-auto flex min-h-[64px] max-w-[1200px] flex-nowrap items-center gap-x-3 px-4 py-1.5 sm:px-6 xl:gap-x-4">
          <Link
            href={CLIENT_ROOT}
            aria-label={`${establishment?.name ?? "Espace client"} — retour à l'accueil`}
            className="flex min-w-0 flex-shrink items-center gap-2.5 rounded-lg"
          >
            <EodaMark size={40} className="flex-shrink-0" />
            {establishment?.logoDataUri && (
              // eslint-disable-next-line @next/next/no-img-element -- data URI déposée par le cabinet, sans optimisation possible
              <img src={establishment.logoDataUri} alt="" className="hidden h-10 max-w-[96px] object-contain sm:block" />
            )}
            <span className="truncate font-bold lg:sr-only xl:not-sr-only xl:max-w-[240px]">
              {establishment?.name ?? "Espace client"}
            </span>
          </Link>

          <ClientNavBar items={items} variant="top" />

          <div className="ml-auto flex flex-shrink-0 items-center gap-2">
            <HelpLink className="h-12 rounded-[10px] text-[17px]" />
            <AccountMenu
              name={userName}
              links={clientAccountLinks(accessRole)}
              settings={
                // Dans le panneau, la place ne manque pas : le libellé du thème
                // (masqué sur petit écran dans l'en-tête) s'affiche toujours.
                <div className="[&_.sr-only]:not-sr-only">
                  <ThemeToggle className="h-12 w-full justify-start rounded-lg" />
                </div>
              }
            />
          </div>
        </div>
      </header>

      <ModeBanner
        mode={support ? toUiSupportMode(support.mode) : null}
        offerLabel={support ? describeModeTag(support.formule, support.mode) : ""}
      />

      {/* Marge basse sur mobile : la barre de navigation fixe ne doit pas recouvrir
          la fin de la page. */}
      <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:pb-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>

      <ClientNavBar items={items} variant="bottom" />
    </div>
  );
}
