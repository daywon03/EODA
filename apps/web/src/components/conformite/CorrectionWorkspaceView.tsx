import Link from "next/link";
import type { ReactNode } from "react";
import { PanelRightClose, Sparkles } from "lucide-react";
import { generateCorrectionProposal, type CorrectionWorkspace } from "@/lib/actions/correction-proposal";
import { formatDateTime } from "@/lib/services/date-format-service";
import { Callout } from "@/components/ui/callout";
import { GestureButton } from "@/components/diagnostic/GestureButton";
import { ComplianceSideBySide } from "./ComplianceSideBySide";

// Corps de l'écran « Mettre en conformité » (N8), commun au portail client et au
// cabinet : seul le lien de retour change. La mention vient de review-mention-service
// (en autonomie : la réserve complète) ; une proposition n'est jamais « validée ».
//
// Côté cabinet, `assistant` ajoute le panneau de l'assistant À DROITE (11/11/2026,
// « comme VS Code ») : le document au centre, la conversation à côté. Le panneau
// s'ouvre et se ferme par l'adresse (`?assistant=1`), sans JavaScript ; l'assistant
// garde ses propres gardes et ses crédits. Le portail de la structure ne le passe pas.
export type WorkspaceAssistant = { open: boolean; openHref: string; closeHref: string; panel: ReactNode };

export function CorrectionWorkspaceView({
  workspace,
  backHref,
  backLabel,
  assistant,
}: {
  workspace: CorrectionWorkspace;
  backHref: string;
  backLabel: string;
  assistant?: WorkspaceAssistant | undefined;
}) {
  const body = <WorkspaceBody workspace={workspace} backHref={backHref} backLabel={backLabel} assistant={assistant} />;
  if (!assistant?.open) return body;
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="min-w-0 flex-[999_1_560px]">{body}</div>
      <aside
        aria-label="Assistant"
        className="w-full min-w-0 flex-[1_1_360px] lg:sticky lg:top-4 lg:max-w-[420px]"
      >
        <div className="mb-2 flex justify-end">
          <Link
            href={assistant.closeHref}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-ink2 hover:bg-soft hover:text-ink"
          >
            <PanelRightClose className="h-4 w-4" aria-hidden="true" />
            Fermer l&apos;assistant
          </Link>
        </div>
        {assistant.panel}
      </aside>
    </div>
  );
}

function WorkspaceBody({
  workspace,
  backHref,
  backLabel,
  assistant,
}: {
  workspace: CorrectionWorkspace;
  backHref: string;
  backLabel: string;
  assistant?: WorkspaceAssistant | undefined;
}) {
  const { context, proposal } = workspace;
  const generate = generateCorrectionProposal.bind(null, context.version.id, null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex min-h-12 w-fit items-center rounded-[10px] border border-ink bg-card px-4 text-ink hover:bg-soft"
        >
          ← {backLabel}
        </Link>
        {assistant && !assistant.open && (
          <Link
            href={assistant.openHref}
            className="inline-flex min-h-12 w-fit items-center gap-2 rounded-[10px] border border-ink bg-ink-fill px-4 font-bold text-on-ink hover:opacity-90"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Assistant
          </Link>
        )}
      </div>

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
