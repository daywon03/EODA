import { cn } from "@/lib/utils";

export type PhaseState = "done" | "current" | "upcoming";

export type TimelinePhase = {
  id: string;
  label: string;
  // Période affichée telle quelle (« 01/08 → 15/11/2026 »), déjà formatée JJ/MM/AAAA.
  period?: string;
  percent?: number;
  state: PhaseState;
};

// L'état se lit par le glyphe ET le mot, pas par la couleur seule.
const STATE: Record<PhaseState, { glyph: string; word: string; dot: string }> = {
  done: { glyph: "✓", word: "Terminée", dot: "border-vert-ok bg-green-fill text-ink" },
  current: { glyph: "◔", word: "En cours", dot: "border-ambre bg-amber-fill text-ink" },
  upcoming: { glyph: "○", word: "À venir", dot: "border-muted bg-card text-ink2" },
};

// Frise des phases d'une mission. Les phases elles-mêmes (noms, ordre) sont fournies
// par l'appelant : ce composant n'en connaît aucune, elles relèvent d'une décision
// métier qui vit dans les services.
export function PhaseTimeline({ label, phases, className }: { label: string; phases: readonly TimelinePhase[]; className?: string }) {
  return (
    <ol aria-label={label} className={cn("grid gap-3 sm:grid-flow-col sm:auto-cols-fr", className)}>
      {phases.map((phase) => {
        const s = STATE[phase.state];
        return (
          <li
            key={phase.id}
            aria-current={phase.state === "current" ? "step" : undefined}
            className={cn(
              "flex gap-3 rounded-xl border bg-card p-4",
              phase.state === "current" ? "border-ambre" : "border-line"
            )}
          >
            <span
              aria-hidden="true"
              className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border font-bold", s.dot)}
            >
              {s.glyph}
            </span>
            <div className="min-w-0 space-y-0.5">
              <p className="font-bold text-ink">{phase.label}</p>
              <p className="text-sm text-ink2">
                {s.word}
                {phase.percent !== undefined && ` · ${phase.percent} %`}
              </p>
              {phase.period && <p className="text-sm tabular-nums text-ink2">{phase.period}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
