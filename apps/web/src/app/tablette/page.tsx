import type { Metadata } from "next";
import Link from "next/link";
import { resolveTabletDevice, resolveTabletSession } from "@/lib/auth/guards";
import { getBeneficiaryDataPort } from "@/lib/hds";
import { listTabletSignInStaff } from "@/lib/actions/tablet";
import { TabletSignOutButton } from "@/components/tablet/TabletSignOutButton";
import { firstNameOf } from "@/lib/services/structures-overview-service";
import { HdsLockedNotice } from "@/components/terrain/HdsLockedNotice";
import { TabletHeader, TabletMain } from "@/components/tablet/TabletHeader";
import { TabletSignIn } from "@/components/tablet/TabletSignIn";
import { TABLET_PRIMARY, TABLET_SECONDARY } from "@/components/tablet/tablet-ui";
import { TABLET_ROLE_LABELS } from "@/lib/services/tablet-role-service";

export const metadata: Metadata = { title: "Tablette terrain", robots: { index: false, follow: false } };

// ─────────────────────────────────────────────────────────────────────────────
// TABLETTE TERRAIN (lot C). Route sans session Auth.js : l'autorisation vient de
// l'APPAREIL ENREGISTRÉ et du code du salarié (resolveTabletSession, guards.ts).
// Trois états : appareil inconnu → explication ; appareil connu sans session →
// « Qui utilise la tablette ? » ; session ouverte → accueil. Tant que le verrou HDS
// est fermé, l'accueil dit honnêtement que rien ne s'enregistre encore et renvoie
// vers la démonstration — aucun formulaire d'écriture n'est proposé.
// ─────────────────────────────────────────────────────────────────────────────
export default async function TabletPage() {
  const session = await resolveTabletSession();
  const device = session ?? (await resolveTabletDevice());

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <TabletHeader
        structureName={device?.establishmentName ?? "Tablette terrain"}
        aside={
          session ? <TabletSignOutButton name={session.staffDisplayName} /> : null
        }
      />
      <TabletMain>
        {!device && (
          <div className="flex max-w-[760px] flex-col gap-5">
            <h1 className="text-[34px] font-bold">Cette tablette n&apos;est pas encore enregistrée</h1>
            <p>
              Pour protéger les personnes accompagnées, la tablette s&apos;ouvre seulement sur un appareil enregistré par la direction, avec le
              code personnel de l&apos;intervenant. Jamais un code seul.
            </p>
            <p>La direction l&apos;enregistre depuis le portail : « Personnes accompagnées », puis « Enregistrer cet appareil », sur cette tablette.</p>
            <Link href="/tablette/demonstration" className={`${TABLET_SECONDARY} w-fit`}>Voir la démonstration</Link>
          </div>
        )}
        {device && !session && <TabletSignIn staff={await listTabletSignInStaff()} />}
        {session && (
          <div className="flex flex-col gap-6">
            <h1 className="text-[36px] font-bold">Bonjour {firstNameOf(session.staffDisplayName) ?? session.staffDisplayName}.</h1>
            {/* Le rôle posé par la direction (30/10/2026) : chacun sait ce qu'il peut faire. */}
            <p className="text-[19px] text-ink2">
              Vous êtes <span className="font-bold text-ink">{TABLET_ROLE_LABELS[session.tabletRole].label}</span> sur cette tablette :{" "}
              {TABLET_ROLE_LABELS[session.tabletRole].description.charAt(0).toLowerCase() + TABLET_ROLE_LABELS[session.tabletRole].description.slice(1)}
            </p>
            {/* L'enquête fonctionne dès maintenant : le serveur ne garde aucune donnée
                de personne (21/10/2026) ; la liste des noms reste dans la tablette
                (22/10/2026). */}
            <div className="flex max-w-[760px] flex-col gap-3 rounded-2xl border border-line bg-card p-6">
              <h2 className="text-[26px] font-bold">Enquête de satisfaction</h2>
              <p>Choisissez la personne dans la liste, posez les questions : la tablette coche « fait ». Les réponses partent sans aucun nom.</p>
              <Link href="/tablette/enquete" className={`${TABLET_PRIMARY} w-fit`}>Faire une enquête</Link>
            </div>
            {/* Le DIPEC se signe dès maintenant : la fiche de la personne, les
                signatures et le contrat restent dans la tablette (26/10/2026). */}
            <div className="flex max-w-[760px] flex-col gap-3 rounded-2xl border border-line bg-card p-6">
              <h2 className="text-[26px] font-bold">Accueil d&apos;une nouvelle personne</h2>
              <p>Remplissez sa fiche une fois, relisez le contrat (DIPEC) avec elle, expliquez ce que le manuel HAS demande, puis signez sur la tablette.</p>
              <Link href="/tablette/admission" className={`${TABLET_PRIMARY} w-fit`}>Accueil et contrat</Link>
            </div>
            {getBeneficiaryDataPort().isAvailable ? (
              <p>Les enquêtes et les dossiers s&apos;ouvrent sur la tablette dès que le parcours réel est activé par EODA.</p>
            ) : (
              <>
                <HdsLockedNotice showDemoLink={false} />
                <p className="max-w-[65ch]">
                  Le dossier d&apos;une personne et l&apos;accueil d&apos;une nouvelle personne se montrent déjà en démonstration, avec des
                  personnes fictives. Rien n&apos;y est enregistré.
                </p>
                <Link href="/tablette/demonstration" className={`${TABLET_SECONDARY} w-fit`}>Ouvrir la démonstration</Link>
              </>
            )}
          </div>
        )}
      </TabletMain>
    </div>
  );
}
