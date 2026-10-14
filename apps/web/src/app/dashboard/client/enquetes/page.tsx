import Link from "next/link";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { clientAllows, NEED } from "@/lib/auth/capabilities";
import { getTerrainBoard } from "@/lib/actions/terrain-read";
import { HdsLockedNotice } from "@/components/terrain/HdsLockedNotice";
import { SurveyBoard } from "@/components/terrain/SurveyBoard";

export const metadata = { title: "Enquêtes" };

// Enquêtes de satisfaction (maquette « Espace structure », A5 ; lot C). Résultats
// agrégés, jamais nominatifs ; plan d'action proposé à valider. Les réponses sont
// recueillies sur la tablette — verrouillées tant que l'hébergement n'est pas HDS.
export default async function ClientSurveysPage() {
  const { establishment, accessRole } = await requireClientEstablishment(NEED.TERRAIN_READ);
  if (!establishment) {
    return (
      <div className="space-y-3">
        <h1 className="text-[30px] font-bold">Enquêtes de satisfaction</h1>
        <p>Aucune structure n&apos;est rattachée à votre compte.</p>
      </div>
    );
  }
  const board = await getTerrainBoard(establishment.id);
  const canWrite = accessRole !== null && clientAllows(accessRole, NEED.TERRAIN_WRITE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold leading-tight">Enquêtes de satisfaction</h1>
          <p className="mt-1 max-w-[65ch] text-ink2">
            À terminer avant l&apos;évaluation. Les intervenants les font sur la tablette, au domicile.
          </p>
        </div>
        <Link
          href="/tablette"
          className="inline-flex h-12 items-center rounded-md bg-accent-fill px-5 font-bold text-on-accent shadow-eoda-sm hover:bg-accent-fill/90"
        >
          Faire une enquête
        </Link>
      </div>
      {!board.hdsAvailable && <HdsLockedNotice />}
      <SurveyBoard board={board} establishmentId={establishment.id} canWrite={canWrite} />
    </div>
  );
}
