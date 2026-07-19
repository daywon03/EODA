import { ProgressBar } from "@/components/ui/progress-bar";
import { MissionChecklistItemRow } from "./MissionChecklistItemRow";
import { PhaseDatesForm } from "./PhaseDatesForm";
import type { MissionChecklistScope } from "@eoda/database";

type Item = { code: string; label: string; completed: boolean };

type Props = {
  missionId: string;
  phase: Exclude<MissionChecklistScope, "DIAGNOSTIC">;
  label: string;
  items: Item[];
  pct: number;
  applicable: boolean;
  startDate: Date | null;
  endDate: Date | null;
};

export function PhaseChecklistSection({
  missionId,
  phase,
  label,
  items,
  pct,
  applicable,
  startDate,
  endDate,
}: Props) {
  return (
    <div className={`space-y-2 ${applicable ? "" : "opacity-60"}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brun-ancre">{label}</h3>
        <span className="text-xs text-gris-mid tabular-nums">{applicable ? `${pct}%` : "—"}</span>
      </div>
      {!applicable && (
        <p className="text-xs text-gris-mid italic">
          Réservé aux missions Excellence ou bêta-test gratuit.
        </p>
      )}
      {applicable && <ProgressBar value={pct} colorClassName="bg-terre" />}
      <PhaseDatesForm
        missionId={missionId}
        phase={phase}
        startDate={startDate}
        endDate={endDate}
        disabled={!applicable}
      />
      <ul className="divide-y divide-gris-light border border-gris-light rounded-lg px-3">
        {items.map((item) => (
          <MissionChecklistItemRow
            key={item.code}
            missionId={missionId}
            code={item.code}
            label={item.label}
            completed={item.completed}
            locked={!applicable}
          />
        ))}
      </ul>
    </div>
  );
}
