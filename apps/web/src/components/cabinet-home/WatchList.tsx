import Link from "next/link";
import { formatDaysUntil } from "@/lib/services/elapsed-time-service";
import type { StructureFacts, WatchItem, WatchReasonKind } from "@/lib/services/structures-overview-service";
import type { PillSpec } from "@/lib/design/status-vocabulary";
import { StatusPill } from "@/components/ui/status-pill";
import { StageBadge } from "@/components/crm/StageBadge";

// Le motif se lit par une pastille (mot + glyphe), la couleur ne fait que renforcer.
const REASON_PILL: Record<WatchReasonKind, Omit<PillSpec, "label">> = {
  ECHEANCE_DEPASSEE: { glyph: "!", tone: "danger" },
  ECHEANCE_PROCHE: { glyph: "◷", tone: "fix" },
  A_RELIRE: { glyph: "◔", tone: "review" },
  MESSAGE: { glyph: "✉", tone: "progress" },
  INACTIVITE: { glyph: "…", tone: "todo" },
};

// Bloc « À surveiller » de l'accueil cabinet. Une ligne = une structure, son
// motif principal (le plus grave) et le nombre d'autres motifs.
export function WatchList({ items, now }: { items: WatchItem<StructureFacts>[]; now: Date }) {
  return (
    <section aria-labelledby="watch-heading" className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
        <h2 id="watch-heading" className="text-xl font-bold text-ink">
          À surveiller
        </h2>
        <Link
          href="/dashboard/cabinet/structures"
          className="text-base font-bold text-accent-text underline-offset-4 hover:underline"
        >
          Voir toutes les structures →
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-base text-ink2">
          Aucune structure ne demande d&apos;attention : pas d&apos;échéance proche, rien à relire, aucun message en
          attente.
        </p>
      ) : (
        <ul>
          {items.map(({ row, reasons }) => {
            const [main, ...others] = reasons;
            return (
              <li key={row.id} className="border-b border-line">
                <Link
                  href={`/dashboard/cabinet/etablissements/${row.id}`}
                  className="grid gap-x-5 gap-y-2 px-2 py-4 text-ink hover:bg-soft sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] sm:items-center"
                >
                  <span className="flex flex-col gap-1">
                    <span className="font-bold">{row.name}</span>
                    <StageBadge stage={row.stage} beta={row.isBeta} />
                  </span>
                  <span className="tabular-nums">
                    <span className="block text-sm text-ink2">Évaluation HAS</span>
                    {row.hasEvaluationTargetDate ? formatDaysUntil(row.hasEvaluationTargetDate, now) : "Non fixée"}
                  </span>
                  {main && (
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusPill pill={{ ...REASON_PILL[main.kind], label: main.label }} />
                      {others.length > 0 && (
                        <span className="text-sm text-ink2">
                          + {others.length} autre{others.length > 1 ? "s" : ""} motif{others.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
