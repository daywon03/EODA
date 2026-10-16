"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { acceptSurveyActions } from "@/lib/actions/survey-plan";
import { submitWithoutReset } from "@/lib/forms/submit-without-reset";
import type { SurveyActionProposal } from "@/lib/services/survey-report-service";

// Plan d'action PROPOSÉ à partir de l'enquête : rien n'entre au plan sans être coché.
// Le serveur recalcule les propositions avant d'écrire.
type State = { error: string } | { ok: true; created: number } | null;

export function SurveyPlanForm({
  establishmentId,
  proposals,
  canWrite,
}: {
  establishmentId: string;
  proposals: SurveyActionProposal[];
  canWrite: boolean;
}) {
  const [state, formAction, isPending] = useActionState<State, FormData>(
    async (_previous, data) => acceptSurveyActions(data),
    null
  );

  return (
    <section aria-labelledby="plan-enquete-titre" className="flex flex-col gap-3 rounded-xl border-2 border-accent-fill bg-card p-5">
      <div>
        <h2 id="plan-enquete-titre" className="text-xl font-bold">Plan d&apos;action proposé</h2>
        <p className="text-ink2">À partir des questions sous 75 % de satisfaction. Cochez ce que la structure retient.</p>
      </div>
      <form method="post" onSubmit={submitWithoutReset(formAction)} className="flex flex-col gap-3">
        <input type="hidden" name="establishmentId" value={establishmentId} />
        <ul className="divide-y divide-line">
          {proposals.map((proposal) => (
            <li key={proposal.key} className="py-2.5">
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                {canWrite && (
                  <input type="checkbox" name="key" value={proposal.key} defaultChecked className="mt-1 h-5 w-5 flex-shrink-0 accent-accent-fill" />
                )}
                <span className="flex flex-col">
                  <span className="font-bold">{proposal.title}</span>
                  <span className="text-ink2">{proposal.reason}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {canWrite && (
          <Button type="submit" disabled={isPending} className="w-fit">
            {isPending ? "Ajout…" : "Ajouter au plan d'action"}
          </Button>
        )}
        {state && "error" in state && (
          <p role="alert" className="font-bold text-danger-text">{state.error}</p>
        )}
        {state && "ok" in state && (
          <p role="status" className="font-bold text-ok-text">
            {state.created} action{state.created > 1 ? "s" : ""} ajoutée{state.created > 1 ? "s" : ""} au plan d&apos;action.
          </p>
        )}
      </form>
    </section>
  );
}
