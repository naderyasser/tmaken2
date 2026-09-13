'use client'

/**
 * FinancialWellness — an employee-facing "how healthy is my pay month" insight
 * card for /me. Read-only: it reuses the EWA earned-balance snapshot
 * (ewaApi.getMyBalance) and turns it into a wellness score + a contextual nudge,
 * complementing (not duplicating) the transactional EwaCard (راتبي المرن).
 *
 * Feature-flag-safe: if EWA is disabled for the tenant ({enabled:false}) or the
 * probe errors, the card renders nothing. No backend change — pure derivation.
 */

import * as React from 'react'
import { useEffect, useState } from 'react'
import { PiggyBank, Sparkles, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useI18n } from '@/lib/i18n'
import { formatCurrency, type AppLocale } from '@/lib/format'
import { ewaApi, type EwaBalance, type EwaBalanceEnabled } from '@/lib/ewa-api'

type Grade = 'excellent' | 'good' | 'fair' | 'at_risk'

const GRADE_META: Record<Grade, { varName: string; en: string; ar: string }> = {
  excellent: { varName: '--success', en: 'Healthy', ar: 'ممتاز' },
  good: { varName: '--primary', en: 'On track', ar: 'جيد' },
  fair: { varName: '--warning', en: 'Watch it', ar: 'انتبه' },
  at_risk: { varName: '--destructive', en: 'Stretched', ar: 'مضغوط' },
}

function pctClamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function derive(b: EwaBalanceEnabled) {
  const usageRatio = b.cap_amount > 0 ? Math.min(1, b.outstanding / b.cap_amount) : 0
  const reqRatio = b.max_requests > 0 ? Math.min(1, b.requests_used / b.max_requests) : 0
  let score = 100 - usageRatio * 55 - reqRatio * 15
  if (!b.tenure_ok) score -= 5
  score = pctClamp(score)
  const grade: Grade = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'at_risk'
  return { usageRatio, score, grade }
}

export default function FinancialWellness() {
  const { isRTL } = useI18n()
  const tt = (en: string, ar: string) => (isRTL ? ar : en)
  const locale: AppLocale = isRTL ? 'ar' : 'en'

  const [bal, setBal] = useState<EwaBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    ewaApi
      .getMyBalance()
      .then((b) => {
        if (!alive) return
        setBal(b)
        setLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setFailed(true)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  // Inert when the feature is off or the probe failed.
  if (failed) return null
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PiggyBank className="h-4 w-4 text-primary" />
            {tt('Financial Wellness', 'الرفاه المالي')}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )
  }
  if (!bal || !bal.enabled) return null

  const b = bal as EwaBalanceEnabled
  const { usageRatio, score, grade } = derive(b)
  const meta = GRADE_META[grade]
  const gradeColor = `hsl(var(${meta.varName}))`
  const money = (n: number) => formatCurrency(n, { locale })

  const nudge = b.in_blackout
    ? tt('Payday is near — advances are paused until then.', 'يقترب موعد الراتب — السحب متوقّف مؤقتًا حتى الصرف.')
    : b.outstanding === 0 && b.available > 0
      ? tt("You haven't tapped your flexible pay — it's all saved for payday.", 'لم تسحب من أجرك المرن — رصيدك كامل محفوظ ليوم الراتب.')
      : usageRatio >= 0.7
        ? tt('You have used most of your flexible pay this month — mind your cash flow until payday.', 'استخدمت معظم أجرك المرن هذا الشهر — انتبه لسيولتك حتى الراتب.')
        : tt('You are on track. Keeping some earned wage aside makes for a healthier payday.', 'أنت على المسار. الاحتفاظ بجزء من أجرك المكتسب يجعل راتبك أريح.')

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <PiggyBank className="h-4 w-4 text-primary" />
          {tt('Financial Wellness', 'الرفاه المالي')}
        </CardTitle>
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `hsl(var(${meta.varName}) / 0.12)`, color: gradeColor }}
        >
          <ShieldCheck className="h-3 w-3" />
          {tt(meta.en, meta.ar)}
        </span>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Wellness score */}
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold leading-none tabular-nums text-foreground">{score}</span>
            <span className="text-sm font-medium text-muted-foreground">/100</span>
            <span className="ms-auto text-[11px] text-muted-foreground">{tt('wellness score', 'مؤشر الرفاه')}</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-out"
              style={{ width: `${score}%`, backgroundColor: gradeColor }}
            />
          </div>
        </div>

        {/* Month snapshot */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-accent/50 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">{tt('Earned so far', 'المكتسب حتى الآن')}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{money(b.gross_earned)}</p>
          </div>
          <div className="rounded-lg bg-success/10 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">{tt('Available', 'المتاح')}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-success">{money(b.available)}</p>
          </div>
          <div className="rounded-lg bg-accent/50 p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground">{tt('Taken', 'المسحوب')}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{money(b.outstanding)}</p>
          </div>
        </div>

        {/* Flexible-pay usage bar */}
        <div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{tt('Flexible pay used', 'المستخدم من الأجر المرن')}</span>
            <span className="tabular-nums text-foreground/80">
              {money(b.outstanding)} / {money(b.cap_amount)}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${usageRatio >= 0.7 ? 'bg-warning/70' : 'bg-primary/70'}`}
              style={{ width: `${pctClamp(usageRatio * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            <span className="tabular-nums text-foreground/70">{b.requests_used}/{b.max_requests}</span>{' '}
            {tt('advances used this month', 'سلفة مستخدمة هذا الشهر')}
          </p>
        </div>

        {/* Contextual nudge */}
        <div className="flex items-start gap-2.5 rounded-lg bg-gradient-to-r from-primary/10 to-info/10 p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-[13px] leading-relaxed text-foreground/90">{nudge}</p>
        </div>
      </CardContent>
    </Card>
  )
}
