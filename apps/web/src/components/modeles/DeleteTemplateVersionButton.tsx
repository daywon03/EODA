"use client";

import { deleteTemplateVersion } from "@/lib/actions/template-library";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { Trash2 } from "lucide-react";

type Props = { versionId: string; versionLabel: string; stageLabel: string };

// Contrairement aux pièces d'un dossier client — où chacun ne supprime que son propre
// dernier dépôt et où l'historique complet fait foi — un gabarit interne n'est la
// preuve de rien. C'est du matériau de travail, et Sandrine a demandé explicitement de
// pouvoir « ajouter, modifier, supprimer les documents vierges ».
export function DeleteTemplateVersionButton({ versionId, versionLabel, stageLabel }: Props) {
  return (
    <ConfirmActionButton
      appearance="link"
      label="Supprimer"
      accessibleLabel={`Supprimer ${stageLabel} ${versionLabel}`}
      icon={Trash2}
      question={`Supprimer ${stageLabel} ${versionLabel} ? Le fichier sera effacé du stockage. Cette action est irréversible.`}
      confirmLabel="Supprimer la version"
      onConfirm={() => deleteTemplateVersion(versionId)}
    />
  );
}
