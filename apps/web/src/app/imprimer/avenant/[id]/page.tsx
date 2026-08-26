import { notFound } from "next/navigation";
import { getAvenantData } from "@/lib/actions/mission";
import { AvenantPrintable } from "@/components/mission/AvenantPrintable";
import { PrintButton } from "@/components/devis/PrintButton";
import { buildAvenantFileName, needsAvenant } from "@/lib/services/avenant-service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
};

// `id` = identifiant d'ÉTABLISSEMENT, comme les autres routes de mission : une
// mission n'existe que par son établissement, et la garde de `getAvenantData`
// (requireCabinetSession + filtre tenant) est la même que partout ailleurs.
export default async function ImprimerAvenantPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { auto } = await searchParams;

  const data = await getAvenantData(id);
  // Pas de mission, ou aucune option hors contrat initial : il n'y a rien à faire
  // signer. Rendre une page vide laisserait croire à un document valide.
  if (!data || !needsAvenant(data.options)) notFound();

  const issuedOn = new Date();
  const fileName = buildAvenantFileName({
    structureName: data.establishmentName,
    issuedOn,
    contractReference: data.contractReference,
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end print:hidden">
        <PrintButton fileName={fileName} auto={auto === "1"} />
      </div>
      <AvenantPrintable
        establishmentName={data.establishmentName}
        contractReference={data.contractReference}
        signedOn={data.signedOn}
        issuedOn={issuedOn}
        options={data.options}
      />
    </div>
  );
}
