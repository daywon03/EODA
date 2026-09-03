"use client";

import { deleteTemplate } from "@/lib/actions/template-library";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { Trash2 } from "lucide-react";

// Ne réussit que si le modèle n'a plus aucune version — l'action serveur le
// revérifie. Ce n'est pas de la prudence de principe : une cascade emporterait les
// lignes sans retirer les fichiers du stockage, qui deviendraient des objets que plus
// aucune clé ne désigne.
export function DeleteTemplateButton({ templateId, title }: { templateId: string; title: string }) {
  return (
    <ConfirmActionButton
      label="Supprimer le modèle"
      icon={Trash2}
      question={`Supprimer la fiche « ${title} » de la bibliothèque ?`}
      confirmLabel="Supprimer"
      onConfirm={() => deleteTemplate(templateId)}
    />
  );
}
