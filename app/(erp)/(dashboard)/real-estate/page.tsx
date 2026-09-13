'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'
import { realEstateApi, type AqarDashboard, type AqarDashboardExtras } from '@/lib/real-estate-api'
import { formatNumber, formatPrice, dualDate, timeAgo } from '@/lib/aqar-format'
import { DashboardCharts } from '@/components/real-estate/dashboard-charts'
import {
  Building2, Clock, AlertTriangle, CalendarClock, Users, Coins, Flag, Plus, ArrowUpRight,
  History, MessageCircle, ShieldCheck, Star, Settings, ImageOff, FileText, Inbox,
} from 'lucide-react'

interface KpiDef {
  key: keyof AqarDashboard
  labelKey: string
  icon: typeof Building2
  tone: string
  money?: boolean
  href?: string
  external?: boolean   // href points to the Frappe desk (/app/…) → full-page nav
}

// Contract types (internal → Arabic) for the contract-requests strip.
const CTYPE_AR: Record<string, string> = {
  'Residential Rent': 'إيجار سكني', 'Commercial Rent': 'إيجار تجاري', Sale: 'بيع', Brokerage: 'وساطة / تسويق',
}
// In-dashboard request inboxes (never the Frappe desk).
const CONTRACTS_LIST = '/real-estate/contracts'
const LEADS_LIST = '/real-estate/leads'
const LTOPIC_AR: Record<string, string> = {
  Auctions: 'حراج عقارات', 'Property Management': 'إدارة أملاك', Investment: 'استثمار', Other: 'أخرى',
}

const KPIS: KpiDef[] = [
  { key: 'active', labelKey: 're.kpiActive', icon: Building2, tone: 'text-emerald-700 bg-emerald-50', href: '/real-estate/listings?status=Active' },
  { key: 'pending', labelKey: 're.kpiPending', icon: Clock, tone: 'text-amber-700 bg-amber-50', href: '/real-estate/listings?status=Pending License' },
  { key: 'expiring_7', labelKey: 're.kpiExpiring7', icon: AlertTriangle, tone: 'text-red-700 bg-red-50', href: '/real-estate/compliance' },
  { key: 'expiring_30', labelKey: 're.kpiExpiring30', icon: CalendarClock, tone: 'text-orange-700 bg-orange-50', href: '/real-estate/compliance' },
  { key: 'expired', labelKey: 're.kpiExpired', icon: CalendarClock, tone: 'text-gray-700 bg-gray-100', href: '/real-estate/listings?status=Expired' },
  { key: 'advertisers', labelKey: 're.kpiAdvertisers', icon: Users, tone: 'text-blue-700 bg-blue-50' },
  { key: 'promotion_revenue', labelKey: 're.kpiRevenue', icon: Coins, tone: 'text-violet-700 bg-violet-50', money: true, href: '/real-estate/promotions' },
  { key: 'open_reports', labelKey: 're.kpiReports', icon: Flag, tone: 'text-rose-700 bg-rose-50', href: '/real-estate/moderation' },
  { key: 'new_contracts', labelKey: 're.kpiNewContracts', icon: FileText, tone: 'text-teal-700 bg-teal-50', href: `${CONTRACTS_LIST}?status=New` },
  { key: 'new_leads', labelKey: 're.kpiNewLeads', icon: Inbox, tone: 'text-sky-700 bg-sky-50', href: `${LEADS_LIST}?status=New` },
]

const STATUS_TONE: Record<string, string> = {
  Active: 'bg-emerald-100 text-emerald-800', Draft: 'bg-gray-100 text-gray-600', Expired: 'bg-orange-100 text-orange-800',
  Rejected: 'bg-red-100 text-red-800', Sold: 'bg-blue-100 text-blue-800', 'Pending License': 'bg-amber-100 text-amber-800',
}
const ACT_ICON = { audit: History, comment: MessageCircle, report: Flag } as const

// Internal value → i18n key (never print raw internal strings in the UI)
const STATUS_KEY: Record<string, string> = {
  Active: 're.statusActive', Draft: 're.statusDraft', 'Pending License': 're.statusPending',
  Expired: 're.statusExpired', Rejected: 're.statusRejected', Sold: 're.statusSold',
}
const AUDIT_KEY: Record<string, string> = {
  'Category Created': 're.log.catCreated', 'Category Updated': 're.log.catUpdated',
  'Category Enabled': 're.log.catEnabled', 'Category Disabled': 're.log.catDisabled',
  'Categories Reordered': 're.log.catReordered', 'Listings Reassigned': 're.log.listingsReassigned',
  'Category Deleted': 're.log.catDeleted', 'Advertiser Updated': 're.log.advUpdated',
  'Verification Set': 're.log.verifySet', 'Verification Cleared': 're.log.verifyCleared',
  'Advertiser Suspended': 're.log.advSuspended', 'Advertiser Banned': 're.log.advBanned',
  'Unpublished (Banned)': 're.log.unpubBanned', 'Advertiser Unbanned': 're.log.advUnbanned',
  'Republished (Unban)': 're.log.republished', 'Advertiser Deleted': 're.log.advDeleted',
  'Role Granted': 're.log.roleGranted', 'Role Revoked': 're.log.roleRevoked',
  'Force Unpublished': 're.log.forceUnpub', 'Force Featured': 're.log.forceFeat',
  'Force Unfeatured': 're.log.forceUnfeat', 'Listing Transferred': 're.log.transferred',
  'Admin Re-license Edit': 're.log.relicense', 'Service Created': 're.log.svcCreated',
  'Service Updated': 're.log.svcUpdated', 'Service Deleted': 're.log.svcDeleted',
  'Promotion Created': 're.log.promoCreated', 'Promotion Updated': 're.log.promoUpdated',
  'Promotion Deleted': 're.log.promoDeleted', 'Geo Renamed': 're.log.geoRenamed',
  'District Added': 're.log.districtAdded', 'Module Flag Changed': 're.log.flagChanged',
  Created: 're.log.created', Published: 're.log.published',
  'Status Changed': 're.log.statusChanged', Updated: 're.log.updated',
}
const REPORT_REASON_KEY: Record<string, string> = {
  Fraud: 're.report.fraud', 'Wrong Info': 're.report.wrongInfo', Duplicate: 're.report.duplicate',
  Inappropriate: 're.report.inappropriate', 'Already Sold': 're.report.alreadySold',
  Spam: 're.report.spam', Other: 're.report.other',
}
const REPORT_STATUS_KEY: Record<string, string> = {
  Open: 're.repstatus.open', 'Under Review': 're.repstatus.underReview',
  Resolved: 're.repstatus.resolved', Dismissed: 're.repstatus.dismissed',
}

export default function RealEstateDashboard() {
  const { t, lang, isRTL } = useI18n()
  const router = useRouter()
  const [data, setData] = useState<AqarDashboard | null>(null)
  const [extras, setExtras] = useState<AqarDashboardExtras | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true); setError(null)
    try {
      const [d, e] = await Promise.all([realEstateApi.getDashboard(), realEstateApi.getDashboardExtras()])
      setData(d); setExtras(e)
    } catch (e: any) {
      setError(e?.message || t('re.error'))
    } finally { setLoading(false) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [])

  const daysChip = (n: number) =>
    n <= 7 ? 'bg-red-100 text-red-700' : n <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'

  // localize internal values via i18n (fallback to raw only if an unknown value slips through)
  const statusLabel = (s?: string) => (s && STATUS_KEY[s] ? t(STATUS_KEY[s]) : s || '')
  const activityTitle = (a: AqarDashboardExtras['activity'][number]) => {
    if (a.type === 'comment') return t('re.log.comment')
    if (a.type === 'report') return `${t('re.log.report')}: ${REPORT_REASON_KEY[a.title] ? t(REPORT_REASON_KEY[a.title]) : a.title}`
    return AUDIT_KEY[a.title] ? t(AUDIT_KEY[a.title]) : a.title
  }
  const activityDetail = (a: AqarDashboardExtras['activity'][number]) => {
    if (!a.detail) return ''
    if (a.type === 'report') return REPORT_STATUS_KEY[a.detail] ? t(REPORT_STATUS_KEY[a.detail]) : a.detail
    return a.detail
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('re.title')}</h1>
          <p className="text-sm text-gray-500">{isRTL ? 'نظرة شاملة على المتجر' : 'Marketplace at a glance'}</p>
        </div>
        <button onClick={() => router.push('/real-estate/listings/new')} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">
          <Plus className="h-4 w-4" />{t('re.newListing')}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error} · <button onClick={load} className="font-semibold underline">{t('re.retry')}</button>
        </div>
      )}

      {/* KPI tiles (status tiles are clickable → filtered listings) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {KPIS.map((kpi) => {
          const Icon = kpi.icon
          const value = data ? data[kpi.key] : 0
          const clickable = !!kpi.href
          return (
            <button
              key={kpi.key}
              disabled={!clickable}
              onClick={() => { if (!kpi.href) return; if (kpi.external) window.location.href = kpi.href; else router.push(kpi.href) }}
              className={`rounded-2xl border-2 border-gray-100 bg-white p-5 text-start transition-colors ${clickable ? 'hover:border-emerald-200 cursor-pointer' : 'cursor-default'}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${kpi.tone}`}><Icon className="h-5 w-5" /></span>
                {clickable && <ArrowUpRight className={`h-4 w-4 text-gray-300 ${isRTL ? 'rotate-[270deg]' : ''}`} />}
              </div>
              <p className="text-sm text-gray-500">{t(kpi.labelKey)}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                {loading ? '—' : kpi.money ? formatPrice(value as number, lang as 'ar' | 'en') : formatNumber(value as number, lang as 'ar' | 'en')}
              </p>
            </button>
          )
        })}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {[
          { href: '/real-estate/listings', label: isRTL ? 'الإعلانات' : 'Listings', icon: Building2 },
          { href: '/real-estate/moderation', label: isRTL ? 'البلاغات' : 'Moderation', icon: Flag },
          { href: '/real-estate/promotions', label: isRTL ? 'الترقيات' : 'Promotions', icon: Star },
          { href: '/real-estate/compliance', label: isRTL ? 'الامتثال' : 'Compliance', icon: ShieldCheck },
          { href: '/real-estate/settings', label: isRTL ? 'الإعدادات' : 'Settings', icon: Settings },
        ].map((a) => (
          <Link key={a.href} href={a.href} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-emerald-200 hover:text-emerald-800">
            <a.icon className="h-4 w-4" />{a.label}
          </Link>
        ))}
        <Link href={CONTRACTS_LIST} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-emerald-200 hover:text-emerald-800">
          <FileText className="h-4 w-4" />{t('re.contractRequests')}
        </Link>
        <Link href={LEADS_LIST} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:border-emerald-200 hover:text-emerald-800">
          <Inbox className="h-4 w-4" />{t('re.incomingLeads')}
        </Link>
      </div>

      {/* Charts */}
      {extras ? <DashboardCharts extras={extras} /> : <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-[260px] animate-pulse rounded-2xl bg-gray-100" />)}</div>}

      {/* Recent listings strip */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{isRTL ? 'أحدث الإعلانات' : 'Recent listings'}</h2>
          <Link href="/real-estate/listings" className="text-sm font-medium text-emerald-700 hover:underline">{isRTL ? 'الكل' : 'All'}</Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{[...Array(6)].map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100" />)}</div>
        ) : !extras?.recent?.length ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center text-gray-400">{isRTL ? 'لا توجد إعلانات بعد' : 'No listings yet'}</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {extras.recent.map((l) => (
              <Link key={l.name} href={`/real-estate/listings/${l.name}`} className="group overflow-hidden rounded-2xl border-2 border-gray-100 bg-white transition-colors hover:border-emerald-200">
                <div className="relative aspect-[4/3] bg-gray-100">
                  {l.primary_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.primary_image} alt={l.title} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-300"><ImageOff className="h-6 w-6" /></div>
                  )}
                  <span className={`absolute top-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[l.status || 'Draft']}`} style={{ insetInlineStart: '0.375rem' }}>{statusLabel(l.status)}</span>
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-1 text-xs font-medium text-gray-900">{l.title}</p>
                  <p className="line-clamp-1 text-[11px] text-gray-400">{l.district_name_ar || ''}</p>
                  <p className="mt-1 text-xs font-semibold tabular-nums text-emerald-700">{formatPrice(l.price, lang as 'ar' | 'en')}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Expiring + Activity */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border-2 border-gray-100 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><AlertTriangle className="h-4 w-4 text-amber-500" />{isRTL ? 'تراخيص تقترب من الانتهاء' : 'Licenses expiring soon'}</h2>
          {!extras?.expiring?.length ? (
            <p className="py-6 text-center text-sm text-gray-400">{isRTL ? 'لا شيء قريب من الانتهاء' : 'Nothing expiring soon'}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {extras.expiring.map((e) => (
                <Link key={e.name} href={`/real-estate/listings/${e.name}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm text-gray-900">{e.title}</p>
                    <p className="text-[11px] text-gray-400">{dualDate(e.rega_license_expiry, lang as 'ar' | 'en')}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums ${daysChip(e.days_left)}`}>
                    {isRTL ? `${e.days_left} يوم` : `${e.days_left}d`}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border-2 border-gray-100 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900"><History className="h-4 w-4 text-emerald-600" />{isRTL ? 'آخر النشاطات' : 'Recent activity'}</h2>
          {!extras?.activity?.length ? (
            <p className="py-6 text-center text-sm text-gray-400">{isRTL ? 'لا نشاط بعد' : 'No activity yet'}</p>
          ) : (
            <div className="space-y-3">
              {extras.activity.map((a) => {
                const Icon = ACT_ICON[a.type] || History
                return (
                  <div key={`${a.type}-${a.name}`} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500"><Icon className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm text-gray-800">
                        <span className="font-medium">{activityTitle(a)}</span>
                        {activityDetail(a) ? <span className="text-gray-400"> — {activityDetail(a)}</span> : null}
                      </p>
                      <p className="text-[11px] text-gray-400">{a.who || ''} · {timeAgo(a.creation, lang as 'ar' | 'en')}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Incoming requests — in-dashboard inboxes (no Frappe desk redirect) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Contract requests (إدارة العقود) */}
        <section className="rounded-2xl border-2 border-gray-100 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><FileText className="h-4 w-4 text-teal-600" />{t('re.contractRequests')}</h2>
            <Link href={CONTRACTS_LIST} className="text-sm font-medium text-emerald-700 hover:underline">{t('re.contractsAll')}</Link>
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />)}</div>
          ) : !extras?.contracts?.length ? (
            <p className="py-6 text-center text-sm text-gray-400">{t('re.noContracts')}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {extras.contracts.map((c) => (
                <Link key={c.name} href={`${CONTRACTS_LIST}/${c.name}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm text-gray-900">{c.applicant_name || c.name}</p>
                    <p className="text-[11px] text-gray-400">{CTYPE_AR[c.contract_type] || c.contract_type} · {timeAgo(c.creation, lang as 'ar' | 'en')}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-teal-800">{c.name}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Incoming leads (notify-me / service forms) */}
        <section className="rounded-2xl border-2 border-gray-100 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Inbox className="h-4 w-4 text-sky-600" />{t('re.incomingLeads')}</h2>
            <Link href={LEADS_LIST} className="text-sm font-medium text-emerald-700 hover:underline">{t('re.contractsAll')}</Link>
          </div>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />)}</div>
          ) : !extras?.leads?.length ? (
            <p className="py-6 text-center text-sm text-gray-400">{t('re.noLeads')}</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {extras.leads.map((l) => (
                <Link key={l.name} href={`${LEADS_LIST}/${l.name}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm text-gray-900">{l.lead_name || l.contact || l.name}</p>
                    <p className="text-[11px] text-gray-400">{LTOPIC_AR[l.topic] || l.topic} · {timeAgo(l.creation, lang as 'ar' | 'en')}</p>
                  </div>
                  <Inbox className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
