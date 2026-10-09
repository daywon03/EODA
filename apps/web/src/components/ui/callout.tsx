import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Encadré d'information. Le ton se lit par le glyphe ET le mot d'en-tête, pas par la
// seule couleur de la bordure. `warning` sert notamment à la réserve d'autonomie
// (« Non revérifié par un humain : peut comporter des erreurs. À relire
// absolument. ») — elle n'est jamais rendue en gris discret.
const TONES = {
  info: { glyph: "i", border: "border-l-ink2", bg: "bg-soft" },
  warning: { glyph: "!", border: "border-l-ambre", bg: "bg-highlight" },
  danger: { glyph: "!", border: "border-l-danger-text", bg: "bg-card" },
  success: { glyph: "✓", border: "border-l-vert-ok", bg: "bg-ok-soft" },
} as const;

type Props = {
  tone?: keyof typeof TONES;
  title?: string;
  children: ReactNode;
  // `alert` UNIQUEMENT pour un message apparu suite à une action (annoncé aussitôt).
  // Un encadré présent dès le chargement reste une simple note.
  role?: "note" | "alert";
  className?: string;
};

export function Callout({ tone = "info", title, children, role = "note", className }: Props) {
  const { glyph, border, bg } = TONES[tone];
  return (
    <div
      role={role}
      className={cn("flex gap-3 rounded-xl border border-l-4 border-line px-4 py-3 text-base text-ink", border, bg, className)}
    >
      <span
        aria-hidden="true"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border border-current font-bold"
      >
        {glyph}
      </span>
      <div className="min-w-0 space-y-1">
        {title && <p className="font-bold">{title}</p>}
        <div className="text-ink">{children}</div>
      </div>
    </div>
  );
}
