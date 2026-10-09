import { ClipboardCheck } from "lucide-react";
import { listDocumentsAwaitingReview } from "@/lib/actions/review-queue";
import type { ReviewQueueItem } from "@/lib/services/review-queue-service";
import { formatDate } from "@/lib/services/date-format-service";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "À relire · EODA Conseil" };

const COLUMNS: readonly DataTableColumn<ReviewQueueItem>[] = [
  { id: "document", header: "Document", cell: (item) => item.documentLabel, isRowHeader: true },
  { id: "structure", header: "Structure", cell: (item) => item.establishmentName },
  { id: "version", header: "Version", cell: (item) => item.versionLabel },
  { id: "uploaded", header: "Déposé le", cell: (item) => formatDate(item.uploadedAt) },
];

// File « À relire », version minimale : la liste des analyses que le client ne
// verra qu'une fois relues (analysisVisibleTo). La relecture elle-même se fait
// depuis la fiche de la structure, où vivent déjà les gestes (« analyse relue »,
// suggestions de critères). La file en trois colonnes de la maquette est la
// tranche R1.
export default async function ReviewQueuePage() {
  const { items, totalCount } = await listDocumentsAwaitingReview();
  const hiddenCount = totalCount - items.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="À relire"
        subtitle="Analyses en attente de votre relecture, de la plus ancienne à la plus récente, toutes structures."
        icon={ClipboardCheck}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Tout est relu"
          description="Aucune analyse n'attend de relecture. Les prochaines apparaîtront ici dès qu'un document sera analysé."
        />
      ) : (
        <>
          <DataTable
            caption="Documents dont l'analyse attend une relecture"
            columns={COLUMNS}
            rows={items}
            getRowKey={(item) => item.versionId}
            rowHref={(item) => item.href}
          />
          {hiddenCount > 0 && (
            <p className="text-base text-ink2">
              {hiddenCount} autre{hiddenCount > 1 ? "s" : ""} en attente, plus récent{hiddenCount > 1 ? "s" : ""} :
              ils s&apos;afficheront à mesure que la file se vide.
            </p>
          )}
        </>
      )}
    </div>
  );
}
