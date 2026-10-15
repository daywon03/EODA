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
  // 2 sous une mise en page qui porte déjà le h1 (fiche structure) : un seul h1 par page.
  headingLevel?: 1 | 2;
};

export function PageHeader({ title, subtitle, icon: Icon, accent = "terre", backHref, action, headingLevel = 1 }: Props) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  // L'accent passe par l'icône seule : le liseré latéral épais (border-l-4) est
  // refusé par le socle qualité impeccable (test de bout en bout du 12/10).
  const iconClass = accent === "terre" ? "text-accent-text" : "text-amber-text";

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {backHref && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={backHref}>
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Link>
          </Button>
        )}
        <div className="py-0.5">
          <div className="flex items-center gap-2">
            {Icon && <Icon className={`w-5 h-5 ${iconClass} flex-shrink-0`} aria-hidden="true" />}
            <Heading className="text-xl sm:text-2xl font-bold text-brun-ancre leading-tight">{title}</Heading>
          </div>
          {subtitle && <p className="text-ink2 text-sm mt-1">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="min-w-0 max-w-full flex-shrink-0">{action}</div>}
    </div>
  );
}
