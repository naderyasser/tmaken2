// Ported from egarsys src/components/ui/table-skeleton.tsx (RingsSkeleton only —
// the dashboard's loading state). Reuses the platform Skeleton primitive.
import { Skeleton } from '@/components/ui/skeleton'

export function RingsSkeleton({ rings = 3 }: { rings?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Array.from({ length: rings }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card p-6 flex flex-col items-center gap-3"
        >
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-36 w-36 rounded-full" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  )
}
