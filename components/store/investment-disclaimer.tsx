import { ShieldAlert } from 'lucide-react'
import { INVEST_OPEX } from '@/lib/investment'

/** Shared investment estimate/risk disclaimer (hub + listing-detail investment panel). */
export default function InvestmentDisclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <p className="flex items-start gap-1.5 text-[11px] leading-5 text-[var(--aqar-kohl)]/55">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--aqar-clay)]" />
        قيمٌ تقديريةٌ من بيانات الإعلانات (بافتراض تكاليف تشغيل {Math.round(INVEST_OPEX * 100)}%) — ليست ضماناً ولا نصيحةً استثمارية.
      </p>
    )
  }
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[var(--aqar-clay)]/30 bg-[var(--aqar-clay)]/5 p-4 text-sm text-[var(--aqar-kohl)]/80">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[var(--aqar-clay)]" />
      <p>
        <b>إخلاء مسؤولية:</b> جميع المؤشّرات المعروضة (العائد، معدّل الرسملة، السعر/م²) <b>تقديريةٌ</b> ومحسوبةٌ من بيانات الإعلانات المتاحة —
        متوسّط إيجار/م² لعقاراتٍ مماثلة في النطاق، بافتراض نسبة تكاليف تشغيل <b>{Math.round(INVEST_OPEX * 100)}%</b>. وهي ليست ضماناً للعائد ولا تُعدّ نصيحةً استثمارية. تحقّق دائماً قبل اتخاذ أي قرار.
      </p>
    </div>
  )
}
