import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveTabletSession } from "@/lib/auth/guards";
import { getTabletAwarenessSheets, getTabletDipcSource, getTabletStructureAddress } from "@/lib/actions/tablet-admission";
import { TABLET_DIPC_UNAVAILABLE } from "@/lib/services/tablet-dipc-service";
import { TabletSignOutButton } from "@/components/tablet/TabletSignOutButton";
import { TabletHeader, TabletMain } from "@/components/tablet/TabletHeader";
import { TABLET_SECONDARY } from "@/components/tablet/tablet-ui";
import { TabletAdmission } from "@/components/tablet/admission/TabletAdmission";

export const metadata: Metadata = { title: "Accueil et contrat", robots: { index: false, follow: false } };

// Accueil d'une nouvelle personne et signature du DIPEC (26/10/2026). Même garde que
// l'enquête : appareil enregistré + salarié connecté avec son code. La page ne
// transmet que le DIPEC VALIDÉ de la structure ; la personne, ses signatures et son
// contrat restent dans la tablette (admission-service, verrou HDS).
export default async function TabletAdmissionPage() {
  const session = await resolveTabletSession();
  if (!session) redirect("/tablette");
  const [dipc, structureAddress, sheets] = await Promise.all([getTabletDipcSource(), getTabletStructureAddress(), getTabletAwarenessSheets()]);
  if (!dipc || structureAddress === null) redirect("/tablette");

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <TabletHeader structureName={session.establishmentName} aside={<TabletSignOutButton name={session.staffDisplayName} />} />
      <TabletMain>
        {dipc.status === "READY" ? (
          <TabletAdmission
            establishmentId={session.establishmentId}
            structureName={session.establishmentName}
            structureAddress={structureAddress}
            staffName={session.staffDisplayName}
            sheets={sheets}
            dipc={{ versionId: dipc.versionId, versionNumber: dipc.versionNumber, validatedOn: dipc.validatedOn, text: dipc.text, hasWord: dipc.hasWord }}
          />
        ) : (
          <div className="flex max-w-[760px] flex-col gap-5">
            <h1 className="text-[34px] font-bold">Le contrat n&apos;est pas encore prêt</h1>
            <p className="text-[20px]">{TABLET_DIPC_UNAVAILABLE[dipc.status]}</p>
            <Link href="/tablette" className={`${TABLET_SECONDARY} w-fit`}>Retour à l&apos;accueil</Link>
          </div>
        )}
      </TabletMain>
    </div>
  );
}
