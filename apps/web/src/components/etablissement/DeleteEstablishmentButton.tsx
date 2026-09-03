"use client";

import { deleteEstablishment } from "@/lib/actions/establishment";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { Trash2 } from "lucide-react";

type Props = {
  establishmentId: string;
  establishmentName: string;
  // Icône seule, pour la carte de liste : le libellé y prendrait la place des
  // informations de la fiche. Le nom accessible reste porté par `accessibleLabel`.
  compact?: boolean;
};

export function DeleteEstablishmentButton({
  establishmentId,
  establishmentName,
  compact = false,
}: Props) {
  return (
    <ConfirmActionButton
      compact={compact}
      label="Supprimer"
      accessibleLabel={`Supprimer ${establishmentName}`}
      icon={Trash2}
      question={`Supprimer définitivement « ${establishmentName} » et tous ses documents ? Cette action est irréversible.`}
      confirmLabel="Supprimer la fiche"
      onConfirm={() => deleteEstablishment(establishmentId)}
    />
  );
}
