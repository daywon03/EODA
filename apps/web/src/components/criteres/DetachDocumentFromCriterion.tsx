"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { unlinkCriterionFromDocumentType } from "@/lib/actions/criterion-matrix";

// Décocher un document d'un critère depuis la page Critères d'une structure (retours
// de Sandrine, 09/11/2026 : « il manque des poubelles », « la même chose depuis
// plusieurs menus »). Même action que la fiche document et la matrice : un
// rattachement proposé est refusé, un ajout à la main est retiré.
export function DetachDocumentFromCriterion({
  documentTypeCode,
  documentLabel,
  criterionCode,
}: {
  documentTypeCode: string;
  documentLabel: string;
  criterionCode: string;
}) {
  const router = useRouter();

  async function detach() {
    const result = await unlinkCriterionFromDocumentType(documentTypeCode, criterionCode);
    if (!result) router.refresh();
    return result;
  }

  return (
    <ConfirmActionButton
      appearance="link"
      label="Retirer"
      accessibleLabel={`Retirer « ${documentLabel} » des preuves du critère ${criterionCode}`}
      icon={X}
      question={`Retirer « ${documentLabel} » des preuves du critère ${criterionCode} ? Il ne sera plus attendu pour ce critère, dans toutes les structures.`}
      confirmLabel="Retirer"
      onConfirm={detach}
    />
  );
}
