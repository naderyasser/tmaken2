import { Skeleton } from '@/components/ui/skeleton'

/** Shell-aware content skeleton for route-level loading.tsx files. */
export function PageSkeleton() {
  return (
    <div className="p-8 space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-lg" />)}
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  )
}
