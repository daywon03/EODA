import { formatDate } from "@/lib/services/date-format-service";
import { buildContractualMention } from "@/lib/services/document-ownership-service";
import { DocumentBrandHeader } from "@/components/documents/DocumentBrandHeader";
import { formatStartingPrice } from "@/lib/services/price-format-service";
import {
  avenantStartingTotalEuros,
  describeContractReference,
  selectAvenantLines,
  type MissionOptionLine,
} from "@/lib/services/avenant-service";

type Props = {
  establishmentName: string;
  establishmentLogo: string | null;
  contractReference: string | null;
  signedOn: Date | null;
  issuedOn: Date;
  options: MissionOptionLine[];
};



// Avenant au contrat d'accompagnement — options souscrites hors contrat initial
// (§12.6). Le document CONSTATE : ce qui s'ajoute, à quel prix, et sous quelles
// conditions (celles du contrat initial, inchangées). Il n'écrit aucune clause
// nouvelle : produire du droit à la place de Sandrine n'est pas le rôle de l'outil.
export function AvenantPrintable({
  establishmentName,
  establishmentLogo,
  contractReference,
  signedOn,
  issuedOn,
  options,
}: Props) {
  const lines = selectAvenantLines(options);
  const startingTotal = avenantStartingTotalEuros(options);

  return (
    <div className="space-y-6 text-brun-ancre">
      <div className="space-y-4 border-b border-gris-light pb-4">
        <DocumentBrandHeader
          establishmentName={establishmentName}
          establishmentLogo={establishmentLogo}
        />
        <div>
          <h2 className="text-lg font-bold">Avenant au contrat d&apos;accompagnement</h2>
          <p className="text-sm text-gris-mid">Établi le {formatDate(issuedOn)}</p>
        </div>
      </div>

      <div>
        <p className="text-xs text-gris-mid uppercase tracking-wide">Client</p>
        <p className="text-sm font-semibold">{establishmentName}</p>
      </div>

      <p className="text-sm">{describeContractReference({ contractReference, signedOn })}</p>

      <div>
        <p className="text-xs text-gris-mid uppercase tracking-wide mb-2">
          Prestations ajoutées au périmètre
        </p>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-gris-light">
            {lines.map((line) => (
              <tr key={line.catalogueOptionId}>
                <td className="py-2 pr-4">{line.labelSnapshot}</td>
                <td className="py-2 text-right tabular-nums whitespace-nowrap">
                  {/* « À partir de », jamais un montant ferme : ces prix viennent du
                      catalogue et non d'un devis signé. Les rendre fermes
                      inventerait un engagement que personne n'a chiffré
                      (CLAUDE.md §7). */}
                  {formatStartingPrice({
                    priceEuros: line.priceSnapshotEuros,
                    pricingUnit: line.pricingUnitSnapshot,
                    priceMaxEuros: line.priceMaxSnapshotEuros,
                    minQuantity: line.minQuantitySnapshot,
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-1 text-sm ml-auto max-w-xs">
        <div className="flex justify-between font-semibold text-base border-t border-gris-light pt-2">
          <span>Total indicatif</span>
          <span className="tabular-nums">{formatStartingPrice({ priceEuros: startingTotal })}</span>
        </div>
      </div>

      {/* Un avenant se signe : sans emplacement de signature, le document ne vaut
          rien et Sandrine devrait le retoucher à la main avant chaque envoi. */}
      <div className="grid grid-cols-2 gap-8 pt-8 text-sm">
        <div>
          <p className="text-xs text-gris-mid">Pour EODA Conseil</p>
          <p className="mt-1 text-xs text-gris-mid">Date et signature</p>
          <div className="h-20 border-b border-gris-light" />
        </div>
        <div>
          <p className="text-xs text-gris-mid">Pour {establishmentName}</p>
          <p className="mt-1 text-xs text-gris-mid">
            Date, signature et cachet, précédées de la mention « bon pour accord »
          </p>
          <div className="h-20 border-b border-gris-light" />
        </div>
      </div>

      <p className="text-xs text-gris-mid border-t border-gris-light pt-4">
        Tarifs indicatifs « à partir de » · TVA non applicable, art. 293 B du CGI · les
        conditions du contrat initial demeurent applicables pour tout ce que le présent
        avenant ne modifie pas.
        {" "}
        {/* Mention de PRESTATION, pas de paternité : sur un document contractuel, EODA
            s'engage — elle ne revendique pas la propriété d'une œuvre. */}
        {buildContractualMention(establishmentName)}
      </p>
    </div>
  );
}
