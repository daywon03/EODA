import { ProgressBar } from "@/components/ui/progress-bar";

type Props = { diagnosticPct: number; phasesPct: number; globalPct: number };

export function MissionProgressSummary({ diagnosticPct, phasesPct, globalPct }: Props) {
  const rows = [
    { label: "Avancement global", value: globalPct, color: "bg-vert-ok" },
    { label: "Diagnostic", value: diagnosticPct, color: "bg-ambre" },
    { label: "Phases d'accompagnement", value: phasesPct, color: "bg-terre" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {rows.map(({ label, value, color }) => (
        <div key={label} className="bg-white border border-gris-light rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gris-mid">{label}</p>
            <p className="text-lg font-bold text-brun-ancre tabular-nums">{value}%</p>
          </div>
          <ProgressBar value={value} colorClassName={color} />
        </div>
      ))}
    </div>
  );
}
