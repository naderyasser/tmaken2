'use client'

/**
 * Freelancer dashboard widgets — revenue-over-time chart and a top-clients list,
 * both aggregated client-side from Sales Invoices. Theme-token colours so they
 * follow the deep-green freelancer theme; RTL-aware.
 */

import Link from 'next/link'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, type AppLocale } from '@/lib/format'

export interface DashInvoice {
  customer?: string
  grand_total?: number
  outstanding_amount?: number
  status?: string
  posting_date?: string
}

function lastMonths(n: number): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`
    out.push({ key, label })
  }
  return out
}

export function RevenueChart({
  invoices, isRTL, lang,
}: {
  invoices: DashInvoice[]
  isRTL: boolean
  lang: AppLocale
}) {
  const money = (v: number) => formatCurrency(v, { locale: lang, currency: 'SAR' })
  const months = lastMonths(12)
  const map: Record<string, { invoiced: number; collected: number }> = {}
  months.forEach((m) => { map[m.key] = { invoiced: 0, collected: 0 } })
  for (const inv of invoices) {
    const pd = (inv.posting_date || '').slice(0, 7)
    if (map[pd]) {
      const gt = Number(inv.grand_total) || 0
      const out = Number(inv.outstanding_amount) || 0
      map[pd].invoiced += gt
      map[pd].collected += Math.max(0, gt - out)
    }
  }
  const data = months.map((m) => ({ name: m.label, invoiced: map[m.key].invoiced, collected: map[m.key].collected }))
  const L = { invoiced: isRTL ? 'مفوتَر' : 'Invoiced', collected: isRTL ? 'محصّل' : 'Collected' }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{isRTL ? 'الإيرادات عبر الزمن' : 'Revenue over time'}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} reversed={isRTL} />
              <YAxis tick={{ fontSize: 11 }} orientation={isRTL ? 'right' : 'left'} width={68}
                tickFormatter={(v) => money(Number(v))} />
              <Tooltip formatter={(v: any) => money(Number(v))} cursor={{ fill: 'hsl(var(--muted))' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="invoiced" name={L.invoiced} fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="collected" name={L.collected} fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function TopClients({
  invoices, isRTL, lang,
}: {
  invoices: DashInvoice[]
  isRTL: boolean
  lang: AppLocale
}) {
  const money = (v: number) => formatCurrency(v, { locale: lang, currency: 'SAR' })
  const agg: Record<string, { invoiced: number; outstanding: number }> = {}
  for (const inv of invoices) {
    const c = inv.customer || (isRTL ? 'غير معروف' : 'Unknown')
    if (!agg[c]) agg[c] = { invoiced: 0, outstanding: 0 }
    agg[c].invoiced += Number(inv.grand_total) || 0
    agg[c].outstanding += Number(inv.outstanding_amount) || 0
  }
  const top = Object.entries(agg)
    .map(([customer, v]) => ({ customer, ...v }))
    .sort((a, b) => b.invoiced - a.invoiced)
    .slice(0, 5)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{isRTL ? 'أعلى العملاء' : 'Top clients'}</CardTitle>
        <Link href="/freelancer/clients" className="text-xs font-medium text-primary hover:underline">
          {isRTL ? 'عرض الكل' : 'View all'}
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {top.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">
            {isRTL ? 'لا توجد بيانات فواتير' : 'No invoice data'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {top.map((c, i) => (
              <li key={c.customer}>
                <Link href="/freelancer/clients" className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="truncate text-sm font-medium text-slate-800">{c.customer}</span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span className="text-xs font-semibold text-slate-700">{money(c.invoiced)}</span>
                    {c.outstanding > 0 && (
                      <span className="text-[10px] text-red-600">
                        {isRTL ? 'مستحق' : 'due'} {money(c.outstanding)}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
