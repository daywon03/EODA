import { notFound } from "next/navigation";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { getEstablishmentChecklist, type ChecklistItem } from "@/lib/actions/checklist";
import { selectReminderLabels } from "@/lib/services/reminder-service";
import { formatDate } from "@/lib/services/date-format-service";
import {
  countDocumentBuckets,
  DOCUMENT_BUCKET_LABELS,
  DOCUMENT_BUCKETS,
  DOCUMENT_CATEGORY_LABELS,
  documentRowPill,
  documentsHref,
  filterDocumentRows,
  findDocumentRow,
  flattenChecklist,
  parseDocumentFilters,
  rowsInBucket,
  type DocumentRow,
} from "@/lib/services/structure-documents-service";
import { structureHref } from "@/lib/design/structure-tabs";
import type { DocumentCategory } from "@eoda/database";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { TabsNav } from "@/components/ui/tabs-nav";
import { StatusPill } from "@/components/ui/status-pill";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DocumentReminderForm } from "@/components/etablissement/DocumentReminderForm";
import { UrlSheet } from "@/components/structure/UrlSheet";
import { DocumentSheetBody } from "@/components/structure/DocumentSheetBody";

export const metadata = { title: "Documents · EODA Conseil" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[]; q?: string | string[]; cat?: string | string[]; doc?: string | string[] }>;
};

type Row = DocumentRow<ChecklistItem>;

function columns(): DataTableColumn<Row>[] {
  return [
    {
      id: "name",
      header: "Document",
      isRowHeader: true,
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.label}</span>
          <span className="text-sm font-normal text-ink2">{DOCUMENT_CATEGORY_LABELS[row.category]}</span>
        </span>
      ),
    },
    { id: "status", header: "Statut", cell: (row) => <StatusPill pill={documentRowPill(row)} /> },
    {
      id: "version",
      header: "Version",
      cell: (row) => <span className="tabular-nums">{row.currentVersion ? `v${row.currentVersion.versionNumber}` : "—"}</span>,
    },
    {
      id: "date",
      header: "Date",
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums">
          {row.currentVersion ? formatDate(row.currentVersion.uploadedAt) : "—"}
        </span>
      ),
    },
    // « Critères couverts » et « Responsable » de la maquette arrivent avec leurs
    // tranches (N4 rattachements, N9 rôles). Ce qui se sait aujourd'hui : qui doit
    // fournir le document.
    { id: "source", header: "Fourni par", cell: (row) => (row.requestedFromClient ? "La structure" : "EODA") },
  ];
}

// Onglet Documents de la fiche structure. Compteurs, recherche et filtre sont
// DÉRIVÉS de la checklist (structure-documents-service) ; l'adresse porte l'état
// (onglet, recherche, catégorie, document ouvert), le serveur garde la main.
export default async function StructureDocumentsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const raw = await searchParams;
  const { role } = await requireEstablishmentInTenant(id);
  const checklist = await getEstablishmentChecklist(id);

  const filters = parseDocumentFilters(raw);
  const basePath = structureHref(id, "documents");
  const allRows = flattenChecklist(checklist);
  const searched = filterDocumentRows(allRows, filters);
  const counts = countDocumentBuckets(searched);
  const rows = rowsInBucket(searched, filters.bucket);

  // Le panneau : cherché dans la checklist de CETTE structure, déjà bornée au tenant.
  const docParam = Array.isArray(raw.doc) ? raw.doc[0] : raw.doc;
  const opened = docParam === undefined ? null : findDocumentRow(allRows, docParam);
  if (docParam !== undefined && !opened) notFound();

  const reminderCount = selectReminderLabels(allRows).length;
  const categories = Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[];

  return (
    <div className="space-y-4">
      <h2 className="sr-only">Documents</h2>
      <TabsNav
        label="Filtrer les documents par état"
        activeId={filters.bucket}
        tabs={DOCUMENT_BUCKETS.map((bucket) => ({
          id: bucket,
          label: DOCUMENT_BUCKET_LABELS[bucket],
          count: counts[bucket],
          href: documentsHref(basePath, { ...filters, bucket }),
        }))}
      />

      <div className="flex flex-wrap items-end gap-3">
        {/* Formulaire GET : la recherche est une adresse, pas un état de page. */}
        <form method="get" action={basePath} className="flex flex-wrap items-end gap-3" role="search">
          {filters.bucket !== "todo" && <input type="hidden" name="tab" value={filters.bucket} />}
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold text-ink">Rechercher un document</span>
            <Input name="q" defaultValue={filters.query} maxLength={100} className="w-64" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-bold text-ink">Catégorie</span>
            <Select name="cat" defaultValue={filters.category ?? ""} className="w-56">
              <option value="">Toutes</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {DOCUMENT_CATEGORY_LABELS[category]}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" variant="outline">
            Filtrer
          </Button>
        </form>
        <span className="flex-1" />
        {/* Relance = geste manuel existant (sendDocumentReminder), jamais un automate. */}
        <div className="max-w-md">
          <DocumentReminderForm establishmentId={id} missingCount={reminderCount} />
        </div>
      </div>

      <DataTable
        caption={`Documents — ${DOCUMENT_BUCKET_LABELS[filters.bucket]}`}
        columns={columns()}
        rows={rows}
        getRowKey={(row) => row.documentTypeId}
        rowHref={(row) => documentsHref(basePath, { ...filters, doc: row.documentTypeId })}
        emptyMessage="Rien dans cette liste. Les documents apparaissent ici dès que leur état change."
      />

      {opened && (
        <UrlSheet title={opened.label} closeHref={documentsHref(basePath, filters)}>
          <DocumentSheetBody item={opened} categoryLabel={DOCUMENT_CATEGORY_LABELS[opened.category]} establishmentId={id} canEditScope={role === "CABINET_ADMIN"} />
        </UrlSheet>
      )}
    </div>
  );
}
