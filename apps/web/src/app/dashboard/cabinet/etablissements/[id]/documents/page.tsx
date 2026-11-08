import { notFound } from "next/navigation";
import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { hasCabinetCapability } from "@/lib/auth/capabilities";
import { getEstablishmentChecklist, type ChecklistItem } from "@/lib/actions/checklist";
import { selectReminderLabels } from "@/lib/services/reminder-service";
import { formatDate } from "@/lib/services/date-format-service";
import {
  countDocumentBuckets,
  DOCUMENT_BUCKET_LABELS,
  DOCUMENT_BUCKETS,
  DOCUMENT_CATEGORY_LABELS,
  documentProviderLabel,
  documentRowPill,
  documentsHref,
  filterDocumentRows,
  findDocumentRow,
  flattenChecklist,
  parseDocumentFilters,
  rowsInBucket,
  sortDocumentRows,
  documentColumnOptions,
  filterDocumentColumns,
  type DocumentColumnFilter,
  type DocumentFilters,
  type DocumentRow,
  type DocumentSort,
} from "@/lib/services/structure-documents-service";
import { structureHref } from "@/lib/design/structure-tabs";
import type { DocumentCategory } from "@eoda/database";
import { DataTable, type DataTableColumn, type DataTableFilterMenu, type DataTableSortMenu } from "@/components/ui/data-table";
import { filterMenuFor, sortMenuFor } from "@/components/ui/data-table-menus";
import { TabsNav } from "@/components/ui/tabs-nav";
import { StatusPill } from "@/components/ui/status-pill";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DocumentReminderForm } from "@/components/etablissement/DocumentReminderForm";
import { DocumentWorkspace, type WorkspaceEntry } from "@/components/structure/DocumentWorkspace";
import { DocumentSheetBody } from "@/components/structure/DocumentSheetBody";
import { NewDocumentTypeForm } from "@/components/checklist/NewDocumentTypeForm";
import { normalizeCriterionQuery } from "@/lib/services/document-type-creation-service";
import { groupRowsByFolder } from "@/lib/services/document-folder-service";
import { listDocumentFolders } from "@/lib/actions/document-folder";
import { DocumentFolderManager } from "@/components/structure/lazy-document-panels";
import { Folder } from "lucide-react";
import { FolderDetails } from "@/components/structure/FolderDetails";

export const metadata = { title: "Documents" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    tab?: string | string[];
    q?: string | string[];
    cat?: string | string[];
    tri?: string | string[];
    statut?: string | string[];
    fourni?: string | string[];
    version?: string | string[];
    doc?: string | string[];
    // Venu de l'onglet Critères : « Ajouter un document à ce critère ».
    critere?: string | string[];
  }>;
};

type Row = DocumentRow<ChecklistItem>;

// Menus de colonne façon Excel (call du 29/10/2026) : trier et filtrer sans taper.
// Chaque entrée est une ADRESSE (documentsHref) — la page serveur fait le travail.
type MenuContext = { basePath: string; filters: DocumentFilters; rows: readonly Row[] };

function sortMenu(context: MenuContext, asc: DocumentSort, desc: DocumentSort, ascLabel: string, descLabel: string): DataTableSortMenu {
  return sortMenuFor(context.filters.sort, { asc, desc, ascLabel, descLabel }, (sort) =>
    documentsHref(context.basePath, { ...context.filters, sort })
  );
}

function filterMenu(context: MenuContext, column: DocumentColumnFilter): DataTableFilterMenu {
  return filterMenuFor(documentColumnOptions(context.rows, column), context.filters.columns?.[column], (value) => {
    const columns = { ...context.filters.columns };
    if (value === undefined) delete columns[column];
    else columns[column] = value;
    return documentsHref(context.basePath, { ...context.filters, columns });
  });
}

function columns(context: MenuContext): DataTableColumn<Row>[] {
  return [
    {
      id: "name",
      header: "Document",
      isRowHeader: true,
      menu: { sort: sortMenu(context, "nom", "nom-desc", "De A à Z", "De Z à A") },
      cell: (row) => (
        <span className="flex flex-col">
          <span>{row.label}</span>
          <span className="text-sm font-normal text-ink2">{DOCUMENT_CATEGORY_LABELS[row.category]}</span>
        </span>
      ),
    },
    {
      id: "status",
      header: "Statut",
      menu: { filter: filterMenu(context, "statut") },
      cell: (row) => <StatusPill pill={documentRowPill(row)} />,
    },
    {
      id: "version",
      header: "Version",
      menu: {
        sort: sortMenu(context, "version", "version-desc", "Version la plus basse d'abord", "Version la plus haute d'abord"),
        filter: filterMenu(context, "version"),
      },
      cell: (row) => <span className="tabular-nums">{row.currentVersion ? `v${row.currentVersion.versionNumber}` : "—"}</span>,
    },
    {
      id: "date",
      header: "Date",
      menu: { sort: sortMenu(context, "date", "date-desc", "Plus ancien d'abord", "Plus récent d'abord") },
      cell: (row) => (
        <span className="whitespace-nowrap tabular-nums">
          {row.currentVersion ? formatDate(row.currentVersion.uploadedAt) : "—"}
        </span>
      ),
    },
    // Qui a FOURNI le document — l'auteur du dépôt, pas le réglage du type (call du
    // 18/10/2026) ; sans dépôt, qui doit le fournir.
    { id: "source", header: "Fourni par", menu: { filter: filterMenu(context, "fourni") }, cell: (row) => documentProviderLabel(row) },
  ];
}

// Onglet Documents de la fiche structure. Compteurs, recherche et filtre sont
// DÉRIVÉS de la checklist (structure-documents-service) ; l'adresse porte l'état
// (onglet, recherche, catégorie, document ouvert), le serveur garde la main.
export default async function StructureDocumentsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const raw = await searchParams;
  const { role } = await requireEstablishmentInTenant(id, "READ");
  const [checklist, folders] = await Promise.all([getEstablishmentChecklist(id), listDocumentFolders()]);

  const filters = parseDocumentFilters(raw);
  const basePath = structureHref(id, "documents");
  const allRows = flattenChecklist(checklist);
  const searched = filterDocumentRows(allRows, filters);
  const counts = countDocumentBuckets(filterDocumentColumns(searched, filters.columns));
  // Les menus proposent ce que l'onglet contient (avant les filtres de colonne : on
  // doit pouvoir passer d'un statut à l'autre sans tout effacer).
  const bucketRows = rowsInBucket(searched, filters.bucket);
  const rows = sortDocumentRows(filterDocumentColumns(bucketRows, filters.columns), filters.sort);
  const menuContext: MenuContext = { basePath, filters, rows: bucketRows };
  // Dossiers (call du 29/10/2026) : un pavé par dossier, ses lignes en dessous ; le
  // reste à plat. Mêmes lignes, mêmes filtres — seul le rangement change.
  const foldered = groupRowsByFolder(rows, folders);

  // Le panneau : cherché dans la checklist de CETTE structure, déjà bornée au tenant.
  const docParam = Array.isArray(raw.doc) ? raw.doc[0] : raw.doc;
  // Un numéro de critère seulement (« 3.14.2 ») : rien d'autre ne passe dans le formulaire.
  const criterionParam = normalizeCriterionQuery((Array.isArray(raw.critere) ? raw.critere[0] : raw.critere) ?? "");
  const initialCriterionCode = /^\d+(\.\d+)*$/.test(criterionParam) ? criterionParam : undefined;
  const opened = docParam === undefined ? null : findDocumentRow(allRows, docParam);
  if (docParam !== undefined && !opened) notFound();

  const reminderCount = selectReminderLabels(allRows).length;
  const categories = Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[];
  // La liste vaut pour toutes les structures : la compléter est un réglage de cabinet.
  const canManageList = hasCabinetCapability(role, "CABINET_SETTINGS");

  // Ce que la visionneuse doit savoir AVANT la réponse du serveur : un intitulé et la
  // version à afficher. Rien de plus — le détail arrive avec le rendu serveur.
  const entries: Record<string, WorkspaceEntry> = Object.fromEntries(
    allRows.map((row) => [
      row.documentTypeId,
      {
        title: row.label,
        versionId: row.currentVersion?.id ?? null,
        originalFilename: row.currentVersion?.originalFilename ?? null,
      },
    ])
  );

  return (
    <DocumentWorkspace
      entries={entries}
      serverOpenedId={opened?.documentTypeId ?? null}
      closeHref={documentsHref(basePath, filters)}
      panel={
        opened ? (
          <DocumentSheetBody
            item={opened}
            categoryLabel={DOCUMENT_CATEGORY_LABELS[opened.category]}
            establishmentId={id}
            canEditScope={canManageList}
            folders={folders}
          />
        ) : null
      }
    >
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
          {/* Tri et filtres de colonne (menus des en-têtes) gardés à la recherche. */}
          {filters.sort && <input type="hidden" name="tri" value={filters.sort} />}
          {Object.entries(filters.columns ?? {}).map(([column, value]) => (
            <input key={column} type="hidden" name={column} value={value} />
          ))}
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

      {canManageList && (
        <div className="flex flex-wrap items-start gap-2">
          <NewDocumentTypeForm
            key={initialCriterionCode ?? "liste"}
            establishmentId={id}
            documentsPath={basePath}
            folders={folders}
            {...(initialCriterionCode ? { initialCriterionCode } : {})}
          />
          <DocumentFolderManager folders={folders} />
        </div>
      )}

      {foldered.folders.map((folder) => (
        // Fermé par défaut ; ouvert quand on cherche, ou quand le document ouvert y est —
        // et il reste ouvert à la sortie du document (FolderDetails garde l'état).
        <FolderDetails
          key={folder.id}
          forceOpen={filters.query !== "" || folder.rows.some((row) => row.documentTypeId === opened?.documentTypeId)}
          className="group rounded-xl border border-line bg-card"
          summary={<summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-3 text-base font-bold text-ink hover:bg-soft">
            <Folder className="h-4 w-4 flex-shrink-0 text-accent-text" aria-hidden="true" />
            {folder.label}
            <span className="font-normal text-ink2">
              · {folder.rows.length} document{folder.rows.length > 1 ? "s" : ""}
            </span>
          </summary>}
        >
          <DataTable
            caption={`${folder.label} — ${DOCUMENT_BUCKET_LABELS[filters.bucket]}`}
            columns={columns(menuContext)}
            rows={folder.rows}
            getRowKey={(row) => row.documentTypeId}
            rowHref={(row) => documentsHref(basePath, { ...filters, doc: row.documentTypeId })}
            className="rounded-t-none border-x-0 border-b-0"
          />
        </FolderDetails>
      ))}

      {(foldered.loose.length > 0 || foldered.folders.length === 0) && (
        <DataTable
          caption={`Documents — ${DOCUMENT_BUCKET_LABELS[filters.bucket]}`}
          columns={columns(menuContext)}
          rows={foldered.loose}
          getRowKey={(row) => row.documentTypeId}
          rowHref={(row) => documentsHref(basePath, { ...filters, doc: row.documentTypeId })}
          emptyMessage="Rien dans cette liste. Les documents apparaissent ici dès que leur état change."
        />
      )}
    </div>
    </DocumentWorkspace>
  );
}
