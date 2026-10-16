import { cn } from "@/lib/utils";
import { clampPercent } from "@/lib/design/progress";

type Props = {
  value: number;
  max?: number;
  // Nom accessible OBLIGATOIRE : une barre de progression sans nom est annoncée
  // « barre de progression, 60 % » — 60 % de quoi ?
  label: string;
  // Lecture alternative de la valeur (« 12 documents sur 20 ») quand le pourcentage
  // seul ne dit pas l'essentiel.
  valueText?: string;
  colorClassName?: string;
  className?: string;
};

export function ProgressBar({ value, max = 100, label, valueText, colorClassName = "bg-green-fill", className }: Props) {
  const pct = clampPercent(value, max);
  return (
    <div
      className={cn("h-2.5 overflow-hidden rounded-full bg-line", className)}
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-300", colorClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
