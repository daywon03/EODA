import { RowsSkeleton, Skeleton } from "@/components/ui/skeleton";

// Rendu SOUS l'en-tête et les onglets de la fiche (layout.tsx) : seul le contenu de
// l'onglet attend.
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
      <RowsSkeleton count={4} />
    </div>
  );
}
