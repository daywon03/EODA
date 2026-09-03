import { cn } from "@/lib/utils";

// Bloc d'attente. Réserve la place que le contenu occupera, plutôt que d'afficher
// un écran vide puis de tout faire sauter quand la réponse arrive : c'est la
// différence entre « ça charge » et « c'est cassé », et ça supprime le décalage de
// mise en page (CLS) à l'arrivée des données.
//
// `animate-pulse` s'arrête tout seul sous `prefers-reduced-motion` (Tailwind neutralise
// l'animation) ; le bloc reste visible et lisible.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-ivoire motion-reduce:animate-none", className)}
      aria-hidden="true"
    />
  );
}

// Page en cours de chargement. `aria-busy` + un texte pour lecteur d'écran : les
// blocs gris ne disent rien à qui ne les voit pas, et sans annonce la navigation
// paraît n'avoir rien fait.
export function PageSkeleton({ children }: { children: React.ReactNode }) {
  return (
    <div aria-busy="true" className="space-y-6">
      <span className="sr-only" role="status">
        Chargement en cours…
      </span>
      {children}
    </div>
  );
}

// En-tête de page : titre + sous-titre. Présent sur presque tous les écrans.
export function HeaderSkeleton() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <Skeleton className="h-11 w-40" />
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-40 rounded-xl" />
      ))}
    </div>
  );
}

export function RowsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, index) => (
        <Skeleton key={index} className="h-16 rounded-xl" />
      ))}
    </div>
  );
}
