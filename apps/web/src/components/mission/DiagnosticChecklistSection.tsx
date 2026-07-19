import { ProgressBar } from "@/components/ui/progress-bar";
import { MissionChecklistItemRow } from "./MissionChecklistItemRow";

type Item = { code: string; label: string; completed: boolean };

type Props = { missionId: string; items: Item[]; pct: number };

export function DiagnosticChecklistSection({ missionId, items, pct }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brun-ancre">Diagnostic initial</h3>
        <span className="text-xs text-gris-mid tabular-nums">{pct}%</span>
      </div>
      <ProgressBar value={pct} colorClassName="bg-ambre" />
      <ul className="divide-y divide-gris-light border border-gris-light rounded-lg px-3">
        {items.map((item) => (
          <MissionChecklistItemRow
            key={item.code}
            missionId={missionId}
            code={item.code}
            label={item.label}
            completed={item.completed}
          />
        ))}
      </ul>
    </div>
  );
}
