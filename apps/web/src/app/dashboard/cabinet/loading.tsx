import {
  CardGridSkeleton,
  HeaderSkeleton,
  PageSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

// Squelette du tableau de bord. Sa seule présence change le comportement de Next :
// sans `loading.tsx`, la navigation reste sur l'écran PRÉCÉDENT jusqu'à ce que le
// rendu serveur complet soit prêt — le clic paraît n'avoir rien déclenché. Avec, la
// page apparaît immédiatement et se remplit ensuite.
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <CardGridSkeleton />
    </PageSkeleton>
  );
}
