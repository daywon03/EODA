import type { ReactNode } from "react";
import Link from "next/link";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { getClientHasUnansweredMessage } from "@/lib/actions/message";
import { getClientNewDeliverablesCount } from "@/lib/actions/deliverables";
import { getClientSupportContext } from "@/lib/actions/client-support";
import { describeModeTag, toUiSupportMode } from "@/lib/services/support-mode-service";
import {
  buildClientNav,
  canSeeClientEntry,
  clientAccountLinks,
  CLIENT_ROOT,
} from "@/lib/design/client-navigation";
import { clientAllows } from "@/lib/auth/capabilities";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { EodaMark } from "../EodaLogo";
import { HelpLink, MAIN_CONTENT_ID, SkipLink } from "../shell-parts";
import { AccountMenu } from "./AccountMenu";
import { ClientNavBar } from "./ClientNavBar";
import { ClientSidebar } from "./ClientSidebar";
import { ModeBanner } from "./ModeBanner";

// ─────────────────────────────────────────────────────────────────────────────
// COQUILLE DU PORTAIL CLIENT — maquettes de l'espace de la structure accompagnée
// (Excellence) et du portail client v2 (structure en autonomie).
//
// UNE SEULE COQUILLE POUR TOUS LES PALIERS. La maquette du portail en autonomie
// l'écrit elle-même : « Même espace, mêmes écrans » — le palier ne change qu'une
// étiquette (le bandeau de mode et le sous-titre de la barre latérale), jamais la
// navigation. Aucune entrée ne s'ouvre ou ne se ferme selon l'offre souscrite ; ce
// qui se ferme, c'est une ACTION (générer une version corrigée, par exemple, gardé
// par `correctionRight`), et ça se refuse côté serveur, pas en masquant un bouton.
//
// Corps de texte 18 px et cibles de 48 px, ICI seulement : le portail client est
// lu par des directions et des administratifs qui n'y viennent pas tous les jours
// (« même un enfant de 12 ans », CLAUDE.md §6). Le cabinet garde 16 px.
//
// Navigation LATERALE dès `lg` (barre latérale repliable, comme le cabinet) ; sous
// `lg`, la barre du bas reste seule — le pouce l'atteint. Les deux rendus lisent la
// MEME liste : `items` est calculé une fois ici et passé aux deux.
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
  // Même règle que le filtre de la barre, appelée par la même fonction : un rôle sans
  // le module DOCUMENTS ne voit pas l'entrée, donc il n'a rien à compter — et on ne
  // lit pas un compteur en son nom.
  const canReadDeliverables = canSeeClientEntry(accessRole, "deliverables");
  const [hasUnansweredMessage, newDeliverablesCount] = await Promise.all([
    canReadMessages ? getClientHasUnansweredMessage() : Promise.resolve(false),
    canReadDeliverables ? getClientNewDeliverablesCount() : Promise.resolve(0),
  ]);
  const items = buildClientNav({ hasUnansweredMessage, accessRole, newDeliverablesCount });
  const userName = session.user.name ?? session.user.email ?? "Mon compte";
  const structureName = establishment?.name ?? "Espace client";
  // Le palier est un FAIT de la mission : sans mission, aucune étiquette (ni ici, ni
  // dans le bandeau) — un palier deviné annoncerait un niveau de relecture non acheté.
  const modeLabel = support ? describeModeTag(support.formule, support.mode) : null;

  return (
    <div className="flex min-h-screen bg-paper text-lg text-ink">
      <SkipLink />

      <ClientSidebar
        items={items}
        structureName={structureName}
        structureLogo={establishment?.logoDataUri ?? null}
        modeLabel={modeLabel}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* L'en-tête garde ce qui n'appartient à aucune entrée : l'aide, le compte (et
            le thème, dans le panneau du compte). Sous `lg` seulement, il porte aussi
            la marque et le nom de la structure — au-dessus, la barre latérale les
            montre déjà, et les écrire deux fois ferait deux fois la même annonce. */}
        <header className="sticky top-0 z-30 flex min-h-[64px] items-center gap-x-3 border-b border-line bg-card px-4 py-1.5 sm:px-6">
          <Link
            href={CLIENT_ROOT}
            aria-label={`${structureName} — retour à l'accueil`}
            className="flex min-w-0 items-center gap-2.5 rounded-lg lg:hidden"
          >
            <EodaMark size={40} className="flex-shrink-0" />
            {establishment?.logoDataUri && (
              // eslint-disable-next-line @next/next/no-img-element -- data URI déposée par le cabinet, sans optimisation possible
              <img src={establishment.logoDataUri} alt="" className="hidden h-10 max-w-[96px] object-contain sm:block" />
            )}
            <span className="truncate font-bold">{structureName}</span>
          </Link>

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
        </header>

        <ModeBanner
          mode={support ? toUiSupportMode(support.mode) : null}
          offerLabel={support ? describeModeTag(support.formule, support.mode) : ""}
        />

        {/* Marge basse sous `lg` : la barre de navigation fixe ne doit pas recouvrir la
            fin de la page. Au-dessus, la barre du bas n'existe plus. */}
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:pb-8">
          <div className="mx-auto max-w-[1200px]">{children}</div>
        </main>
      </div>

      <ClientNavBar items={items} />
    </div>
  );
}
