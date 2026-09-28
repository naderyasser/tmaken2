'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, AlertTriangle, Check, Loader2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useCompanySafe } from '@/hooks/use-company'
import { useToast } from '@/hooks/use-toast'
import { fmtDate, fmtNumber } from '@/lib/hr-format'

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
  started_on?: string | null
  period?: string | null
  extra_employees?: number | null
  support_whatsapp: string | null
  support_email: string | null
}

interface Package {
  key: string
  label: string
  price: number | string | null
  limits: Record<string, number | null | undefined>
}

interface PackagesResponse {
  packages: Package[]
  active_key: string | null
  configured: boolean
}

const LIMIT_LABEL: Record<string, string> = { employees: 'الموظفين', users: 'المستخدمين', branches: 'الفروع' }

/**
 * «معلومات الاشتراك» — Apex: two accordions (معلومات الاشتراك · إستهلاك الباقة),
 * a package comparison grid (M8), and تجديد/ترقية actions. Plan/status/expiry
 * come from base_meena.api.hr_settings.get_subscription_info; the package
 * catalogue + renewal/upgrade requests come from
 * base_meena.api.hr_subscription (list_packages/request_change) — added for
 * B9/M8. When no catalogue is configured on this site, the grid falls back
 * to a single "current plan" card and the buttons fall back to the contact
 * link, exactly as before.
 */
export function SubscriptionPage() {
  const { company } = useCompanySafe()
  const { toast } = useToast()
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [usage, setUsage] = useState({ employees: 0, users: 0, devices: 0, branches: 0 })
  const [sub, setSub] = useState<SubscriptionInfo | null>(null)
  const [pkgInfo, setPkgInfo] = useState<PackagesResponse | null>(null)
  const [requesting, setRequesting] = useState<string | null>(null)
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

    frappeClient.call<PackagesResponse>('base_meena.api.hr_subscription.list_packages')
      .then((r: any) => setPkgInfo((r?.message ?? r?.data ?? null) as PackagesResponse | null))
      .catch(() => setPkgInfo(null))
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

  const packages = pkgInfo?.packages ?? []
  const activeKey = pkgInfo?.active_key ?? null
  const configured = !!pkgInfo?.configured
  const upgradeTarget = packages.find((p) => p.key !== activeKey) ?? null

  const doRequest = async (pkg: Package, kind: 'renew' | 'upgrade') => {
    setRequesting(pkg.key)
    try {
      await frappeClient.call('base_meena.api.hr_subscription.request_change', {
        package_key: pkg.key,
        note: kind === 'renew' ? 'تجديد الإشتراك' : 'ترقية الإشتراك',
      })
      toast({
        title: 'تم إرسال الطلب',
        description: kind === 'renew'
          ? `تم إرسال طلب تجديد باقة «${pkg.label}»، سنتواصل معك قريباً`
          : `تم إرسال طلب الترقية إلى باقة «${pkg.label}»، سنتواصل معك قريباً`,
      })
    } catch (e: any) {
      toast({ title: 'تعذّر إرسال الطلب', description: e?.message, variant: 'destructive' })
    } finally {
      setRequesting(null)
    }
  }

  const ActionButton = ({ pkg, kind, label }: { pkg: Package; kind: 'renew' | 'upgrade'; label: string }) => (
    <button
      type="button"
      onClick={() => doRequest(pkg, kind)}
      disabled={requesting === pkg.key}
      className="h-[40px] px-5 rounded bg-[var(--apex-bootstrap-blue)] text-white text-[15px] hover:opacity-90 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
    >
      {requesting === pkg.key ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {label}
    </button>
  )
  const ContactLink = ({ label }: { label: string }) => (
    <a
      href={contactHref!}
      target="_blank"
      rel="noreferrer"
      className="h-[40px] px-5 rounded bg-[var(--apex-bootstrap-blue)] text-white text-[15px] hover:opacity-90 inline-flex items-center justify-center"
    >
      {label}
    </a>
  )

  const UNLIMITED = 'لا نهائي'
  const cap = sub?.employees_cap ?? null
  const Cell = ({ k, v, wide }: { k: string; v: React.ReactNode; wide?: boolean }) => (
    <div className={wide ? 'md:col-span-3' : 'md:col-span-2'}>
      <h3 className="text-[16px] font-bold text-slate-800 mb-1">{k}</h3>
      <p className="text-[15px] text-slate-600">{v}</p>
    </div>
  )
  const Usage = ({ label, used, max }: { label: string; used?: number; max?: number | null }) => {
    const limited = max != null && max > 0
    const pct = limited ? Math.min(100, ((used ?? 0) / (max as number)) * 100) : 100
    return (
      <>
        <div className="md:col-span-2"><h3 className="text-[16px] font-bold text-slate-800">{label}</h3></div>
        <div className="md:col-span-10 mt-2">
          <div className="h-1 rounded bg-[var(--apex-blue)]/20 overflow-hidden"><div className="h-full bg-[var(--apex-blue)]" style={{ width: `${pct}%` }} /></div>
          <p className="text-left text-[14px] text-slate-600 mt-1" dir="ltr">{limited ? `${used ?? 0}/${max}` : UNLIMITED}</p>
        </div>
      </>
    )
  }

  // Apex (app-subscription-information): both accordions open — «معلومات الاشتراك»
  // (الباقة · الفترة · تاريخ التفعيل · تاريخ الانتهاء · عدد الأيام المتبقية, الباقة
  // الأساسية, الباقات الإضافية) and «إستهلاك الباقة» (a bar per limit), then
  // «تجديد الإشتراك» · «ترقية الإشتراك». Values come from the site's
  // subscription_* config; anything not capped shows «لا نهائي» like Apex.
  return (
    <div className="p-4 pt-6" dir="rtl">
      <Accordion title="معلومات الاشتراك" open={open.info !== false} onToggle={() => setOpen((o) => ({ ...o, info: o.info === false }))}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-right">
          <Cell k="الباقة" v={sub?.plan || NA} />
          <Cell k="الفترة" v={sub?.period || NA} />
          <Cell k="تاريخ التفعيل" v={sub?.started_on || NA} />
          <Cell k="تاريخ الانتهاء" v={sub?.expires_on || NA} wide />
          <Cell k="عدد الأيام المتبقية" v={
            <span className="inline-flex items-center gap-2">
              {sub?.days_left ?? NA}
              {lowDays && <AlertTriangle className="h-4 w-4 text-amber-600" aria-label="قارب على الانتهاء" />}
            </span>
          } wide />
        </div>
        <hr className="my-5 border-slate-200" />
        <h2 className="text-[20px] font-bold text-slate-800 mb-4 text-right">الباقة الأساسية</h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-right">
          <Cell k="عدد الفروع" v={UNLIMITED} />
          <Cell k="عدد المستخدمين" v={UNLIMITED} />
          <Cell k="عدد الموظفين" v={cap != null ? Math.max(0, cap - (sub?.extra_employees ?? 0)) : UNLIMITED} />
          <Cell k="عدد المخازن" v={UNLIMITED} wide />
          <Cell k="عدد نقاط البيع" v={UNLIMITED} wide />
          <Cell k="عدد العملاء" v={UNLIMITED} />
          <Cell k="عدد الفواتير" v={UNLIMITED} />
          <Cell k="عدد الموردين" v={UNLIMITED} />
          <Cell k="عدد الاصناف" v={UNLIMITED} wide />
        </div>
        <hr className="my-5 border-slate-200" />
        <h2 className="text-[20px] font-bold text-slate-800 mb-4 text-right">الباقات الإضافية</h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-right">
          {sub?.extra_employees ? <Cell k="عدد الموظفين" v={sub.extra_employees} wide /> : <p className="md:col-span-12 text-slate-500 text-[14px]">لا توجد باقات إضافية</p>}
        </div>
      </Accordion>

      <Accordion title="إستهلاك الباقة" open={open.usage !== false} onToggle={() => setOpen((o) => ({ ...o, usage: o.usage === false }))}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-2 items-start text-right">
          <Usage label="عدد الفروع" used={usage.branches} />
          <Usage label="عدد العملاء" />
          <Usage label="عدد المستخدمين" used={usage.users} />
          <Usage label="عدد الموظفين" used={sub?.employees_used ?? usage.employees} max={cap} />
          <Usage label="عدد المخازن" />
          <Usage label="عدد نقاط البيع" />
          <Usage label="عدد الفواتير" />
          <Usage label="عدد الموردين" />
          <Usage label="عدد الاصناف" />
        </div>
      </Accordion>

      <div className="flex items-center justify-around mt-3">
        <div className="flex items-center gap-2">
          {configured && activeKey ? (
            <ActionButton pkg={packages.find((p) => p.key === activeKey)!} kind="renew" label="تجديد الإشتراك" />
          ) : contactHref ? <ContactLink label="تجديد الإشتراك" /> : (
            <button type="button" disabled className="h-[40px] px-5 rounded bg-[var(--apex-bootstrap-blue)] text-white text-[15px] opacity-60">تجديد الإشتراك</button>
          )}
          {configured && upgradeTarget ? (
            <ActionButton pkg={upgradeTarget} kind="upgrade" label="ترقية الإشتراك" />
          ) : contactHref ? <ContactLink label="ترقية الإشتراك" /> : (
            <button type="button" disabled className="h-[40px] px-5 rounded bg-[var(--apex-bootstrap-blue)] text-white text-[15px] opacity-60">ترقية الإشتراك</button>
          )}
        </div>
      </div>
    </div>
  )
}
