'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useCompanySafe } from '@/hooks/use-company'

function Accordion({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-md shadow-sm border border-slate-200/70 mb-5">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-6 h-[70px] text-[20px] font-bold text-slate-800">
        <span>{title}</span>
        {open ? <ChevronUp className="h-5 w-5 text-slate-500" /> : <ChevronDown className="h-5 w-5 text-slate-500" />}
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  )
}

/**
 * «معلومات الاشتراك» — Apex: two accordions (معلومات الاشتراك · إستهلاك الباقة)
 * and the تجديد / ترقية buttons. Usage comes from live counts on this site.
 */
export function SubscriptionPage() {
  const { company } = useCompanySafe()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [usage, setUsage] = useState({ employees: 0, users: 0, devices: 0, branches: 0 })
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))

  useEffect(() => {
    const count = (doctype: string, filters: any = {}) =>
      frappeClient.call<number>('frappe.client.get_count', { doctype, filters }).then((r: any) => Number(r?.message ?? 0)).catch(() => 0)
    Promise.all([
      count('Employee', { status: 'Active' }), count('User', { enabled: 1, user_type: 'System User' }),
      count('Biometric Device'), count('Branch'),
    ]).then(([employees, users, devices, branches]) => setUsage({ employees, users, devices, branches }))
  }, [])

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 text-[15px]">
      <span className="text-slate-600">{k}</span><span className="font-bold text-slate-800">{v}</span>
    </div>
  )
  const Bar = ({ label, used, max }: { label: string; used: number; max: number }) => (
    <div className="py-3">
      <div className="flex items-center justify-between text-[14px] mb-1.5"><span className="text-slate-700">{label}</span><span className="text-slate-500">{used} / {max}</span></div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-[#2960b6]" style={{ width: `${Math.min(100, (used / max) * 100)}%` }} /></div>
    </div>
  )

  return (
    <div className="p-4 pt-6" dir="rtl">
      <Accordion title="معلومات الاشتراك" open={!!open.info} onToggle={() => toggle('info')}>
        <Row k="الشركة" v={company || '—'} />
        <Row k="الباقة" v="الموارد البشرية — الحضور والانصراف" />
        <Row k="نوع الاشتراك" v="سنوي" />
        <Row k="حالة الاشتراك" v={<span className="text-emerald-600">نشط</span>} />
      </Accordion>
      <Accordion title="إستهلاك الباقة" open={!!open.usage} onToggle={() => toggle('usage')}>
        <Bar label="الموظفين" used={usage.employees} max={100} />
        <Bar label="المستخدمين" used={usage.users} max={100} />
        <Bar label="الاجهزة" used={usage.devices} max={20} />
        <Bar label="الفروع" used={usage.branches} max={50} />
      </Accordion>
      <div className="flex items-center justify-center gap-2 mt-2">
        <button type="button" className="h-[40px] px-4 rounded bg-[#2f7ee6] text-white text-[15px] hover:bg-[#2a6fcc]">تجديد الإشتراك</button>
        <button type="button" className="h-[40px] px-4 rounded bg-[#2f7ee6] text-white text-[15px] hover:bg-[#2a6fcc]">ترقية الإشتراك</button>
      </div>
    </div>
  )
}
