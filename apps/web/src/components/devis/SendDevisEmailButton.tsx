"use client";

import { sendDevisEmail } from "@/lib/actions/devis";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { Mail } from "lucide-react";

type Props = {
  devisId: string;
  number: string;
  structureName: string;
  contactEmail: string | null;
};

// Remplace le brouillon `mailto:` (retour du call Sandrine/Assad Benoît, 22/09 :
// « Préparer l'e-mail n'envoie pas l'e-mail »). La question posée par
// ConfirmActionButton EST l'aperçu demandé : destinataire, numéro, pièce jointe —
// exactement ce qui manquait avant l'envoi.
export function SendDevisEmailButton({ devisId, number, structureName, contactEmail }: Props) {
  if (!contactEmail) {
    return null;
  }

  return (
    <ConfirmActionButton
      label="Envoyer le devis par e-mail"
      icon={Mail}
      question={`Envoyer le devis ${number} à ${contactEmail} (${structureName}) ? Le PDF sera joint, et vous serez mis(e) en copie.`}
      confirmLabel="Envoyer"
      onConfirm={() => sendDevisEmail(devisId)}
    />
  );
}
