import { notFound } from "next/navigation";
import { getConformityReportData } from "@/lib/actions/checklist";
import { ConformityReportPrintable } from "@/components/documents/ConformityReportPrintable";
import { PrintButton } from "@/components/devis/PrintButton";
import {
  buildReportFileName,
  buildReportLines,
  hasReportableContent,
} from "@/lib/services/conformity-report-service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
};

// `id` = identifiant d'établissement. La garde de `getConformityReportData`
// (requireEstablishmentInTenant) est la même que partout ailleurs.
export default async function ImprimerRapportPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { auto } = await searchParams;

  const data = await getConformityReportData(id);

  // Rien à dire : ni document manquant à signaler, ni analyse relue à restituer.
  // Produire une page vide à l'en-tête d'EODA serait pire que ne rien produire.
  if (!hasReportableContent(buildReportLines(data.items))) notFound();

  const issuedOn = new Date();
  const fileName = buildReportFileName({ structureName: data.establishmentName, issuedOn });

  return (
    <div className="space-y-6">
      <div className="flex justify-end print:hidden">
        <PrintButton fileName={fileName} auto={auto === "1"} />
      </div>
      <ConformityReportPrintable
        establishmentName={data.establishmentName}
        establishmentLogo={data.establishmentLogo}
        issuedOn={issuedOn}
        items={data.items}
      />
    </div>
  );
}
