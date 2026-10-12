import Link from "next/link";
import { generateCorrectionProposal, type CorrectionWorkspace } from "@/lib/actions/correction-proposal";
import { formatDateTime } from "@/lib/services/date-format-service";
import { Callout } from "@/components/ui/callout";
import { GestureButton } from "@/components/diagnostic/GestureButton";
import { ComplianceSideBySide } from "./ComplianceSideBySide";

// Corps de l'écran « Mettre en conformité » (N8), commun au portail client et au
// cabinet : seul le lien de retour change. La mention vient de review-mention-service
// (en autonomie : la réserve complète) ; une proposition n'est jamais « validée ».
export function CorrectionWorkspaceView({ workspace, backHref, backLabel }: { workspace: CorrectionWorkspace; backHref: string; backLabel: string }) {
  const { context, proposal } = workspace;
  const generate = generateCorrectionProposal.bind(null, context.version.id, null);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={backHref}
        className="inline-flex min-h-12 w-fit items-center rounded-[10px] border border-ink bg-card px-4 text-ink hover:bg-soft"
      >
        ← {backLabel}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-tight sm:text-[32px]">
            Mettre en conformité : {context.version.documentLabel}
          </h1>
          {proposal && <p className="mt-1.5 text-ink2">Proposition préparée le {formatDateTime(proposal.generatedAt)}.</p>}
        </div>
        {workspace.mention ? (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border-2 border-dashed border-ink2 bg-card px-2.5 py-1 font-bold">
            <span aria-hidden="true">?</span> {workspace.mention}
          </span>
        ) : (
          <span className="inline-flex items-center rounded-md border border-line bg-soft px-2.5 py-1 font-bold">
            Proposition non relue — à vérifier avant toute remise
          </span>
        )}
      </div>

      {!context.version.isCurrent && (
        <Callout tone="warning" title="Une version plus récente existe">
          Cette proposition porte sur la version {context.version.versionNumber}. Relancez la mise en conformité sur la
          dernière version déposée.
        </Callout>
      )}

      {proposal ? (
        <ComplianceSideBySide
          proposalId={proposal.id}
          proposal={proposal.content}
          originalParagraphs={workspace.originalParagraphs}
          versionNumber={context.version.versionNumber}
          criterionLabels={workspace.criterionLabels}
          appliedDecisions={proposal.applied?.decisions ?? null}
          canSave={workspace.canSave}
          documentsHref={backHref}
        />
      ) : (
        <div className="flex flex-col items-start gap-4 rounded-xl border border-line bg-card p-5">
          <p>
            La plateforme lit votre document et propose ce qu&apos;il faut y ajouter, critère par critère. Vous acceptez
            ou refusez chaque ajout ; rien n&apos;est modifié sans vous.
          </p>
          {workspace.canGenerate ? (
            <GestureButton action={generate} label="Préparer la mise en conformité" large />
          ) : (
            <p className="font-bold">{workspace.generateBlockedReason}</p>
          )}
        </div>
      )}

      {proposal && !proposal.applied && workspace.canGenerate && (
        <div className="flex flex-col items-start gap-2 border-t border-line pt-4">
          <p className="text-ink2">La proposition ne convient pas ? Une nouvelle proposition remplace celle-ci à l&apos;écran.</p>
          <GestureButton action={generate} label="Préparer une nouvelle proposition" className="bg-card text-ink ring-1 ring-ink hover:bg-soft" />
        </div>
      )}
    </div>
  );
}
