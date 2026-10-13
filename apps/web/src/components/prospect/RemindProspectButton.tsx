"use client";

import { remindSelfServiceProspect } from "@/lib/actions/prospect-pipeline";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { BellRing } from "lucide-react";

// Relance d'une structure inscrite seule (maquette v2) : un rappel à ses comptes, sans
// contenu du diagnostic. Geste manuel, journalisé.
export function RemindProspectButton({ prospectId, structureName }: { prospectId: string; structureName: string }) {
  return (
    <ConfirmActionButton
      label="Relancer"
      accessibleLabel={`Relancer ${structureName}`}
      icon={BellRing}
      tone="neutral"
      question={`Envoyer un rappel à ${structureName} ? Un e-mail court l'invite à reprendre son diagnostic.`}
      confirmLabel="Relancer"
      onConfirm={() => remindSelfServiceProspect(prospectId)}
    />
  );
}
