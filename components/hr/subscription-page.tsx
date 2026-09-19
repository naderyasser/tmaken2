'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
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

const NA = 'غير محدد'

interface SubscriptionInfo {
  plan: string | null
  status: string | null
  expires_on: string | null
  days_left: number | null
  employees_used: number | null
  employees_cap: number | null
  support_whatsapp: string | null
  support_email: string | null
}

/** "2026-09-30" → "30-09-2026" — matches the dd-mm-yyyy convention used across the HR shell. */
function fmtDate(d?: string | null): string | null {
  if (!d) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d
}

/**
 * «معلومات الاشتراك» — Apex: two accordions (معلومات الاشتراك · إستهلاك الباقة)
 * and a single تواصل معنا للتجديد action. Usage bars come from live counts on
 * this site; plan/status/expiry come from base_meena.api.hr_settings.get_subscription_info.
 */
export function SubscriptionPage() {
  const { company } = useCompanySafe()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [usage, setUsage] = useState({ employees: 0, users: 0, devices: 0, branches: 0 })
  const [sub, setSub] = useState<SubscriptionInfo | null>(null)
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }))

  useEffect(() => {
    const count = (doctype: string, filters: any = {}) =>
      frappeClient.call<number>('frappe.client.get_count', { doctype, filters }).then((r: any) => Number(r?.message ?? 0)).catch(() => 0)
    Promise.all([
      count('Employee', { status: 'Active' }), count('User', { enabled: 1, user_type: 'System User' }),
      count('Biometric Device'), count('Branch'),
    ]).then(([employees, users, devices, branches]) => setUsage({ employees, users, devices, branches }))

    frappeClient.call<SubscriptionInfo>('base_meena.api.hr_settings.get_subscription_info')
      .then((r: any) => setSub((r?.message ?? r?.data ?? null) as SubscriptionInfo | null))
      .catch(() => setSub(null))
  }, [])

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 text-[15px]">
      <span className="text-slate-600">{k}</span><span className="font-bold text-slate-800">{v}</span>
    </div>
  )
  const Bar = ({ label, used, max }: { label: string; used: number; max: number | null }) => (
    <div className="py-3">
      <div className="flex items-center justify-between text-[14px] mb-1.5"><span className="text-slate-700">{label}</span><span className="text-slate-500">{used} / {max != null ? max : NA}</span></div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">{max != null && <div className="h-full bg-[var(--apex-blue)]" style={{ width: `${Math.min(100, (used / max) * 100)}%` }} />}</div>
    </div>
  )

  const lowDays = typeof sub?.days_left === 'number' && (sub!.days_left as number) <= 14
  const contactHref = sub?.support_whatsapp
    ? `https://wa.me/${sub.support_whatsapp.replace(/[^0-9]/g, '')}`
    : sub?.support_email
      ? `mailto:${sub.support_email}`
      : null

  return (
    <div className="p-4 pt-6" dir="rtl">
      <Accordion title="معلومات الاشتراك" open={!!open.info} onToggle={() => toggle('info')}>
        <Row k="الشركة" v={company || NA} />
        <Row k="الباقة" v={sub?.plan || NA} />
        <Row k="حالة الاشتراك" v={
          <span className="inline-flex items-center gap-2">
            <span className={sub?.status ? 'text-emerald-600' : ''}>{sub?.status || NA}</span>
            {lowDays && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-bold px-2 py-0.5">
                <AlertTriangle className="h-3 w-3" />ينتهي خلال {sub!.days_left} يوم
              </span>
            )}
          </span>
        } />
        <Row k="تاريخ الانتهاء" v={fmtDate(sub?.expires_on) || NA} />
      </Accordion>
      <Accordion title="إستهلاك الباقة" open={!!open.usage} onToggle={() => toggle('usage')}>
        <Bar label="الموظفين" used={sub?.employees_used ?? usage.employees} max={sub?.employees_cap ?? null} />
        <Bar label="المستخدمين" used={usage.users} max={null} />
        <Bar label="الاجهزة" used={usage.devices} max={null} />
        <Bar label="الفروع" used={usage.branches} max={null} />
      </Accordion>
      {contactHref && (
        <div className="flex items-center justify-center mt-2">
          <a
            href={contactHref}
            target="_blank"
            rel="noreferrer"
            className="h-[40px] px-4 rounded bg-[var(--apex-contact-blue)] text-white text-[15px] hover:bg-[var(--apex-contact-blue-hover)] inline-flex items-center justify-center"
          >
            تواصل معنا للتجديد
          </a>
        </div>
      )}
    </div>
  )
}
