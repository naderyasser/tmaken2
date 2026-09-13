/** /post skeleton: heading, stepper dots, then the wizard card — shown while the
 *  client wizard chunk loads. */
export default function PostLoading() {
  return (
    <div aria-busy="true" aria-label="جارٍ التحميل" className="mx-auto max-w-2xl px-4 py-10">
      <div className="h-9 w-48 animate-pulse rounded-xl bg-[var(--aqar-sand-2)]" />
      <div className="mt-3 h-5 w-full max-w-md animate-pulse rounded-lg bg-[var(--aqar-sand-2)]" />
      <div className="mt-6 flex items-center gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-7 w-7 animate-pulse rounded-full bg-[var(--aqar-sand-2)]" />
        ))}
      </div>
      <div className="mt-6 h-72 animate-pulse rounded-2xl bg-[var(--aqar-sand-2)]" />
    </div>
  )
}
