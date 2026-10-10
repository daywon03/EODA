import type { ReactNode } from "react";
import type { DevisAmounts } from "@/lib/services/devis-calculation-service";
import { formatEuros, formatStartingPrice } from "@/lib/services/price-format-service";

export type RecapLine = { id: string; label: string; amountEuros: number };

// Récapitulatif collant du devis en cours de saisie (maquette v2). Il RELIT l'aperçu
// calculé par le formulaire (devis-calculation-service), il ne calcule rien.
// Montants « à partir de » : le devis n'est pas signé, rien n'est ferme.
export function DevisRecap({
  structureName,
  lines,
  amounts,
  showStartingPriceNote,
  children,
}: {
  structureName?: string | undefined;
  lines: readonly RecapLine[];
  amounts: DevisAmounts;
  showStartingPriceNote: boolean;
  children: ReactNode;
}) {
  return (
    <aside
      aria-labelledby="recap-devis"
      className="space-y-3 rounded-xl border-2 border-ink-fill bg-card p-5 lg:sticky lg:top-24"
    >
      <h2 id="recap-devis" className="text-xl font-bold text-ink">
        Récapitulatif
      </h2>
      {structureName && <p className="font-bold text-ink">{structureName}</p>}
      {lines.length === 0 ? (
        <p className="border-y border-line py-2 text-ink2">Choisissez une offre.</p>
      ) : (
        <dl className="divide-y divide-line border-y border-line">
          {lines.map((line) => (
            <div key={line.id} className="flex justify-between gap-3 py-2">
              <dt className="text-ink">{line.label}</dt>
              <dd className="whitespace-nowrap tabular-nums text-ink">{formatEuros(line.amountEuros)}</dd>
            </div>
          ))}
        </dl>
      )}
      <dl className="space-y-1.5">
        <div className="flex justify-between gap-3 text-lg font-bold">
          <dt className="text-ink">Total</dt>
          <dd className="tabular-nums text-ink">{formatStartingPrice({ priceEuros: amounts.totalAmountEuros })}</dd>
        </div>
        <Amount label="Acompte" value={amounts.depositAmountEuros} />
        <Amount label="Solde" value={amounts.balanceAmountEuros} />
        <Amount label="Par échéance" value={amounts.installmentAmountEuros} />
      </dl>
      {showStartingPriceNote && (
        <p className="border-t border-line pt-2 text-sm text-ink2">
          Montants « à partir de » — devis personnalisé établi après diagnostic initial (offre
          commerciale v10 §04).
        </p>
      )}
      <div className="flex flex-col gap-2 pt-2">{children}</div>
    </aside>
  );
}

function Amount({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink2">{label}</dt>
      <dd className="font-bold tabular-nums text-ink">{formatEuros(value)}</dd>
    </div>
  );
}
