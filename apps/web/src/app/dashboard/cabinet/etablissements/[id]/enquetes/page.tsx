import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { hasCabinetCapability } from "@/lib/auth/capabilities";
import { getSurveyBoard } from "@/lib/actions/terrain-read";
import { HdsLockedNotice } from "@/components/terrain/HdsLockedNotice";
import { SurveyBoard } from "@/components/terrain/SurveyBoard";

export const metadata = { title: "Enquêtes" };

type Props = { params: Promise<{ id: string }> };

// Onglet « Enquêtes » de la fiche (lot C) : statistiques agrégées, plan d'action
// proposé. Le cabinet qui écrit peut retenir une proposition ; la lecture seule
// regarde.
export default async function StructureSurveysPage({ params }: Props) {
  const { id } = await params;
  const { role } = await requireEstablishmentInTenant(id, "READ");
  const board = await getSurveyBoard(id);

  return (
    <section aria-labelledby="enquetes-titre" className="flex flex-col gap-4">
      <h2 id="enquetes-titre" className="sr-only">
        Enquêtes de satisfaction
      </h2>
      {!board.hdsAvailable && <HdsLockedNotice />}
      <SurveyBoard board={board} establishmentId={id} canWrite={hasCabinetCapability(role, "STRUCTURES_WRITE")} />
    </section>
  );
}
