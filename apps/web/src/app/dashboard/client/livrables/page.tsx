import { getClientChecklist } from "@/lib/actions/checklist";
import { PageHeader } from "@/components/layout/PageHeader";
import { DocumentDownloadLink } from "@/components/checklist/DocumentDownloadLink";
import { DocumentPreviewLink } from "@/components/checklist/DocumentPreviewLink";
import { formatDate } from "@/lib/services/date-format-service";
import {
  countDeliverablesInProgress,
  groupDeliverablesByCategory,
  selectDeliverables,
} from "@/lib/services/deliverables-service";
import type { DocumentCategory } from "@eoda/database";
import { AlertTriangle, Clock, PackageOpen } from "lucide-react";

export const metadata = { title: "Mes livrables · EODA Conseil" };

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  LOI_2002_2: "Documents loi 2002-2 (droits des personnes accompagnées)",
  FONCTIONNEMENT: "Fonctionnement de la structure",
  QUALITE_RISQUES: "Démarche qualité et gestion des risques",
  RH: "Ressources humaines",
};

// ─────────────────────────────────────────────────────────────────────────────
// RESTITUTIONS & LIVRABLES (CDC §5) — ce qu'EODA a produit et validé.
//
// Même lecture que la checklist (`getClientChecklist`, cloisonnée par le lien
// EstablishmentUser de la session) : cette page ne connaît aucun identifiant
// d'établissement et n'en accepte aucun, donc rien à falsifier. La sélection est
// dans `deliverables-service`, pur et testé — un document non VALIDÉ n'apparaît pas.
// ─────────────────────────────────────────────────────────────────────────────
export default async function ClientDeliverablesPage() {
  const { establishment, checklist } = await getClientChecklist();

  if (!establishment) {
    return (
      <div className="space-y-6">
        <PageHeader title="Mes livrables" icon={PackageOpen} accent="ambre" />
        <div className="flex items-start gap-3 rounded-lg border border-ambre/30 bg-ambre/10 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-ambre" aria-hidden="true" />
          <p className="text-sm text-gris-mid">
            Votre consultant EODA doit d&apos;abord vous rattacher à votre établissement.
          </p>
        </div>
      </div>
    );
  }

  // La catégorie est la CLÉ du regroupement de la checklist, pas un champ de l'item :
  // on la réattache ici, à la frontière, pour que le service reste ignorant de la
  // forme du chemin de chargement.
  const items = Object.entries(checklist).flatMap(([category, categoryItems]) =>
    categoryItems.map((item) => ({ ...item, category: category as DocumentCategory }))
  );
  const deliverables = selectDeliverables(items);
  const inProgress = countDeliverablesInProgress(items);
  const grouped = groupDeliverablesByCategory(deliverables);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes livrables"
        subtitle="Documents produits et validés par EODA Conseil"
        icon={PackageOpen}
        accent="ambre"
      />

      {/* Ce qui est en cours est COMPTÉ, jamais listé : annoncer un livrable avant
          que la consultante l'ait validé, c'est promettre à sa place. */}
      {inProgress > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-gris-light bg-ivoire px-5 py-4">
          <Clock className="mt-0.5 h-5 w-5 flex-shrink-0 text-ambre" aria-hidden="true" />
          <p className="text-sm text-gris-mid">
            {inProgress} document{inProgress > 1 ? "s" : ""} en cours de finalisation par EODA
            Conseil. Il{inProgress > 1 ? "s" : ""} apparaîtra
            {inProgress > 1 ? "ont" : ""} ici après validation.
          </p>
        </div>
      )}

      {deliverables.length === 0 ? (
        <div className="rounded-xl border border-gris-light bg-white px-5 py-8 text-center">
          <p className="text-sm font-semibold text-brun-ancre">Aucun livrable disponible</p>
          <p className="mt-1 text-sm text-gris-mid">
            Les documents produits par EODA Conseil dans le cadre de votre accompagnement
            apparaîtront ici dès qu&apos;ils seront validés.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([category, categoryDeliverables]) => (
            <section key={category} className="rounded-xl border border-gris-light bg-white">
              <h2 className="border-b border-gris-light px-5 py-3 text-sm font-semibold text-brun-ancre">
                {CATEGORY_LABELS[category]}
              </h2>
              <ul className="divide-y divide-gris-light">
                {categoryDeliverables.map((deliverable) => (
                  <li
                    key={deliverable.code}
                    className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-brun-ancre">{deliverable.label}</p>
                      <p className="text-xs text-gris-mid">
                        {deliverable.filename} · remis le {formatDate(deliverable.remittedOn)}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-4">
                      <DocumentPreviewLink documentVersionId={deliverable.documentVersionId} />
                      <DocumentDownloadLink documentVersionId={deliverable.documentVersionId} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs text-gris-mid">
        Ces documents sont produits par EODA Conseil dans le cadre de votre accompagnement et
        restent consultables après la fin de la mission.
      </p>
    </div>
  );
}
