import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requireCabinetSession } from "@/lib/auth/guards";
import { hasCabinetCapability } from "@/lib/auth/capabilities";
import { getStructureCriteriaEvidence, getStructureCriteriaProof, type CriterionEvidence } from "@/lib/actions/criteria-proof";
import { documentsHref } from "@/lib/services/structure-documents-service";
import {
  EVIDENCE_PILLS,
  PROOF_PILLS,
  describeImperativesProof,
  filterProofRows,
  parseProofFilter,
  type CriterionProofRow,
} from "@/lib/services/criteria-proof-service";
import { structureHref } from "@/lib/design/structure-tabs";
import { DataTable, type DataTableColumn, type DataTableColumnMenu } from "@/components/ui/data-table";
import { distinctValues, filterMenuFor, sortMenuFor } from "@/components/ui/data-table-menus";
import { StatusPill } from "@/components/ui/status-pill";
import { TabsNav } from "@/components/ui/tabs-nav";
import { AttachExistingDocument, DetachDocumentFromCriterion } from "@/components/criteres/lazy-criteria-panels";

export const metadata = { title: "Critères et preuves" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    filtre?: string | string[];
    // Menus de colonne façon Excel (call du 29/10/2026).
    etat?: string | string[];
    chap?: string | string[];
    tri?: string | string[];
  }>;
};

// État de l'adresse des menus de colonne : filtre d'onglet, état, chapitre, tri.
type CriteriaView = { filtre: string | undefined; etat: string | undefined; chap: string | undefined; tri: CriteriaSort | undefined };
type CriteriaSort = "code" | "code-desc" | "preuves" | "preuves-desc";
const CRITERIA_SORTS: readonly CriteriaSort[] = ["code", "code-desc", "preuves", "preuves-desc"];

function first(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? value.slice(0, 80) : undefined;
}

function criteriaHref(base: string, view: CriteriaView): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(view)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

const chapterLabel = (row: CriterionProofRow) => `Chapitre ${row.chapterNumber}`;

// Numéro de critère dans l'ordre naturel (« 3.2.1 » avant « 3.10.1 »).
const byCode = (a: CriterionProofRow, b: CriterionProofRow) => a.code.localeCompare(b.code, "fr", { numeric: true });

function sortCriteria(rows: readonly CriterionProofRow[], sort: CriteriaSort | undefined): CriterionProofRow[] {
  if (!sort) return [...rows];
  if (sort === "code") return [...rows].sort(byCode);
  if (sort === "code-desc") return [...rows].sort((a, b) => byCode(b, a));
  const ratio = (row: CriterionProofRow) => (row.expected === 0 ? -1 : row.proven / row.expected);
  const direction = sort === "preuves" ? 1 : -1;
  return [...rows].sort((a, b) => (ratio(a) - ratio(b)) * direction || byCode(a, b));
}

function criteriaMenus(base: string, view: CriteriaView, rows: readonly CriterionProofRow[]): Record<"code" | "proofs" | "chapter" | "status", DataTableColumnMenu> {
  const href = (patch: Partial<CriteriaView>) => criteriaHref(base, { ...view, ...patch });
  return {
    code: { sort: sortMenuFor(view.tri, { asc: "code", desc: "code-desc", ascLabel: "Du plus petit numéro", descLabel: "Du plus grand numéro" }, (tri) => href({ tri })) },
    proofs: {
      sort: sortMenuFor(view.tri, { asc: "preuves", desc: "preuves-desc", ascLabel: "Les moins prouvés d'abord", descLabel: "Les plus prouvés d'abord" }, (tri) => href({ tri })),
    },
    chapter: { filter: filterMenuFor(distinctValues(rows.map(chapterLabel)), view.chap, (chap) => href({ chap })) },
    status: { filter: filterMenuFor(distinctValues(rows.map((row) => PROOF_PILLS[row.status].label)), view.etat, (etat) => href({ etat })) },
  };
}

function columns(
  evidence: Record<string, CriterionEvidence>,
  documentsPath: string,
  canEditMatrix: boolean,
  menus: ReturnType<typeof criteriaMenus>
): DataTableColumn<CriterionProofRow>[] {
  return [
    { id: "code", header: "Critère", menu: menus.code, cell: (r) => <span className="font-bold tabular-nums">{r.code}</span>, isRowHeader: true },
    {
      id: "label",
      header: "Intitulé",
      // L'intitulé ouvre le détail : ce que l'évaluateur HAS regarde, et la liste des
      // documents retenus comme preuves, chacun avec son état (21/10/2026).
      cell: (r) => (
        <CriterionDetails
          row={r}
          evidence={evidence[r.id]}
          documentsPath={documentsPath}
          canEditMatrix={canEditMatrix}
        />
      ),
    },
    {
      id: "imperative",
      header: "Impératif",
      // Glyphe ET mot : jamais la couleur ni le seul triangle.
      cell: (r) => (r.isImperative ? <span className="whitespace-nowrap font-bold text-ink">▲ Impératif</span> : "—"),
    },
    {
      id: "proofs",
      header: "Preuves",
      menu: menus.proofs,
      cell: (r) =>
        r.expected === 0 ? (
          "—"
        ) : (
          <span className="whitespace-nowrap tabular-nums">
            {r.proven} / {r.expected} prouvée{r.proven > 1 ? "s" : ""}
            {r.deposited > r.proven && <span className="block text-sm text-ink2">{r.deposited} déposée{r.deposited > 1 ? "s" : ""}</span>}
          </span>
        ),
    },
    { id: "chapter", header: "Chapitre", menu: menus.chapter, cell: chapterLabel },
    { id: "status", header: "État", menu: menus.status, cell: (r) => <StatusPill pill={PROOF_PILLS[r.status]} /> },
  ];
}

// Détail d'un critère, dépliable au clic sur son intitulé (<details> : clavier et
// lecteur d'écran sans une ligne de JavaScript).
function CriterionDetails({
  row,
  evidence,
  documentsPath,
  canEditMatrix,
}: {
  row: CriterionProofRow;
  evidence: CriterionEvidence | undefined;
  documentsPath: string;
  canEditMatrix: boolean;
}) {
  const items = evidence?.items ?? [];
  const elements = evidence?.hasElements ?? [];
  return (
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-ink2 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
        <span>{row.label}</span>
      </summary>
      <div className="mt-3 space-y-4 pl-6">
        <div>
          <p className="font-bold text-ink">Documents retenus comme preuves</p>
          {items.length === 0 ? (
            <p className="text-ink2">Aucun document n&apos;est encore rattaché à ce critère dans la matrice.</p>
          ) : (
            <ul className="mt-1.5 space-y-1.5">
              {items.map((item) => (
                <li key={item.documentTypeId} className="flex flex-wrap items-center justify-between gap-2">
                  {item.state === "ABSENTE" ? (
                    <span className="text-ink">{item.label}</span>
                  ) : (
                    <Link
                      href={documentsHref(documentsPath, { doc: item.documentTypeId })}
                      className="inline-flex min-h-11 items-center font-bold text-ink underline-offset-4 hover:underline"
                    >
                      {item.label}
                    </Link>
                  )}
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusPill pill={EVIDENCE_PILLS[item.state]} />
                    {canEditMatrix && item.documentTypeCode && (
                      <DetachDocumentFromCriterion
                        documentTypeCode={item.documentTypeCode}
                        documentLabel={item.label}
                        criterionCode={row.code}
                      />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {canEditMatrix && (
            <div className="mt-3 space-y-2">
              {/* Choisir une ligne DÉJÀ dans la liste (retours du 09/11/2026), en plus
                  d'en créer une. */}
              <AttachExistingDocument
                criterionCode={row.code}
                linkedDocumentTypeIds={items.map((item) => item.documentTypeId)}
              />
            <span className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {/* Déposer DEPUIS le critère (call du 28/10/2026) : une nouvelle ligne de
                  Documents, déjà rattachée à ce critère, puis le dépôt sur cette ligne. */}
              <Button asChild variant="outline" className="font-bold">
                <Link href={`${documentsPath}?critere=${encodeURIComponent(row.code)}`}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Créer un nouveau document pour ce critère
                </Link>
              </Button>
              <Link href="/dashboard/cabinet/criteres" className="inline-flex min-h-11 items-center font-bold text-accent-text hover:underline">
                Modifier les preuves attendues (matrice — vaut pour toutes les structures) →
              </Link>
            </span>
            </div>
          )}
        </div>
        {elements.length > 0 && (
          <div>
            <p className="font-bold text-ink">Ce que l&apos;évaluateur HAS regarde</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-ink2">
              {elements.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

// Onglet « Critères » de la fiche structure (tranche N4). Tout est DÉRIVÉ des
// documents de la structure et de la matrice validée (criteria-proof-service).
export default async function StructureCriteriaPage({ params, searchParams }: Props) {
  const { id } = await params;
  const raw = await searchParams;
  const filter = parseProofFilter(raw.filtre);
  const tri = first(raw.tri);
  const view: CriteriaView = {
    filtre: filter === "TOUS" ? undefined : filter,
    etat: first(raw.etat),
    chap: first(raw.chap),
    tri: CRITERIA_SORTS.find((sort) => sort === tri),
  };
  const [proof, evidence, { role }] = await Promise.all([
    getStructureCriteriaProof(id),
    getStructureCriteriaEvidence(id),
    requireCabinetSession("STRUCTURES_READ"),
  ]);
  const canEditMatrix = hasCabinetCapability(role, "CABINET_SETTINGS");
  const base = structureHref(id, "criteres");
  const tabRows = filterProofRows(proof.rows, filter);
  const rows = sortCriteria(
    tabRows.filter(
      (row) => (!view.etat || PROOF_PILLS[row.status].label === view.etat) && (!view.chap || chapterLabel(row) === view.chap)
    ),
    view.tri
  );
  const menus = criteriaMenus(base, view, tabRows);
  const unlinked = proof.rows.filter((r) => r.status === "NON_RATTACHE").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-bold text-ink">Critères et preuves</h2>
        <p className="text-ink2">
          Impératifs prouvés : <span className="font-bold text-ink">{describeImperativesProof(proof.imperatives)}</span>
          {proof.imperatives.total !== proof.expectedImperatives &&
            ` (repère du profil : ${proof.expectedImperatives})`}
        </p>
      </div>
      <div className="space-y-1 text-ink2">
        <p>
          <span className="font-bold text-ink">Les preuves</span> d&apos;un critère sont les documents que la
          matrice des critères lui rattache. Une preuve compte quand le document est déposé, puis relu par EODA
          (structure accompagnée) ou accepté par la structure (autonomie).
        </p>
        <p>
          Prouvé = toutes ses preuves comptent. Cliquez sur un intitulé pour voir lesquelles manquent. Ce n&apos;est
          pas un avis de conformité.
        </p>
      </div>
      <TabsNav
        label="Filtrer les critères"
        activeId={filter}
        tabs={[
          { id: "TOUS", label: "Tous", href: base, count: proof.rows.length },
          { id: "IMPERATIFS", label: "Impératifs", href: `${base}?filtre=IMPERATIFS`, count: proof.imperatives.total },
        ]}
      />
      {unlinked > 0 && (
        <p className="text-sm text-ink2">
          {unlinked} critère{unlinked > 1 ? "s" : ""} sans document rattaché dans la matrice
          {" — "}
          <Link href="/dashboard/cabinet/criteres" className="font-bold text-accent-text hover:underline">
            matrice des critères
          </Link>
          {" "}(administration).
        </p>
      )}
      <DataTable
        caption="Critères HAS et preuves documentaires de la structure"
        columns={columns(evidence, structureHref(id, "documents"), canEditMatrix, menus)}
        rows={rows}
        getRowKey={(r) => r.id}
        emptyMessage="Aucun critère à afficher."
      />
    </div>
  );
}
