import { HeaderSkeleton, PageSkeleton, RowsSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <RowsSkeleton />
    </PageSkeleton>
  );
}
