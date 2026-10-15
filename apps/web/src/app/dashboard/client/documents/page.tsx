import Link from "next/link";
import { getClientChecklist } from "@/lib/actions/checklist";
import { flattenChecklist } from "@/lib/services/structure-documents-service";
import {
  CLIENT_DOCUMENT_FILTER_LABELS,
  CLIENT_DOCUMENT_FILTERS,
  buildClientWorkList,
  countClientFilters,
  describeWorkList,
  groupClientDocuments,
  parseClientDocumentFilter,
  toClientDocumentRow,
  type ClientDocumentFilter,
} from "@/lib/services/client-documents-view-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { correctionRight } from "@/lib/services/offer-scope-service";
import { CLIENT_DOCUMENTS_PATH } from "@/lib/design/client-navigation";
import { cn } from "@/lib/utils";
import { ClientDocumentCard } from "@/components/client/documents/ClientDocumentCard";

export const metadata = { title: "Mes documents" };

type Props = { searchParams: Promise<{ filtre?: string | string[] }> };

function filterHref(filter: ClientDocumentFilter | null): string {
  return filter ? `${CLIENT_DOCUMENTS_PATH}?filtre=${filter}` : CLIENT_DOCUMENTS_PATH;
}

// « Mes documents » (maquette Portail Client v2, R6), rangé dans les SEPT groupes de
// l'espace de la structure — Loi 2002-2 · Processus · Gestion des risques · Personne
// accompagnée · Registres · Ressources humaines · Qualité — et non par catégorie
// réglementaire : c'est le vocabulaire de Sandrine, pas celui de la loi (contenu, pas
// schéma : content/documents/groupes.ts). Des filtres d'adresse (partageables, sans
// JavaScript), un intertitre « X relus par EODA sur N » par groupe, une carte par
// document avec UN geste principal. L'état de chaque document est dérivé
// (client-documents-view-service).
export default async function ClientDocumentsPage({ searchParams }: Props) {
  const [{ establishment, checklist, missionAccess, supportMode, offer }, params] = await Promise.all([
    getClientChecklist(),
    searchParams,
  ]);

  if (!establishment) {
    return (
      <div className="space-y-3">
        <h1 className="text-[34px] font-bold">Mes documents</h1>
        <p>Votre espace n&apos;est pas encore rattaché à une structure. Écrivez à EODA.</p>
      </div>
    );
  }

  const rows = flattenChecklist(checklist).map((item) => toClientDocumentRow(item, supportMode));
  const filter = parseClientDocumentFilter(params.filtre);
  const counts = countClientFilters(rows);
  const groups = groupClientDocuments(rows, filter, supportMode);
  const workList = buildClientWorkList(rows);
  const canAct = canDepositDocuments(missionAccess);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[34px] font-bold leading-tight">Mes documents</h1>
        <p className="mt-1.5">
          {counts.accepte} accepté{counts.accepte > 1 ? "s" : ""}. {counts["a-deposer"]} à déposer.
        </p>
      </div>

      {!canAct && (
        <p className="rounded-xl border border-line bg-soft px-5 py-4">
          L&apos;accompagnement est terminé. Vos documents restent consultables. Aucun nouveau dépôt n&apos;est possible.
        </p>
      )}

      <nav aria-label="Filtrer les documents" className="flex flex-wrap gap-2">
        {[null, ...CLIENT_DOCUMENT_FILTERS].map((key) => {
          const active = key === filter;
          return (
            <Link
              key={key ?? "tout"}
              href={filterHref(key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex h-12 items-center gap-2 rounded-full border-2 px-4 text-[17px] font-bold",
                active ? "border-ink bg-ink-fill text-on-ink" : "border-line bg-card text-ink hover:border-ink2"
              )}
            >
              {active && <span aria-hidden="true">✓</span>}
              {key ? CLIENT_DOCUMENT_FILTER_LABELS[key] : "Tout"}
              <span className="tabular-nums">{key ? counts[key] : rows.length}</span>
            </Link>
          );
        })}
      </nav>

      {groups.length === 0 && (
        <p className="rounded-xl border border-line bg-card px-5 py-6 text-center">Aucun document dans ce filtre.</p>
      )}

      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`groupe-${group.id}`} className="flex flex-col gap-2.5">
          <div>
            <h2 id={`groupe-${group.id}`} className="text-2xl font-bold">
              {group.label}
            </h2>
            <p className="text-[17px] text-ink2">{group.progress}</p>
          </div>
          {group.rows.map((row) => (
            <ClientDocumentCard
              key={row.documentTypeId}
              item={row}
              state={row.state}
              mode={supportMode}
              establishmentId={establishment.id}
              canAct={canAct}
              complianceHref={
                canAct &&
                supportMode === "AUTONOMIE" &&
                row.currentVersion?.analysis &&
                correctionRight(offer, row.category).included
                  ? `${CLIENT_DOCUMENTS_PATH}/conformite/${row.currentVersion.id}`
                  : null
              }
            />
          ))}
        </section>
      ))}

      {/* Liste de travail (N3) : ce que la structure a déclaré ne pas avoir. En
          autonomie, c'est à elle de les créer ; accompagnée, EODA les produit. */}
      {workList.length > 0 && (
        <section id="travail" aria-labelledby="liste-travail" className="flex flex-col gap-2 rounded-xl bg-soft px-5 py-4">
          <h2 id="liste-travail" className="text-2xl font-bold">
            {supportMode === "AUTONOMIE" ? "Ma liste de travail" : "Documents à produire"}
          </h2>
          <p>
            {supportMode === "AUTONOMIE"
              ? describeWorkList(workList.length)
              : "Vous ne les avez pas. EODA le voit dans votre dossier."}
          </p>
          <ul className="list-disc pl-6">
            {workList.map((row) => (
              <li key={row.documentTypeId}>{row.label}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
