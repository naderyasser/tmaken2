import { Skeleton } from '@/components/ui/skeleton'

/** Loading placeholder that keeps the table's shape so the page doesn't jump. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full" role="status" aria-label="جارٍ التحميل">
      <div className="flex gap-3 border-b border-[var(--apex-border)] bg-[var(--apex-thead)]/40 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1 bg-white/70" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3 border-b border-[var(--apex-border)] px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-3 flex-1" style={{ opacity: 1 - r * 0.1 }} />
          ))}
        </div>
      ))}
    </div>
  )
}
