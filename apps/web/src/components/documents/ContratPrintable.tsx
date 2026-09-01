import { DocumentBrandHeader } from "./DocumentBrandHeader";
import { DocumentSignatureBlocks } from "./DocumentSignatureBlocks";
import { formatDate } from "@/lib/services/date-format-service";
import { formatEuros } from "@/lib/services/price-format-service";
import { buildContractualMention, EODA_LEGAL_NAME } from "@/lib/services/document-ownership-service";
import {
  buildEodaCommitments,
  buildStructureCommitments,
  countOptionsPendingAvenant,
  describePendingAvenant,
  describeContractBasis,
  describeStructureIdentity,
  selectContractOptions,
  CONTRACT_GENERAL_TERMS_NOTICE,
  CONTRACT_INDEPENDENCE_NOTICE,
  type ContractFacts,
} from "@/lib/services/contract-service";

type Props = {
  facts: ContractFacts;
  establishmentLogo: string | null;
  issuedOn: Date;
};

// Contrat d'accompagnement — dernière pièce du parcours de conversion (§12.6).
//
// Il RÉCAPITULE le devis signé, il ne le remplace pas : les montants affichés ici
// sont ceux du devis, fermes (`formatEuros`), jamais des « à partir de » du
// catalogue. Toute la logique de sélection et de formulation vit dans
// `contract-service` (pur, testé) — ce composant ne fait que rendre.
export function ContratPrintable({ facts, establishmentLogo, issuedOn }: Props) {
  const options = selectContractOptions(facts.options);
  const pendingAvenantNotice = describePendingAvenant(countOptionsPendingAvenant(facts.options));
  const eodaCommitments = buildEodaCommitments();
  const structureCommitments = buildStructureCommitments();

  return (
    <div className="space-y-6 text-brun-ancre">
      <div className="space-y-4">
        <DocumentBrandHeader
          establishmentName={facts.establishmentName}
          establishmentLogo={establishmentLogo}
        />

        <div className="rounded-lg border-l-4 border-ambre bg-brun-ancre px-5 py-4 text-ivoire print:bg-brun-ancre">
          <p className="text-[11px] uppercase tracking-[0.18em] text-ambre">
            Accompagnement à la préparation de l&apos;évaluation qualité HAS
          </p>
          <h2 className="text-lg font-bold leading-tight">Contrat d&apos;accompagnement</h2>
          <p className="mt-1 text-xs">Établi le {formatDate(issuedOn)}</p>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 text-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-gris-mid">Le prestataire</p>
          <p className="font-semibold">{EODA_LEGAL_NAME}</p>
          <p className="text-xs text-gris-mid">
            Conseil qualité auprès des établissements et services sociaux et médico-sociaux
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gris-mid">La structure</p>
          <p className="font-semibold">{facts.establishmentName}</p>
          <p className="text-xs text-gris-mid">{describeStructureIdentity(facts)}</p>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="border-b border-gris-light pb-1 text-sm font-semibold uppercase tracking-wide">
          1 · Objet
        </h3>
        <p className="text-sm">{describeContractBasis(facts)}</p>
        {facts.hasEvaluationTargetDate && (
          <p className="text-sm">
            Échéance d&apos;évaluation visée : {formatDate(facts.hasEvaluationTargetDate)}.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="border-b border-gris-light pb-1 text-sm font-semibold uppercase tracking-wide">
          2 · Périmètre retenu
        </h3>
        <div className="rounded-lg border border-gris-light bg-ivoire/40 px-4 py-3 text-sm">
          <p className="font-semibold">Formule {facts.formuleLabel}</p>
          {facts.modulesLabel && <p className="text-xs text-gris-mid">{facts.modulesLabel}</p>}
        </div>

        {options.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-terre text-left text-xs uppercase tracking-wide text-brun-moyen">
                <th className="py-2">Prestations à la carte souscrites</th>
                <th className="py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gris-light">
              {options.map((option) => (
                <tr key={option.labelSnapshot}>
                  <td className="py-2">{option.labelSnapshot}</td>
                  <td className="py-2 text-right tabular-nums">
                    {/* Montant FERME : ces options viennent du devis signé. Les rendre
                        « à partir de » affaiblirait un engagement déjà pris. */}
                    {formatEuros(option.priceSnapshotEuros)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Ce qui n'est PAS au contrat est dit, pas tu : une option ouverte dans
            l'outil mais absente du contrat est exactement le trou que le §12.6
            demande de fermer. */}
        {pendingAvenantNotice && <p className="text-xs text-terre">{pendingAvenantNotice}</p>}

        <p className="text-xs text-gris-mid">
          Toute prestation non listée ci-dessus fait l&apos;objet d&apos;un avenant signé des deux
          parties avant son exécution.
        </p>
      </section>

      {facts.totalAmountEuros !== null && (
        <section className="space-y-2">
          <h3 className="border-b border-gris-light pb-1 text-sm font-semibold uppercase tracking-wide">
            3 · Conditions financières
          </h3>
          <div className="ml-auto max-w-xs space-y-1 rounded-lg border border-gris-light bg-ivoire/60 p-4 text-sm">
            <div className="flex justify-between border-b border-terre/30 pb-2 text-base font-bold">
              <span>Total</span>
              <span className="tabular-nums">{formatEuros(facts.totalAmountEuros)}</span>
            </div>
            {facts.depositAmountEuros !== null && (
              <div className="flex justify-between pt-1">
                <span className="text-gris-mid">
                  Acompte{facts.depositPercent !== null ? ` (${facts.depositPercent}%)` : ""}
                </span>
                <span className="tabular-nums">{formatEuros(facts.depositAmountEuros)}</span>
              </div>
            )}
            {facts.balanceAmountEuros !== null && (
              <div className="flex justify-between">
                <span className="text-gris-mid">Solde</span>
                <span className="tabular-nums">{formatEuros(facts.balanceAmountEuros)}</span>
              </div>
            )}
            {facts.installmentCount !== null && facts.installmentAmountEuros !== null && (
              <div className="flex justify-between">
                <span className="text-gris-mid">
                  {facts.installmentCount} échéance{facts.installmentCount > 1 ? "s" : ""} de
                </span>
                <span className="tabular-nums">{formatEuros(facts.installmentAmountEuros)}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gris-mid">
            Montants HT · TVA non applicable, art. 293 B du CGI · acompte à la commande, solde à la
            livraison des livrables.
          </p>
        </section>
      )}

      {facts.gratuit && facts.totalAmountEuros === null && (
        <section className="space-y-2">
          <h3 className="border-b border-gris-light pb-1 text-sm font-semibold uppercase tracking-wide">
            3 · Conditions financières
          </h3>
          <p className="text-sm">
            Accompagnement consenti à titre gracieux. Aucune contrepartie financière n&apos;est due
            par la structure au titre du présent contrat.
          </p>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="border-b border-gris-light pb-1 text-sm font-semibold uppercase tracking-wide">
          4 · Engagements d&apos;{EODA_LEGAL_NAME}
        </h3>
        <ul className="space-y-2 text-sm">
          {eodaCommitments.map((commitment) => (
            <li key={commitment.title} className="break-inside-avoid">
              <p className="font-semibold">{commitment.title}</p>
              <p className="text-gris-mid">{commitment.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="border-b border-gris-light pb-1 text-sm font-semibold uppercase tracking-wide">
          5 · Engagements de la structure
        </h3>
        <ul className="space-y-2 text-sm">
          {structureCommitments.map((commitment) => (
            <li key={commitment.title} className="break-inside-avoid">
              <p className="font-semibold">{commitment.title}</p>
              <p className="text-gris-mid">{commitment.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="border-b border-gris-light pb-1 text-sm font-semibold uppercase tracking-wide">
          6 · Indépendance et nature de la prestation
        </h3>
        <p className="text-sm">{CONTRACT_INDEPENDENCE_NOTICE}</p>
        <p className="text-xs text-gris-mid">{CONTRACT_GENERAL_TERMS_NOTICE}</p>
      </section>

      <DocumentSignatureBlocks
        counterpartyName={facts.establishmentName}
        counterpartyInstruction="Date, signature et cachet, précédées de la mention « lu et approuvé »"
      />

      <p className="border-t border-gris-light pt-4 text-xs text-gris-mid">
        {/* Mention de PRESTATION et non de paternité : sur un document contractuel,
            EODA s'engage — elle ne revendique pas la propriété d'une œuvre
            (document-ownership-service). */}
        {buildContractualMention(facts.establishmentName)}
      </p>
    </div>
  );
}
