'use client'

import { useEffect, useRef, useState } from 'react'
import { Calculator, ChevronDown } from 'lucide-react'
import { tweenNumber } from '@/lib/motion'

function Slider({ label, value, min, max, step, suffix, onChange }: {
  label: string; value: number; min: number; max: number; step: number; suffix: string; onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-[var(--aqar-kohl)]/70">{label}</span>
        <span className="font-bold tabular-nums text-[var(--aqar-green-d)]">{value}{suffix}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="aqar-range w-full" />
    </div>
  )
}

/** Estimate-only monthly payment. Saudi defaults (10% down, 25y, 5% APR), all editable. */
export default function MortgageCalc({ price }: { price: number }) {
  const [open, setOpen] = useState(false)
  const [down, setDown] = useState(10)
  const [years, setYears] = useState(25)
  const [apr, setApr] = useState(5)
  const payRef = useRef<HTMLSpanElement>(null)
  const prev = useRef(0)

  const principal = Math.max(0, (price || 0) * (1 - down / 100))
  const r = apr / 100 / 12
  const n = years * 12
  const monthly = !n ? 0 : r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n))
  const monthlyR = Math.round(monthly || 0)

  useEffect(() => {
    if (!open) return
    tweenNumber(payRef.current, prev.current, monthlyR, 450)
    prev.current = monthlyR
  }, [monthlyR, open])

  return (
    <div className="aqar-card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between px-5 py-4 text-start">
        <span className="flex items-center gap-2 font-semibold text-[var(--aqar-kohl)]"><Calculator className="h-5 w-5 text-[var(--aqar-green)]" />احسب التمويل العقاري</span>
        <ChevronDown className={`h-4 w-4 text-[var(--aqar-kohl)]/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-4 border-t border-[var(--aqar-sand-2)] p-5">
          <Slider label="الدفعة الأولى" value={down} min={0} max={50} step={1} suffix="٪" onChange={setDown} />
          <Slider label="مدة التمويل" value={years} min={5} max={30} step={1} suffix=" سنة" onChange={setYears} />
          <Slider label="نسبة الفائدة السنوية" value={apr} min={1} max={10} step={0.1} suffix="٪" onChange={setApr} />
          <div className="rounded-xl bg-[var(--aqar-green)]/8 p-4 text-center">
            <p className="text-xs text-[var(--aqar-kohl)]/60">القسط الشهري التقديري</p>
            <p className="mt-1 text-2xl font-bold text-[var(--aqar-green-d)]">
              <span ref={payRef} className="tabular-nums">{monthlyR}</span> <span className="text-base">ريال/شهر</span>
            </p>
          </div>
          <p className="text-[11px] leading-5 text-[var(--aqar-kohl)]/45">
            هذا الحساب <span className="font-semibold">تقديري</span> لأغراض الاسترشاد فقط وليس عرضاً تمويلياً. تواصل مع الجهة الممولة لمعرفة الشروط الفعلية.
          </p>
        </div>
      )}
    </div>
  )
}
