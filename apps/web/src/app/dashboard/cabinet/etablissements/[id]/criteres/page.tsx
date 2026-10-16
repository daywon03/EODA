import Link from "next/link";
import { getStructureCriteriaProof } from "@/lib/actions/criteria-proof";
import {
  PROOF_PILLS,
  describeImperativesProof,
  filterProofRows,
  parseProofFilter,
  type CriterionProofRow,
} from "@/lib/services/criteria-proof-service";
import { structureHref } from "@/lib/design/structure-tabs";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { TabsNav } from "@/components/ui/tabs-nav";

export const metadata = { title: "Critères et preuves" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filtre?: string | string[] }>;
};

const COLUMNS: readonly DataTableColumn<CriterionProofRow>[] = [
  { id: "code", header: "Critère", cell: (r) => <span className="font-bold tabular-nums">{r.code}</span>, isRowHeader: true },
  { id: "label", header: "Intitulé", cell: (r) => r.label },
  {
    id: "imperative",
    header: "Impératif",
    // Glyphe ET mot : jamais la couleur ni le seul triangle.
    cell: (r) => (r.isImperative ? <span className="whitespace-nowrap font-bold text-ink">▲ Impératif</span> : "—"),
  },
  {
    id: "proofs",
    header: "Preuves",
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
  { id: "chapter", header: "Chapitre", cell: (r) => `Chapitre ${r.chapterNumber}` },
  { id: "status", header: "État", cell: (r) => <StatusPill pill={PROOF_PILLS[r.status]} /> },
];

// Onglet « Critères » de la fiche structure (tranche N4). Tout est DÉRIVÉ des
// documents de la structure et de la matrice validée (criteria-proof-service).
export default async function StructureCriteriaPage({ params, searchParams }: Props) {
  const { id } = await params;
  const filter = parseProofFilter((await searchParams).filtre);
  const proof = await getStructureCriteriaProof(id);
  const rows = filterProofRows(proof.rows, filter);
  const base = structureHref(id, "criteres");
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
      <p className="text-ink2">
        Prouvé = chaque document attendu a été relu par EODA (structure accompagnée) ou accepté par la structure
        (autonomie). Ce n&apos;est pas un avis de conformité.
      </p>
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
        columns={COLUMNS}
        rows={rows}
        getRowKey={(r) => r.id}
        emptyMessage="Aucun critère à afficher."
      />
    </div>
  );
}
