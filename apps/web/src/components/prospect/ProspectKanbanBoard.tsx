import { ProspectCard } from "./ProspectCard";
import { PROSPECT_STATUS_LABELS } from "./ProspectStatusBadge";
import type { ProspectStatus, ProspectType } from "@eoda/database";

type ProspectItem = {
  id: string;
  structureName: string;
  structureType: ProspectType;
  status: ProspectStatus;
  contactName: string | null;
  estimatedAmountEuros: number | null;
  _count: { devis: number };
};

type Props = { prospects: ProspectItem[] };

const COLUMN_ORDER: ProspectStatus[] = ["NOUVEAU", "RDV", "DEVIS_ENVOYE", "NEGOCIATION", "SIGNE", "PERDU"];

export function ProspectKanbanBoard({ prospects }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {COLUMN_ORDER.map((status) => {
        const items = prospects.filter((p) => p.status === status);
        return (
          <div key={status} className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-semibold text-gris-mid uppercase tracking-wide">
                {PROSPECT_STATUS_LABELS[status]}
              </h3>
              <span className="text-xs text-gris-mid tabular-nums">{items.length}</span>
            </div>
            <div className="space-y-3">
              {items.map((p) => (
                <ProspectCard
                  key={p.id}
                  id={p.id}
                  structureName={p.structureName}
                  structureType={p.structureType}
                  status={p.status}
                  contactName={p.contactName}
                  estimatedAmountEuros={p.estimatedAmountEuros}
                  devisCount={p._count.devis}
                />
              ))}
              {items.length === 0 && (
                <p className="text-xs text-gris-mid italic px-1">Aucun prospect</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
