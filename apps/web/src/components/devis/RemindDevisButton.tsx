"use client";

import { remindDevis } from "@/lib/actions/devis-email";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { BellRing } from "lucide-react";

// Relance d'un devis envoyé (maquette v2) : un GESTE, jamais un automate. La question
// dit à qui part le rappel et ce qu'il contient — l'aperçu qu'on attend d'un envoi.
export function RemindDevisButton({
  devisId,
  number,
  structureName,
  contactEmail,
  compact = false,
}: {
  devisId: string;
  number: string;
  structureName: string;
  contactEmail: string;
  compact?: boolean;
}) {
  return (
    <ConfirmActionButton
      label="Relancer"
      accessibleLabel={`Relancer le devis ${number}`}
      icon={BellRing}
      compact={compact}
      tone="neutral"
      question={`Relancer ${structureName} au sujet du devis ${number} ? Un rappel court part à ${contactEmail}, sans pièce jointe ni montant. Vous serez en copie.`}
      confirmLabel="Relancer"
      onConfirm={() => remindDevis(devisId)}
    />
  );
}
