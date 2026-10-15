import { cn } from "@/lib/utils";

// Pastille NUMÉRIQUE d'une entrée de navigation — un seul composant pour les deux
// portails. Elle a été extraite de CabinetNavList le 15/10/2026, quand le portail
// client a eu besoin du même badge : deux copies d'un cercle accent auraient fini par
// diverger sur la taille ou le contraste.
//
// `aria-hidden` : le nombre est décoratif, la phrase qui le porte vit à côté, dans un
// `.sr-only` (« Mes livrables, 3 nouveaux documents »). Un lecteur d'écran qui lirait
// « 3 » seul n'apprendrait rien.
export function CountBadge({ count, className }: { count: number; className?: string | undefined }) {
  return (
    <span
      className={cn(
        "flex h-6 min-w-[26px] items-center justify-center rounded-full bg-accent-fill px-2 text-sm font-bold tabular-nums text-on-accent",
        className
      )}
      aria-hidden="true"
    >
      {count}
    </span>
  );
}
