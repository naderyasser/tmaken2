/** Storefront fallback skeleton (home + any store segment without its own loading.tsx).
 *  Mirrors the home layout: hero search block, category chips, then a card grid —
 *  same pulse idiom as the favorites/compare mount skeletons. */
export default function StoreLoading() {
  return (
    <div aria-busy="true" aria-label="جارٍ التحميل">
      <section className="aqar-hero">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="mx-auto h-10 w-72 max-w-full animate-pulse rounded-2xl bg-[var(--aqar-sand-2)]" />
          <div className="mx-auto mt-7 h-12 w-full max-w-xl animate-pulse rounded-full bg-[var(--aqar-sand-2)]" />
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-8 w-20 animate-pulse rounded-full bg-[var(--aqar-sand-2)]" />
            ))}
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="h-7 w-44 animate-pulse rounded-xl bg-[var(--aqar-sand-2)]" />
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-[var(--aqar-sand-2)]" />
          ))}
        </div>
      </div>
    </div>
  )
}
