import Link from "next/link";
import { getProspect, listProspectsForDevisPicker } from "@/lib/actions/prospect";
import { listCatalogue } from "@/lib/actions/catalogue";
import { computeDefaultValidityDays } from "@/lib/services/devis-validity-service";
import { toDevisCatalogueChoices } from "@/lib/services/devis-catalogue-choices";
import { DevisForm } from "@/components/devis/DevisForm";
import { cn } from "@/lib/utils";

export const metadata = { title: "Nouveau devis" };

// Repli si aucun réglage de facturation n'a encore été enregistré — acompte de 40 %
// à la commande, validité 30 jours, CGP de l'offre commerciale v10 §06.
const DEFAULT_DEPOSIT_PERCENT = 40;
const DEFAULT_VALIDITY_DAYS = 30;
const BASE_PATH = "/dashboard/cabinet/commercial/devis/nouveau";

type Props = { searchParams: Promise<{ prospectId?: string }> };

// Choix de la structure (maquette v2) : des pastilles. Ce sont des LIENS — choisir
// une structure recharge la page pour elle (validité proposée selon SON échéance
// HAS, offre envisagée présélectionnée). `aria-current` dit laquelle est choisie.
function StructurePicker({
  prospects,
  selectedId,
}: {
  prospects: readonly { id: string; structureName: string }[];
  selectedId: string | null;
}) {
  return (
    <nav aria-labelledby="devis-structure" className="flex flex-col gap-2">
      <span id="devis-structure" className="font-bold text-ink">
        Structure
      </span>
      <div className="flex flex-wrap gap-2">
        {prospects.map((p) => {
          const selected = p.id === selectedId;
          return (
            <Link
              key={p.id}
              href={`${BASE_PATH}?prospectId=${p.id}`}
              aria-current={selected ? "true" : undefined}
              scroll={false}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border-2 px-4 text-base font-bold",
                selected ? "border-ink-fill bg-ink-fill text-on-ink" : "border-line bg-card text-ink hover:border-muted"
              )}
            >
              {selected && <span aria-hidden="true">✓&nbsp;</span>}
              {p.structureName}
            </Link>
          );
        })}
        <Link
          href="/dashboard/cabinet/commercial/prospects/nouveau"
          className="inline-flex min-h-11 items-center rounded-full border-2 border-dashed border-muted px-4 text-base text-ink hover:bg-soft"
        >
          + Nouveau prospect
        </Link>
      </div>
    </nav>
  );
}

export default async function NouveauDevisPage({ searchParams }: Props) {
  const { prospectId } = await searchParams;
  const [pickable, catalogue] = await Promise.all([listProspectsForDevisPicker(), listCatalogue()]);
  // getProspect filtre par tenant et fait notFound() hors périmètre.
  const prospect = prospectId ? await getProspect(prospectId) : null;
  // La structure choisie reste dans la liste même si elle n'est plus parmi les plus récentes.
  const prospects =
    prospect && !pickable.some((p) => p.id === prospect.id)
      ? [{ id: prospect.id, structureName: prospect.structureName }, ...pickable]
      : pickable;
  const picker = <StructurePicker prospects={prospects} selectedId={prospect?.id ?? null} />;

  if (!prospect) {
    return (
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
        <h1 className="text-3xl font-bold text-ink">Nouveau devis</h1>
        {picker}
        <p className="text-ink2">Choisissez la structure : l&apos;offre, les options et l&apos;engagement suivent.</p>
      </div>
    );
  }

  const { formules, options } = toDevisCatalogueChoices(catalogue);
  // Validité proposée selon l'échéance HAS du prospect (décision Q10 bis).
  const validity = computeDefaultValidityDays({
    evaluationTargetDate: prospect.hasEvaluationTargetDate,
    now: new Date(),
    fallbackDays: catalogue.billingSettings?.defaultValidityDays ?? DEFAULT_VALIDITY_DAYS,
  });

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6">
      <h1 className="text-3xl font-bold text-ink">Nouveau devis</h1>
      <DevisForm
        key={prospect.id}
        prospectId={prospect.id}
        structureName={prospect.structureName}
        canSendByEmail={Boolean(prospect.contactEmail)}
        structurePicker={picker}
        formules={formules}
        options={options}
        defaultDepositPercent={catalogue.billingSettings?.defaultDepositPercent ?? DEFAULT_DEPOSIT_PERCENT}
        defaultValidityDays={validity.days}
        validityHint={validity.reason}
        envisagedFormule={prospect.envisagedFormule}
      />
    </div>
  );
}
