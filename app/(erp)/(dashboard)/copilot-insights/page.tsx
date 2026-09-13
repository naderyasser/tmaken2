'use client'

/**
 * إحصائيات المساعد — copilot health for the HR admin.
 *
 * Answers the owner's real questions about his assistant: who uses it, what do
 * they ask, how fast is it, and where does it disappoint (👎 samples become the
 * improvement backlog). Server-side gated: audit.stats throws for non-admins.
 * Plain CSS bars on purpose — same reasoning as the drawer chart: a chart lib
 * buys nothing at this size and fights RTL.
 */
import { useEffect, useState } from 'react'
import { Sparkles, ThumbsDown, Timer, Users, MessageSquare, Bot } from 'lucide-react'
import { copilotApi } from '@/lib/copilot-api'

const ROUTE_LABELS: Record<string, string> = {
  DATA: 'أسئلة بيانات',
  HOWTO: 'أسئلة «كيف»',
  HYBRID: 'تشخيص «ليش»',
  SMALLTALK: 'محادثة',
  ACTION: 'إجراءات',
  OUT_OF_SCOPE: 'خارج النطاق',
}

function Bars({ items, unit }: { items: [string, number][]; unit?: string }) {
  const max = Math.max(1, ...items.map(([, v]) => v))
  return (
    <div className="space-y-2">
      {items.map(([label, v]) => (
        <div key={label} className="text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-foreground">{ROUTE_LABELS[label] || label}</span>
            <span className="font-semibold tabular-nums text-muted-foreground" dir="ltr">
              {v}{unit || ''}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-primary/10">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CopilotInsightsPage() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<Record<string, any> | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setData(null)
    copilotApi
      .stats(days)
      .then((d) => alive && setData(d))
      .catch(() => alive && setErr('هذه الصفحة لمسؤولي الموارد البشرية فقط.'))
    return () => {
      alive = false
    }
  }, [days])

  if (err)
    return <div className="p-8 text-center text-muted-foreground" dir="rtl">{err}</div>
  if (!data)
    return (
      <div className="space-y-3 p-6" dir="rtl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-secondary" />
        ))}
      </div>
    )

  const cards = [
    { icon: MessageSquare, label: 'محادثة', value: data.turns ?? 0 },
    { icon: Users, label: 'مستخدم', value: data.unique_users ?? 0 },
    { icon: Bot, label: 'ردود بصوت الذكاء', value: `${data.ai_used_pct ?? 0}%` },
    { icon: Timer, label: 'سرعة الرد (وسيط)', value: `${data.latency_p50_ms ?? 0}ms` },
    { icon: ThumbsDown, label: 'تقييم سلبي', value: data.thumbs_down ?? 0 },
  ]

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          إحصائيات مساعد الأدمن
        </h1>
        <div className="flex gap-1 rounded-xl border border-border p-1">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={
                'rounded-lg px-3 py-1 text-sm ' +
                (days === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')
              }
            >
              {d} يوم
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-3 text-center">
            <c.icon className="mx-auto h-4 w-4 text-primary" />
            <p className="mt-1 text-lg font-bold tabular-nums text-foreground" dir="ltr">{c.value}</p>
            <p className="text-[11px] text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      {(data.turns ?? 0) === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-center text-muted-foreground">
          لا توجد محادثات في هذه الفترة بعد.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-bold text-foreground">أنواع الأسئلة</h2>
              <Bars items={Object.entries(data.by_route || {}).sort((a: any, b: any) => b[1] - a[1]) as [string, number][]} />
            </div>
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-bold text-foreground">أكثر المؤشرات طلباً</h2>
              <Bars items={(data.top_metrics || []) as [string, number][]} />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-bold text-foreground">الاستخدام اليومي</h2>
            <div className="flex items-end gap-1.5" style={{ height: 96 }}>
              {((data.by_day || []) as [string, number][]).map(([d, v]) => {
                const max = Math.max(1, ...((data.by_day || []) as [string, number][]).map(([, x]) => x))
                return (
                  <div key={d} className="flex flex-1 flex-col items-center gap-1" title={`${d}: ${v}`}>
                    <div className="w-full rounded-t bg-primary/80" style={{ height: `${Math.max(4, (v / max) * 80)}px` }} />
                    <span className="text-[9px] text-muted-foreground" dir="ltr">{d.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {(data.thumbs_down_samples || []).length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="mb-3 text-sm font-bold text-foreground">أسئلة قيّمها المستخدمون سلبياً 👎</h2>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {(data.thumbs_down_samples as string[]).map((q, i) => (
                  <li key={i} className="rounded-lg bg-secondary px-3 py-2">{q}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
