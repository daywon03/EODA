import { ProgressBar } from "@/components/ui/progress-bar";
import { MissionChecklistItemRow } from "./MissionChecklistItemRow";

type Item = { code: string; label: string; completed: boolean; applicable: boolean };

type Props = { missionId: string; items: Item[]; pct: number };

// Les items hors offre restent VISIBLES mais verrouillés — même traitement que les
// phases réservées dans PhaseChecklistSection (case désactivée, cadenas, libellé
// grisé) : Sandrine doit voir ce qu'un passage à l'offre supérieure débloquerait
// (context/07-outil-pilotage-missions.md §12.4).
export function DiagnosticChecklistSection({ missionId, items, pct }: Props) {
  const lockedCount = items.filter((i) => !i.applicable).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-brun-ancre">Diagnostic initial</h3>
        <span className="text-xs text-gris-mid tabular-nums">
          {items.length > lockedCount ? `${pct}%` : "—"}
        </span>
      </div>
      {items.length > lockedCount && <ProgressBar value={pct} colorClassName="bg-ambre" />}
      {lockedCount > 0 && (
        <p className="text-xs text-gris-mid italic">
          {lockedCount} item{lockedCount > 1 ? "s" : ""} hors du périmètre de l&apos;offre
          contractée — débloqué{lockedCount > 1 ? "s" : ""} par une formule supérieure.
        </p>
      )}
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
