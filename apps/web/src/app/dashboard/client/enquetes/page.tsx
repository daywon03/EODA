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
            À terminer avant l&apos;évaluation. Rien à écrire, et les réponses ne sont jamais reliées à un nom. Sur la
            tablette au domicile, ou par un lien envoyé aux personnes et à leurs proches.
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
      {/* Qui a répondu se suit sur la TABLETTE (liste importée ou saisie, gardée dans
          l'appareil, jamais envoyée — 22/10/2026). Le portail n'a donc aucun nom à
          montrer, et ne doit pas en avoir tant que l'hébergement n'est pas HDS. */}
      <section aria-labelledby="enquete-suivi" className="max-w-[75ch] rounded-2xl border border-line bg-card p-5">
        <h2 id="enquete-suivi" className="text-[21px] font-bold">
          Savoir qui a répondu
        </h2>
        <p className="mt-2">
          Sur la tablette, ouvrez l&apos;enquête puis <strong>« Importer la liste »</strong> : le fichier de vos personnes
          (Excel ou CSV, par exemple exporté de Ximi), ou ajoutez les noms un par un. La tablette coche chaque personne
          qui a répondu et propose la suivante. <strong>« Exporter »</strong> donne un fichier à reporter dans Ximi.
        </p>
        <p className="mt-2 text-ink2">
          La liste reste sur la tablette : elle n&apos;est jamais envoyée à EODA. Les réponses arrivent ici sans aucun nom.
        </p>
      </section>
    </div>
  );
}
