import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  message: string;
  tone?: "info" | "success";
  onDismiss?: () => void;
  className?: string;
};

const TONES = {
  info: { glyph: "i", classes: "border-line bg-ink-fill text-on-ink" },
  success: { glyph: "✓", classes: "border-green-fill bg-ink-fill text-on-ink" },
} as const;

// Confirmation non bloquante (« Document envoyé »). `role="status"` : annoncée
// poliment par le lecteur d'écran, sans voler le focus. Une ERREUR n'est pas un
// toast — elle reste à côté du champ ou de l'action qui l'a produite.
export function Toast({ message, tone = "info", onDismiss, className }: Props) {
  const { glyph, classes } = TONES[tone];
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl border px-4 py-2 text-base shadow-eoda-lg",
        classes,
        className
      )}
    >
      <span aria-hidden="true" className="font-bold">
        {glyph}
      </span>
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fermer le message"
          className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-md"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
