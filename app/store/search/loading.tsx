/** /search skeleton: filter bar, then the list/map split (map pane hidden on mobile —
 *  matches MapSearch's responsive order). Reserving the columns here also prevents the
 *  layout shift Lighthouse flagged when results hydrate in. */
export default function SearchLoading() {
  return (
    <div aria-busy="true" aria-label="جارٍ تحميل نتائج البحث" className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-12 w-full max-w-md animate-pulse rounded-full bg-[var(--aqar-sand-2)]" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 w-24 animate-pulse rounded-full bg-[var(--aqar-sand-2)]" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-[var(--aqar-sand-2)]" />
          ))}
        </div>
        <div className="hidden h-[calc(100vh-180px)] animate-pulse rounded-2xl bg-[var(--aqar-sand-2)] lg:block" />
      </div>
    </div>
  )
}
