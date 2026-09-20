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

      {/* M8: package comparison grid — current plan highlighted. Only rendered
          once list_packages has answered (single fallback card when no
          catalogue is configured, so this never claims pricing that doesn't exist). */}
      {packages.length > 0 && (
        <div className="mb-6">
          <p className="text-[16px] font-bold text-slate-800 mb-3 px-1">الباقات المتاحة</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packages.map((pkg) => {
              const isActive = pkg.key === activeKey
              return (
                <div
                  key={pkg.key}
                  className={`rounded-md border p-5 bg-white flex flex-col ${isActive ? 'border-[var(--apex-blue)] ring-1 ring-[var(--apex-blue)]' : 'border-slate-200/70'}`}
                >
                  {isActive && (
                    <span className="self-start mb-2 inline-flex items-center gap-1 rounded-full bg-[var(--apex-blue)]/10 text-[var(--apex-blue)] text-[11px] font-bold px-2 py-0.5">
                      <Check className="h-3 w-3" />الباقة الحالية
                    </span>
                  )}
                  <p className="text-[17px] font-bold text-slate-800">{pkg.label}</p>
                  <p className="text-[20px] font-extrabold text-slate-800 mt-1">
                    {pkg.price != null ? fmtNumber(pkg.price) + ' ر.س' : NA}
                  </p>
                  <div className="mt-3 space-y-1.5 flex-1">
                    {Object.entries(pkg.limits || {}).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-[13px] text-slate-600">
                        <span>{LIMIT_LABEL[k] || k}</span>
                        <span className="font-semibold text-slate-800">{v != null ? fmtNumber(v) : NA}</span>
                      </div>
                    ))}
                    {Object.keys(pkg.limits || {}).length === 0 && (
                      <p className="text-[13px] text-slate-400">{NA}</p>
                    )}
                  </div>
                  <div className="mt-4">
                    {configured ? (
                      <ActionButton pkg={pkg} kind={isActive ? 'renew' : 'upgrade'} label={isActive ? 'تجديد' : 'طلب الترقية'} />
                    ) : contactHref ? (
                      <ContactLink label={isActive ? 'تجديد' : 'طلب الترقية'} />
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 5.26: Apex shows both «تجديد الإشتراك» and «ترقية الإشتراك», centered
          under the accordions — quick actions on top of the grid above.
          Configured catalogue: go straight through request_change with a
          confirmation toast. No catalogue configured: fall back to the
          support WhatsApp/email contact link, exactly as before. */}
      {configured && packages.length > 0 ? (
        <div className="flex items-center justify-center gap-3 mt-2">
          {activeKey && (
            <ActionButton pkg={packages.find((p) => p.key === activeKey)!} kind="renew" label="تجديد الإشتراك" />
          )}
          {upgradeTarget ? (
            <ActionButton pkg={upgradeTarget} kind="upgrade" label="ترقية الإشتراك" />
          ) : contactHref ? (
            <ContactLink label="ترقية الإشتراك" />
          ) : null}
        </div>
      ) : contactHref && (
        <div className="flex items-center justify-center gap-3 mt-2">
          <ContactLink label="تجديد الإشتراك" />
          <ContactLink label="ترقية الإشتراك" />
        </div>
      )}
    </div>
  )
}
