import { cn } from "@/lib/utils";
import { ProgressBar } from "./progress-bar";

// Cadre de mesure (maquette v2, « Où en est la structure ») : un libellé, une valeur,
// une jauge, une note. Distinct de ScopeCard, qui liste ce qu'une OFFRE comprend :
// ici, on mesure un avancement. La valeur est passée déjà formulée (« 2,8 / 4 »,
// « 5 / 7 », « Non coté ») — ce composant n'invente aucun chiffre.
export function MeasureCard({
  label,
  value,
  percent,
  progressLabel,
  note,
  className,
}: {
  label: string;
  value: string;
  // Absent = rien à mesurer encore (pas de jauge vide qui ressemblerait à un zéro).
  percent?: number | undefined;
  progressLabel?: string;
  note?: string | undefined;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2.5 rounded-xl border border-line bg-card p-5", className)}>
      <h3 className="font-bold text-ink">{label}</h3>
      <p className="text-3xl font-bold leading-tight tabular-nums text-ink">{value}</p>
      {percent !== undefined && (
        <ProgressBar value={percent} label={progressLabel ?? label} colorClassName="bg-accent-fill" className="h-1.5" />
      )}
      {note && <p className="text-sm text-ink2">{note}</p>}
    </section>
  );
}
