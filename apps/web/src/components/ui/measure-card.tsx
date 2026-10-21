import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
  href,
  className,
}: {
  label: string;
  value: string;
  // Absent = rien à mesurer encore (pas de jauge vide qui ressemblerait à un zéro).
  percent?: number | undefined;
  progressLabel?: string;
  note?: string | undefined;
  // Où voir le détail de la mesure (call du 18/10/2026 : « cliquer sur "6 validés" ne
  // fait rien »). Toute la carte devient le lien ; le titre en porte le nom.
  href?: string | undefined;
  className?: string;
}) {
  const content = (
    <>
      <h3 className="flex items-center justify-between gap-2 font-bold text-ink">
        {label}
        {href && <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink2" aria-hidden="true" />}
      </h3>
      <p className="text-3xl font-bold leading-tight tabular-nums text-ink">{value}</p>
      {percent !== undefined && (
        <ProgressBar value={percent} label={progressLabel ?? label} colorClassName="bg-accent-fill" className="h-1.5" />
      )}
      {note && <p className="text-sm text-ink2">{note}</p>}
    </>
  );
  const frame = "flex flex-col gap-2.5 rounded-xl border border-line bg-card p-5";
  if (!href) return <section className={cn(frame, className)}>{content}</section>;
  return (
    <Link href={href} className={cn(frame, "transition-colors hover:border-ink2 hover:bg-soft", className)}>
      {content}
    </Link>
  );
}
