import type { ChecklistItem } from "@/lib/actions/checklist";
import { documentRowPill } from "@/lib/services/structure-documents-service";
import { StatusPill } from "@/components/ui/status-pill";
import { ChecklistItemDetail } from "@/components/checklist/ChecklistItemDetail";
import { DocumentUploadButton } from "@/components/checklist/DocumentUploadButton";

// Contenu du panneau latéral d'un document (onglet Documents de la fiche). Il
// RECOMPOSE l'existant — historique et aperçu, parcours et validation
// (setDocumentValidated), analyse et critères proposés, brouillon corrigé, dépôt
// cabinet — sans en réécrire la logique : chaque geste garde son action serveur,
// sa garde et sa journalisation.
export function DocumentSheetBody({
  item,
  categoryLabel,
  establishmentId,
  canEditScope,
}: {
  item: ChecklistItem;
  categoryLabel: string;
  establishmentId: string;
  canEditScope: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-sm text-ink2">{categoryLabel}</p>
        <StatusPill pill={documentRowPill(item)} />
        {item.isConditional && item.status !== "NOT_APPLICABLE" && <p className="text-sm text-ink2">Si concerné</p>}
        {item.expectedFrequency === "ANNUAL" && !item.expiryNotice && (
          <p className="text-sm text-ink2">Fréquence annuelle attendue</p>
        )}
        {/* Périmé : dire DEPUIS QUAND, pas seulement que ça l'est. */}
        {item.expiryNotice && <p className="text-sm font-bold text-ink">{item.expiryNotice}</p>}
      </div>

      <ChecklistItemDetail
        item={item}
        establishmentId={establishmentId}
        canManageVersions
        canDeposit
        canEditScope={canEditScope}
      />

      <div className="border-t border-line pt-4">
        <DocumentUploadButton establishmentId={establishmentId} documentTypeId={item.documentTypeId} showModelSelector />
      </div>
    </div>
  );
}
