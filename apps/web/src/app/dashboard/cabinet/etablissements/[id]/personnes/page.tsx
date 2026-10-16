import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { getPeopleAggregates } from "@/lib/actions/terrain-read";
import { HdsLockedNotice } from "@/components/terrain/HdsLockedNotice";
import { PeopleAggregates } from "@/components/terrain/PeopleAggregates";

export const metadata = { title: "Personnes accompagnées" };

type Props = { params: Promise<{ id: string }> };

// Onglet « Personnes accompagnées » de la fiche (lot C) — côté cabinet, des CHIFFRES
// AGRÉGÉS seulement (décision de Damon, 14/10/2026, minimisation RGPD/HDS) : la
// structure tient ses dossiers nominatifs, le cabinet suit l'avancement.
export default async function StructurePeoplePage({ params }: Props) {
  const { id } = await params;
  await requireEstablishmentInTenant(id, "READ");
  const { hdsAvailable, aggregates } = await getPeopleAggregates(id);

  return (
    <section aria-labelledby="personnes-titre" className="flex flex-col gap-4">
      <h2 id="personnes-titre" className="sr-only">
        Personnes accompagnées
      </h2>
      {!hdsAvailable && <HdsLockedNotice />}
      <PeopleAggregates aggregates={aggregates} />
    </section>
  );
}
