"use client";

import { deleteDevis } from "@/lib/actions/devis";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { Trash2 } from "lucide-react";

// Ne s'affiche que sur un BROUILLON (la page décide), et l'action serveur le
// revérifie : un devis émis ne se supprime jamais, il s'annule.
type Props = {
  devisId: string;
  number: string;
  // Icône seule, pour la carte de liste.
  compact?: boolean;
};

export function DeleteDevisButton({ devisId, number, compact = false }: Props) {
  return (
    <ConfirmActionButton
      compact={compact}
      label="Supprimer"
      accessibleLabel={`Supprimer le brouillon ${number}`}
      icon={Trash2}
      question={`Supprimer définitivement le brouillon ${number} ? Son numéro n'ayant jamais été émis, aucune trace n'est conservée.`}
      confirmLabel="Supprimer le brouillon"
      onConfirm={() => deleteDevis(devisId)}
    />
  );
}
