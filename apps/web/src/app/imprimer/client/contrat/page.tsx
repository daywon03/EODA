import { notFound } from "next/navigation";
import { getOwnContract } from "@/lib/actions/client-documents";
import { ContratPrintable } from "@/components/documents/ContratPrintable";
import { PrintButton } from "@/components/devis/PrintButton";
import { buildContractFileName, canIssueContract } from "@/lib/services/contract-service";

export const metadata = { title: "Mon contrat d'accompagnement · EODA Conseil" };

// Le contrat, vu par la structure qu'il engage. Même remarque que pour le devis :
// aucun identifiant dans l'URL, tout est résolu depuis la session.
//
// `canIssueContract` s'applique ICI AUSSI, et pas seulement côté cabinet : sans
// accord chiffré, il n'y a rien à contractualiser, et rendre la page produirait un
// contrat sans montant. Un document faux est pire qu'un document absent — et un
// client ne saurait pas que celui qu'il lit est incomplet.
export default async function ImprimerMonContratPage() {
  const data = await getOwnContract();
  if (!data) notFound();
  if (!canIssueContract(data.facts)) notFound();

  const issuedOn = new Date();
  const fileName = buildContractFileName({
    structureName: data.facts.establishmentName,
    issuedOn,
    devisNumber: data.facts.devisNumber,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end print:hidden">
        <PrintButton fileName={fileName} />
      </div>
      <ContratPrintable
        facts={data.facts}
        establishmentLogo={data.establishmentLogo}
        issuedOn={issuedOn}
      />
    </div>
  );
}
