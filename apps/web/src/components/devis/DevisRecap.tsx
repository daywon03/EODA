import type { ReactNode } from "react";
import type { DevisAmounts } from "@/lib/services/devis-calculation-service";
import type { DevisRecap as DevisRecapData } from "@/lib/services/devis-recap-service";
import { formatEuros, formatStartingPrice } from "@/lib/services/price-format-service";

// Récapitulatif collant du devis en cours de saisie (maquette v2) : les lignes, puis
// « Par mois » et « Ponctuel », puis l'engagement. Il RELIT ce que le formulaire a
// rangé (devis-recap-service) et calculé (devis-calculation-service) : rien n'est
// calculé ici. Le total engagé et l'acompte restent dits, plus discrètement — ce
// sont les montants du document commercial.
export function DevisRecap({
  reference,
  structureName,
  recap,
  amounts,
  commitmentLine,
  children,
}: {
  reference: string;
  structureName?: string | undefined;
  recap: DevisRecapData;
  amounts: DevisAmounts;
  commitmentLine: string | null;
  children: ReactNode;
}) {
  return (
    <aside
      aria-labelledby="recap-devis"
      className="flex flex-col gap-3 rounded-[14px] border-2 border-ink bg-card p-5 sm:p-6 lg:sticky lg:top-24"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="recap-devis" className="text-xl font-bold text-ink">
          Récapitulatif
        </h2>
        <span className="text-base tabular-nums text-ink2">{reference}</span>
      </div>
      {structureName && <p className="font-bold text-ink">{structureName}</p>}
      {recap.lines.length === 0 ? (
        <p className="border-t border-line py-2 text-ink2">Choisissez une offre ou une option.</p>
      ) : (
        <dl>
          {recap.lines.map((line) => (
            <div key={line.key} className="flex justify-between gap-3 border-t border-line py-2">
              <dt className="text-ink">{line.label}</dt>
              <dd className="whitespace-nowrap tabular-nums text-ink">{line.price}</dd>
            </div>
          ))}
        </dl>
      )}
      <dl className="flex flex-col gap-1">
        <div className="flex justify-between gap-3 border-t-2 border-ink pt-2.5 font-bold">
          <dt>Par mois</dt>
          <dd className="tabular-nums">{recap.monthly}</dd>
        </div>
        <div className="flex justify-between gap-3 font-bold">
          <dt>Ponctuel</dt>
          <dd className="tabular-nums">{recap.once}</dd>
        </div>
      </dl>
      {commitmentLine && <p className="text-base text-ink2">{commitmentLine}</p>}
      <dl className="flex flex-col gap-1 border-t border-line pt-2 text-base">
        <div className="flex justify-between gap-3">
          <dt className="text-ink2">Total engagé à la signature</dt>
          <dd className="tabular-nums text-ink">{formatStartingPrice({ priceEuros: amounts.totalAmountEuros })}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink2">Acompte</dt>
          <dd className="tabular-nums text-ink">{formatEuros(amounts.depositAmountEuros)}</dd>
        </div>
      </dl>
      <div className="mt-1.5 flex flex-col gap-2">{children}</div>
    </aside>
  );
}
