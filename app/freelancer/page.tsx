'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  FileText, TrendingUp, Trophy, Clock, RefreshCw, ArrowRight, ArrowLeft, Eye,
  Users, Receipt, Banknote, CircleDollarSign,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { formatCurrency } from '@/lib/format'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { RevenueChart, TopClients, type DashInvoice } from '@/components/freelancer/dashboard-widgets'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentProposal {
  name: string
  title?: string
  party_display_name?: string
  status?: string
  grand_total?: number
  modified?: string
}

interface DashboardStats {
  total: number
  by_status: Record<string, number>
  expected_revenue: number
  won_revenue: number
  expiring_soon: number
  recent: RecentProposal[]
}

// ---------------------------------------------------------------------------
// Status constants (backend stays English; Arabic display-only)
// ---------------------------------------------------------------------------

const PIPELINE: { key: string; ar: string; en: string; color: string }[] = [
  { key: 'Draft', ar: 'مسودة', en: 'Draft', color: '#94a3b8' },
  { key: 'Sent', ar: 'مُرسل', en: 'Sent', color: '#3b82f6' },
  { key: 'Open', ar: 'مفتوح', en: 'Open', color: '#06b6d4' },
  { key: 'Accepted', ar: 'مقبول', en: 'Accepted', color: '#16a34a' },
]

const ALL_STATUSES: { key: string; ar: string; en: string; color: string }[] = [
  ...PIPELINE,
  { key: 'Rejected', ar: 'مرفوض', en: 'Rejected', color: '#dc2626' },
  { key: 'Expired', ar: 'منتهي', en: 'Expired', color: '#d97706' },
]

const STATUS_STYLES: Record<string, string> = {
  Draft: 'bg-slate-100 text-slate-600',
  Sent: 'bg-blue-100 text-blue-700',
  Open: 'bg-cyan-100 text-cyan-700',
  Accepted: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  Expired: 'bg-amber-100 text-amber-800',
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FreelancerDashboardPage() {
  const { t, isRTL, lang } = useI18n()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewedCount, setViewedCount] = useState<number>(0)
  const [invoices, setInvoices] = useState<DashInvoice[]>([])
  const [clientsCount, setClientsCount] = useState<number>(0)

  const statusLabel = (key: string) => {
    const s = ALL_STATUSES.find((x) => x.key === key)
    return s ? (isRTL ? s.ar : s.en) : key
  }

  const load = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)
      const res = await frappeClient.call<DashboardStats>(
        'base_meena.sales_proposal.api.get_freelancer_dashboard_stats',
        {},
      )
      const data = (res?.message ?? (res as any)?.data) as DashboardStats | undefined
      setStats(
        data ?? { total: 0, by_status: {}, expected_revenue: 0, won_revenue: 0, expiring_soon: 0, recent: [] },
      )
      // Secondary metrics — one failing query must not blank the dashboard.
      const [viewedR, invR, custR, leadR] = await Promise.allSettled([
        frappeClient.getList<{ name: string }>('Sales Proposal', {
          fields: ['name'],
          filters: [['Sales Proposal', 'view_count', '>', 0]],
          limit_page_length: 0,
        }),
        frappeClient.getList<DashInvoice>('Sales Invoice', {
          fields: ['customer', 'grand_total', 'outstanding_amount', 'status', 'posting_date'],
          order_by: 'posting_date desc',
          limit_page_length: 0,
        }),
        frappeClient.getList<{ name: string }>('Customer', { fields: ['name'], limit_page_length: 0 }),
        frappeClient.getList<{ name: string }>('Lead', { fields: ['name'], limit_page_length: 0 }),
      ])
      if (viewedR.status === 'fulfilled') setViewedCount(viewedR.value.length)
      setInvoices(invR.status === 'fulfilled' ? invR.value : [])
      setClientsCount(
        (custR.status === 'fulfilled' ? custR.value.length : 0) +
        (leadR.status === 'fulfilled' ? leadR.value.length : 0),
      )
    } catch (err: any) {
      console.error('Failed to load freelancer dashboard:', err)
      setError(err?.message || t('fl.dash.load_fail'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  const money = (v?: number) => formatCurrency(v ?? 0, { locale: lang, currency: 'SAR' })

  const chartData = useMemo(() => {
    if (!stats) return []
    return ALL_STATUSES.map((s) => ({
      name: isRTL ? s.ar : s.en,
      value: stats.by_status?.[s.key] ?? 0,
      color: s.color,
    }))
  }, [stats, isRTL])

  const fin = useMemo(() => {
    let invoiced = 0, collected = 0, outstanding = 0
    for (const inv of invoices) {
      const gt = Number(inv.grand_total) || 0
      const out = Number(inv.outstanding_amount) || 0
      invoiced += gt
      outstanding += out
      collected += Math.max(0, gt - out)
    }
    return { invoiced, collected, outstanding }
  }, [invoices])

  const openProposals =
    (stats?.by_status?.Draft ?? 0) + (stats?.by_status?.Sent ?? 0) + (stats?.by_status?.Open ?? 0)

  // -------------------------------------------------------------------------
  // Loading
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  const Arrow = isRTL ? ArrowLeft : ArrowRight

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{t('fl.dash.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('fl.dash.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
          <RefreshCw className={`me-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {t('fl.common.refresh')}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center justify-between p-4">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="outline" size="sm" onClick={() => load()}>
              {t('fl.common.retry')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: isRTL ? 'العملاء' : 'Clients', value: String(clientsCount), icon: Users, bg: 'bg-accent', fg: 'text-primary' },
          { label: isRTL ? 'عروض مفتوحة' : 'Open proposals', value: String(openProposals), icon: FileText, bg: 'bg-accent', fg: 'text-primary' },
          { label: isRTL ? 'قيمة مقبولة' : 'Accepted value', value: money(stats?.won_revenue), icon: Trophy, bg: 'bg-green-50', fg: 'text-green-600' },
          { label: isRTL ? 'إجمالي الفواتير' : 'Invoiced', value: money(fin.invoiced), icon: Receipt, bg: 'bg-accent', fg: 'text-primary' },
          { label: isRTL ? 'المُحصّل' : 'Collected', value: money(fin.collected), icon: Banknote, bg: 'bg-green-50', fg: 'text-green-600' },
          { label: isRTL ? 'المستحق' : 'Outstanding', value: money(fin.outstanding), icon: CircleDollarSign, bg: fin.outstanding > 0 ? 'bg-red-50' : 'bg-accent', fg: fin.outstanding > 0 ? 'text-red-600' : 'text-primary' },
        ].map(({ label, value, icon: Icon, bg, fg }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2.5 ${bg}`}><Icon className={`h-5 w-5 ${fg}`} /></div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="truncate text-lg font-bold text-slate-900">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: t('fl.dash.expected_revenue'), value: money(stats?.expected_revenue), icon: TrendingUp },
          { label: t('fl.dash.expiring_soon'), value: String(stats?.expiring_soon ?? 0), icon: Clock },
          { label: isRTL ? 'تمت مشاهدته' : 'Viewed by clients', value: String(viewedCount), icon: Eye },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center gap-3 p-4">
              <Icon className="h-4 w-4 shrink-0 text-slate-400" />
              <p className="truncate text-xs text-slate-500">{label}</p>
              <p className="ms-auto text-sm font-bold text-slate-900">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue over time + Top clients */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart invoices={invoices} isRTL={isRTL} lang={lang} />
        </div>
        <TopClients invoices={invoices} isRTL={isRTL} lang={lang} />
      </div>

      {/* Pipeline */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('fl.dash.pipeline')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-stretch gap-2">
            {PIPELINE.map((s, idx) => (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className="flex min-w-[120px] flex-col items-center rounded-lg border px-4 py-3"
                  style={{ borderColor: s.color + '55', backgroundColor: s.color + '11' }}
                >
                  <span className="text-2xl font-bold" style={{ color: s.color }}>
                    {stats?.by_status?.[s.key] ?? 0}
                  </span>
                  <span className="text-xs text-slate-600">{isRTL ? s.ar : s.en}</span>
                </div>
                {idx < PIPELINE.length - 1 && (
                  <Arrow className="h-4 w-4 shrink-0 text-slate-300" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chart + recent */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Breakdown chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('fl.dash.by_status')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} reversed={isRTL} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} orientation={isRTL ? 'right' : 'left'} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Recent proposals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{t('fl.dash.recent')}</CardTitle>
            <Link href="/freelancer/proposals" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              {t('fl.dash.view_all')}
              <Arrow className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {(!stats?.recent || stats.recent.length === 0) ? (
              <div className="px-6 py-10 text-center text-sm text-slate-400">
                {t('fl.dash.no_recent')}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {stats.recent.map((p) => (
                  <li key={p.name}>
                    <Link
                      href="/freelancer/proposals"
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{p.title || p.name}</p>
                        <p className="truncate text-xs text-slate-500">{p.party_display_name || p.name}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs font-semibold text-slate-700">{money(p.grand_total)}</span>
                        {p.status && (
                          <Badge className={`text-[10px] ${STATUS_STYLES[p.status] ?? 'bg-gray-100 text-gray-700'}`}>
                            {statusLabel(p.status)}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
