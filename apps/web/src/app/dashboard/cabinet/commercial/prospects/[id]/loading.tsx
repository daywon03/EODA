import { HeaderSkeleton, PageSkeleton, RowsSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
      <RowsSkeleton count={3} />
    </PageSkeleton>
  );
}
