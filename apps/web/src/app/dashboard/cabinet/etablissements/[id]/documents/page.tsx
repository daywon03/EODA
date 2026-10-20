import { requireEstablishmentInTenant } from "@/lib/auth/guards";
import { hasCabinetCapability } from "@/lib/auth/capabilities";
import { getEstablishmentChecklist } from "@/lib/actions/checklist";
import { selectReminderLabels } from "@/lib/services/reminder-service";
import { signPreviewUrlsForVersions } from "@/lib/services/document-preview-urls-service";
import {
  countDocumentBuckets,
  DOCUMENT_BUCKET_LABELS,
  DOCUMENT_BUCKETS,
  DOCUMENT_CATEGORY_LABELS,
  documentsHref,
  filterDocumentRows,
  flattenChecklist,
  parseDocumentFilters,
  rowsInBucket,
} from "@/lib/services/structure-documents-service";
import { structureHref } from "@/lib/design/structure-tabs";
import type { DocumentCategory } from "@eoda/database";
import { TabsNav } from "@/components/ui/tabs-nav";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DocumentReminderForm } from "@/components/etablissement/DocumentReminderForm";
import { DocumentsExplorer } from "@/components/structure/DocumentsExplorer";

export const metadata = { title: "Documents" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[]; q?: string | string[]; cat?: string | string[]; doc?: string | string[] }>;
};

// Onglet Documents de la fiche structure. Compteurs, recherche et filtre sont
// DÉRIVÉS de la checklist (structure-documents-service) ; l'adresse porte l'état
// (onglet, recherche, catégorie, document ouvert), le serveur garde la main.
export default async function StructureDocumentsPage({ params, searchParams }: Props) {
  const { id } = await params;
  const raw = await searchParams;
  const { role } = await requireEstablishmentInTenant(id, "READ");
  const checklist = await getEstablishmentChecklist(id);

  const filters = parseDocumentFilters(raw);
  const basePath = structureHref(id, "documents");
  const allRows = flattenChecklist(checklist);
  const searched = filterDocumentRows(allRows, filters);
  const counts = countDocumentBuckets(searched);
  const rows = rowsInBucket(searched, filters.bucket);

  // Document ouvert au premier rendu (lien partagé, rechargement). Ensuite la
  // sélection vit dans le navigateur : ouvrir et fermer ne coûte plus un rendu
  // serveur (cf. l'en-tête de DocumentsExplorer). Un identifiant inconnu ne trouve
  // rien dans cette checklist, déjà bornée au tenant — le panneau ne s'ouvre pas.
  const docParam = Array.isArray(raw.doc) ? raw.doc[0] : raw.doc;
  const signedPreviewUrls = await signPreviewUrlsForVersions({
    establishmentId: id,
    versionIds: rows.flatMap((row) => (row.currentVersion ? [row.currentVersion.id] : [])),
  });

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

      <DocumentsExplorer
        rows={rows}
        allRows={allRows}
        filters={filters}
        basePath={basePath}
        bucketLabel={DOCUMENT_BUCKET_LABELS[filters.bucket]}
        establishmentId={id}
        canEditScope={hasCabinetCapability(role, "CABINET_SETTINGS")}
        initialDocId={docParam ?? null}
        signedPreviewUrls={signedPreviewUrls}
      />
    </div>
  );
}
