import Link from "next/link";
import { Building2 } from "lucide-react";
import { requireCabinetSession } from "@/lib/auth/guards";
import { getStructuresOverview } from "@/lib/actions/structures-overview";
import { formatDaysUntil } from "@/lib/services/elapsed-time-service";
import { ESTABLISHMENT_TYPE_LABELS } from "@/lib/services/structure-identity-service";
import {
  describeLastActivity,
  describeLoi2002Coverage,
  sortByUrgency,
  type StructureFacts,
} from "@/lib/services/structures-overview-service";
import { canSeeCommercial } from "@/lib/design/cabinet-navigation";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { StageBadge } from "@/components/crm/StageBadge";

export const metadata = { title: "Structures · EODA Conseil" };

function columns(now: Date): DataTableColumn<StructureFacts>[] {
  return [
    { id: "name", header: "Structure", cell: (row) => row.name, isRowHeader: true },
    { id: "type", header: "Type", cell: (row) => ESTABLISHMENT_TYPE_LABELS[row.type] },
    { id: "stage", header: "Étape", cell: (row) => <StageBadge stage={row.stage} beta={row.isBeta} /> },
    {
      // « Impératifs prouvés » ne se dérive pas encore (rattachements critères ↔
      // documents à charger, tranche N4) : on affiche ce qui se compte honnêtement,
      // la couverture loi 2002-2 — des types DÉPOSÉS, pas des documents conformes.
      id: "loi2002",
      header: "Loi 2002-2 déposés",
      cell: (row) => (
        <span className="flex items-center gap-2 tabular-nums">
          <ProgressBar
            value={row.loi2002Deposited}
            max={Math.max(row.loi2002Total, 1)}
            label={`Documents loi 2002-2 déposés — ${row.name}`}
            valueText={`${row.loi2002Deposited} sur ${row.loi2002Total}`}
            colorClassName="bg-accent-fill"
            className="w-14 flex-shrink-0"
          />
          {describeLoi2002Coverage(row)}
        </span>
      ),
    },
    {
      id: "evaluation",
      header: "Évaluation HAS",
      cell: (row) =>
        row.hasEvaluationTargetDate ? (
          <span className="whitespace-nowrap tabular-nums">{formatDaysUntil(row.hasEvaluationTargetDate, now)}</span>
        ) : (
          <span className="text-ink2">Non fixée</span>
        ),
    },
    {
      id: "activity",
      header: "Dernière activité",
      cell: (row) => (
        <span className="flex flex-col">
          <span>{describeLastActivity(row.lastActivityAt, now)}</span>
          {row.documentsAwaitingReview > 0 && (
            <span className="text-sm text-ink2">
              {row.documentsAwaitingReview} à relire
            </span>
          )}
        </span>
      ),
    },
  ];
}

// Liste des structures (maquette « Portail Cabinet v2 », vue Structures), triée de
// la plus urgente à la moins urgente. Pas de « Nouvelle structure » : une fiche ne
// naît que de la signature d'un devis (CLAUDE.md §7). Pas de filtre par mode
// (seul / accompagné) tant que le mode n'est pas modélisé (tranche N1).
export default async function StructuresPage() {
  const { role } = await requireCabinetSession();
  const { rows } = await getStructuresOverview();
  const now = new Date();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink sm:text-3xl">Structures</h1>
        <p className="mt-1 text-base text-ink2">Triées de la plus urgente à la moins urgente.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Aucune structure"
          description="Une fiche naît de la signature d'un devis : enregistrez le prospect, établissez son devis, puis signez-le. La fiche, la mission et les options souscrites sont créées d'un seul geste."
          action={
            canSeeCommercial(role) ? (
              <Button asChild>
                <Link href="/dashboard/cabinet/commercial/prospects">Ouvrir les prospects</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          caption="Structures accompagnées, de la plus urgente à la moins urgente"
          columns={columns(now)}
          rows={sortByUrgency(rows, now)}
          getRowKey={(row) => row.id}
          rowHref={(row) => `/dashboard/cabinet/etablissements/${row.id}`}
        />
      )}
    </div>
  );
}
