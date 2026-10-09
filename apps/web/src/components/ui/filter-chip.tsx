import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-pressed"> & {
  pressed: boolean;
  count?: number;
};

// Filtre à bascule (« Impératifs seulement »). `aria-pressed` porte l'état pour le
// lecteur d'écran ; la coche visible le porte pour l'œil — jamais la couleur seule.
export function FilterChip({ pressed, count, className, children, type = "button", ...props }: Props) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-base transition-colors",
        pressed
          ? "border-ink-fill bg-ink-fill font-bold text-on-ink"
          : "border-line bg-card text-ink hover:border-muted",
        className
      )}
      {...props}
    >
      {pressed && <span aria-hidden="true">✓</span>}
      {children}
      {count !== undefined && <span className="text-sm tabular-nums">({count})</span>}
    </button>
  );
}
