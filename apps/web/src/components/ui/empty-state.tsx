import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  // Ce que la personne peut faire maintenant — un état vide dit toujours la suite.
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ title, description, icon: Icon, action, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-muted bg-card px-6 py-10 text-center",
        className
      )}
    >
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-soft">
          <Icon className="h-6 w-6 text-ink2" aria-hidden="true" />
        </span>
      )}
      <p className="text-lg font-bold text-ink">{title}</p>
      {description && <p className="max-w-prose text-base text-ink2">{description}</p>}
      {action}
    </div>
  );
}
