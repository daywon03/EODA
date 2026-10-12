import Link from "next/link";
import { markDiagnosticReviewed } from "@/lib/actions/diagnostic";
import type { DiagnosticData } from "@/lib/db/read-diagnostic";
import { DiagnosticValidationBanner } from "./DiagnosticValidationBanner";
import { GestureButton } from "./GestureButton";

// Cadre « Diagnostic » de la vue d'ensemble d'une fiche (cabinet, N6). Le geste
// « Marquer le diagnostic relu » n'existe que pour une structure accompagnée dont la
// relecture n'est pas déjà à jour (diagnostic-validation-service) ; en autonomie,
// c'est la structure qui accepte seule, et le cadre le dit.
export function DiagnosticReviewCard({ data }: { data: DiagnosticData }) {
  return (
    <section aria-labelledby="overview-diagnostic" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="overview-diagnostic" className="text-xl font-bold text-ink">
          Diagnostic de la structure
        </h2>
        <Link
          href={`/imprimer/diagnostic/${data.establishmentId}`}
          target="_blank"
          className="font-bold text-accent-text hover:underline"
        >
          Voir le rapport →
        </Link>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-card p-5">
        <div className="flex flex-col gap-2">
          <p className="font-bold">{data.line}</p>
          <DiagnosticValidationBanner view={data.validation} mode={data.mode} />
          {data.mode === "AUTONOMIE" && (
            <p className="text-ink2">Structure en autonomie : pas de relecture EODA, elle accepte son diagnostic elle-même.</p>
          )}
        </div>
        {data.validation.cabinetCanReview && (
          <GestureButton action={markDiagnosticReviewed.bind(null, data.establishmentId)} label="Marquer le diagnostic relu" />
        )}
      </div>
    </section>
  );
}
