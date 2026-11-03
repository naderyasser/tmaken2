'use client'

/**
 * RecognitionWall — the "Recognition Wall / جدار التقدير" section: a live feed of
 * peer recognition cards (badge + employee + message) with a like button, plus a
 * lightweight "give recognition" form (employee picker + badge + message).
 * Likes-only, no comments.
 *
 * Self-contained: its own fetchers + types live in this file. Talks to
 *   base_meena.api.recognition.get_wall(limit)      -> { wall: [...] }
 *   base_meena.api.recognition.like(name)           -> { name, likes }
 *   base_meena.api.recognition.give_recognition(...) -> { name, employee, ... }
 * and reuses base_meena.employee_search_api.search_employees for the picker.
 *
 * Mirrors the other HR dashboard sections (token-only colors, logical-RTL,
 * .theme-hr, skeleton + retry, Arabic-first).
 */

import * as React from 'react'
import { useEffect, useState } from 'react'
import {
  Award,
  RefreshCw,
  AlertTriangle,
  Heart,
  Star,
  Users,
  Rocket,
  ShieldCheck,
  Plus,
  X,
  Search,
  Loader2,
  CheckCircle2,
  Send,
  PartyPopper,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import frappeClient from '@/lib/api-client'

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

type TX = (en: string, ar: string) => string

/* ─────────────────────────── types (match backend) ─────────────────────────── */

type BadgeKey = 'Star' | 'Team Player' | 'Going Extra Mile' | 'Customer Hero'
type Visibility = 'Public' | 'Manager Only'

interface WallCard {
  name: string
  employee: string
  employee_name: string
  from_user: string
  from_name: string
  badge: BadgeKey | string
  message: string
  likes: number
  branch?: string | null
  creation: string
  created_hijri?: string | null
}

interface WallResponse {
  wall: WallCard[]
}

interface LikeResult {
  name: string
  likes: number
}

interface GiveResult {
  name: string
  employee: string
  employee_name: string
  badge: BadgeKey | string
  message: string
  visibility: Visibility
}

interface EmpRow {
  name: string
  employee_name: string
  branch?: string | null
  designation?: string | null
}

/* ─────────────────────────── fetchers (self-contained) ─────────────────────────── */

async function fetchWall(signal?: AbortSignal): Promise<WallCard[]> {
  const res = await frappeClient.call<WallResponse>(
    'base_meena.api.recognition.get_wall',
    { limit: 60 },
    signal,
  )
  return res?.message?.wall ?? []
}

async function likeRecognition(name: string): Promise<LikeResult> {
  const res = await frappeClient.call<LikeResult>('base_meena.api.recognition.like', { name })
  return (res?.message as LikeResult) ?? { name, likes: 0 }
}

async function giveRecognition(args: {
  employee: string
  badge: BadgeKey
  message: string
  visibility: Visibility
}): Promise<GiveResult> {
  const res = await frappeClient.call<GiveResult>('base_meena.api.recognition.give_recognition', args)
  return res?.message as GiveResult
}

async function searchEmployees(query: string, signal?: AbortSignal): Promise<EmpRow[]> {
  const res = await frappeClient.call<EmpRow[]>(
    'base_meena.employee_search_api.search_employees',
    { query, status: 'Active', limit: 20 },
    signal,
  )
  return (res?.message as EmpRow[]) ?? []
}

/* ─────────────────────────── badge metadata ─────────────────────────── */

const BADGE_META: Record<
  BadgeKey,
  { en: string; ar: string; varName: string; icon: React.ComponentType<{ className?: string }> }
> = {
  Star: { en: 'Star', ar: 'نجم', varName: '--warning', icon: Star },
  'Team Player': { en: 'Team Player', ar: 'روح الفريق', varName: '--info', icon: Users },
  'Going Extra Mile': { en: 'Extra Mile', ar: 'جهد إضافي', varName: '--primary', icon: Rocket },
  'Customer Hero': { en: 'Customer Hero', ar: 'بطل العملاء', varName: '--success', icon: ShieldCheck },
}

const BADGE_ORDER: BadgeKey[] = ['Star', 'Team Player', 'Going Extra Mile', 'Customer Hero']

function badgeMeta(badge: string) {
  return BADGE_META[badge as BadgeKey] ?? { en: badge, ar: badge, varName: '--muted-foreground', icon: Award }
}

function initials(name: string): string {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '؟'
  if (parts.length === 1) return parts[0].slice(0, 2)
  return (parts[0][0] || '') + (parts[parts.length - 1][0] || '')
}

function timeAgo(creation: string, isRTL: boolean): string {
  const t = Date.parse(String(creation || '').replace(' ', 'T'))
  if (Number.isNaN(t)) return ''
  const diff = Math.max(0, Date.now() - t)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return isRTL ? 'الآن' : 'just now'
  if (mins < 60) return isRTL ? `منذ ${mins} د` : `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return isRTL ? `منذ ${hrs} س` : `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return isRTL ? `منذ ${days} يوم` : `${days}d ago`
  const months = Math.floor(days / 30)
  return isRTL ? `منذ ${months} شهر` : `${months}mo ago`
}

/* ─────────────────────────── recognition card ─────────────────────────── */

function RecognitionCardView({
  c,
  tx,
  isRTL,
  onLike,
  liking,
}: {
  c: WallCard
  tx: TX
  isRTL: boolean
  onLike: (name: string) => void
  liking: boolean
}) {
  const meta = badgeMeta(c.badge)
  const color = `hsl(var(${meta.varName}))`
  const Icon = meta.icon
  const when = c.created_hijri || timeAgo(c.creation, isRTL)

  return (
    <section className={`${CARD} flex flex-col`}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase"
            style={{ backgroundColor: `hsl(var(${meta.varName}) / 0.14)`, color }}
          >
            {initials(c.employee_name)}
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-foreground">{c.employee_name}</h3>
            {c.branch ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.branch}</p> : null}
          </div>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `hsl(var(${meta.varName}) / 0.12)`, color }}
        >
          <Icon className="h-3 w-3" />
          {tx(meta.en, meta.ar)}
        </span>
      </div>

      <p className="flex-1 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground/90">
        {c.message}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <p className="min-w-0 truncate text-[11px] text-muted-foreground">
          <span className="text-foreground/70">{c.from_name}</span>
          {when ? <span className="mx-1 opacity-60">·</span> : null}
          <span className="tabular-nums">{when}</span>
        </p>
        <button
          type="button"
          onClick={() => onLike(c.name)}
          disabled={liking}
          aria-label={tx('Like', 'إعجاب')}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-[12px] font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
        >
          <Heart className={`h-3.5 w-3.5 ${liking ? 'animate-pulse' : ''}`} />
          <span className="tabular-nums">{c.likes}</span>
        </button>
      </div>
    </section>
  )
}

/* ─────────────────────────── give-recognition form ─────────────────────────── */

function GiveRecognitionForm({
  tx,
  isRTL,
  onClose,
  onGiven,
}: {
  tx: TX
  isRTL: boolean
  onClose: () => void
  onGiven: (r: GiveResult, branch: string | null) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<EmpRow[]>([])
  const [searching, setSearching] = useState(false)
  const [openList, setOpenList] = useState(false)
  const [picked, setPicked] = useState<EmpRow | null>(null)

  const [badge, setBadge] = useState<BadgeKey | null>(null)
  const [message, setMessage] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('Public')

  const [submitting, setSubmitting] = useState(false)
  const [errMsg, setErrMsg] = useState<string | null>(null)

  // Debounced employee search
  useEffect(() => {
    const q = query.trim()
    if (picked && q === picked.employee_name) return
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    const ctrl = new AbortController()
    setSearching(true)
    const id = setTimeout(() => {
      searchEmployees(q, ctrl.signal)
        .then((rows) => {
          if (ctrl.signal.aborted) return
          setResults(rows)
          setOpenList(true)
          setSearching(false)
        })
        .catch(() => {
          if (ctrl.signal.aborted) return
          setResults([])
          setSearching(false)
        })
    }, 300)
    return () => {
      ctrl.abort()
      clearTimeout(id)
    }
  }, [query, picked])

  const canSubmit = !!picked && !!badge && message.trim().length > 0 && !submitting

  const submit = async () => {
    if (!picked || !badge || !message.trim()) return
    setSubmitting(true)
    setErrMsg(null)
    try {
      const r = await giveRecognition({
        employee: picked.name,
        badge,
        message: message.trim(),
        visibility,
      })
      onGiven(r, picked.branch ?? null)
    } catch (e: any) {
      setErrMsg(e?.message || tx('Could not submit. Try again.', 'تعذّر الإرسال. حاول مرة أخرى.'))
      setSubmitting(false)
    }
  }

  return (
    <section className={`${CARD} mb-5`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Award className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold text-foreground">{tx('Give recognition', 'امنح تقديرًا')}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={tx('Close', 'إغلاق')}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Employee picker */}
      <div className="relative mb-3">
        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
          {tx('Employee', 'الموظف')}
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 start-2.5 flex items-center text-muted-foreground">
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              if (picked) setPicked(null)
            }}
            onFocus={() => results.length > 0 && setOpenList(true)}
            placeholder={tx('Search by name, ID, phone…', 'ابحث بالاسم أو الرقم أو الجوال…')}
            className="h-10 w-full rounded-lg border border-input bg-background ps-9 pe-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
          />
          {picked ? (
            <span className="absolute inset-y-0 end-2.5 flex items-center text-success">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          ) : null}
        </div>

        {openList && results.length > 0 && !picked ? (
          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-popover shadow-card">
            {results.map((r) => (
              <button
                key={r.name}
                type="button"
                onClick={() => {
                  setPicked(r)
                  setQuery(r.employee_name)
                  setOpenList(false)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-start transition-colors hover:bg-accent"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold uppercase text-primary">
                  {initials(r.employee_name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-foreground">{r.employee_name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {[r.designation, r.branch].filter(Boolean).join(' · ') || r.name}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Badge picker */}
      <div className="mb-3">
        <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">{tx('Badge', 'الوسام')}</label>
        <div className="flex flex-wrap gap-2">
          {BADGE_ORDER.map((b) => {
            const meta = BADGE_META[b]
            const Icon = meta.icon
            const active = badge === b
            const color = `hsl(var(${meta.varName}))`
            return (
              <button
                key={b}
                type="button"
                onClick={() => setBadge(b)}
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors"
                style={{
                  borderColor: active ? color : 'hsl(var(--border))',
                  backgroundColor: active ? `hsl(var(${meta.varName}) / 0.12)` : 'transparent',
                  color: active ? color : 'hsl(var(--muted-foreground))',
                }}
              >
                <Icon className="h-3.5 w-3.5" />
                {tx(meta.en, meta.ar)}
              </button>
            )
          })}
        </div>
      </div>

      {/* Message */}
      <div className="mb-3">
        <label className="mb-1 block text-[11px] font-medium text-muted-foreground">{tx('Message', 'الرسالة')}</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={tx('Say why they deserve it…', 'اذكر سبب استحقاقه…')}
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
        <div className="mt-1 text-end text-[10px] tabular-nums text-muted-foreground">{message.length}/500</div>
      </div>

      {/* Visibility */}
      <div className="mb-4">
        <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">{tx('Visibility', 'الظهور')}</label>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {(['Public', 'Manager Only'] as Visibility[]).map((v) => {
            const active = visibility === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => setVisibility(v)}
                className={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
                  active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {v === 'Public' ? tx('Public', 'عام') : tx('Manager only', 'المدير فقط')}
              </button>
            )
          })}
        </div>
        {visibility === 'Manager Only' ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {tx("Won't appear on the public wall.", 'لن يظهر على الجدار العام.')}
          </p>
        ) : null}
      </div>

      {errMsg ? (
        <p className="mb-3 flex items-center gap-1.5 text-[12px] text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" />
          {errMsg}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
          {tx('Cancel', 'إلغاء')}
        </Button>
        <Button size="sm" onClick={submit} disabled={!canSubmit}>
          {submitting ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="me-1.5 h-3.5 w-3.5" />}
          {tx('Send recognition', 'إرسال التقدير')}
        </Button>
      </div>
    </section>
  )
}

/* ─────────────────────────── skeleton ─────────────────────────── */

function SkeletonCard() {
  return (
    <div className={CARD}>
      <div className="mb-3 flex items-center gap-2.5">
        <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
        <div className="space-y-1.5">
          <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
          <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
        <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
        <div className="h-6 w-12 animate-pulse rounded-full bg-muted" />
      </div>
    </div>
  )
}

/* ─────────────────────────── main export ─────────────────────────── */

export default function RecognitionWallSection() {
  const { isRTL } = useI18n()
  const tx: TX = (en, ar) => (isRTL ? ar : en)

  const [cards, setCards] = useState<WallCard[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [liking, setLiking] = useState<Record<string, boolean>>({})
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = React.useCallback((signal?: AbortSignal) => {
    setLoading(true)
    setError(false)
    fetchWall(signal)
      .then((rows) => {
        if (signal?.aborted) return
        setCards(rows)
        setLoading(false)
      })
      .catch(() => {
        if (signal?.aborted) return
        setError(true)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [load])

  const handleLike = React.useCallback(
    (name: string) => {
      setLiking((m) => ({ ...m, [name]: true }))
      // optimistic +1
      setCards((prev) => prev?.map((c) => (c.name === name ? { ...c, likes: (c.likes || 0) + 1 } : c)) ?? prev)
      likeRecognition(name)
        .then((res) => {
          setCards((prev) => prev?.map((c) => (c.name === name ? { ...c, likes: res.likes } : c)) ?? prev)
        })
        .catch(() => {
          // revert optimistic bump on failure
          setCards((prev) => prev?.map((c) => (c.name === name ? { ...c, likes: Math.max(0, (c.likes || 1) - 1) } : c)) ?? prev)
        })
        .finally(() => {
          setLiking((m) => {
            const { [name]: _drop, ...rest } = m
            return rest
          })
        })
    },
    [],
  )

  const handleGiven = React.useCallback(
    (r: GiveResult, branch: string | null) => {
      setShowForm(false)
      setToast(tx('Recognition sent 🎉', 'تم إرسال التقدير 🎉'))
      window.setTimeout(() => setToast(null), 4000)
      // Only public recognitions live on the wall; prepend optimistically.
      if (r.visibility === 'Public') {
        const optimistic: WallCard = {
          name: r.name,
          employee: r.employee,
          employee_name: r.employee_name,
          from_user: '',
          from_name: tx('You', 'أنت'),
          badge: r.badge,
          message: r.message,
          likes: 0,
          branch,
          creation: new Date().toISOString().slice(0, 19).replace('T', ' '),
          created_hijri: null,
        }
        setCards((prev) => [optimistic, ...(prev ?? [])])
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isRTL],
  )

  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">{tx('Recognition Wall', 'جدار التقدير')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="me-1.5 h-3.5 w-3.5" />
            {tx('Give recognition', 'امنح تقديرًا')}
          </Button>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            aria-label={tx('Refresh', 'تحديث')}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {toast ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-[13px] font-medium text-success">
          <PartyPopper className="h-4 w-4" />
          {toast}
        </div>
      ) : null}

      {showForm ? (
        <GiveRecognitionForm tx={tx} isRTL={isRTL} onClose={() => setShowForm(false)} onGiven={handleGiven} />
      ) : null}

      {error ? (
        <div className={`${CARD} flex flex-col items-center gap-3 py-10 text-center`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {tx("Couldn't load the recognition wall", 'تعذّر تحميل جدار التقدير')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx('Check your connection and try again.', 'تحقّق من الاتصال وحاول مرة أخرى.')}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => load()}>
            <RefreshCw className="me-1.5 h-3.5 w-3.5" />
            {tx('Retry', 'إعادة المحاولة')}
          </Button>
        </div>
      ) : loading || !cards ? (
        <div className="hr-stagger grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className={`${CARD} flex flex-col items-center gap-3 py-12 text-center`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Award className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{tx('No recognitions yet', 'لا توجد تقديرات بعد')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx('Be the first to celebrate a teammate.', 'كن أول من يحتفي بزميل.')}
            </p>
          </div>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="me-1.5 h-3.5 w-3.5" />
            {tx('Give recognition', 'امنح تقديرًا')}
          </Button>
        </div>
      ) : (
        <div className="hr-stagger grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((c) => (
            <RecognitionCardView
              key={c.name}
              c={c}
              tx={tx}
              isRTL={isRTL}
              onLike={handleLike}
              liking={!!liking[c.name]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
