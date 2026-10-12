"use client";

import { useState, useTransition } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { createPacActions, proposePacFromEvaluation } from "@/lib/actions/task-pac";
import type { PacProposal } from "@/lib/services/pac-proposal-service";
import { FUNCTION_LABELS } from "@/lib/services/action-item-service";
import { Button } from "@/components/ui/button";

// « Générer depuis l'auto-évaluation » : une PROPOSITION d'action par critère coté
// sous 4, que le cabinet coche avant création. Rien n'est écrit en silence.
export function PacGenerator({ establishmentId }: { establishmentId: string }) {
  const [proposals, setProposals] = useState<PacProposal[] | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function propose() {
    setMessage(null);
    startTransition(async () => setProposals(await proposePacFromEvaluation(establishmentId)));
  }

  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    data.set("establishmentId", establishmentId);
    startTransition(async () => {
      const result = await createPacActions(data);
      if ("error" in result) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setMessage({ tone: "ok", text: `${result.created} action${result.created > 1 ? "s" : ""} ajoutée${result.created > 1 ? "s" : ""} au plan.` });
      setProposals(null);
    });
  }

  return (
    <section aria-labelledby="pac-generator" className="space-y-3 rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="pac-generator" className="text-lg font-bold text-ink">
            Générer depuis l&apos;auto-évaluation
          </h3>
          <p className="text-ink2">Une action proposée par critère coté sous 4 — à valider avant création.</p>
        </div>
        <Button type="button" variant="outline" onClick={propose} disabled={isPending}>
          {isPending && proposals === null ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}
          Proposer des actions
        </Button>
      </div>

      {proposals !== null && proposals.length === 0 && (
        <p role="status" className="text-ink2">
          Aucun critère coté sous 4 sans action en cours : rien à proposer.
        </p>
      )}

      {proposals !== null && proposals.length > 0 && (
        <form onSubmit={create} className="space-y-3">
          <fieldset className="space-y-1">
            <legend className="font-bold text-ink">Propositions à vérifier</legend>
            {proposals.map((p) => (
              <label key={p.criterionId} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-soft">
                <input type="checkbox" name="criterionId" value={p.criterionId} defaultChecked className="mt-1 h-5 w-5 accent-terre" />
                <span className="min-w-0 flex-1">
                  <span className="font-bold text-ink">{p.title}</span>
                  <span className="block text-sm text-ink2">
                    {p.isImperative ? "▲ Impératif · " : ""}coté {p.score.toFixed(1).replace(".", ",")} / 4 · pilote :{" "}
                    {FUNCTION_LABELS[p.ownerFunction]}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Créer les actions cochées
          </Button>
        </form>
      )}

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-danger-text" : "text-ok-text"}>
          {message.text}
        </p>
      )}
    </section>
  );
}
