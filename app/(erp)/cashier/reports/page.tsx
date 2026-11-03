"use client"

/**
 * Reports — session/day/period sales report.
 * - KPI cards (sales, invoices, returns count+value, net, average basket)
 * - Payment-method bar/pie + breakdown table, sales-by-hour bar, top items
 * - Period filter: today / current session / custom range (backend get_summary
 *   accepts date + to_date; read-only aggregation)
 * - CSV export + thermal print (lib/cashier/print.ts pipeline)
 * - Offline-friendly: when the server is unreachable the same shape is computed
 *   from the local invoices store (queued + reconciled snapshots)
 * - Fully bilingual AR/EN (cashier.* keys) with correct RTL/LTR
 */

import { useState, useEffect, useCallback } from "react"
import {
  BarChart2, Loader2, RefreshCw, CreditCard, Package, Clock,
  ShoppingBag, RotateCcw, TrendingUp, AlertTriangle, Download, Printer, WifiOff,
} from "lucide-react"
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Legend,
} from "recharts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SessionHeader } from "@/components/cashier/session-header"
import { useCashier } from "@/contexts/CashierContext"
import { cashierApi, type DailySummary } from "@/lib/cashier-api"
import { fmtCurrency } from "@/lib/cashier-utils"
import { useI18n } from "@/lib/i18n"
import { getLocalInvoices } from "@/lib/cashier/offline-catalog"
import { paymentMethodLabel } from "@/lib/cashier/payment-labels"
import { printHtml, getRollWidth } from "@/lib/cashier/print"
import { getBrandSync } from "@/hooks/use-brand"
import { letterheadCss, letterheadHtml } from "@/lib/print-letterhead"

const PIE_COLORS = ["#059669", "#0ea5e9", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4"]

type Period = "today" | "session" | "custom"

/** Offline fallback: rebuild the summary shape from locally-stored invoices so the
 *  report stays useful with zero network. */
async function summaryFromLocal(): Promise<DailySummary> {
  const local = await getLocalInvoices()
  const today = new Date().toISOString().split("T")[0]
  const todays = local.filter(r => (r.invoice?.posting_date || r.createdAt.slice(0, 10)) === today)
  const pays: Record<string, number> = {}
  const hours: Record<string, { count: number; total: number }> = {}
  const items: Record<string, { item_name: string; qty: number; amount: number }> = {}
  let total = 0
  for (const r of todays) {
    const inv = r.invoice
    total += Number(inv.grand_total) || 0
    for (const p of (inv.payments as any[]) || []) {
      pays[p.mode_of_payment] = (pays[p.mode_of_payment] || 0) + (Number(p.amount) || 0)
    }
    const hour = String(inv.posting_time || "00").split(":")[0].padStart(2, "0")
    const h = (hours[hour] = hours[hour] || { count: 0, total: 0 })
    h.count += 1; h.total += Number(inv.grand_total) || 0
    for (const it of (inv.items as any[]) || []) {
      const e = (items[it.item_code] = items[it.item_code] || { item_name: it.item_name || it.item_code, qty: 0, amount: 0 })
      e.qty += Number(it.qty) || 0; e.amount += Number(it.amount) || (Number(it.qty) || 0) * (Number(it.rate) || 0)
    }
  }
  return {
    date: today,
    total_sales: total,
    invoice_count: todays.length,
    total_returns: 0,
    returns_count: 0,
    net_sales: total,
    avg_basket: todays.length ? total / todays.length : 0,
    payment_breakdown: Object.entries(pays).map(([mode_of_payment, amount]) => ({ mode_of_payment, amount })),
    hourly: Object.entries(hours).sort().map(([hour, v]) => ({ hour, ...v })),
    top_items: Object.entries(items).map(([item_code, v]) => ({ item_code, ...v }))
      .sort((a, b) => b.amount - a.amount).slice(0, 10),
  } as DailySummary
}

export default function ReportsPage() {
  const { session } = useCashier()
  const { t, dir, lang } = useI18n()
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [offline, setOffline] = useState(false)
  const [period, setPeriod] = useState<Period>("session")
  const todayStr = new Date().toISOString().split("T")[0]
  const [fromDate, setFromDate] = useState(todayStr)
  const [toDate, setToDate] = useState(todayStr)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    setOffline(false)
    try {
      const params: Record<string, any> = {}
      if (period === "session") params.session = session?.name
      else if (period === "custom") { params.date = fromDate; params.to_date = toDate }
      const data = await cashierApi.getSummary(params)
      setSummary(data)
    } catch (e) {
      // offline → compute from local data instead of a dead end
      try {
        setSummary(await summaryFromLocal())
        setOffline(true)
      } catch {
        setError(e instanceof Error ? e.message : t("cashier.report_failed"))
      }
    } finally {
      setLoading(false)
    }
  }, [session?.name, period, fromDate, toDate, t])

  useEffect(() => { load() }, [load])

  const pieData = (summary?.payment_breakdown ?? []).map(pb => ({ name: paymentMethodLabel(pb.mode_of_payment, lang), value: pb.amount }))
  const hourly = ((summary as any)?.hourly ?? []) as Array<{ hour: string; count: number; total: number }>
  const maxItemAmount = Math.max(1, ...(summary?.top_items ?? []).map(it => it.amount))
  const locale = lang === "ar" ? "ar-SA" : "en-US"

  // ── CSV export (client-side, BOM for Excel-Arabic) ──
  const exportCsv = () => {
    if (!summary) return
    const lines: string[] = []
    lines.push(`${t("cashier.report_title")},${summary.date}`)
    lines.push("")
    lines.push(`${t("cashier.total_sales")},${summary.total_sales}`)
    lines.push(`${t("cashier.invoice_count")},${summary.invoice_count}`)
    lines.push(`${t("cashier.returns")},${summary.total_returns}`)
    lines.push(`${t("cashier.net_sales")},${summary.net_sales}`)
    lines.push(`${t("cashier.avg_basket")},${((summary as any).avg_basket ?? 0).toFixed(2)}`)
    lines.push("")
    lines.push(`${t("cashier.payment_method")},${t("cashier.amount")}`)
    for (const pb of summary.payment_breakdown ?? []) lines.push(`${paymentMethodLabel(pb.mode_of_payment, lang)},${pb.amount}`)
    lines.push("")
    lines.push(`${t("cashier.product")},${t("cashier.quantity")},${t("cashier.sales")}`)
    for (const it of summary.top_items ?? []) lines.push(`"${it.item_name}",${it.qty},${it.amount}`)
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `pos-report-${summary.date}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // ── thermal print via the shared iframe pipeline ──
  const printReport = () => {
    if (!summary) return
    const mm = getRollWidth() === "58" ? 58 : 80
    const rows = (summary.top_items ?? []).map(it =>
      `<tr><td>${it.item_name}</td><td class="n">${it.qty}</td><td class="n">${fmtCurrency(it.amount)}</td></tr>`).join("")
    const pays = (summary.payment_breakdown ?? []).map(pb =>
      `<div class="row"><span>${paymentMethodLabel(pb.mode_of_payment, lang)}</span><span>${fmtCurrency(pb.amount)}</span></div>`).join("")
    void printHtml(`<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8">
      <style>@page{size:${mm}mm auto;margin:2mm}body{width:${mm - 4}mm;margin:0;font-family:Tahoma,sans-serif;font-size:${mm === 58 ? "9.5px" : "11px"}}
      .c{text-align:center}.b{font-weight:700}hr{border:0;border-top:1px dashed #000}
      .row{display:flex;justify-content:space-between}table{width:100%;border-collapse:collapse}td,th{padding:1px 2px;text-align:start}td.n{text-align:end}${letterheadCss({ layout: "receipt" })}</style></head><body>
      ${letterheadHtml(getBrandSync())}
      <div class="c b">${t("cashier.report_title")}</div>
      <div class="c">${summary.date}${session?.name ? ` · ${session.name}` : ""}</div><hr>
      <div class="row"><span>${t("cashier.total_sales")}</span><span class="b">${fmtCurrency(summary.total_sales)}</span></div>
      <div class="row"><span>${t("cashier.invoice_count")}</span><span>${summary.invoice_count}</span></div>
      <div class="row"><span>${t("cashier.returns")}</span><span>${fmtCurrency(summary.total_returns)}</span></div>
      <div class="row b"><span>${t("cashier.net_sales")}</span><span>${fmtCurrency(summary.net_sales)}</span></div><hr>
      <div class="b">${t("cashier.payment_method")}</div>${pays}<hr>
      <table><thead><tr><th>${t("cashier.product")}</th><th class="n">${t("cashier.quantity")}</th><th class="n">${t("cashier.sales")}</th></tr></thead><tbody>${rows}</tbody></table>
      </body></html>`)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 [font-family:var(--font-arabic)]" dir={dir}>
      <SessionHeader />

      {/* ── Toolbar: title, period filter, export/print ── */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-emerald-600" />
          <h1 className="font-bold text-base text-slate-800">{t("cashier.report_title")}</h1>
        </div>
        {summary?.date && (
          <span className="text-xs text-slate-500 bg-slate-100 rounded-full px-2.5 py-1" dir="ltr">{summary.date}</span>
        )}
        {offline && (
          <span className="text-xs bg-amber-100 text-amber-800 rounded-full px-2.5 py-1 flex items-center gap-1">
            <WifiOff className="h-3 w-3" />{t("cashier.report_local")}
          </span>
        )}
        <div className="flex-1" />
        {/* period filter */}
        <div className="flex items-center gap-1.5">
          {([["session", t("cashier.period_session")], ["today", t("cashier.period_today")], ["custom", t("cashier.period_custom")]] as Array<[Period, string]>).map(([p, label]) => (
            <Button key={p} size="sm" variant={period === p ? "default" : "outline"} className="h-9 px-3 text-xs"
              onClick={() => setPeriod(p)}>
              {label}
            </Button>
          ))}
          {period === "custom" && (
            <span className="flex items-center gap-1">
              <Input type="date" className="h-9 w-36 text-xs" value={fromDate} onChange={e => setFromDate(e.target.value)} aria-label={t("cashier.from_date")} />
              <Input type="date" className="h-9 w-36 text-xs" value={toDate} onChange={e => setToDate(e.target.value)} aria-label={t("cashier.to_date")} />
            </span>
          )}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={exportCsv} disabled={!summary} aria-label={t("cashier.export_csv")} title={t("cashier.export_csv")}>
          <Download className="h-3.5 w-3.5" />CSV
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={printReport} disabled={!summary} aria-label={t("cashier.print")} title={t("cashier.print")}>
          <Printer className="h-3.5 w-3.5" />{t("cashier.print")}
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5 text-slate-600 h-9" onClick={load} disabled={loading} aria-label={t("cashier.refresh")}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {t("cashier.refresh")}
        </Button>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-5">
          {error && (
            <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {loading && !summary ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-sm text-slate-500">{t("cashier.report_loading")}</p>
            </div>
          ) : summary ? (
            <>
              {/* ── KPI cards (now 6, incl. average basket + returns count) ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                <KPICard icon={<ShoppingBag className="h-5 w-5 text-emerald-600" />} bg="bg-emerald-50"
                  label={t("cashier.total_sales")} value={fmtCurrency(summary.total_sales)} valueColor="text-emerald-700" />
                <KPICard icon={<BarChart2 className="h-5 w-5 text-sky-600" />} bg="bg-sky-50"
                  label={t("cashier.invoice_count")} value={String(summary.invoice_count)} valueColor="text-sky-700" />
                <KPICard icon={<TrendingUp className="h-5 w-5 text-indigo-600" />} bg="bg-indigo-50"
                  label={t("cashier.avg_basket")} value={fmtCurrency((summary as any).avg_basket ?? 0)} valueColor="text-indigo-700" />
                <KPICard icon={<RotateCcw className="h-5 w-5 text-amber-600" />} bg="bg-amber-50"
                  label={t("cashier.returns")} value={fmtCurrency(summary.total_returns)} valueColor="text-amber-700" />
                <KPICard icon={<RotateCcw className="h-5 w-5 text-rose-600" />} bg="bg-rose-50"
                  label={t("cashier.returns_count")} value={String((summary as any).returns_count ?? 0)} valueColor="text-rose-700" />
                <KPICard icon={<TrendingUp className="h-5 w-5 text-violet-600" />} bg="bg-violet-50"
                  label={t("cashier.net_sales")} value={fmtCurrency(summary.net_sales)} valueColor="text-violet-700" />
              </div>

              {/* ── Sales by hour ── */}
              {hourly.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-sky-600" />
                    <h2 className="text-sm font-bold text-slate-700">{t("cashier.sales_by_hour")}</h2>
                  </div>
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hourly} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} reversed={dir === "rtl"} />
                        <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} orientation={dir === "rtl" ? "right" : "left"} />
                        <Tooltip formatter={(v: number) => [fmtCurrency(v), t("cashier.amount")]}
                          contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                        <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#0ea5e9" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ── Payment-method charts ── */}
              {pieData.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                      <h2 className="text-sm font-bold text-slate-700">{t("cashier.payment_breakdown")}</h2>
                    </div>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={pieData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} reversed={dir === "rtl"} />
                          <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} orientation={dir === "rtl" ? "right" : "left"} />
                          <Tooltip formatter={(v: number) => [fmtCurrency(v), t("cashier.amount")]}
                            contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                          <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#059669" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart2 className="h-4 w-4 text-sky-600" />
                      <h2 className="text-sm font-bold text-slate-700">{t("cashier.payment_share")}</h2>
                    </div>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value">
                            {pieData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v: number) => [fmtCurrency(v), t("cashier.amount")]}
                            contentStyle={{ borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                          <Legend iconType="circle" iconSize={8}
                            formatter={val => <span style={{ fontSize: "11px", color: "#64748b" }}>{val}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Payment breakdown table ── */}
              {summary.payment_breakdown && summary.payment_breakdown.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                    <CreditCard className="h-4 w-4 text-emerald-600" />
                    <h2 className="text-sm font-bold text-slate-700">{t("cashier.payment_detail")}</h2>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {summary.payment_breakdown.map((pb, i) => {
                      const pct = summary.total_sales > 0 ? (pb.amount / summary.total_sales) * 100 : 0
                      return (
                        <div key={i} className={`flex items-center px-4 py-3 gap-4 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                          <span className="text-sm text-slate-700 w-32 shrink-0">{paymentMethodLabel(pb.mode_of_payment, lang)}</span>
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="h-2 rounded-full bg-emerald-500 transition-all" style={{ width: `${pct.toFixed(1)}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 w-10">{pct.toFixed(0)}%</span>
                          <span className="text-sm font-black text-emerald-700 w-24 text-end">{fmtCurrency(pb.amount)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Top items ── */}
              {summary.top_items && summary.top_items.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
                    <Package className="h-4 w-4 text-violet-600" />
                    <h2 className="text-sm font-bold text-slate-700">{t("cashier.top_products")}</h2>
                  </div>
                  <div className="grid grid-cols-5 gap-0 bg-slate-50 border-b border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    <span className="col-span-2">{t("cashier.product")}</span>
                    <span className="text-center">{t("cashier.quantity")}</span>
                    <span className="col-span-2">{t("cashier.sales")}</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {summary.top_items.map((item, i) => {
                      const pct = (item.amount / maxItemAmount) * 100
                      return (
                        <div key={i} className={`grid grid-cols-5 gap-0 items-center px-4 py-3 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}>
                          <div className="col-span-2 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{item.item_name}</p>
                            <p className="text-xs text-slate-400 truncate" dir="ltr">{item.item_code}</p>
                          </div>
                          <p className="text-sm text-center text-slate-600 font-semibold">{item.qty.toLocaleString(locale)}</p>
                          <div className="col-span-2 flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div className="h-2 rounded-full bg-violet-500 transition-all" style={{ width: `${pct.toFixed(1)}%` }} />
                            </div>
                            <span className="text-sm font-black text-violet-700 w-24 text-end">{fmtCurrency(item.amount)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : !error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <BarChart2 className="h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">{t("cashier.no_data")}</p>
              <Button variant="outline" size="sm" onClick={load}>{t("cashier.load_report")}</Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function KPICard({ icon, bg, label, value, valueColor = "text-slate-800" }: {
  icon: React.ReactNode; bg: string; label: string; value: string; valueColor?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>{icon}</div>
      <p className="text-xs text-slate-500 mb-0.5">{label}</p>
      <p className={`text-base font-black ${valueColor}`}>{value}</p>
    </div>
  )
}
