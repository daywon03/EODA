import Link from "next/link";
import { ChevronDown, CircleCheck, Folder, Hourglass, ListTodo, type LucideIcon } from "lucide-react";
import { FolderDetails } from "@/components/structure/FolderDetails";
import { foldersOfRows, groupRowsByFolder } from "@/lib/services/document-folder-service";
import { getClientChecklist } from "@/lib/actions/checklist";
import { flattenChecklist } from "@/lib/services/structure-documents-service";
import {
  clientSearchableFilenames,
  matchesClientSearch,
  parseClientSearch,
  toClientDocumentRow,
} from "@/lib/services/client-documents-view-service";
import {
  CLIENT_DOCUMENT_VIEWS,
  countClientViews,
  describeClientTodo,
  describeClientView,
  describeEmptyView,
  groupClientDocumentsForView,
  parseClientDocumentView,
  resolveClientView,
  type ClientDocumentView,
  type ClientViewIcon,
} from "@/lib/services/client-documents-page-service";
import { canDepositDocuments } from "@/lib/services/mission-access-service";
import { correctionRight } from "@/lib/services/offer-scope-service";
import { CLIENT_DOCUMENTS_PATH } from "@/lib/design/client-navigation";
import { cn } from "@/lib/utils";
import { ClientDocumentCard } from "@/components/client/documents/ClientDocumentCard";

export const metadata = { title: "Mes documents" };

// `filtre=` (anciens liens, traduit en onglet), `groupe=` et `tri=` (anciens boutons)
// sont encore acceptés : ils ne cassent rien, `groupe` et `tri` n'ont simplement plus
// d'effet — les rubriques sont toutes affichées, dans l'ordre alphabétique.
type Props = {
  searchParams: Promise<{
    vue?: string | string[];
    filtre?: string | string[];
    groupe?: string | string[];
    q?: string | string[];
    tri?: string | string[];
  }>;
};

const VIEW_ICONS: Record<ClientViewIcon, LucideIcon> = { todo: ListTodo, waiting: Hourglass, done: CircleCheck };

// L'onglet et la recherche vivent dans l'adresse : partageable, utilisable sans
// JavaScript, et « précédent » ramène à l'onglet d'avant.
function viewHref(view: ClientDocumentView, query: string): string {
  const params = new URLSearchParams({ vue: view });
  if (query) params.set("q", query);
  return `${CLIENT_DOCUMENTS_PATH}?${params.toString()}`;
}

const rubricAnchor = (id: string) => `rubrique-${id}`;
const documentCount = (n: number) => `${n} document${n > 1 ? "s" : ""}`;

function RubricLinks({ groups }: { groups: readonly { id: string; label: string; rows: readonly unknown[] }[] }) {
  return (
    <ul className="flex flex-col gap-1 lg:flex-row lg:flex-wrap lg:gap-x-6">
      {groups.map((group) => (
        <li key={group.id}>
          <a
            href={`#${rubricAnchor(group.id)}`}
            className="inline-flex min-h-12 items-center gap-2 font-bold text-accent-text underline underline-offset-4"
          >
            {group.label}
            <span className="font-normal text-ink2 tabular-nums">({group.rows.length})</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

// « Mes documents » (refonte du 09/11/2026, retours de la directrice du pilote et de
// Sandrine) : une phrase qui dit quoi faire, TROIS onglets (« À faire par vous »,
// « EODA s'en occupe », « C'est fait ») à la place des cinq bulles d'état, les sept
// rubriques en titres de section avec un sommaire d'ancres à la place des huit bulles,
// une recherche. L'état de chaque document est dérivé (client-documents-view-service),
// son onglet aussi (client-documents-page-service) ; rien ne change de ce que la
// structure a le droit de voir.
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

  const rows = flattenChecklist(checklist).map((item) => ({
    ...toClientDocumentRow(item, supportMode),
    searchableFilenames: clientSearchableFilenames(item),
  }));
  const query = parseClientSearch(params.q);
  // Les nombres des onglets tiennent compte de la recherche : ils annoncent ce qu'on obtient.
  const counts = countClientViews(
    rows.filter((row) => matchesClientSearch(row, query)),
    supportMode
  );
  const view = resolveClientView(parseClientDocumentView(params, supportMode), counts, query);
  const current = describeClientView(view, supportMode);
  const groups = groupClientDocumentsForView(rows, view, supportMode, query);
  const canAct = canDepositDocuments(missionAccess);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[34px] font-bold leading-tight">Mes documents</h1>
        <p className="mt-2 max-w-[60ch] text-[21px]">{describeClientTodo(rows, supportMode)}</p>
      </div>

      {!canAct && (
        <p className="rounded-xl border border-line bg-soft px-5 py-4">
          L&apos;accompagnement est terminé. Vos documents restent consultables. Aucun nouveau dépôt n&apos;est possible.
        </p>
      )}

      {/* Trois onglets : des liens, l'onglet courant porte aria-current. Pictogramme +
          mot + nombre — jamais la couleur seule. */}
      <div className="flex flex-col gap-3">
        <nav aria-label="Listes de documents">
          <ul className="grid grid-cols-3 gap-2">
            {CLIENT_DOCUMENT_VIEWS.map((key) => {
              const active = key === view;
              const { label, icon } = describeClientView(key, supportMode);
              const Icon = VIEW_ICONS[icon];
              return (
                <li key={key} className="flex">
                  <Link
                    href={viewHref(key, query)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-2 text-center text-[17px] font-bold leading-tight sm:flex-row sm:gap-2.5 sm:px-4",
                      active ? "border-ink bg-ink-fill text-on-ink" : "border-line bg-card text-ink hover:border-ink2"
                    )}
                  >
                    <Icon className="h-6 w-6 flex-shrink-0" aria-hidden="true" />
                    <span>{label}</span>
                    <span className="tabular-nums">
                      {counts[key]}
                      <span className="sr-only"> {counts[key] > 1 ? "documents" : "document"}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <p className="max-w-[65ch]">{current.sentence}</p>
      </div>

      {/* Recherche : un champ, un bouton, un formulaire GET sans JavaScript. Elle
          porte sur les trois onglets ; l'onglet qui a des résultats s'ouvre. */}
      <form action={CLIENT_DOCUMENTS_PATH} method="get" role="search" className="flex flex-wrap items-end gap-x-3 gap-y-2">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <span className="font-bold">Chercher un document</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Par exemple : livret, règlement, plaintes…"
            className="h-12 rounded-xl border-2 border-line bg-card px-4 text-ink placeholder:text-ink2"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-12 items-center rounded-xl border-2 border-line bg-card px-5 font-bold text-ink hover:border-ink2"
        >
          Chercher
        </button>
        {query && (
          <Link
            href={viewHref(view, "")}
            className="inline-flex min-h-12 items-center font-bold text-accent-text underline underline-offset-4"
          >
            Effacer la recherche
          </Link>
        )}
      </form>

      {/* Sommaire des rubriques de CET onglet : des ancres, sans JavaScript. En ligne
          sur grand écran ; replié (<details> natif) sur petit écran. */}
      {groups.length > 1 && (
        <>
          <nav aria-label="Aller à une rubrique" className="hidden rounded-xl border border-line bg-soft px-5 py-3 lg:block">
            <p className="font-bold">Aller à une rubrique</p>
            <RubricLinks groups={groups} />
          </nav>
          <details className="group rounded-xl border border-line bg-soft lg:hidden">
            <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-5 py-2 font-bold">
              Aller à une rubrique
              <ChevronDown className="h-5 w-5 flex-shrink-0 group-open:rotate-180" aria-hidden="true" />
            </summary>
            <nav aria-label="Aller à une rubrique" className="px-5 pb-3">
              <RubricLinks groups={groups} />
            </nav>
          </details>
        </>
      )}

      {groups.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-line bg-card px-5 py-8 text-center">
          <p className="text-[21px] font-bold">{describeEmptyView(view, supportMode, query)}</p>
          {query && (
            <Link href={viewHref(view, "")} className="inline-flex min-h-12 items-center font-bold text-accent-text underline underline-offset-4">
              Effacer la recherche
            </Link>
          )}
        </div>
      )}

      {groups.map((group) => (
        <section
          key={group.id}
          id={rubricAnchor(group.id)}
          aria-labelledby={`titre-${rubricAnchor(group.id)}`}
          className="flex scroll-mt-24 flex-col gap-2.5"
        >
          <div>
            <h2 id={`titre-${rubricAnchor(group.id)}`} className="text-2xl font-bold">
              {group.label}
            </h2>
            <p className="text-ink2">{documentCount(group.rows.length)}</p>
          </div>
          {(() => {
            // Dossiers (call du 29/10/2026) : « un repère clair et balisé, pour nous et
            // pour le client » — un pavé par dossier, ses documents dedans.
            const foldered = groupRowsByFolder(group.rows, foldersOfRows(group.rows));
            const renderCard = (row: (typeof group.rows)[number]) => (
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
            );
            return (
              <>
                {foldered.folders.map((folder) => (
                  <FolderDetails
                    key={folder.id}
                    forceOpen={query !== ""}
                    className="rounded-xl border border-line bg-soft"
                    summary={
                      <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-5 py-3 text-xl font-bold">
                        <Folder className="h-5 w-5 flex-shrink-0 text-accent-text" aria-hidden="true" />
                        {folder.label}
                        <span className="font-normal text-ink2">· {documentCount(folder.rows.length)}</span>
                      </summary>
                    }
                  >
                    <div className="flex flex-col gap-2.5 px-3 pb-3">{folder.rows.map(renderCard)}</div>
                  </FolderDetails>
                ))}
                {foldered.loose.map(renderCard)}
              </>
            );
          })()}
        </section>
      ))}
    </div>
  );
}
