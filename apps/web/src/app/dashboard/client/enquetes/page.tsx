import Link from "next/link";
import { requireClientEstablishment } from "@/lib/auth/guards";
import { clientAllows, NEED } from "@/lib/auth/capabilities";
import { getSurveyBoard } from "@/lib/actions/terrain-read";
import { SurveyBoard } from "@/components/terrain/SurveyBoard";
import { AnonymousSurveyLinksPanel } from "@/components/terrain/AnonymousSurveyLinksPanel";

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
  const board = await getSurveyBoard(establishment.id);
  const canWrite = accessRole !== null && clientAllows(accessRole, NEED.TERRAIN_WRITE);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold leading-tight">Enquêtes de satisfaction</h1>
          <p className="mt-1 max-w-[65ch] text-ink2">
            À terminer avant l&apos;évaluation. Anonymes : aucun nom, rien à écrire. Sur la tablette au domicile, ou
            par un lien envoyé aux personnes et à leurs proches.
          </p>
        </div>
        <Link
          href="/tablette/enquete"
          className="inline-flex h-12 items-center rounded-md bg-accent-fill px-5 font-bold text-on-accent shadow-eoda-sm hover:bg-accent-fill/90"
        >
          Faire une enquête sur la tablette
        </Link>
      </div>
      {canWrite && <AnonymousSurveyLinksPanel establishmentId={establishment.id} />}
      <SurveyBoard board={board} establishmentId={establishment.id} canWrite={canWrite} />
      {/* L'enquête NOMINATIVE (rattachée au dossier d'une personne) reste verrouillée
          tant que l'hébergement n'est pas certifié HDS ; l'anonyme n'en dépend pas. */}
      {!board.hdsAvailable && (
        <p className="max-w-[65ch] text-ink2">
          Le suivi « enquête faite » personne par personne s&apos;ouvrira avec l&apos;hébergement des données de santé.
          D&apos;ici là, les enquêtes sont anonymes.
        </p>
      )}
    </div>
  );
}
