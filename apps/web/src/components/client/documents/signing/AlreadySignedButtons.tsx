"use client";

import { useRouter } from "next/navigation";
import { FileCheck2, Undo2 } from "lucide-react";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { declareDocumentAlreadySigned, withdrawAlreadySignedDeclaration } from "@/lib/actions/document-signature";

// « Il est déjà signé » (retour de Damon, 12/11/2026 : « certains documents sont déjà
// signés, il n'y a pas besoin de les signer ou les tamponner »). La direction le
// déclare : rien n'est posé sur le fichier, la carte cesse de proposer « Signer ».
// L'action revérifie tout (direction, accepté, version courante).

type Target = { establishmentId: string; documentTypeId: string; versionId: string; label: string };

function formOf(target: Target): FormData {
  const data = new FormData();
  data.set("establishmentId", target.establishmentId);
  data.set("documentTypeId", target.documentTypeId);
  data.set("versionId", target.versionId);
  return data;
}

export function DeclareAlreadySignedButton(target: Target) {
  const router = useRouter();
  return (
    <ConfirmActionButton
      label="Il est déjà signé"
      accessibleLabel={`Il est déjà signé : ${target.label}`}
      icon={FileCheck2}
      tone="neutral"
      appearance="link"
      align="start"
      question="Le fichier déposé porte-t-il déjà la signature et le tampon ? Il sera marqué « déjà signé » et ne vous sera plus proposé à la signature. Vous pourrez revenir en arrière."
      confirmLabel="Oui, il est déjà signé"
      onConfirm={async () => {
        const result = await declareDocumentAlreadySigned(formOf(target));
        if ("error" in result) return result;
        router.refresh();
        return null;
      }}
    />
  );
}

export function WithdrawAlreadySignedButton(target: Target) {
  const router = useRouter();
  return (
    <ConfirmActionButton
      label="Finalement, le signer ici"
      accessibleLabel={`Finalement, signer ici : ${target.label}`}
      icon={Undo2}
      tone="neutral"
      appearance="link"
      align="start"
      question="Retirer la mention « déjà signé » ? Le document vous sera de nouveau proposé à la signature."
      confirmLabel="Retirer la mention"
      onConfirm={async () => {
        const result = await withdrawAlreadySignedDeclaration(formOf(target));
        if ("error" in result) return result;
        router.refresh();
        return null;
      }}
    />
  );
}
