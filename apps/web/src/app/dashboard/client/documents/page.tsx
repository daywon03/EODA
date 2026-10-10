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
import { CLIENT_DOCUMENTS_PATH } from "@/lib/design/client-navigation";
import { cn } from "@/lib/utils";
import { ClientDocumentCard } from "@/components/client/documents/ClientDocumentCard";

export const metadata = { title: "Mes documents · EODA Conseil" };

type Props = { searchParams: Promise<{ filtre?: string | string[] }> };

function filterHref(filter: ClientDocumentFilter | null): string {
  return filter ? `${CLIENT_DOCUMENTS_PATH}?filtre=${filter}` : CLIENT_DOCUMENTS_PATH;
}

// « Mes documents » (maquette Portail Client v2, R6). Deux groupes — les sept
// documents de la loi 2002-2, puis les autres pièces réclamées —, des filtres
// d'adresse (partageables, sans JavaScript), une carte par document avec UN geste
// principal. L'état de chaque document est dérivé (client-documents-view-service).
export default async function ClientDocumentsPage({ searchParams }: Props) {
  const [{ establishment, checklist, missionAccess, supportMode }, params] = await Promise.all([
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
  const { obligatory, others } = groupClientDocuments(rows, filter);
  const workList = buildClientWorkList(rows);
  const canAct = canDepositDocuments(missionAccess);

  const groups = [
    {
      id: "obligatoires",
      title: "Les 7 documents obligatoires (loi 2002-2)",
      hint: "La loi du 2 janvier 2002 les demande à tous les services.",
      rows: obligatory,
    },
    {
      id: "autres",
      title: "Les autres documents demandés",
      hint: "Ils prouvent ce que vous faites au quotidien.",
      rows: others,
    },
  ].filter((group) => group.rows.length > 0);

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
              {group.title}
            </h2>
            <p className="text-[17px] text-ink2">{group.hint}</p>
          </div>
          {group.rows.map((row) => (
            <ClientDocumentCard
              key={row.documentTypeId}
              item={row}
              state={row.state}
              mode={supportMode}
              establishmentId={establishment.id}
              canAct={canAct}
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
