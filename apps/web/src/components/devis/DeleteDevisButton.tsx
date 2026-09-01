"use client";

import { deleteDevis } from "@/lib/actions/devis";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { Trash2 } from "lucide-react";

// Ne s'affiche que sur un BROUILLON (la page décide), et l'action serveur le
// revérifie : un devis émis ne se supprime jamais, il s'annule.
export function DeleteDevisButton({ devisId, number }: { devisId: string; number: string }) {
  return (
    <ConfirmActionButton
      label="Supprimer"
      icon={Trash2}
      question={`Supprimer définitivement le brouillon ${number} ? Son numéro n'ayant jamais été émis, aucune trace n'est conservée.`}
      confirmLabel="Supprimer le brouillon"
      onConfirm={() => deleteDevis(devisId)}
    />
  );
}
