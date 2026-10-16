import { Loader2 } from "lucide-react";
import { PROPOSAL_KIND_LABELS, type CriterionProposal } from "@/lib/services/review-queue-service";
import type { PillSpec } from "@/lib/design/status-vocabulary";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";

// Cartes de la colonne « Analyse à vérifier ». L'état d'une proposition se lit par
// une pastille (mot + glyphe), jamais par la seule couleur d'un liseré.

const STATUS_PILLS: Record<CriterionProposal["status"], PillSpec> = {
  PENDING: { label: "À vérifier", glyph: "◔", tone: "review" },
  CONFIRMED: { label: "Accepté", glyph: "✓", tone: "ok" },
  REJECTED: { label: "Écarté", glyph: "✎", tone: "neutral" },
};

export function CriterionProposalCard({
  proposal,
  busy,
  disabled,
  onAccept,
  onCorrect,
}: {
  proposal: CriterionProposal;
  busy: boolean;
  disabled: boolean;
  onAccept: () => void;
  onCorrect: () => void;
}) {
  const isPending = proposal.status === "PENDING";
  const name = `${proposal.criterionCode} — ${proposal.criterionLabel}`;
  return (
    <li
      className={`flex flex-col gap-2 rounded-lg border p-4 ${isPending ? "border-ambre bg-paper" : "border-line bg-card"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-ink2">
          {PROPOSAL_KIND_LABELS.CRITERION}
          {proposal.isImperative && <span className="ml-2 text-danger-text">▲ Impératif</span>}
        </span>
        <StatusPill pill={STATUS_PILLS[proposal.status]} />
      </div>
      <p className="text-base font-bold text-ink">{name}</p>
      <p className="text-base text-ink2">« {proposal.justification} »</p>
      {isPending && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={disabled} onClick={onAccept} aria-label={`Accepter : ${name}`}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Accepter
          </Button>
          {/* Corriger un critère repéré, c'est dire qu'il n'est pas couvert : la
              suggestion est écartée (rejectCriterionSuggestion). Une décision ne se
              réécrit pas ensuite — d'où l'absence d'« Annuler ». */}
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={onCorrect}
            aria-label={`Corriger : écarter ${name}`}
          >
            Corriger
          </Button>
        </div>
      )}
    </li>
  );
}

export function FindingCard({ label, text }: { label: string; text: string }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-line bg-card p-4">
      <span className="text-sm font-bold text-ink2">{label}</span>
      <p className="text-base text-ink">{text}</p>
    </li>
  );
}
