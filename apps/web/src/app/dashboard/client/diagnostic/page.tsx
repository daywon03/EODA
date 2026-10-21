import Link from "next/link";
import { acceptDiagnostic, getClientDiagnostic } from "@/lib/actions/diagnostic";
import { getClientPractices } from "@/lib/actions/practice";
import { getClientCriteriaEvidence } from "@/lib/actions/criteria-proof";
import { DIAGNOSTIC_DISCLAIMER } from "@/lib/services/diagnostic-service";
import { CLIENT_DOCUMENTS_PATH, CLIENT_PRACTICES_PATH } from "@/lib/design/client-navigation";
import { DiagnosticChapters, DiagnosticCounters, PriorityActions } from "@/components/diagnostic/DiagnosticSections";
import { DiagnosticValidationBanner } from "@/components/diagnostic/DiagnosticValidationBanner";
import { GestureButton } from "@/components/diagnostic/GestureButton";

export const metadata = { title: "Mon diagnostic" };

// « Mon diagnostic » (maquette Portail Client v2, N6). Tout ce qui s'y lit est DÉRIVÉ
// des critères & preuves (N4) ; seuls les deux gestes — relu par EODA, accepté par
// la structure — sont stockés. Jamais « conforme », jamais « évaluation HAS ».
export default async function ClientDiagnosticPage() {
  const [data, practices, evidence] = await Promise.all([
    getClientDiagnostic(),
    getClientPractices(),
    getClientCriteriaEvidence(),
  ]);

  if (!data) {
    return (
      <div className="space-y-3">
        <h1 className="text-[34px] font-bold">Mon diagnostic</h1>
        <p>Votre espace n&apos;est pas encore rattaché à une structure. Écrivez à EODA.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-bold">Mon diagnostic</h1>
          <p className="mt-1.5 text-xl">{data.line}</p>
        </div>
        <Link
          href={`/imprimer/diagnostic/${data.establishmentId}`}
          target="_blank"
          className="inline-flex min-h-14 items-center rounded-[10px] border-2 border-ink bg-card px-6 font-bold text-ink hover:bg-soft"
        >
          Télécharger le rapport
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-card p-5">
        <div className="flex flex-col gap-2">
          <DiagnosticValidationBanner view={data.validation} mode={data.mode} />
          <span>{data.validation.explanation}</span>
        </div>
        {data.validation.clientCanAccept && <GestureButton action={acceptDiagnostic} label="J'accepte ce diagnostic" large />}
      </div>

      <DiagnosticCounters summary={data.summary} expectedImperatives={data.expectedImperatives} />

      {practices && practices.questions.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-soft p-5">
          <div className="flex flex-col gap-1">
            <span className="text-xl font-bold">Vos pratiques</span>
            <span>
              Un document ne suffit pas. Racontez comment vous faites au quotidien : une question par critère
              impératif.
            </span>
            <span className="text-ink2 tabular-nums">{practices.progress.label}</span>
          </div>
          <Link
            href={CLIENT_PRACTICES_PATH}
            className="inline-flex min-h-14 items-center rounded-[10px] bg-ink-fill px-6 font-bold text-on-ink hover:bg-ink-fill/90"
          >
            Répondre aux questions
          </Link>
        </div>
      )}

      <PriorityActions priorities={data.priorities} depositHref={CLIENT_DOCUMENTS_PATH} />

      <DiagnosticChapters
        chapters={data.chapters}
        details={
          evidence
            ? {
                evidence,
                mode: data.mode,
                documentHref: (label) => `${CLIENT_DOCUMENTS_PATH}?q=${encodeURIComponent(label)}`,
              }
            : undefined
        }
      />

      <p className="text-base text-ink2">{DIAGNOSTIC_DISCLAIMER}</p>
    </div>
  );
}
