import type { SignalTone } from "@/lib/services/prospect-diagnostic-service";
import { cn } from "@/lib/utils";

// Pastille d'activité (maquette v2) : un point de couleur ET un texte — jamais la
// couleur seule (WCAG 1.4.1). Le point est décoratif.
const DOT: Record<SignalTone, string> = {
  accent: "bg-accent-fill",
  amber: "bg-ambre",
  green: "bg-green-fill",
  red: "bg-danger-fill",
};

export function SignalDot({ tone, text, className }: { tone: SignalTone; text: string; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span aria-hidden="true" className={cn("h-2 w-2 flex-shrink-0 rounded-full", DOT[tone])} />
      {text}
    </span>
  );
}
