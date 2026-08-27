import type { PricingUnit } from "@eoda/database";
import { formatDate } from "@/lib/services/date-format-service";
import { formatEuros, formatStartingPrice } from "@/lib/services/price-format-service";
import { optionCommittedAmountEuros } from "@/lib/services/devis-calculation-service";

type DevisOptionLine = {
  labelSnapshot: string;
  priceSnapshotEuros: number;
  pricingUnitSnapshot: PricingUnit;
  priceMaxSnapshotEuros: number | null;
  minQuantitySnapshot: number | null;
};

type Props = {
  number: string;
  createdAt: Date;
  validUntil: Date;
  prospectStructureName: string;
  formuleLabelSnapshot: string;
  formulePriceSnapshotEuros: number;
  options: DevisOptionLine[];
  totalAmountEuros: number;
  depositPercent: number;
  depositAmountEuros: number;
  balanceAmountEuros: number;
  installmentCount: number;
  installmentAmountEuros: number;
};



export function DevisSummaryPrintable({
  number,
  createdAt,
  validUntil,
  prospectStructureName,
  formuleLabelSnapshot,
  formulePriceSnapshotEuros,
  options,
  totalAmountEuros,
  depositPercent,
  depositAmountEuros,
  balanceAmountEuros,
  installmentCount,
  installmentAmountEuros,
}: Props) {
  return (
    <div className="space-y-6 text-brun-ancre">
      <div className="flex items-start justify-between border-b border-gris-light pb-4">
        <div>
          <h2 className="text-lg font-bold">Devis {number}</h2>
          <p className="text-sm text-gris-mid">Émis le {formatDate(new Date(createdAt))}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gris-mid">Valable jusqu'au</p>
          <p className="text-sm font-semibold">{formatDate(new Date(validUntil))}</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-gris-mid uppercase tracking-wide">Client</p>
        <p className="font-semibold">{prospectStructureName}</p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gris-light text-left text-xs text-gris-mid uppercase tracking-wide">
            <th className="py-2">Prestation</th>
            <th className="py-2 text-right">Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gris-light/60">
            <td className="py-2">Formule {formuleLabelSnapshot}</td>
            <td className="py-2 text-right tabular-nums">
              {formatStartingPrice({ priceEuros: formulePriceSnapshotEuros })}
            </td>
          </tr>
          {options.map((o, i) => {
            // Une option à l'unité (95 €/h, mini. 2 h) affiche son tarif unitaire, mais
            // n'entre au total que pour son engagement minimal. Sans ce montant, les
            // lignes visibles ne s'additionnent pas au total visible — sur un document
            // qu'un prospect peut tenir pour contractuel, c'est inacceptable.
            const committed = optionCommittedAmountEuros({
              priceEuros: o.priceSnapshotEuros,
              minQuantity: o.minQuantitySnapshot,
            });
            const unitLabel = formatStartingPrice({
              priceEuros: o.priceSnapshotEuros,
              pricingUnit: o.pricingUnitSnapshot,
              priceMaxEuros: o.priceMaxSnapshotEuros,
              minQuantity: o.minQuantitySnapshot,
            });
            const isMetered = o.pricingUnitSnapshot !== "FORFAIT";

            return (
              <tr key={i} className="border-b border-gris-light/60">
                <td className="py-2">
                  {o.labelSnapshot}
                  {isMetered ? (
                    <span className="block text-xs text-gris-mid">{unitLabel}</span>
                  ) : null}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {isMetered ? formatEuros(committed) : unitLabel}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="space-y-1 text-sm ml-auto max-w-xs">
        <div className="flex justify-between font-semibold text-base border-t border-gris-light pt-2">
          <span>Total</span>
          <span className="tabular-nums">{formatStartingPrice({ priceEuros: totalAmountEuros })}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gris-mid">Acompte ({depositPercent}%)</span>
          <span className="tabular-nums">{formatEuros(depositAmountEuros)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gris-mid">Solde</span>
          <span className="tabular-nums">{formatEuros(balanceAmountEuros)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gris-mid">
            {installmentCount} échéance{installmentCount > 1 ? "s" : ""} de
          </span>
          <span className="tabular-nums">{formatEuros(installmentAmountEuros)}</span>
        </div>
      </div>

      <p className="text-xs text-gris-mid border-t border-gris-light pt-4">
        Tarifs indicatifs HT « à partir de » · TVA non applicable, art. 293 B du CGI · acompte à la
        commande, solde à la livraison des livrables. Devis établi par EODA Conseil — préparation à
        l'évaluation qualité HAS. Prestation de conseil, ne constitue pas une évaluation HAS officielle.
      </p>
    </div>
  );
}
