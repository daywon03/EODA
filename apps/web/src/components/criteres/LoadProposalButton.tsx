"use client";

import { useState } from "react";
import { ListPlus } from "lucide-react";
import { loadFullProposedMatrix } from "@/lib/actions/criterion-matrix";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";

// « Charger toute la proposition » (décision de Damon, 21/10/2026). Le serveur
// recalcule le plan ; ce bouton n'envoie rien d'autre que l'intention.
export function LoadProposalButton({ missing }: { missing: number }) {
  const [summary, setSummary] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <ConfirmActionButton
        label={`Charger toute la proposition (${missing} à ajouter)`}
        question={`Ajouter les ${missing} rattachements proposés qui manquent encore ? Ils vaudront pour toutes les structures. Rien n'est retiré ; un rattachement se décoche ensuite type par type.`}
        confirmLabel="Charger"
        icon={ListPlus}
        tone="neutral"
        disabled={missing === 0}
        onConfirm={async () => {
          const result = await loadFullProposedMatrix();
          if ("error" in result) return result;
          setSummary(
            `${result.added} rattachement(s) ajouté(s), ${result.alreadyLinked} déjà en place` +
              (result.skipped > 0 ? `, ${result.skipped} hors référentiel ignoré(s).` : ".")
          );
          return null;
        }}
      />
      {summary && (
        <p role="status" className="text-sm text-ok-text">
          {summary}
        </p>
      )}
    </div>
  );
}
