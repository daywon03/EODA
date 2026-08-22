import { ProgressBar } from "@/components/ui/progress-bar";
import { MissionChecklistItemRow } from "./MissionChecklistItemRow";
import { PhaseDatesForm } from "./PhaseDatesForm";
import type { MissionChecklistScope } from "@eoda/database";

type Item = { code: string; label: string; completed: boolean; applicable: boolean };

type Props = {
  missionId: string;
  phase: Exclude<MissionChecklistScope, "DIAGNOSTIC">;
  label: string;
  items: Item[];
  pct: number;
  startDate: Date | null;
  endDate: Date | null;
};

// L'applicabilité est portée par CHAQUE item (`MissionChecklistItem.min_formule`,
// arbitré par offer-scope-service), jamais par la phase entière : une phase peut
// parfaitement mélanger des items Essentiel et des items Excellence. Le verrouillage
// est donc calculé item par item, exactement comme dans DiagnosticChecklistSection.
// La phase n'est « réservée » que lorsque AUCUN de ses items n'est couvert — c'est
// aussi le cas où mission-progress-service la retire de `phasePcts` (§12.4).
export function PhaseChecklistSection({
  missionId,
  phase,
  label,
  items,
  pct,
  startDate,
  endDate,
}: Props) {
  const lockedCount = items.filter((i) => !i.applicable).length;
  const hasApplicableItem = lockedCount < items.length;

  return (
    <div className={`space-y-2 ${hasApplicableItem ? "" : "opacity-60"}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brun-ancre">{label}</h3>
        <span className="text-xs text-gris-mid tabular-nums">
          {hasApplicableItem ? `${pct}%` : "—"}
        </span>
      </div>
      {!hasApplicableItem && (
        <p className="text-xs text-gris-mid italic">
          Phase hors du périmètre de l&apos;offre contractée — débloquée par une formule
          supérieure.
        </p>
      )}
      {hasApplicableItem && lockedCount > 0 && (
        <p className="text-xs text-gris-mid italic">
          {lockedCount} item{lockedCount > 1 ? "s" : ""} hors du périmètre de l&apos;offre
          contractée — débloqué{lockedCount > 1 ? "s" : ""} par une formule supérieure.
        </p>
      )}
      {hasApplicableItem && <ProgressBar value={pct} colorClassName="bg-terre" />}
      <PhaseDatesForm
        missionId={missionId}
        phase={phase}
        startDate={startDate}
        endDate={endDate}
        disabled={!hasApplicableItem}
      />
      <ul className="divide-y divide-gris-light border border-gris-light rounded-lg px-3">
        {items.map((item) => (
          <MissionChecklistItemRow
            key={item.code}
            missionId={missionId}
            code={item.code}
            label={item.label}
            completed={item.completed}
            locked={!item.applicable}
          />
        ))}
      </ul>
    </div>
  );
}
