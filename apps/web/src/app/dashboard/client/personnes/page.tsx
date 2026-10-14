import Link from "next/link";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { clientAllows, NEED } from "@/lib/auth/capabilities";
import { getTerrainBoard } from "@/lib/actions/terrain-read";
import { getTabletAdmin } from "@/lib/actions/tablet";
import { HdsLockedNotice } from "@/components/terrain/HdsLockedNotice";
import { PeopleBoard } from "@/components/terrain/PeopleBoard";
import { TabletAdminPanel } from "@/components/terrain/TabletAdminPanel";

export const metadata = { title: "Personnes accompagnées" };

// « Personnes accompagnées » de la structure (maquette « Espace structure », A3 ;
// lot C). Direction et responsable qualité. Les dossiers sont des données de santé :
// tant que le verrou HDS est fermé, la page le dit et la liste reste vide ; les
// tablettes et les codes des intervenants (données de salariés) se gèrent déjà.
export default async function ClientPeoplePage() {
  const { establishment, accessRole } = await requireClientEstablishment(NEED.TERRAIN_READ);
  if (!establishment) {
    return (
      <div className="space-y-3">
        <h1 className="text-[30px] font-bold">Personnes accompagnées</h1>
        <p>Aucune structure n&apos;est rattachée à votre compte.</p>
      </div>
    );
  }
  const canWrite = accessRole !== null && clientAllows(accessRole, NEED.TERRAIN_WRITE);
  const [board, tablets] = await Promise.all([getTerrainBoard(establishment.id), getTabletAdmin(establishment.id)]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold leading-tight">Personnes accompagnées</h1>
          <p className="mt-1 max-w-[65ch] text-ink2">
            Le dossier de chaque personne se crée sur la tablette, à son arrivée : livret d&apos;accueil, règlement de fonctionnement
            et DIPC présentés, puis une signature.
          </p>
        </div>
        <Link
          href="/tablette"
          className="inline-flex h-12 items-center rounded-md bg-accent-fill px-5 font-bold text-on-accent shadow-eoda-sm hover:bg-accent-fill/90"
        >
          Ouvrir la tablette
        </Link>
      </div>
      {!board.hdsAvailable && <HdsLockedNotice />}
      <PeopleBoard board={board} />
      {canWrite && <TabletAdminPanel establishmentId={establishment.id} view={tablets} />}
    </div>
  );
}
