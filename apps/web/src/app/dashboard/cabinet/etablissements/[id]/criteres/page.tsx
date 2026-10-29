import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusPill } from "@/components/ui/status-pill";
import { TabsNav } from "@/components/ui/tabs-nav";

export const metadata = { title: "Critères et preuves" };

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filtre?: string | string[] }>;
};

function columns(
  evidence: Record<string, CriterionEvidence>,
  documentsPath: string,
  canEditMatrix: boolean
): DataTableColumn<CriterionProofRow>[] {
  return [
    { id: "code", header: "Critère", cell: (r) => <span className="font-bold tabular-nums">{r.code}</span>, isRowHeader: true },
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
                  <StatusPill pill={EVIDENCE_PILLS[item.state]} />
                </li>
              ))}
            </ul>
          )}
          {canEditMatrix && (
            <span className="mt-2 flex flex-wrap gap-x-6">
              {/* Déposer DEPUIS le critère (call du 28/10/2026) : une nouvelle ligne de
                  Documents, déjà rattachée à ce critère, puis le dépôt sur cette ligne. */}
              <Link
                href={`${documentsPath}?critere=${encodeURIComponent(row.code)}`}
                className="inline-flex min-h-11 items-center font-bold text-accent-text hover:underline"
              >
                + Ajouter un document à ce critère
              </Link>
              <Link href="/dashboard/cabinet/criteres" className="inline-flex min-h-11 items-center font-bold text-accent-text hover:underline">
                Modifier les preuves attendues (matrice — vaut pour toutes les structures) →
              </Link>
            </span>
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
  const filter = parseProofFilter((await searchParams).filtre);
  const [proof, evidence, { role }] = await Promise.all([
    getStructureCriteriaProof(id),
    getStructureCriteriaEvidence(id),
    requireCabinetSession("STRUCTURES_READ"),
  ]);
  const canEditMatrix = hasCabinetCapability(role, "CABINET_SETTINGS");
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
        columns={columns(evidence, structureHref(id, "documents"), canEditMatrix)}
        rows={rows}
        getRowKey={(r) => r.id}
        emptyMessage="Aucun critère à afficher."
      />
    </div>
  );
}
