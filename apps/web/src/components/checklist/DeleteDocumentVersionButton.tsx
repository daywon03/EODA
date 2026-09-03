"use client";

import { deleteDocumentVersion } from "@/lib/actions/document";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { Trash2 } from "lucide-react";

type Props = { documentVersionId: string; filename: string };

// Suppression définitive d'une version déposée. La règle n'est pas « qui a le
// droit » mais « qui a déposé » (canDeleteVersion) — l'action serveur le revérifie.
// Habillage `link` : la ligne d'historique aligne Prévisualiser / Télécharger en
// texte, un bouton plein y ferait une marche.
export function DeleteDocumentVersionButton({ documentVersionId, filename }: Props) {
  return (
    <ConfirmActionButton
      appearance="link"
      label="Supprimer"
      accessibleLabel={`Supprimer ${filename}`}
      icon={Trash2}
      question={`Supprimer définitivement « ${filename} » ? Le fichier sera effacé du stockage. Cette action est irréversible.`}
      confirmLabel="Supprimer le fichier"
      onConfirm={() => deleteDocumentVersion(documentVersionId)}
    />
  );
}
