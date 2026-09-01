import { notFound } from "next/navigation";
import { getContractData } from "@/lib/actions/contract";
import { ContratPrintable } from "@/components/documents/ContratPrintable";
import { PrintButton } from "@/components/devis/PrintButton";
import { buildContractFileName, canIssueContract } from "@/lib/services/contract-service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
};

// `id` = identifiant d'ÉTABLISSEMENT, comme les autres routes de document de mission
// (avenant, rapport) : le contrat n'existe que par la mission, et la garde de
// `getContractData` (requireCabinetSession + filtre tenant) est la même que partout
// ailleurs. Hors périmètre ⇒ notFound(), jamais une redirection qui révélerait que
// l'identifiant existe dans un autre tenant.
export default async function ImprimerContratPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { auto } = await searchParams;

  const data = await getContractData(id);
  if (!data) notFound();

  // Sans accord chiffré, il n'y a rien à contractualiser. Rendre la page quand même
  // produirait un contrat sans montant — un document faux est pire qu'un document
  // absent (même règle que l'avenant).
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
        <PrintButton fileName={fileName} auto={auto === "1"} />
      </div>
      <ContratPrintable
        facts={data.facts}
        establishmentLogo={data.establishmentLogo}
        issuedOn={issuedOn}
      />
    </div>
  );
}
