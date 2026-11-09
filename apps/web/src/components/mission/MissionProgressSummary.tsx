import { ProgressBar } from "@/components/ui/progress-bar";
import { explainMissionProgress, type MissionProgress } from "@/lib/services/mission-progress-service";

type Props = { progress: MissionProgress };

// Chaque pourcentage porte sa phrase de calcul (retour de Sandrine, 08/11/2026 :
// « comment est-ce calculé ? ») — même source pour le cabinet et la structure.
export function MissionProgressSummary({ progress }: Props) {
  const explanation = explainMissionProgress(progress);
  const rows = [
    { label: "Avancement global", value: progress.globalPct, color: "bg-vert-ok", how: explanation.global },
    { label: "Diagnostic", value: progress.diagnosticPct, color: "bg-ambre", how: explanation.diagnostic },
    { label: "Phases d'accompagnement", value: progress.phasesPct, color: "bg-terre", how: explanation.phases },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {rows.map(({ label, value, color, how }) => (
          <div key={label} className="bg-surface border border-gris-light rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink2">{label}</p>
              <p className="text-lg font-bold text-brun-ancre tabular-nums">{value}%</p>
            </div>
            <ProgressBar value={value} label={label} colorClassName={color} />
            <p className="text-xs text-ink2">{how}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink2">{explanation.note}</p>
    </div>
  );
}
