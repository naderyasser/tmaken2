"use client"

/**
 * "My commission" — the rep's own view.
 *
 * Deliberately shows the same numbers the back office sees, scoped to one
 * person by the server. A commission scheme a rep cannot check gets treated as
 * a rumour; showing pending vs approved vs paid separately is what makes the
 * difference between "the company owes me" and "the company paid me" legible
 * without anyone having to ask.
 */

import { useState, useEffect, useCallback } from "react"
import { Percent, RefreshCw, Loader2, Clock, CheckCircle2, Wallet, TrendingUp, Receipt } from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { commissionApi, type MyCommission } from "@/lib/commission-api"
import { formatSAR, formatDateShort } from "@/lib/sales-format"

/** First and last day of a YYYY-MM month, in local time. */
function monthBounds(month: string): { from_date: string; to_date: string } {
  const [y, m] = month.split("-").map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from_date: `${month}-01`, to_date: `${month}-${String(last).padStart(2, "0")}` }
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export default function SalesRepCommissionPage() {
  const { t, lang } = useI18n()

  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState<MyCommission | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const fmt = (v: number | undefined | null) => formatSAR(v || 0, lang)
  const fmtDate = (v?: string | null) => formatDateShort(v, lang)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      setData(await commissionApi.getMyCommission(monthBounds(month)))
    } catch {
      setLoadError(true)
    }
    setLoading(false)
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (loadError || !data) {
    return (
      <div className="p-4">
        <div className="text-center py-16 bg-white rounded-xl shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Percent className="w-7 h-7 text-gray-400" />
          </div>
          <p className="font-semibold text-gray-700">{t("sr.commission.unavailable")}</p>
          <p className="text-sm text-gray-400 mt-1">{t("sr.commission.unavailable_hint")}</p>
          <button onClick={load} className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 font-semibold">
            {t("sr.commission.retry")}
          </button>
        </div>
      </div>
    )
  }

  const stats = [
    { label: t("sr.commission.pending"), value: fmt(data.pending), bg: "bg-amber-50", dot: "bg-amber-500", Icon: Clock },
    { label: t("sr.commission.approved"), value: fmt(data.approved), bg: "bg-blue-50", dot: "bg-blue-500", Icon: CheckCircle2 },
    { label: t("sr.commission.paid"), value: fmt(data.paid), bg: "bg-emerald-50", dot: "bg-emerald-500", Icon: Wallet },
    { label: t("sr.commission.sales_base"), value: fmt(data.base_total), bg: "bg-purple-50", dot: "bg-purple-500", Icon: TrendingUp },
  ]

  return (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{t("sr.commission.title")}</h1>
          <p className="text-xs text-gray-400">{t("sr.commission.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border rounded-lg px-2 py-1.5 text-sm"
          />
          <button
            onClick={load}
            className="h-9 w-9 flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Headline: what the rep is owed right now. Pending + approved, because
          both are money earned and neither has been handed over yet. */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 text-white p-5 shadow-sm">
        <p className="text-xs font-semibold text-emerald-100">{t("sr.commission.owed")}</p>
        <p className="text-3xl font-extrabold mt-1">{fmt(data.pending + data.approved)}</p>
        <p className="text-[11px] text-emerald-100 mt-1">{t("sr.commission.owed_hint")}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map((s, i) => (
          <div key={i} className={`rounded-xl shadow-sm p-4 ${s.bg}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
              <p className="text-[10px] font-semibold text-gray-500 truncate">{s.label}</p>
            </div>
            <p className="text-lg font-extrabold text-gray-900 truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Entries */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-2">{t("sr.commission.entries")}</h2>
        {data.entries.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <p className="text-sm text-gray-400">{t("sr.commission.no_entries")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.entries.map((e) => (
              <div key={e.name} className="bg-white rounded-xl shadow-sm p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {e.customer_name || e.customer || e.sales_invoice}
                    </p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {e.sales_invoice || e.reference_name} · {fmtDate(e.posting_date)}
                    </p>
                  </div>
                  <div className="text-end flex-shrink-0">
                    <p className={`font-extrabold ${e.commission_amount < 0 ? "text-red-600" : "text-gray-900"}`}>
                      {fmt(e.commission_amount)}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {fmt(e.base_amount)} × {e.commission_percent}%
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      e.status === "Paid"
                        ? "bg-emerald-100 text-emerald-700"
                        : e.status === "Approved"
                          ? "bg-blue-100 text-blue-700"
                          : e.status === "Cancelled"
                            ? "bg-gray-100 text-gray-500"
                            : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {t(`sr.commission.status_${e.status.toLowerCase()}`)}
                  </span>
                  {e.entry_type === "Reversal" && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      {t("sr.commission.reversal")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payouts */}
      {data.payouts.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-2">{t("sr.commission.payouts")}</h2>
          <div className="space-y-2">
            {data.payouts.map((p) => (
              <div key={p.name} className="bg-white rounded-xl shadow-sm p-3.5 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-[11px] text-gray-400">
                    {fmtDate(p.from_date)} → {fmtDate(p.to_date)}
                  </p>
                </div>
                <div className="text-end flex-shrink-0">
                  <p className="font-extrabold text-gray-900">{fmt(p.total_amount)}</p>
                  <p className="text-[11px] text-gray-400">{t(`sr.commission.status_${p.status.toLowerCase()}`)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
