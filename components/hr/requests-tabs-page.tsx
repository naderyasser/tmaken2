'use client'

import { useEffect, useState } from 'react'
import { frappeClient } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { GenericListPage } from '@/components/hr/generic-list-page'
import { getModuleConfig, type ListModuleConfig } from '@/lib/hr-modules'

const TABS: { id: string; label: string; module: string }[] = [
  { id: 'leaves', label: 'الاجازات', module: 'add-leave' },
  { id: 'permissions', label: 'الاذونات', module: 'add-permission' },
  { id: 'fingerprints', label: 'البصمات', module: 'fingerprint-requests' },
]

/**
 * «الطلبات» — Apex tabs (الاجازات · الاذونات · البصمات) with count badges over
 * the same list toolbar/table as every other list screen.
 */
export function RequestsTabsPage() {
  const [tab, setTab] = useState(TABS[0].id)
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    TABS.forEach((t) => {
      const cfg = getModuleConfig(t.module) as ListModuleConfig | undefined
      if (!cfg) return
      frappeClient.call<number>('frappe.client.get_count', { doctype: cfg.doctype, filters: cfg.filters ?? {} })
        .then((r: any) => setCounts((c) => ({ ...c, [t.id]: Number(r?.message ?? 0) })))
        .catch(() => {})
    })
  }, [])

  const cfg = getModuleConfig(TABS.find((t) => t.id === tab)!.module) as ListModuleConfig

  return (
    <div dir="rtl">
      <div className="mx-4 mt-3 border-t border-b border-slate-200 bg-white">
        <div className="flex items-center">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={cn(
                'relative px-8 h-[70px] text-[19px] font-bold flex items-center gap-2 transition-colors',
                tab === t.id ? 'text-[var(--apex-blue)]' : 'text-slate-500 hover:text-slate-700',
              )}
            >
              <span>{t.label}</span>
              <span className={cn('min-w-[22px] h-[22px] rounded-full text-white text-[12px] flex items-center justify-center px-1',
                tab === t.id ? 'bg-[var(--apex-blue)]' : 'bg-slate-400')}>{counts[t.id] ?? 0}</span>
              {tab === t.id && <span className="absolute bottom-0 right-0 left-0 h-[3px] bg-[var(--apex-blue)]" />}
            </button>
          ))}
        </div>
      </div>
      <GenericListPage key={tab} config={cfg} />
    </div>
  )
}
