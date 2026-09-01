import type { PricingUnit } from "@eoda/database";
import { formatDate } from "@/lib/services/date-format-service";
import { formatEuros, formatStartingPrice } from "@/lib/services/price-format-service";
import { optionCommittedAmountEuros } from "@/lib/services/devis-calculation-service";
import { buildContractualMention } from "@/lib/services/document-ownership-service";
import { DocumentBrandHeader } from "@/components/documents/DocumentBrandHeader";
import { DocumentSignatureBlocks } from "@/components/documents/DocumentSignatureBlocks";

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

// Devis imprimable — le premier document qu'un prospect reçoit d'EODA, donc celui qui
// porte l'image du cabinet (CDC §2 : « professionnaliser l'image d'EODA face aux
// prospects »).
//
// Il suit la charte comme les autres documents produits par la plateforme, et par les
// mêmes composants partagés : en-tête de marque (`DocumentBrandHeader`), emplacements
// de signature (`DocumentSignatureBlocks`), mention de PRESTATION et non de paternité
// (`buildContractualMention` — revendiquer la propriété intellectuelle d'une offre
// commerciale serait faux, cf. document-ownership-service).
//
// Le prospect n'a pas encore de fiche établissement, donc pas de logo déposé : c'est
// son NOM qui s'affiche en face de celui d'EODA. L'en-tête gère déjà ce cas, il n'y a
// rien à traiter ici.
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
      <div className="space-y-4">
        <DocumentBrandHeader
          establishmentName={prospectStructureName}
          establishmentLogo={null}
        />

        {/* Bandeau de titre à la charte : fond brun foncé « ancrage, crédibilité »,
            liseré ambre. Les couleurs de la charte ne sont pas décoratives ici — un
            devis en noir sur blanc ne se distingue pas de celui d'un concurrent. */}
        <div className="rounded-lg border-l-4 border-ambre bg-brun-ancre px-5 py-4 text-ivoire print:bg-brun-ancre">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-ambre">
                Proposition commerciale
              </p>
              <h2 className="text-lg font-bold leading-tight">Devis {number}</h2>
            </div>
            <div className="text-right text-xs leading-relaxed">
              <p>Émis le {formatDate(new Date(createdAt))}</p>
              <p className="font-semibold">
                Valable jusqu&apos;au {formatDate(new Date(validUntil))}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-gris-mid">Client</p>
        <p className="font-semibold">{prospectStructureName}</p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-terre text-left text-xs uppercase tracking-wide text-brun-moyen">
            <th className="py-2">Prestation</th>
            <th className="py-2 text-right">Montant</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gris-light/60 bg-ivoire/40">
            <td className="py-2 pl-2 font-medium">Formule {formuleLabelSnapshot}</td>
            <td className="py-2 pr-2 text-right tabular-nums">
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
                <td className="py-2 pl-2">
                  {o.labelSnapshot}
                  {isMetered ? (
                    <span className="block text-xs text-gris-mid">{unitLabel}</span>
                  ) : null}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  {isMetered ? formatEuros(committed) : unitLabel}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="ml-auto max-w-xs space-y-1 rounded-lg border border-gris-light bg-ivoire/60 p-4 text-sm">
        <div className="flex justify-between border-b border-terre/30 pb-2 text-base font-bold">
          <span>Total</span>
          <span className="tabular-nums">{formatStartingPrice({ priceEuros: totalAmountEuros })}</span>
        </div>
        <div className="flex justify-between pt-1">
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

      {/* Un devis se retourne signé : sans emplacement, Sandrine devait le retoucher à
          la main avant chaque envoi. Même bloc que l'avenant et le contrat. */}
      <DocumentSignatureBlocks counterpartyName={prospectStructureName} />

      <p className="border-t border-gris-light pt-4 text-xs text-gris-mid">
        Tarifs indicatifs HT « à partir de » · TVA non applicable, art. 293 B du CGI · acompte à la
        commande, solde à la livraison des livrables.{" "}
        {buildContractualMention(prospectStructureName)}
      </p>
    </div>
  );
}
