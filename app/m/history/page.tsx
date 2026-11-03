'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

import { toLogin } from '@/components/m/use-home'
import {
  AR_DAYS, AR_MONTHS, duration, errorText, hhmm, isSessionError, mcall, parseServerTime, workedMinutes,
  type HistoryData,
} from '@/lib/m/api'

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function MobileHistoryPage() {
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [data, setData] = useState<HistoryData | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (m: string) => {
    setLoading(true)
    setError('')
    try {
      setData(await mcall<HistoryData>('get_history', { month: m }))
    } catch (e) {
      if (isSessionError(e)) return toLogin()
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(month)
  }, [month, load])

  const [y, mo] = month.split('-').map(Number)
  const shift = (delta: number) => setMonth(monthKey(new Date(y, mo - 1 + delta, 1)))
  const isCurrent = month === monthKey(new Date())
  const presentDays = data?.days.filter((d) => d.punches.some((p) => p.log_type === 'IN')).length ?? 0
  const totalMinutes = data?.days.reduce((s, d) => s + (d.punches[d.punches.length - 1]?.log_type === 'OUT' ? workedMinutes(d.punches, new Date()) : 0), 0) ?? 0

  return (
    <>
      <header className="bg-gradient-to-b from-[#1d4d56] to-[#163d44] px-5 pb-5 pt-[max(18px,env(safe-area-inset-top))] text-white">
        <h1 className="text-[20px] font-bold">سجل الحضور</h1>
        <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 p-1.5">
          <button onClick={() => shift(-1)} aria-label="الشهر السابق" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10">
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="text-[15px] font-semibold">{AR_MONTHS[mo - 1]} {y}</span>
          <button
            onClick={() => shift(1)}
            disabled={isCurrent}
            aria-label="الشهر التالي"
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stat label="أيام الحضور" value={String(presentDays)} />
          <Stat label="ساعات العمل المكتملة" value={totalMinutes ? duration(totalMinutes) : '—'} />
        </div>
      </header>

      <div className="space-y-3 px-4 py-4">
        {loading && (
          <div className="flex justify-center py-12 text-[#2f7480]">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        )}
        {!loading && error && <p className="rounded-xl bg-[#fdf6ea] p-4 text-center text-[14px] text-[#7a4c0f]">{error}</p>}
        {!loading && !error && data?.days.length === 0 && (
          <p className="py-14 text-center text-[14px] text-[#7b9396]">لا توجد حركات في هذا الشهر</p>
        )}
        {!loading &&
          data?.days.map((d) => {
            const date = parseServerTime(`${d.date} 00:00:00`)
            const first = d.punches.find((p) => p.log_type === 'IN')
            const lastOut = [...d.punches].reverse().find((p) => p.log_type === 'OUT')
            const done = d.punches[d.punches.length - 1]?.log_type === 'OUT'
            return (
              <article key={d.date} className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_-18px_rgba(15,42,47,.5)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 flex-col items-center justify-center rounded-xl bg-[#eef3f3] leading-none">
                      <span className="text-[17px] font-bold text-[#1d4d56]">{date.getDate()}</span>
                    </span>
                    <div>
                      <p className="text-[14.5px] font-bold">{AR_DAYS[date.getDay()]}</p>
                      <p className="text-[12px] text-[#7b9396]">{d.punches.length} حركة</p>
                    </div>
                  </div>
                  {done && <span className="text-[13px] font-semibold tabular-nums text-[#2f7480]">{duration(workedMinutes(d.punches, new Date()))}</span>}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                  <Cell label="الحضور" value={first ? hhmm(first.time) : '—'} tone="in" />
                  <Cell label="الانصراف" value={lastOut ? hhmm(lastOut.time) : '—'} tone="out" />
                </div>
              </article>
            )
          })}
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2.5">
      <p className="text-[11.5px] text-white/65">{label}</p>
      <p className="mt-0.5 text-[18px] font-bold tabular-nums">{value}</p>
    </div>
  )
}

function Cell({ label, value, tone }: { label: string; value: string; tone: 'in' | 'out' }) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${tone === 'in' ? 'bg-[#eef8f3]' : 'bg-[#fdf6ea]'}`}>
      <span className="text-[#5b7a7f]">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  )
}
