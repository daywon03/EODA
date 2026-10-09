import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ScopeItem = {
  id: string;
  label: string;
  included: boolean;
  // Précision à droite : un prix « à partir de » pour une option non souscrite
  // (formatStartingPrice), une date, une quantité. Jamais un montant inventé.
  detail?: string;
};

type Props = {
  title: string;
  items: readonly ScopeItem[];
  footer?: ReactNode;
  className?: string;
};

// Carte de périmètre : ce que l'offre comprend, et ce qui peut s'y ajouter. Inclus
// et non inclus se distinguent par le glyphe et par un mot lu au lecteur d'écran,
// pas seulement par la teinte.
export function ScopeCard({ title, items, footer, className }: Props) {
  return (
    <section className={cn("rounded-xl border border-line bg-card p-5", className)}>
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      <ul className="mt-3 divide-y divide-line">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-2.5">
            <span
              aria-hidden="true"
              className={cn(
                "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border font-bold",
                item.included ? "border-vert-ok bg-green-fill text-ink" : "border-muted bg-card text-ink2"
              )}
            >
              {item.included ? "✓" : "+"}
            </span>
            <span className={cn("flex-1", item.included ? "text-ink" : "text-ink2")}>
              <span className="sr-only">{item.included ? "Inclus : " : "Non inclus : "}</span>
              {item.label}
            </span>
            {item.detail && <span className="text-sm tabular-nums text-ink2">{item.detail}</span>}
          </li>
        ))}
      </ul>
      {footer && <div className="mt-4">{footer}</div>}
    </section>
  );
}
