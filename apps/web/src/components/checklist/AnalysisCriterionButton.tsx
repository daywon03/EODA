"use client";

import { useTransition } from "react";
import { Link2, Loader2, X } from "lucide-react";
import { addManualMatrixLinks, unlinkCriterionFromDocumentType } from "@/lib/actions/criterion-matrix";
import {
  linkedCriteriaMessage,
  unlinkCriterionQuestion,
  unlinkedCriterionMessage,
} from "@/lib/services/criterion-linker-service";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { INLINE_ACTION_CLASS } from "@/components/ui/inline-action";

// ─────────────────────────────────────────────────────────────────────────────
// Détacher / rattacher un critère DEPUIS L'ONGLET ANALYSE (retours de Sandrine,
// 09/11/2026). Les MÊMES actions serveur que CriterionLinker
// (`unlinkCriterionFromDocumentType`, `addManualMatrixLinks` — CABINET_ADMIN, recalcul
// et journal côté serveur) et les MÊMES phrases (criterion-linker-service) : aucune
// règle n'est réécrite ici. Le geste vaut pour TOUTES les structures, et le dit.
// Chargé à la demande (cabinet, administration, panneau ouvert).
// ─────────────────────────────────────────────────────────────────────────────

export function AnalysisCriterionButton({
  typeCode,
  code,
  action,
  proposed,
  onChanged,
  onError,
}: {
  typeCode: string;
  code: string;
  action: "LINK" | "UNLINK";
  // Critère proposé par la matrice : le retirer, c'est REFUSER la proposition.
  proposed: boolean;
  // Après une écriture réussie : relire la matrice et rafraîchir la fiche.
  onChanged: (message: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  if (action === "UNLINK") {
    return (
      <ConfirmActionButton
        appearance="link"
        label="Retirer ce critère du document"
        accessibleLabel={`Retirer ce critère du document : ${code}, pour toutes les structures`}
        icon={X}
        question={unlinkCriterionQuestion(code, proposed)}
        confirmLabel="Retirer"
        onConfirm={async () => {
          const result = await unlinkCriterionFromDocumentType(typeCode, code);
          if (!result) await onChanged(unlinkedCriterionMessage(code));
          return result;
        }}
      />
    );
  }

  function link() {
    startTransition(async () => {
      const result = await addManualMatrixLinks(typeCode, [code]);
      if ("error" in result) onError(result.error);
      else await onChanged(linkedCriteriaMessage(result.added));
    });
  }

  return (
    <button
      type="button"
      onClick={link}
      disabled={isPending}
      className={INLINE_ACTION_CLASS}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      Rattacher à ce document
      {/* Libellé visible en tête du nom accessible (WCAG 2.5.3), précisé pour une
          liste où tous les boutons portent le même texte. */}
      <span className="sr-only"> : critère {code}, pour toutes les structures</span>
    </button>
  );
}
