import Link from "next/link";
import { getClientChecklist } from "@/lib/actions/checklist";
import { flattenChecklist } from "@/lib/services/structure-documents-service";
import {
  CLIENT_DOCUMENT_FILTER_LABELS,
  CLIENT_DOCUMENT_FILTERS,
  buildClientWorkList,
  countClientFilters,
  countClientGroups,
  matchesClientSearch,
  clientSearchableFilenames,
  parseClientGroupFilter,
  parseClientSearch,
  type ClientGroupFilter,
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

type Props = {
  searchParams: Promise<{ filtre?: string | string[]; groupe?: string | string[]; q?: string | string[]; tri?: string | string[] }>;
};

// Les trois filtres se combinent dans l'adresse : partageable, utilisable sans
// JavaScript, et le bouton « précédent » du navigateur les défait un à un.
type ClientFilters = {
  filter: ClientDocumentFilter | null;
  group: ClientGroupFilter | null;
  query: string;
  sort: "nom" | null;
};

function filtersHref({ filter, group, query, sort }: ClientFilters): string {
  const params = new URLSearchParams();
  if (filter) params.set("filtre", filter);
  if (group) params.set("groupe", group);
  if (query) params.set("q", query);
  if (sort) params.set("tri", sort);
  const search = params.toString();
  return search ? `${CLIENT_DOCUMENTS_PATH}?${search}` : CLIENT_DOCUMENTS_PATH;
}

const CHIP = "inline-flex h-12 items-center gap-2 rounded-full border-2 px-4 text-[17px] font-bold";
const CHIP_ON = "border-ink bg-ink-fill text-on-ink";
const CHIP_OFF = "border-line bg-card text-ink hover:border-ink2";

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

  const rows = flattenChecklist(checklist).map((item) => ({
    ...toClientDocumentRow(item, supportMode),
    searchableFilenames: clientSearchableFilenames(item),
  }));
  const filter = parseClientDocumentFilter(params.filtre);
  const group = parseClientGroupFilter(params.groupe);
  const query = parseClientSearch(params.q);
  const sort = (Array.isArray(params.tri) ? params.tri[0] : params.tri) === "nom" ? "nom" : null;
  const current: ClientFilters = { filter, group, query, sort };
  // Les compteurs d'état tiennent compte de la recherche : ils annoncent ce qu'on obtient.
  const counts = countClientFilters(rows.filter((row) => matchesClientSearch(row, query)));
  const groupCounts = countClientGroups(rows, filter, query, supportMode);
  const groups = groupClientDocuments(rows, filter, supportMode, { group, query, sort });
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

      {/* Recherche par nom : un formulaire GET, sans JavaScript ; l'état et la
          rubrique choisis sont gardés. */}
      <form action={CLIENT_DOCUMENTS_PATH} method="get" role="search" className="flex flex-wrap items-end gap-2">
        {filter && <input type="hidden" name="filtre" value={filter} />}
        {group && <input type="hidden" name="groupe" value={group} />}
        {sort && <input type="hidden" name="tri" value={sort} />}
        <label className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <span className="text-[17px] font-bold">Chercher un document</span>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Par exemple : livret, règlement, plaintes…"
            className="h-12 rounded-xl border-2 border-line bg-card px-4 text-[17px] text-ink placeholder:text-ink2"
          />
        </label>
        <button type="submit" className={cn(CHIP, "rounded-xl", CHIP_OFF)}>
          Chercher
        </button>
        {query && (
          <Link href={filtersHref({ ...current, query: "" })} className={cn(CHIP, "rounded-xl", CHIP_OFF)}>
            Effacer la recherche
          </Link>
        )}
        {/* Tri alphabétique (21/10/2026) : un interrupteur, l'ordre par défaut met en
            tête ce qui demande un geste. */}
        <Link
          href={filtersHref({ ...current, sort: sort ? null : "nom" })}
          aria-pressed={sort === "nom"}
          className={cn(CHIP, "rounded-xl", sort ? CHIP_ON : CHIP_OFF)}
        >
          {sort && <span aria-hidden="true">✓</span>}
          Trier de A à Z
        </Link>
      </form>

      <nav aria-label="Filtrer par état" className="flex flex-wrap gap-2">
        {[null, ...CLIENT_DOCUMENT_FILTERS].map((key) => {
          const active = key === filter;
          return (
            <Link
              key={key ?? "tout"}
              href={filtersHref({ ...current, filter: key })}
              aria-current={active ? "page" : undefined}
              className={cn(CHIP, active ? CHIP_ON : CHIP_OFF)}
            >
              {active && <span aria-hidden="true">✓</span>}
              {key ? CLIENT_DOCUMENT_FILTER_LABELS[key] : "Tout"}
              <span className="tabular-nums">
                {key ? counts[key] : rows.filter((row) => matchesClientSearch(row, query)).length}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Rubriques (21/10/2026) : aller droit à « Processus » ou « Registres » sans
          descendre toute la page. */}
      <nav aria-label="Filtrer par rubrique" className="flex flex-wrap gap-2">
        <Link
          href={filtersHref({ ...current, group: null })}
          aria-current={group === null ? "page" : undefined}
          className={cn(CHIP, "h-11 text-base", group === null ? CHIP_ON : CHIP_OFF)}
        >
          {group === null && <span aria-hidden="true">✓</span>}
          Toutes les rubriques
        </Link>
        {groupCounts.map((entry) => {
          const active = entry.id === group;
          return (
            <Link
              key={entry.id}
              href={filtersHref({ ...current, group: entry.id })}
              aria-current={active ? "page" : undefined}
              className={cn(CHIP, "h-11 text-base", active ? CHIP_ON : CHIP_OFF)}
            >
              {active && <span aria-hidden="true">✓</span>}
              {entry.label}
              <span className="tabular-nums">{entry.count}</span>
            </Link>
          );
        })}
      </nav>

      {groups.length === 0 && (
        <p className="rounded-xl border border-line bg-card px-5 py-6 text-center">
          Aucun document ne correspond.{" "}
          <Link href={CLIENT_DOCUMENTS_PATH} className="font-bold text-accent-text underline underline-offset-4">
            Tout afficher
          </Link>
        </p>
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
