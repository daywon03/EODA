"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { CorrectionProposal } from "@/lib/llm/correction-proposal";
import { applyCorrectionProposal } from "@/lib/actions/correction-proposal";
import {
  additionsOf,
  criterionCaption,
  describeProposalStatus,
  nextVersionLabel,
  type ProposalDecision,
} from "@/lib/services/correction-proposal-service";
import { Callout } from "@/components/ui/callout";
import { ProposalText } from "./ProposalText";

type Props = {
  proposalId: string;
  proposal: CorrectionProposal;
  originalParagraphs: string[];
  versionNumber: number;
  criterionLabels: Record<string, string>;
  appliedDecisions: Record<string, ProposalDecision> | null;
  canSave: boolean;
  documentsHref: string;
};

const BUTTON = "inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] px-4 font-bold";

// L'écran côte à côte (maquette « 07 Mettre en conformité », N8) : à gauche la version
// déposée, à droite la proposition où chaque ajout se décide (Accepter / Refuser).
// Les décisions restent ici jusqu'à « Enregistrer la version N+1 », qui les envoie au
// serveur (revalidées là-bas) avec la nouvelle version. Côte à côte à partir de
// 1024 px ; en dessous, l'original puis la proposition, empilés.
export function ComplianceSideBySide(props: Props) {
  const router = useRouter();
  const labels = useMemo(() => new Map(Object.entries(props.criterionLabels)), [props.criterionLabels]);
  const additions = additionsOf(props.proposal);
  const locked = props.appliedDecisions !== null;
  const [decisions, setDecisions] = useState<Record<string, ProposalDecision>>(props.appliedDecisions ?? {});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const decisionMap = new Map(Object.entries(decisions));

  const decide = (id: string, value: ProposalDecision | null) =>
    setDecisions((current) => {
      const next = { ...current };
      if (value) next[id] = value;
      else delete next[id];
      return next;
    });

  function acceptAll() {
    setDecisions((current) => {
      const next = { ...current };
      for (const a of additions) if (!next[a.id]) next[a.id] = "ACCEPTE";
      return next;
    });
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await applyCorrectionProposal(props.proposalId, decisions);
      if ("error" in result) setError(result.error);
      else {
        setSaved(result.versionNumber);
        router.refresh();
      }
    });
  }

  const exportBase = `/api/documents/proposals/${props.proposalId}`;

  return (
    <div className="flex flex-col gap-5">
      <p className="text-lg" aria-live="polite">
        {describeProposalStatus(props.proposal, decisionMap)}
      </p>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-base">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-5 w-8 rounded bg-ok-soft ring-2 ring-ok-text" />
          Ajout proposé
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className="h-5 w-8 rounded border-2 border-dashed border-ink2 bg-card" />À compléter par
          vous
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="col-original" className="min-w-0 rounded-xl border border-line bg-card p-5">
          <h2 id="col-original" className="mb-3 text-lg font-bold text-ink2">
            Votre document · version {props.versionNumber}
          </h2>
          <div className="space-y-3 break-words">
            {props.originalParagraphs.length === 0 ? (
              <p className="text-ink2">Aucun texte n&apos;a pu être lu dans ce document.</p>
            ) : (
              props.originalParagraphs.map((p, i) => <ProposalText key={i} text={p} />)
            )}
          </div>
        </section>

        <section aria-labelledby="col-proposed" className="min-w-0 rounded-xl border-2 border-ink bg-card p-5">
          <h2 id="col-proposed" className="mb-3 text-lg font-bold">
            Version proposée
          </h2>
          <div className="space-y-3 break-words">
            {props.proposal.segments.map((segment, i) => {
              if (segment.kind === "ORIGINAL") return <ProposalText key={i} text={segment.text} />;
              const decision = decisions[segment.id];
              return (
                <div
                  key={segment.id}
                  className={`space-y-2 rounded-lg p-3 ring-2 ${decision === "REFUSE" ? "bg-soft ring-line" : "bg-ok-soft ring-ok-text"}`}
                >
                  <div className={decision === "REFUSE" ? "text-ink2 line-through" : ""}>
                    <ProposalText text={segment.text} />
                  </div>
                  <p className="font-bold">{criterionCaption(segment, labels)}</p>
                  <p className="text-base text-ink2">{segment.reason}</p>
                  {segment.manualQuote && (
                    <blockquote className="text-base italic text-ink2">Manuel HAS : « {segment.manualQuote} »</blockquote>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {decision ? (
                      <>
                        <span className="font-bold">
                          <span aria-hidden="true">{decision === "ACCEPTE" ? "✓ " : "✕ "}</span>
                          {decision === "ACCEPTE" ? "Accepté" : "Refusé"}
                        </span>
                        {!locked && (
                          <button type="button" className={`${BUTTON} border border-ink bg-card text-ink hover:bg-soft`} onClick={() => decide(segment.id, null)}>
                            Changer
                          </button>
                        )}
                      </>
                    ) : (
                      !locked && (
                        <>
                          <button type="button" className={`${BUTTON} border border-ink bg-card text-ink hover:bg-soft`} onClick={() => decide(segment.id, "REFUSE")}>
                            Refuser
                          </button>
                          <button type="button" className={`${BUTTON} bg-ink-fill text-on-ink hover:bg-ink-fill/90`} onClick={() => decide(segment.id, "ACCEPTE")}>
                            Accepter
                          </button>
                        </>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {error && (
        <p role="alert" className="font-bold text-danger-text">
          {error}
        </p>
      )}
      {(saved !== null || locked) && (
        <Callout tone="success" role={saved !== null ? "alert" : "note"} title="Nouvelle version enregistrée">
          La version d&apos;origine est conservée. Téléchargez le document annoté et le rapport des changements pour
          votre archive.
        </Callout>
      )}

      <div className="flex flex-wrap justify-end gap-3">
        <a href={`${exportBase}/annote`} className={`${BUTTON} border border-ink bg-card text-ink hover:bg-soft`}>
          Télécharger en Word
        </a>
        <a href={`${exportBase}/rapport`} className={`${BUTTON} border border-ink bg-card text-ink hover:bg-soft`}>
          Rapport des changements
        </a>
        {!locked && saved === null && (
          <>
            <button type="button" onClick={acceptAll} className={`${BUTTON} border-2 border-ink bg-card text-ink hover:bg-soft`}>
              Accepter tout
            </button>
            {props.canSave && (
              <button
                type="button"
                onClick={save}
                disabled={isPending}
                className={`${BUTTON} bg-accent-fill text-on-accent hover:bg-accent-fill/90 disabled:opacity-60`}
              >
                {isPending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
                {nextVersionLabel(props.versionNumber)}
              </button>
            )}
          </>
        )}
        {(locked || saved !== null) && (
          <Link href={props.documentsHref} className={`${BUTTON} bg-ink-fill text-on-ink hover:bg-ink-fill/90`}>
            Retour aux documents
          </Link>
        )}
      </div>
    </div>
  );
}
