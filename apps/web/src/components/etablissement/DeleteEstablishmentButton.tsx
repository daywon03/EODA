"use client";

import { deleteEstablishment } from "@/lib/actions/establishment";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { Trash2 } from "lucide-react";

type Props = { establishmentId: string; establishmentName: string };

export function DeleteEstablishmentButton({ establishmentId, establishmentName }: Props) {
  return (
    <ConfirmActionButton
      label="Supprimer"
      icon={Trash2}
      question={`Supprimer définitivement « ${establishmentName} » et tous ses documents ? Cette action est irréversible.`}
      confirmLabel="Supprimer la fiche"
      onConfirm={() => deleteEstablishment(establishmentId)}
    />
  );
}
