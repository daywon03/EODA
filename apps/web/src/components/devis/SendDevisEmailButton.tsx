"use client";

import { sendDevisEmail } from "@/lib/actions/devis";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { Mail } from "lucide-react";

type Props = {
  devisId: string;
  number: string;
  structureName: string;
  contactEmail: string | null;
  // Libellé court dans un tableau (« Envoyer ») ; long sur la fiche du devis.
  label?: string;
};

// Remplace le brouillon `mailto:` (retour du call du 22/09 : « Préparer l'e-mail
// n'envoie pas l'e-mail »). La question posée par ConfirmActionButton EST l'aperçu
// demandé : destinataire, numéro, pièce jointe — exactement ce qui manquait avant
// l'envoi.
export function SendDevisEmailButton({
  devisId,
  number,
  structureName,
  contactEmail,
  label = "Envoyer le devis par e-mail",
}: Props) {
  if (!contactEmail) {
    return null;
  }

  return (
    <ConfirmActionButton
      label={label}
      // Libellé court répété ligne à ligne : le nom accessible dit LEQUEL, en
      // commençant par le mot visible (WCAG 2.5.3).
      {...(label === "Envoyer" && { accessibleLabel: `Envoyer le devis ${number}` })}
      icon={Mail}
      question={`Envoyer le devis ${number} à ${contactEmail} (${structureName}) ? Le PDF sera joint, et vous serez mis(e) en copie.`}
      confirmLabel="Envoyer"
      onConfirm={() => sendDevisEmail(devisId)}
    />
  );
}
