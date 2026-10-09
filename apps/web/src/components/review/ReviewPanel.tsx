"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  confirmAllCriterionSuggestions,
  confirmCriterionSuggestion,
  rejectCriterionSuggestion,
} from "@/lib/actions/criterion-suggestion";
import { setAnalysisReviewed } from "@/lib/actions/document";
import type { ReviewQueueEntry } from "@/lib/actions/review-queue";
import { describeReviewMention } from "@/lib/services/analysis-view-service";
import {
  PROPOSAL_KIND_LABELS,
  countPendingCriteria,
  describePending,
  type CriterionSuggestionStatus,
} from "@/lib/services/review-queue-service";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { CriterionProposalCard, FindingCard } from "./ProposalCards";

type Props = {
  entry: ReviewQueueEntry;
  // Où aller après « Marquer relu » : l'élément suivant de la file.
  nextHref: string;
  // Calculée par le serveur (date du jour) : c'est la mention que le client lira.
  todayMention: string;
};

// Colonne « Analyse à vérifier ». Aucun geste n'est réécrit ici : chaque bouton
// appelle l'action existante (criterion-suggestion.ts, setAnalysisReviewed), qui
// porte la garde, le contrôle d'appartenance et la journalisation.
export function ReviewPanel({ entry, nextHref, todayMention }: Props) {
  const router = useRouter();
  const [decided, setDecided] = useState<Record<string, CriterionSuggestionStatus>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const criteria = entry.proposals.criteria.map((c) => ({ ...c, status: decided[c.id] ?? c.status }));
  const pending = countPendingCriteria({ criteria, findings: [] });
  const pendingIds = criteria.filter((c) => c.status === "PENDING").map((c) => c.id);

  function run(key: string, action: () => Promise<{ error: string } | null>, onSuccess: () => void) {
    setError(null);
    setBusy(key);
    startTransition(async () => {
      const result = await action();
      setBusy(null);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      onSuccess();
    });
  }

  function decide(id: string, decision: "CONFIRMED" | "REJECTED") {
    run(
      id,
      () =>
        decision === "CONFIRMED"
          ? confirmCriterionSuggestion(entry.establishmentId, id)
          : rejectCriterionSuggestion(entry.establishmentId, id),
      () => setDecided((prev) => ({ ...prev, [id]: decision }))
    );
  }

  function acceptAll() {
    run(
      "all",
      () => confirmAllCriterionSuggestions(entry.establishmentId, pendingIds),
      () => setDecided((prev) => ({ ...prev, ...Object.fromEntries(pendingIds.map((id) => [id, "CONFIRMED"])) }))
    );
  }

  function markReviewed() {
    run("reviewed", () => setAnalysisReviewed(entry.versionId, true), () => {
      router.push(nextHref);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-ink2">{entry.establishmentName}</p>
        <h2 className="mt-0.5 text-xl font-bold text-ink">Analyse à vérifier</h2>
      </div>

      {!entry.hasReadableAnalysis && (
        <Callout tone="warning" title="Analyse illisible">
          Cette analyse ne contient aucun constat exploitable (appel interrompu ou résultat vide). Relancez-la
          depuis{" "}
          <Link href={`/dashboard/cabinet/etablissements/${entry.establishmentId}`} className="font-bold underline">
            la fiche de la structure
          </Link>{" "}
          avant de la marquer relue.
        </Callout>
      )}

      {criteria.length > 0 && (
        <section aria-labelledby="criteria-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="criteria-heading" className="text-base text-ink2">
              {describePending(pending)}
            </h3>
            {pending > 0 && (
              <Button type="button" variant="outline" disabled={busy !== null} onClick={acceptAll}>
                {busy === "all" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Tout accepter
              </Button>
            )}
          </div>
          <ul className="flex flex-col gap-2.5">
            {criteria.map((c) => (
              <CriterionProposalCard
                key={c.id}
                proposal={c}
                busy={busy === c.id}
                disabled={busy !== null}
                onAccept={() => decide(c.id, "CONFIRMED")}
                onCorrect={() => decide(c.id, "REJECTED")}
              />
            ))}
          </ul>
        </section>
      )}

      {entry.proposals.findings.length > 0 && (
        <section aria-labelledby="findings-heading" className="flex flex-col gap-3">
          <div>
            <h3 id="findings-heading" className="text-base font-bold text-ink">
              Constats de l&apos;analyse
            </h3>
            <p className="text-sm text-ink2">
              Restitués tels quels à la structure une fois relus. Un constat erroné se corrige dans le document,
              depuis la fiche.
            </p>
          </div>
          <ul className="flex flex-col gap-2.5">
            {entry.proposals.findings.map((f) => (
              <FindingCard key={f.key} label={PROPOSAL_KIND_LABELS[f.kind]} text={f.text} />
            ))}
          </ul>
        </section>
      )}

      {entry.hasReadableAnalysis && criteria.length === 0 && entry.proposals.findings.length === 0 && (
        <p className="text-base text-ink2">L&apos;analyse ne relève ni manque ni critère supplémentaire.</p>
      )}

      {error && (
        <p role="alert" className="text-base font-bold text-danger-text">
          {error}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2.5 border-t border-line pt-4">
        {entry.analysisReviewedAt ? (
          <p className="text-base font-bold text-ink">
            Déjà relue — la structure voit : « {describeReviewMention(entry.analysisReviewedAt)} ».
          </p>
        ) : !entry.isCurrent ? (
          <p className="text-base text-ink2">
            Cette version a été remplacée : la structure ne la verra plus, il n&apos;y a rien à marquer relu.
          </p>
        ) : (
          <>
            <p className="text-sm text-ink2">
              La structure verra : « {todayMention} ». Les critères repérés restent internes au cabinet. Valider le
              document reste un geste distinct, sur la fiche.
            </p>
            <Button type="button" size="lg" disabled={busy !== null} onClick={markReviewed} className="text-base font-bold">
              {busy === "reviewed" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Marquer relu
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
