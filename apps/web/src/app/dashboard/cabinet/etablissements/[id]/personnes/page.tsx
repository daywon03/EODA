import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { getTerrainBoard } from "@/lib/actions/terrain-read";
import { HdsLockedNotice } from "@/components/terrain/HdsLockedNotice";
import { PeopleBoard } from "@/components/terrain/PeopleBoard";

export const metadata = { title: "Personnes accompagnées" };

type Props = { params: Promise<{ id: string }> };

// Onglet « Personnes accompagnées » de la fiche (lot C) — EN LECTURE côté cabinet :
// la structure tient ses dossiers et ses tablettes.
export default async function StructurePeoplePage({ params }: Props) {
  const { id } = await params;
  await requireEstablishmentInTenant(id, "READ");
  const board = await getTerrainBoard(id);

  return (
    <section aria-labelledby="personnes-titre" className="flex flex-col gap-4">
      <h2 id="personnes-titre" className="sr-only">
        Personnes accompagnées
      </h2>
      {!board.hdsAvailable && <HdsLockedNotice />}
      <PeopleBoard board={board} />
    </section>
  );
}
