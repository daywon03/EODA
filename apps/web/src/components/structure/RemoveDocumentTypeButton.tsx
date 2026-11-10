"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { removeDocumentType } from "@/lib/actions/document-type-removal";

// « Retirer cette ligne » (retours de Sandrine, 09/11/2026 : « il manque des
// poubelles »). Affiché seulement pour une ligne créée par le cabinet
// (canRemoveDocumentType) ; le serveur rejoue la règle et choisit : suppression si
// la ligne n'a jamais servi, archivage sinon. La question le dit avant le clic.
export function RemoveDocumentTypeButton({
  documentTypeId,
  label,
  closeHref,
}: {
  documentTypeId: string;
  label: string;
  // Où revenir une fois la ligne retirée : le panneau d'une ligne disparue n'a plus d'objet.
  closeHref: string;
}) {
  const router = useRouter();

  async function remove() {
    const result = await removeDocumentType(documentTypeId);
    if ("error" in result) return result;
    router.replace(closeHref, { scroll: false });
    router.refresh();
    return null;
  }

  return (
    <ConfirmActionButton
      tone="destructive"
      align="start"
      label="Retirer cette ligne"
      accessibleLabel={`Retirer la ligne « ${label} » de la liste`}
      icon={Trash2}
      question={`Retirer « ${label} » de la liste de toutes les structures ? Si des documents l'utilisent déjà, la ligne est archivée : elle disparaît des listes, leurs versions restent dans l'historique. Sinon, elle est supprimée.`}
      confirmLabel="Retirer la ligne"
      onConfirm={remove}
    />
  );
}
