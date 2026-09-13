'use client'

import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import { useSavedSearches } from '@/lib/saved-searches'

/** «احفظ هذا البحث» — persists the current /search query (filters+sort) to localStorage. */
export default function SaveSearchButton({ query }: { query: Record<string, string> }) {
  const { save } = useSavedSearches()
  const [msg, setMsg] = useState('')

  const onSave = () => {
    const r = save(query)
    setMsg(r === 'saved' ? 'تم حفظ البحث ✅' : 'هذا البحث محفوظ مسبقاً')
    setTimeout(() => setMsg(''), 2500)
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={onSave}
        aria-label="احفظ هذا البحث"
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[var(--aqar-sand-2)] px-3 text-xs font-medium text-[var(--aqar-kohl)]/75 hover:border-[var(--aqar-green)]/40"
      >
        <Bookmark className="h-3.5 w-3.5" />احفظ البحث
      </button>
      {msg && (
        <span role="status" aria-live="polite" className="absolute bottom-full z-30 mb-1 w-max rounded-lg bg-[var(--aqar-espresso-fill)] px-2.5 py-1.5 text-[11px] text-white shadow-lg" style={{ insetInlineStart: 0 }}>
          {msg}
        </span>
      )}
    </span>
  )
}
