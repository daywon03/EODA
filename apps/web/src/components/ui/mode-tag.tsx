import { cn } from "@/lib/utils";

export type SupportMode = "accompagne" | "autonomie";

// Étiquette du mode de la structure (maquette Portail Client v2) : « Excellence ·
// accompagné par EODA » en aplat encre, « Offre Essentiel · en autonomie » en
// contour. Le libellé est fourni par l'appelant (il dépend de l'offre souscrite) ;
// le mode ne fait que choisir le rendu. Jamais « Sandrine » côté client (D7).
const MODE_CLASSES: Record<SupportMode, string> = {
  accompagne: "border-ink-fill bg-ink-fill text-on-ink",
  autonomie: "border-muted bg-card text-ink",
};

export function ModeTag({ mode, label, className }: { mode: SupportMode; label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center whitespace-nowrap rounded-md border px-2.5 py-0.5 text-sm font-bold",
        MODE_CLASSES[mode],
        className
      )}
    >
      {label}
    </span>
  );
}
