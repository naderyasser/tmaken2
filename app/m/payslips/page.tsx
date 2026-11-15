'use client'

import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, Loader2, Printer, Wallet } from 'lucide-react'

import { toLogin } from '@/components/m/use-home'
import { errorText, isSessionError } from '@/lib/m/api'
import { money, payslipMonthLabel, payslipsApi, type PayslipDetail, type PayslipRow } from '@/lib/m/selfservice'

export default function MobilePayslipsPage() {
  const [rows, setRows] = useState<PayslipRow[] | null>(null)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<PayslipDetail | null>(null)
  const [opening, setOpening] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      setRows(await payslipsApi.list())
    } catch (e) {
      if (isSessionError(e)) return toLogin()
      setError(errorText(e))
      setRows([])
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const open = async (name: string) => {
    setOpening(name)
    setError('')
    try {
      setDetail(await payslipsApi.detail(name))
    } catch (e) {
      if (isSessionError(e)) return toLogin()
      setError(errorText(e))
    } finally {
      setOpening('')
    }
  }

  if (detail) return <Detail slip={detail} onBack={() => setDetail(null)} />

  return (
    <>
      <header className="bg-gradient-to-b from-[#1d4d56] to-[#163d44] px-5 pb-5 pt-[max(18px,env(safe-area-inset-top))] text-white">
        <h1 className="text-[20px] font-bold">رواتبي</h1>
        <p className="mt-1 text-[13px] text-white/70">كشوف الرواتب المعتمدة</p>
      </header>
      <div className="space-y-3 px-4 py-4">
        {rows === null && (
          <div className="flex justify-center py-12 text-[#2f7480]">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        )}
        {error && <p role="alert" className="rounded-xl bg-[#fdf6ea] p-4 text-center text-[14px] text-[#7a4c0f]">{error}</p>}
        {rows && rows.length === 0 && !error && (
          <div className="py-14 text-center text-[#7b9396]">
            <Wallet className="mx-auto mb-3 h-10 w-10" strokeWidth={1.5} />
            <p className="text-[14px]">لا توجد كشوف رواتب معتمدة بعد</p>
          </div>
        )}
        {rows?.map((r) => (
          <button
            key={r.name}
            onClick={() => open(r.name)}
            disabled={!!opening}
            className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-start shadow-[0_8px_24px_-18px_rgba(15,42,47,.5)] active:bg-[#f3f6f6]"
          >
            <div>
              <p className="text-[16px] font-bold">{payslipMonthLabel(r)}</p>
              <p className="mt-0.5 text-[12px] tabular-nums text-[#7b9396]">{r.start_date} → {r.end_date}</p>
            </div>
            <div className="text-end">
              <p className="text-[11.5px] text-[#7b9396]">الصافي</p>
              <p className="text-[17px] font-bold tabular-nums text-[#1d4d56]">
                {opening === r.name ? <Loader2 className="inline h-5 w-5 animate-spin" /> : money(r.net_pay)}
              </p>
            </div>
          </button>
        ))}
      </div>
    </>
  )
}

function Detail({ slip, onBack }: { slip: PayslipDetail; onBack: () => void }) {
  return (
    <>
      <header className="bg-gradient-to-b from-[#1d4d56] to-[#163d44] px-5 pb-5 pt-[max(18px,env(safe-area-inset-top))] text-white print:bg-white print:text-black">
        <div className="flex items-center justify-between print:hidden">
          <button onClick={onBack} aria-label="رجوع" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
            <ArrowRight className="h-5 w-5" />
          </button>
          <button onClick={() => window.print()} className="flex h-11 items-center gap-2 rounded-xl bg-white/10 px-4 text-[14px] font-bold">
            <Printer className="h-[18px] w-[18px]" />
            طباعة
          </button>
        </div>
        <h1 className="mt-3 text-[20px] font-bold">كشف راتب {payslipMonthLabel(slip)}</h1>
        {slip.employee_name && <p className="mt-0.5 text-[13px] text-white/70 print:text-black">{slip.employee_name}</p>}
        <p className="mt-3 text-[12px] text-white/65 print:text-black">صافي الراتب</p>
        <p className="text-[28px] font-bold tabular-nums">{money(slip.net_pay)} <span className="text-[14px] font-semibold">{slip.currency || ''}</span></p>
      </header>
      <div className="space-y-3 px-4 py-4">
        <Lines title="الاستحقاقات" lines={slip.earnings} total={slip.gross_pay} tone="in" />
        <Lines title="الاستقطاعات" lines={slip.deductions} total={slip.total_deduction} tone="out" />
        {slip.payment_days != null && (
          <div className="grid grid-cols-3 gap-2 text-center text-[12.5px]">
            <Mini label="أيام الدفع" value={slip.payment_days} />
            <Mini label="أيام العمل" value={slip.total_working_days} />
            <Mini label="أيام الغياب" value={slip.absent_days} />
          </div>
        )}
      </div>
    </>
  )
}

function Lines({ title, lines, total, tone }: { title: string; lines: PayslipDetail['earnings']; total: number; tone: 'in' | 'out' }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-[0_8px_24px_-18px_rgba(15,42,47,.5)]">
      <h2 className="mb-2 text-[14.5px] font-bold">{title}</h2>
      {lines.length === 0 && <p className="py-2 text-[13px] text-[#7b9396]">لا يوجد</p>}
      {lines.map((l, i) => (
        <div key={`${l.salary_component}-${i}`} className="flex min-h-[40px] items-center justify-between border-b border-[#eef3f3] text-[14px] last:border-0">
          <span>{l.salary_component}</span>
          <span className="tabular-nums">{money(l.amount)}</span>
        </div>
      ))}
      <div className={`mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-[14px] font-bold ${tone === 'in' ? 'bg-[#eef8f3]' : 'bg-[#fdf6ea]'}`}>
        <span>الإجمالي</span>
        <span className="tabular-nums">{money(total)}</span>
      </div>
    </section>
  )
}

function Mini({ label, value }: { label: string; value?: number }) {
  return (
    <div className="rounded-xl bg-white py-2.5">
      <p className="text-[#7b9396]">{label}</p>
      <p className="mt-0.5 text-[16px] font-bold tabular-nums">{value ?? '—'}</p>
    </div>
  )
}
