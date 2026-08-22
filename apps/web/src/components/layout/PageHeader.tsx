import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, type LucideIcon } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string | undefined;
  icon?: LucideIcon;
  accent?: "terre" | "ambre";
  backHref?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, subtitle, icon: Icon, accent = "terre", backHref, action }: Props) {
  const accentClass = accent === "terre" ? "border-terre" : "border-ambre";
  const iconClass = accent === "terre" ? "text-terre" : "text-ambre";

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {backHref && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={backHref}>
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Link>
          </Button>
        )}
        <div className={`border-l-4 ${accentClass} pl-4 py-0.5`}>
          <div className="flex items-center gap-2">
            {Icon && <Icon className={`w-5 h-5 ${iconClass} flex-shrink-0`} aria-hidden="true" />}
            <h1 className="text-xl sm:text-2xl font-bold text-brun-ancre leading-tight">{title}</h1>
          </div>
          {subtitle && <p className="text-gris-mid text-sm mt-1">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
