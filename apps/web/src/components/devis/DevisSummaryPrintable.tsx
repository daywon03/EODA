type DevisOptionLine = { labelSnapshot: string; priceSnapshotEuros: number };

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

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

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
          <p className="text-sm text-gris-mid">Émis le {dateFormatter.format(new Date(createdAt))}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gris-mid">Valable jusqu'au</p>
          <p className="text-sm font-semibold">{dateFormatter.format(new Date(validUntil))}</p>
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
            <td className="py-2 text-right tabular-nums">{formulePriceSnapshotEuros.toLocaleString("fr-FR")} €</td>
          </tr>
          {options.map((o, i) => (
            <tr key={i} className="border-b border-gris-light/60">
              <td className="py-2">{o.labelSnapshot}</td>
              <td className="py-2 text-right tabular-nums">{o.priceSnapshotEuros.toLocaleString("fr-FR")} €</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-1 text-sm ml-auto max-w-xs">
        <div className="flex justify-between font-semibold text-base border-t border-gris-light pt-2">
          <span>Total</span>
          <span className="tabular-nums">{totalAmountEuros.toLocaleString("fr-FR")} €</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gris-mid">Acompte ({depositPercent}%)</span>
          <span className="tabular-nums">{depositAmountEuros.toLocaleString("fr-FR")} €</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gris-mid">Solde</span>
          <span className="tabular-nums">{balanceAmountEuros.toLocaleString("fr-FR")} €</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gris-mid">
            {installmentCount} échéance{installmentCount > 1 ? "s" : ""} de
          </span>
          <span className="tabular-nums">{installmentAmountEuros.toLocaleString("fr-FR")} €</span>
        </div>
      </div>

      <p className="text-xs text-gris-mid border-t border-gris-light pt-4">
        Devis établi par EODA Conseil — préparation à l'évaluation qualité HAS. Prestation de conseil,
        ne constitue pas une évaluation HAS officielle.
      </p>
    </div>
  );
}
