import Link from "next/link";
import { cn } from "@/lib/utils";

export type PhaseState = "done" | "current" | "upcoming";

export type TimelinePhase = {
  id: string;
  label: string;
  // Période affichée telle quelle (« 01/08 → 15/11/2026 »), déjà formatée JJ/MM/AAAA.
  period?: string;
  percent?: number;
  state: PhaseState;
  // Écrans où l'étape se travaille (retour de Sandrine, 08/11/2026). Le premier est
  // la destination de l'étape elle-même : `href` (call du 09/11/2026).
  links?: readonly { label: string; href: string }[];
  href?: string;
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
        // Le titre mène au premier écran de l'étape ; la liste n'en répète pas le lien.
        const [primary, ...others] = phase.links ?? [];
        const titleHref = phase.href ?? primary?.href;
        const listed = titleHref !== undefined && primary?.href === titleHref ? others : (phase.links ?? []);
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
              {titleHref ? (
                <Link href={titleHref} className="group flex min-h-11 flex-col justify-center">
                  <span className="font-bold text-ink group-hover:underline">
                    {phase.label}
                    <span aria-hidden="true">&nbsp;→</span>
                  </span>
                  {primary && primary.href === titleHref && (
                    <span className="text-sm font-bold text-accent-text">{primary.label}</span>
                  )}
                </Link>
              ) : (
                <p className="font-bold text-ink">{phase.label}</p>
              )}
              <p className="text-sm text-ink2">
                {s.word}
                {phase.percent !== undefined && ` · ${phase.percent} %`}
              </p>
              {phase.period && <p className="text-sm tabular-nums text-ink2">{phase.period}</p>}
              {listed.length > 0 && (
                <ul className="pt-1">
                  {listed.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-flex min-h-11 items-center text-sm font-bold text-accent-text hover:underline"
                      >
                        {link.label} →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
