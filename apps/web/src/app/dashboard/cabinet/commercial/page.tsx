import Link from "next/link";
import { getCommercialOverview } from "@/lib/actions/commercial-overview";
import { listPendingOptionRequests } from "@/lib/actions/option-request";
import { describeSubscriptionSplit, type FunnelStep, type TodoItem } from "@/lib/services/commercial-overview-service";
import { OptionRequestQueue } from "@/components/devis/OptionRequestQueue";
import { CommercialHeader } from "@/components/commercial/CommercialHeader";
import { RemindDevisButton } from "@/components/devis/RemindDevisButton";
import { RemindProspectButton } from "@/components/prospect/RemindProspectButton";
import { FORMULE_LABELS } from "@/components/mission/formule-labels";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

export const metadata = { title: "Pipeline commercial" };

const ROOT = "/dashboard/cabinet/commercial";

function funnelHref(step: FunnelStep): string {
  const { target } = step;
  return target.kind === "devis"
    ? `${ROOT}/devis?onglet=${target.tab}`
    : `${ROOT}/prospects?onglet=${target.tab}&origine=${target.origin}`;
}

const EDGE: Record<number, string> = { 4: "border-t-ambre", 5: "border-t-vert-ok" };
const TODO_DOT = { accent: "bg-accent-fill", amber: "bg-ambre", red: "bg-danger-fill" } as const;

function TodoAction({ item }: { item: TodoItem }) {
  const { action } = item;
  if (action.kind === "remind-devis") {
    return (
      <RemindDevisButton
        devisId={action.devisId}
        number={action.number}
        structureName={action.structureName}
        contactEmail={action.contactEmail}
      />
    );
  }
  if (action.kind === "remind-prospect") {
    return <RemindProspectButton prospectId={action.prospectId} structureName={action.structureName} />;
  }
  return (
    <Button size="sm" variant="outline" asChild>
      <Link href={action.href}>
        {action.label}
        <span className="sr-only"> — {item.title}</span>
      </Link>
    </Button>
  );
}

// Maquette v2 « Commercial — vue d'ensemble » : l'entonnoir en cinq cartes, de
// l'inscription seule à l'accompagnement signé, le bloc « À faire » et les
// abonnements actifs — tout DÉRIVÉ des faits (commercial-overview-service). La file
// des demandes d'option reste ici. Le kanban est retiré (13/10/2026).
export default async function CommercialDashboardPage() {
  const [overview, optionRequests] = await Promise.all([getCommercialOverview(), listPendingOptionRequests()]);
  const { funnel, todo, subscriptions } = overview;

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-7">
      <CommercialHeader
        title="Commercial"
        description="De l'inscription seule à l'accompagnement signé."
        action={
          <Button asChild>
            <Link href={`${ROOT}/devis/nouveau`}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nouveau devis
            </Link>
          </Button>
        }
      />

      {optionRequests.length > 0 && <OptionRequestQueue requests={optionRequests} />}

      <nav aria-label="Entonnoir commercial">
        <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(170px,100%),1fr))] gap-3">
          {funnel.map((step) => (
            <li key={step.step}>
              <Link
                href={funnelHref(step)}
                className={cn(
                  "flex h-full flex-col gap-1 rounded-xl border border-t-4 border-line border-t-accent-fill bg-card px-[18px] py-4 text-ink transition-colors hover:border-accent-fill",
                  EDGE[step.step]
                )}
              >
                <span className="text-sm tabular-nums text-ink2">Étape {step.step}</span>
                <span className="text-[30px] font-bold leading-tight tabular-nums">{step.value}</span>
                <span className="font-bold">{step.label}</span>
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(340px,100%),1fr))] items-start gap-7">
        <section aria-labelledby="a-faire">
          <h2 id="a-faire" className="border-b border-line pb-3 text-xl font-bold">
            À faire
          </h2>
          {todo.length === 0 ? (
            <p className="py-4 text-ink2">Rien d&apos;urgent : aucun appel à préparer, aucun devis à relancer.</p>
          ) : (
            <ul>
              {todo.map((item) => (
                <li key={item.key} className="flex flex-wrap items-center gap-3.5 border-b border-line px-1 py-3.5">
                  <span aria-hidden="true" className={cn("h-2 w-2 flex-shrink-0 rounded-full", TODO_DOT[item.tone])} />
                  <span className="flex min-w-[200px] flex-1 flex-col">
                    <span className="font-bold">{item.title}</span>
                    <span className="text-sm text-ink2">{item.meta}</span>
                  </span>
                  <TodoAction item={item} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="abonnements">
          <div className="flex justify-between gap-3 border-b border-line pb-3">
            <h2 id="abonnements" className="text-xl font-bold">
              Abonnements actifs
            </h2>
            <span className="tabular-nums text-ink2">
              {subscriptions.total} structure{subscriptions.total > 1 ? "s" : ""}
            </span>
          </div>
          <ul>
            {subscriptions.rows.map((row) => (
              <li
                key={row.formule}
                className="grid grid-cols-[minmax(120px,1fr)_minmax(0,2fr)_40px] items-center gap-3.5 border-b border-line px-1 py-3.5"
              >
                <span className="flex flex-col">
                  <span className="font-bold">{FORMULE_LABELS[row.formule]}</span>
                  <span className="text-sm text-ink2">{describeSubscriptionSplit(row)}</span>
                </span>
                <span aria-hidden="true" className="h-2 overflow-hidden rounded bg-line">
                  <span className="block h-full bg-accent-fill" style={{ width: `${row.percent}%` }} />
                </span>
                <span className="text-right font-bold tabular-nums">{row.total}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-sm text-ink2">Missions en cours, par offre. Les montants s&apos;afficheront quand les prix du catalogue seront fixés.</p>
        </section>
      </div>

      {optionRequests.length === 0 && <OptionRequestQueue requests={optionRequests} />}
    </div>
  );
}
