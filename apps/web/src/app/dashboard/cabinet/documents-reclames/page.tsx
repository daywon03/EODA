import { Files } from "lucide-react";
import { requireCabinetAdminSession } from "@/lib/auth/guards";
import { listDocumentTypeScopes } from "@/lib/actions/document-type-scope";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/services/structure-documents-service";
import { PageHeader } from "@/components/layout/PageHeader";
import { Callout } from "@/components/ui/callout";
import { DocumentScopeToggle } from "@/components/checklist/DocumentScopeToggle";
import type { DocumentCategory } from "@eoda/database";

export const metadata = { title: "Documents réclamés" };

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS RÉCLAMÉS AUX STRUCTURES — réglage de CABINET, CABINET_ADMIN seul.
//
// « Ce qu'on réclame au client n'est pas tout ce qu'on produit pour lui » (CLAUDE.md
// §7) : `DocumentType.requestedFromClient` vaut pour TOUTES les structures. La
// bascule vivait dans les Réglages d'une fiche, ce qui laissait croire qu'elle ne
// touchait que celle-ci (test de bout en bout du 12/10/2026) — elle vit donc ici,
// à côté de la matrice des critères, l'autre réglage valable pour tout le cabinet.
// ─────────────────────────────────────────────────────────────────────────────
export default async function RequestedDocumentsPage() {
  await requireCabinetAdminSession();
  const scopes = await listDocumentTypeScopes();
  const requestedCount = scopes.filter((s) => s.requestedFromClient).length;
  const categories = (Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]).filter((category) =>
    scopes.some((s) => s.category === category)
  );

  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader
        title="Documents réclamés"
        subtitle={`${requestedCount} document${requestedCount > 1 ? "s" : ""} réclamé${requestedCount > 1 ? "s" : ""} aux structures sur ${scopes.length}`}
        icon={Files}
      />

      <Callout title="Ce réglage s'applique à toutes les structures">
        Un document « réclamé » est demandé à chaque structure, sur son portail. Un document « produit par EODA » ne
        lui est pas demandé : c&apos;est le cabinet qui le rédige. Chaque changement est inscrit au journal.
      </Callout>

      {scopes.length === 0 && <p className="text-ink2">Aucun type de document n&apos;est chargé.</p>}

      {categories.map((category) => (
        <section key={category} aria-labelledby={`requested-${category}`} className="space-y-3">
          <h2 id={`requested-${category}`} className="text-xl font-bold text-ink">
            {DOCUMENT_CATEGORY_LABELS[category]}
          </h2>
          <ul className="divide-y divide-line rounded-xl border border-line bg-card">
            {scopes
              .filter((s) => s.category === category)
              .map((scope) => (
                <li key={scope.documentTypeId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0 text-ink">{scope.label}</span>
                  <DocumentScopeToggle
                    documentTypeId={scope.documentTypeId}
                    requestedFromClient={scope.requestedFromClient}
                    canEdit
                  />
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
