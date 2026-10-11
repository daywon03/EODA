import { ListChecks } from "lucide-react";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { getMatrixReview } from "@/lib/actions/criterion-matrix";
import { PageHeader } from "@/components/layout/PageHeader";
import { Callout } from "@/components/ui/callout";
import { MatrixTypeForm } from "@/components/criteres/MatrixTypeForm";
import { PromoteSuggestionButton } from "@/components/criteres/PromoteSuggestionButton";

export const metadata = { title: "Matrice des critères · EODA Conseil" };

// ─────────────────────────────────────────────────────────────────────────────
// MATRICE DOCUMENTS → CRITÈRES HAS (tranche N4, spec 04) — CABINET_ADMIN seul.
//
// La proposition du 08/10 (207 rattachements) est relue type par type, puis validée :
// c'est elle qui dit quelles pièces prouvent quel critère (onglet « Critères » des
// fiches), quelles guidelines rappeler à l'analyse, et nourrit la pré-cotation.
// ─────────────────────────────────────────────────────────────────────────────
export default async function CriterionMatrixPage() {
  await requireCabinetAdminSession();
  const review = await getMatrixReview();

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader
        title="Matrice des critères"
        subtitle="Quels documents prouvent quels critères HAS — proposition à valider, type par type"
        icon={ListChecks}
      />

      <Callout title="Une proposition, pas une décision">
        Les cases de confiance haute sont cochées d&apos;office ; les autres attendent votre avis. Rien n&apos;est
        enregistré avant « Valider ce type ». Ces rattachements valent pour toutes les structures.
      </Callout>

      {review.promotable.length > 0 && (
        <section aria-labelledby="matrix-promote" className="space-y-3">
          <h2 id="matrix-promote" className="text-xl font-bold text-ink">
            Critères confirmés sur des documents, pas encore dans la matrice
          </h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {review.promotable.map((p) => (
              <li key={p.suggestionId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  <span className="font-bold text-ink">{p.criterionCode}</span>
                  <span className="text-ink2"> → {p.documentTypeLabel}</span>
                  <span className="block text-sm text-ink2">{p.criterionLabel}</span>
                </span>
                <PromoteSuggestionButton
                  suggestionId={p.suggestionId}
                  label={`${p.criterionCode} pour ${p.documentTypeLabel}`}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="matrix-groups" className="space-y-4">
        <h2 id="matrix-groups" className="text-xl font-bold text-ink">
          Rattachements proposés ({review.groups.length} types de document)
        </h2>
        {review.groups.map((group) => (
          <MatrixTypeForm key={group.documentTypeCode} group={group} />
        ))}
      </section>

      {review.notApplicable.length > 0 && (
        <section aria-labelledby="matrix-na" className="space-y-2">
          <h2 id="matrix-na" className="text-xl font-bold text-ink">
            Non applicables à ce référentiel
          </h2>
          <p className="text-ink2">
            Ces critères sont cités par la proposition mais absents du référentiel chargé (hors périmètre SAD) :
            ils ne sont pas enregistrés.
          </p>
          <ul className="flex flex-wrap gap-2">
            {review.notApplicable.map((n) => (
              <li key={n.criterionCode} className="rounded-full border border-line px-3 py-1 text-ink">
                {n.criterionCode}
              </li>
            ))}
          </ul>
        </section>
      )}

      {review.unknownDocumentTypes.length > 0 && (
        <Callout tone="warning" title="Types de document inconnus">
          {review.unknownDocumentTypes.join(", ")} — absents de la base, ignorés.
        </Callout>
      )}
    </div>
  );
}
