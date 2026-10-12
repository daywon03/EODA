import { getDiagnosticForPrint } from "@/lib/actions/diagnostic";
import { DIAGNOSTIC_DISCLAIMER } from "@/lib/services/diagnostic-service";
import { buildEodaFileName } from "@/lib/services/document-naming-service";
import { formatDate } from "@/lib/services/date-format-service";
import { PrintButton } from "@/components/devis/PrintButton";
import { EodaLockup } from "@/components/layout/EodaLogo";
import { DiagnosticChapters, DiagnosticCounters, PriorityActions } from "@/components/diagnostic/DiagnosticSections";

export const metadata = { title: "Rapport de diagnostic · EODA Conseil" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ auto?: string }> };

// Rapport de diagnostic imprimable (N6). `id` = identifiant d'établissement, non
// fiable : la garde (requireEstablishmentAccess, dans getDiagnosticForPrint) vaut
// pour les deux côtés — lien EstablishmentUser pour la structure, tenant pour le
// cabinet — et répond notFound() hors périmètre. L'accès est journalisé.
export default async function ImprimerDiagnosticPage({ params, searchParams }: Props) {
  const [{ id }, { auto }] = await Promise.all([params, searchParams]);
  const data = await getDiagnosticForPrint(id);
  const issuedOn = new Date();
  const fileName = buildEodaFileName({
    issuedOn,
    type: "DIAGNOSTIC",
    clientName: data.establishmentName,
    objet: "Rapport-de-diagnostic",
    audience: "Externe",
    extension: "pdf",
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-end print:hidden">
        <PrintButton fileName={fileName} auto={auto === "1"} />
      </div>
      <article className="space-y-7 text-ink">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <EodaLockup width={180} />
          {data.establishmentLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI déposée par le cabinet
            <img src={data.establishmentLogo} alt={data.establishmentName} className="h-14 max-w-[160px] object-contain" />
          ) : (
            <span className="font-bold">{data.establishmentName}</span>
          )}
        </header>
        <div>
          <h1 className="text-3xl font-bold">Rapport de diagnostic — {data.establishmentName}</h1>
          <p className="mt-1 text-ink2">Édité le {formatDate(issuedOn)}</p>
          <p className="mt-3 text-lg">{data.line}</p>
        </div>
        <p className="rounded-xl border-2 border-dashed border-ink2 p-4 font-bold">
          {data.validation.mention}
          {data.validation.acceptedLabel ? ` · ${data.validation.acceptedLabel}` : ""}
        </p>
        <DiagnosticCounters summary={data.summary} expectedImperatives={data.expectedImperatives} />
        <PriorityActions priorities={data.priorities} depositHref={null} />
        <DiagnosticChapters chapters={data.chapters} printable />
        <footer className="border-t border-line pt-4 text-base text-ink2">{DIAGNOSTIC_DISCLAIMER}</footer>
      </article>
    </div>
  );
}
