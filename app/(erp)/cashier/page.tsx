"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Loader2, ShoppingBag, AlertCircle, Clock, Wallet,
  TrendingUp, Calendar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useCashier } from "@/contexts/CashierContext"
import { parseNonNegative, fmtCurrency } from "@/lib/cashier-utils"
import { cashierApi, type CashierSession } from "@/lib/cashier-api"

export default function CashierGatePage() {
  const router = useRouter()
  const { session, isLoadingSession, sessionError, openSession, settings } = useCashier()
  const [openingCash, setOpeningCash] = useState("0")
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState("")
  const [lastSessions, setLastSessions] = useState<CashierSession[]>([])

  // Active session → go to checkout
  useEffect(() => {
    if (session?.status === "Active") {
      router.replace("/cashier/checkout")
    }
  }, [session, router])

  // Load last closed sessions
  useEffect(() => {
    cashierApi.getLastClosedSessions(3)
      .then(res => setLastSessions(res.sessions || []))
      .catch(() => { }) // silent — non-critical
  }, [])

  const handleStartSession = async () => {
    setError("")
    const cash = parseNonNegative(openingCash)
    if (cash < 0 || (openingCash.trim() !== "" && isNaN(parseFloat(openingCash)))) {
      setError("Opening cash must be a valid non-negative number.")
      return
    }
    setStarting(true)
    try {
      await openSession(cash)
      router.replace("/cashier/checkout")
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to open session.")
    } finally {
      setStarting(false)
    }
  }

  // Numpad handler
  const numpadKeys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"]
  const handleNumpad = useCallback((key: string) => {
    setOpeningCash(prev => {
      if (key === "⌫") return prev.length <= 1 ? "0" : prev.slice(0, -1)
      if (key === ".") return prev.includes(".") ? prev : prev + "."
      // max 2 decimal places
      const dotIdx = prev.indexOf(".")
      if (dotIdx !== -1 && prev.length - dotIdx > 2) return prev
      return prev === "0" ? key : prev + key
    })
  }, [])

  if (isLoadingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 [font-family:var(--font-arabic)]"
      dir="rtl"
    >
      <div className="w-full max-w-md space-y-5">
        {/* ── Header icon + title ── */}
        <div className="text-center">
          <div className="h-20 w-20 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4 shadow-sm">
            <ShoppingBag className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-800">فتح جلسة جديدة</h1>
          {settings?.company && (
            <p className="text-sm text-slate-500 mt-1">{settings.company}</p>
          )}
        </div>

        {/* ── Opening cash card ── */}
        <Card className="border-2 border-slate-200 shadow-md rounded-2xl">
          <CardContent className="p-5 space-y-4">
            <label className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
              <Wallet className="h-4 w-4" />
              رصيد الافتتاح
            </label>

            {/* Amount display */}
            <div className="relative">
              <div className="h-16 flex items-center justify-center rounded-xl border-2 border-slate-200 bg-slate-50 text-3xl font-black text-slate-800 tabular-nums tracking-wide" dir="ltr">
                {openingCash || "0"}
                <span className="text-base font-medium text-slate-400 ms-2">
                  {settings?.currency || "SAR"}
                </span>
              </div>
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {numpadKeys.map(key => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleNumpad(key)}
                  className="h-14 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-xl font-bold text-slate-700 transition-colors shadow-sm touch-manipulation"
                >
                  {key}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Errors ── */}
        {(error || sessionError) && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error || sessionError}</span>
          </div>
        )}

        {!settings?.company && !isLoadingSession && (
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>إعدادات المبيعات غير مهيأة. تواصل مع المدير.</span>
          </div>
        )}

        {/* ── Open Session button ── */}
        <Button
          className="w-full h-14 text-lg font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-2 shadow-lg touch-manipulation"
          onClick={handleStartSession}
          disabled={starting || !settings?.company}
        >
          {starting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              جارٍ الفتح...
            </span>
          ) : (
            <>
              <ShoppingBag className="h-5 w-5" />
              فتح الجلسة
            </>
          )}
        </Button>

        {/* ── Last 3 closed sessions ── */}
        {lastSessions.length > 0 && (
          <div className="space-y-2.5">
            <h2 className="text-sm font-bold text-slate-500 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              آخر الجلسات المغلقة
            </h2>
            <div className="space-y-2">
              {lastSessions.map(s => (
                <div
                  key={s.name}
                  className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3"
                >
                  <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 truncate">{s.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {s.session_start ? new Date(s.session_start).toLocaleDateString("ar-SA") : "—"}
                    </p>
                  </div>
                  <div className="text-left shrink-0">
                    <p className="text-sm font-bold text-slate-700">{fmtCurrency(s.closing_cash ?? 0)}</p>
                    {s.variance !== 0 && (
                      <p className={`text-[11px] flex items-center gap-0.5 ${s.variance > 0 ? "text-blue-600" : "text-rose-600"}`}>
                        <TrendingUp className="h-3 w-3" />
                        {s.variance > 0 ? "+" : ""}{fmtCurrency(Math.abs(s.variance))}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
