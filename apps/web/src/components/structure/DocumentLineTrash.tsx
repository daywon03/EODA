"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmActionButton } from "@/components/ui/confirm-action-button";
import { hideDocumentTypeForEstablishment } from "@/lib/actions/document-type-exclusion";
import { removeDocumentType } from "@/lib/actions/document-type-removal";

// ─────────────────────────────────────────────────────────────────────────────
// LA POUBELLE D'UNE LIGNE DE « DOCUMENTS » (retour de Sandrine, 10/11/2026 : « une
// petite poubelle avec confirmation… seulement pour ce client ou pour tout le
// monde »). Deux portées, deux actions qui rejouent chacune leur règle côté serveur :
//  - « Seulement pour cette structure » : hideDocumentTypeForEstablishment (réversible) ;
//  - « Pour toutes les structures » : removeDocumentType (lignes du cabinet seulement).
// Posée au-dessus du lien de la ligne (`relative z-10`) : la cliquer n'ouvre pas le
// document.
// ─────────────────────────────────────────────────────────────────────────────

export function DocumentLineTrash({
  establishmentId,
  documentTypeId,
  label,
  forThisStructure,
  forEveryone,
}: {
  establishmentId: string;
  documentTypeId: string;
  label: string;
  forThisStructure: boolean;
  forEveryone: boolean;
}) {
  const router = useRouter();
  if (!forThisStructure && !forEveryone) return null;

  const hideHere = { label: "Seulement pour cette structure", onConfirm: () => done(hideDocumentTypeForEstablishment(establishmentId, documentTypeId)) };
  const removeEverywhere = {
    label: "Pour toutes les structures",
    onConfirm: () => done(removeDocumentType(documentTypeId)),
  };
  const [primary, ...alternatives] = [...(forThisStructure ? [hideHere] : []), ...(forEveryone ? [removeEverywhere] : [])];
  if (!primary) return null;

  async function done(pending: Promise<{ error: string } | { ok: true } | null>) {
    const result = await pending;
    if (result && "error" in result) return result;
    router.refresh();
    return null;
  }

  const question = [
    `Retirer « ${label} » ?`,
    forThisStructure &&
      "Seulement pour cette structure : la ligne disparaît de sa liste et de son portail ; elle se rétablit dans « Lignes masquées ».",
    forEveryone &&
      "Pour toutes les structures : retirée de la liste de chacune (archivée si des documents l'utilisent déjà).",
    !forEveryone && "Cette ligne vient du référentiel : elle ne se retire que pour cette structure.",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className="relative z-10">
      <ConfirmActionButton
        compact
        label="Retirer cette ligne"
        accessibleLabel={`Retirer la ligne « ${label} »`}
        icon={Trash2}
        question={question}
        confirmLabel={primary.label}
        onConfirm={primary.onConfirm}
        alternatives={alternatives}
      />
    </span>
  );
}
