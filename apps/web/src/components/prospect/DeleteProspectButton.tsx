"use client";

import { deleteProspect } from "@/lib/actions/prospect";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { Trash2 } from "lucide-react";

type Props = { prospectId: string; structureName: string };

export function DeleteProspectButton({ prospectId, structureName }: Props) {
  return (
    <ConfirmActionButton
      label="Supprimer"
      icon={Trash2}
      // L'historique d'un prospect est append-only : le supprimer efface la frise
      // entière, commentaires et changements d'étape compris. La question le dit.
      question={`Supprimer définitivement le prospect « ${structureName} » ? Son historique d'échanges et de changements d'étape disparaît avec lui. Cette action est irréversible.`}
      confirmLabel="Supprimer le prospect"
      onConfirm={() => deleteProspect(prospectId)}
    />
  );
}
