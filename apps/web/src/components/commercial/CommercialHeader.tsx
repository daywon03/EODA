import type { ReactNode } from "react";

// En-tête des écrans commerciaux (maquette v2) : titre, phrase qui dit à quoi sert
// l'écran, une action à droite. La navigation entre écrans est dans la barre
// latérale et le fil d'Ariane : pas de bouton « Retour » en plus.
export function CommercialHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold leading-tight text-ink">{title}</h1>
        <p className="max-w-3xl text-lg text-ink2">{description}</p>
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
