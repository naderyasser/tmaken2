'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'

import type { Package } from '@/lib/store-api'

const TIERS = ['silver', 'gold', 'diamond'] as const
const PERKS = [
  'ربط أجهزة البصمة وتطبيق الجوال',
  'فروع ومستخدمين بلا حد',
  'كل التقارير والدوامات',
  'تحديثات ودعم فني',
]

export const sar = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ر.س`

function tierFor(packages: Record<string, Package>, n: number) {
  return TIERS.find((k) => packages[k] && n >= packages[k].min && (!packages[k].max || n <= packages[k].max!)) || 'silver'
}

/** Packages + a live «how much for my team» calculator. Prices come from the
 *  server's price list (site_creator.hr_clients.PACKAGES). */
export function Pricing({ packages }: { packages: Record<string, Package> }) {
  const [count, setCount] = useState(50)
  const [years, setYears] = useState(1)
  const tier = tierFor(packages, count)
  const p = packages[tier]
  const calc = useMemo(() => {
    const annual = Math.round(p.rate * count * 100) / 100
    return { annual, total: Math.round((annual * years + p.setup) * 100) / 100 }
  }, [p, count, years])

  return (
    <div>
      <div className="grid gap-5 md:grid-cols-3">
        {TIERS.filter((k) => packages[k]).map((k) => {
          const pk = packages[k]
          const on = k === tier
          return (
            <div
              key={k}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 transition ${on ? 'border-[#24817f] shadow-[0_24px_60px_-30px_rgba(29,77,86,.55)] ring-2 ring-[#24817f]' : 'border-[#dbe5e6]'}`}
            >
              {k === 'gold' && (
                <span className="absolute -top-3 right-6 rounded-full bg-[#f0ae4f] px-3 py-1 text-[12px] font-bold text-[#3b2a09]">الأكثر طلباً</span>
              )}
              <h3 className="text-[19px] font-bold text-[#163d44]">الباقة {pk.label}</h3>
              <p className="mt-1 text-[13.5px] text-[#5b7a7f]">{pk.max ? `من ${pk.min} إلى ${pk.max} موظف` : `${pk.min} موظف فأكثر`}</p>
              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="text-[38px] font-extrabold leading-none text-[#163d44] tabular-nums">{pk.rate}</span>
                <span className="text-[14px] text-[#5b7a7f]">ر.س للموظف / سنوياً</span>
              </p>
              <p className="mt-2 text-[13.5px] text-[#5b7a7f]">رسوم تأسيس لمرة واحدة <b className="text-[#163d44]">{sar(pk.setup)}</b></p>
              <ul className="mt-5 space-y-2.5 text-[14px] text-[#2c4a50]">
                {PERKS.map((t) => (
                  <li key={t} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-[#2f9e6f]" />{t}</li>
                ))}
              </ul>
              <Link
                href={`/subscribe?package=${k}&employees=${on ? count : pk.min}`}
                className={`mt-6 flex h-11 items-center justify-center rounded-xl text-[15px] font-bold transition ${on ? 'bg-[#24817f] text-white hover:bg-[#1d6b69]' : 'border border-[#24817f] text-[#24817f] hover:bg-[#e6f4f2]'}`}
              >
                اشترك الآن
              </Link>
            </div>
          )
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-[#dbe5e6] bg-white p-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-[240px] flex-1">
            <label htmlFor="calc-count" className="text-[14px] font-bold text-[#163d44]">احسب تكلفتك — عدد الموظفين</label>
            <div className="mt-3 flex items-center gap-4">
              <input id="calc-count" type="range" min={1} max={500} value={count} onChange={(e) => setCount(+e.target.value)}
                className="h-2 flex-1 cursor-pointer accent-[#24817f]" />
              <input type="number" min={1} value={count} onChange={(e) => setCount(Math.max(1, +e.target.value || 1))} aria-label="عدد الموظفين"
                className="h-10 w-24 rounded-lg border border-[#dbe5e6] text-center text-[15px] font-bold tabular-nums outline-none focus:border-[#24817f]" dir="ltr" />
            </div>
          </div>
          <div className="flex gap-2" role="group" aria-label="مدة الاشتراك">
            {[1, 2, 3].map((y) => (
              <button key={y} type="button" onClick={() => setYears(y)}
                className={`h-10 rounded-lg px-4 text-[14px] font-bold ${years === y ? 'bg-[#163d44] text-white' : 'bg-[#eef3f3] text-[#2c4a50]'}`}>
                {y === 1 ? 'سنة' : y === 2 ? 'سنتان' : '3 سنوات'}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-[#eef3f3] pt-5 text-[14.5px] text-[#2c4a50]">
          <span>الباقة <b className="text-[#163d44]">{p.label}</b></span>
          <span>{count} × {p.rate} = <b className="text-[#163d44] tabular-nums">{sar(calc.annual)}</b> سنوياً</span>
          <span>التأسيس <b className="text-[#163d44] tabular-nums">{sar(p.setup)}</b></span>
          <span className="ms-auto text-[17px]">الإجمالي <b className="text-[22px] text-[#24817f] tabular-nums">{sar(calc.total)}</b></span>
          <Link href={`/subscribe?package=${tier}&employees=${count}&years=${years}`}
            className="flex h-11 items-center rounded-xl bg-[#24817f] px-6 text-[15px] font-bold text-white hover:bg-[#1d6b69]">
            اشترك بهذا السعر
          </Link>
        </div>
        <p className="mt-3 text-[12.5px] text-[#7b9396]">الأسعار بالريال السعودي وشاملة ضريبة القيمة المضافة.</p>
      </div>
    </div>
  )
}
