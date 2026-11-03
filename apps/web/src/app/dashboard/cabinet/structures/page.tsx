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
import { DataTable, type DataTableColumn, type DataTableColumnMenu } from "@/components/ui/data-table";
import { distinctValues, filterMenuFor, sortMenuFor } from "@/components/ui/data-table-menus";
import { pillForFunnelStage } from "@/lib/design/status-vocabulary";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { StageBadge } from "@/components/crm/StageBadge";
import { describeImperativesProof } from "@/lib/services/criteria-proof-service";
import { establishmentLogoUrl } from "@/lib/services/logo-response-service";

export const metadata = { title: "Structures" };

const BASE_PATH = "/dashboard/cabinet/structures";

// Menus de colonne façon Excel (call du 29/10/2026) : type, étape, tri par nom ou par
// échéance HAS. Par défaut, l'ordre reste « la plus urgente d'abord ».
type StructuresSort = "nom" | "nom-desc" | "evaluation" | "evaluation-desc";
const STRUCTURES_SORTS: readonly StructuresSort[] = ["nom", "nom-desc", "evaluation", "evaluation-desc"];
type StructuresView = { type: string | undefined; etape: string | undefined; tri: StructuresSort | undefined };

const typeLabel = (row: StructureFacts) => ESTABLISHMENT_TYPE_LABELS[row.type];
const stageLabel = (row: StructureFacts) => (row.stage ? pillForFunnelStage(row.stage).label : "—");

function first(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value ? value.slice(0, 80) : undefined;
}

function structuresHref(view: StructuresView): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(view)) if (value) params.set(key, value);
  const query = params.toString();
  return query ? `${BASE_PATH}?${query}` : BASE_PATH;
}

function sortStructures(rows: readonly StructureFacts[], sort: StructuresSort | undefined, now: Date): StructureFacts[] {
  if (!sort) return sortByUrgency(rows, now);
  const byName = (a: StructureFacts, b: StructureFacts) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  if (sort === "nom") return [...rows].sort(byName);
  if (sort === "nom-desc") return [...rows].sort((a, b) => byName(b, a));
  const direction = sort === "evaluation" ? 1 : -1;
  // Échéance non fixée : en fin de liste dans les deux sens.
  return [...rows].sort((a, b) => {
    const left = a.hasEvaluationTargetDate?.getTime();
    const right = b.hasEvaluationTargetDate?.getTime();
    if (left === undefined || right === undefined) return left === right ? byName(a, b) : left === undefined ? 1 : -1;
    return (left - right) * direction;
  });
}

function structuresMenus(view: StructuresView, rows: readonly StructureFacts[]): Record<"name" | "type" | "stage" | "evaluation", DataTableColumnMenu> {
  const href = (patch: Partial<StructuresView>) => structuresHref({ ...view, ...patch });
  return {
    name: { sort: sortMenuFor(view.tri, { asc: "nom", desc: "nom-desc", ascLabel: "De A à Z", descLabel: "De Z à A" }, (tri) => href({ tri })) },
    type: { filter: filterMenuFor(distinctValues(rows.map(typeLabel)), view.type, (type) => href({ type })) },
    stage: { filter: filterMenuFor(distinctValues(rows.map(stageLabel)), view.etape, (etape) => href({ etape })) },
    evaluation: {
      sort: sortMenuFor(view.tri, { asc: "evaluation", desc: "evaluation-desc", ascLabel: "La plus proche d'abord", descLabel: "La plus lointaine d'abord" }, (tri) => href({ tri })),
    },
  };
}

function columns(now: Date, menus: ReturnType<typeof structuresMenus>): DataTableColumn<StructureFacts>[] {
  return [
    {
      id: "name",
      header: "Structure",
      isRowHeader: true,
      menu: menus.name,
      // Le logo devant le nom : on reconnaît un client d'un coup d'œil (call du
      // 18/10/2026). Sans logo, une pastille à l'initiale garde l'alignement.
      cell: (row) => (
        <span className="flex items-center gap-3">
          {row.hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- servi par notre route, en cache navigateur.
            <img
              src={establishmentLogoUrl(row.id)}
              alt=""
              width={36}
              height={36}
              loading="lazy"
              className="h-9 w-9 flex-shrink-0 rounded-md border border-line bg-card object-contain"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-soft text-sm font-bold text-ink2"
            >
              {row.name.trim().charAt(0).toUpperCase()}
            </span>
          )}
          {row.name}
        </span>
      ),
    },
    { id: "type", header: "Type", menu: menus.type, cell: typeLabel },
    { id: "stage", header: "Étape", menu: menus.stage, cell: (row) => <StageBadge stage={row.stage} beta={row.isBeta} /> },
    {
      // Couverture loi 2002-2 — des types DÉPOSÉS, pas des documents conformes.
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
      // Impératifs PROUVÉS (N4) : relus par EODA ou acceptés par la structure, selon
      // le mode — jamais « conformes ». Même dérivation que l'onglet Critères.
      id: "imperatives",
      header: "Impératifs prouvés",
      cell: (row) =>
        row.imperatives ? (
          <span className="whitespace-nowrap tabular-nums">{describeImperativesProof(row.imperatives)}</span>
        ) : (
          "—"
        ),
    },
    {
      id: "evaluation",
      header: "Évaluation HAS",
      menu: menus.evaluation,
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
export default async function StructuresPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[]; etape?: string | string[]; tri?: string | string[] }>;
}) {
  const { role } = await requireCabinetSession("STRUCTURES_READ");
  const [{ rows }, raw] = await Promise.all([getStructuresOverview(), searchParams]);
  const now = new Date();
  const tri = first(raw.tri);
  const view: StructuresView = { type: first(raw.type), etape: first(raw.etape), tri: STRUCTURES_SORTS.find((sort) => sort === tri) };
  const shown = sortStructures(
    rows.filter((row) => (!view.type || typeLabel(row) === view.type) && (!view.etape || stageLabel(row) === view.etape)),
    view.tri,
    now
  );

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
          columns={columns(now, structuresMenus(view, rows))}
          rows={shown}
          emptyMessage="Aucune structure ne correspond à ce filtre."
          getRowKey={(row) => row.id}
          rowHref={(row) => `/dashboard/cabinet/etablissements/${row.id}`}
        />
      )}
    </div>
  );
}
