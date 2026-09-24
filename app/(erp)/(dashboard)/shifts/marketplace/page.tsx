'use client'

/**
 * Shift Marketplace (سوق المناوبات) — open shifts + rule-checked shift swaps.
 *
 * Standalone HR route at /shifts/marketplace. Bilingual (RTL-aware), token-only
 * (no hardcoded colours), built on the shared kit + ui primitives. Talks only to
 * the additive whitelisted endpoints in
 * base_meena.shift_marketplace.marketplace_api.
 *
 * NOTE: not yet wired into the rail nav / SHELL_PREFIXES (see the ship report).
 * We apply `.theme-hr` locally so the HR palette resolves even before the shell
 * mounts this prefix.
 */
import * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarClock, Plus, RefreshCw, Repeat, Store, Loader2, Check, X, Search,
} from 'lucide-react'
import { PageHeader, SegmentedControl, EmptyState } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/hooks/use-toast'
import { dualDate } from '@/lib/format'
import { frappeClient, type Employee } from '@/lib/api-client'

// ── types (mirror marketplace_api summaries) ──────────────────────────────────
interface OpenShiftClaim {
  employee: string
  employee_name?: string | null
  claim_status: string
  claimed_on?: string | null
}
interface OpenShift {
  name: string
  branch: string
  shift_type: string
  date: string | null
  slots: number
  slots_remaining: number
  designation?: string | null
  notes?: string | null
  status: string
  published_by?: string | null
  claims: OpenShiftClaim[]
  my_claim?: string | null
}
interface Swap {
  name: string
  from_employee: string
  from_employee_name?: string | null
  to_employee: string
  to_employee_name?: string | null
  branch?: string | null
  swap_date: string | null
  from_shift: string
  to_shift?: string | null
  reason?: string | null
  status: string
  applied_on?: string | null
}
interface ShiftTypeRow { name: string }
interface BranchRow { name: string }

const API = 'base_meena.shift_marketplace.marketplace_api'
async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const res = await frappeClient.call<T>(`${API}.${fn}`, args)
  return res.message as T
}

type Tab = 'open' | 'swaps'

export default function ShiftMarketplacePage() {
  const { isRTL } = useI18n()
  const tt = (en: string, ar: string) => (isRTL ? ar : en)
  const { isHRUser, isManager } = useAuth()
  const { toast } = useToast()
  const canManage = isHRUser || isManager

  const [tab, setTab] = useState<Tab>('open')
  const [openShifts, setOpenShifts] = useState<OpenShift[]>([])
  const [swaps, setSwaps] = useState<Swap[]>([])
  const [approvals, setApprovals] = useState<Swap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [publishOpen, setPublishOpen] = useState(false)
  const [swapOpen, setSwapOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      if (tab === 'open') {
        setOpenShifts(await call<OpenShift[]>('list_open_shifts', {}))
      } else {
        const [mine, toApprove] = await Promise.all([
          call<Swap[]>('list_my_swaps', {}),
          canManage ? call<Swap[]>('list_swaps_to_approve', {}) : Promise.resolve<Swap[]>([]),
        ])
        setSwaps(mine); setApprovals(toApprove)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Could not load data.', 'تعذر تحميل البيانات.')
      setError(msg)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, canManage])

  useEffect(() => { load() }, [load])

  const act = async (key: string, fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(key)
    try {
      await fn()
      toast({ title: tt('Done', 'تم'), description: okMsg })
      await load()
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Please try again.', 'يرجى المحاولة مرة أخرى.')
      toast({ title: tt('Action failed', 'فشل الإجراء'), description: msg, variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }

  const tabs = useMemo(() => [
    { id: 'open', label: tt('Open shifts', 'المناوبات المتاحة'), icon: Store },
    { id: 'swaps', label: tt('My swaps', 'تبادلاتي'), icon: Repeat },
  ], [isRTL])

  return (
    <div className="theme-hr" dir={isRTL ? 'rtl' : 'ltr'}>
      <PageHeader
        title={tt('Shift Marketplace', 'سوق المناوبات')}
        description={tt(
          'Publish and claim open shifts, and request rule-checked shift swaps.',
          'انشر واحجز المناوبات المتاحة، واطلب تبادل المناوبات وفق القواعد.',
        )}
        icon={CalendarClock}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="ms-2 hidden sm:inline">{tt('Refresh', 'تحديث')}</span>
            </Button>
            {tab === 'open' && canManage && (
              <Button size="sm" onClick={() => setPublishOpen(true)}>
                <Plus className="h-4 w-4" />
                <span className="ms-2">{tt('Publish shift', 'نشر مناوبة')}</span>
              </Button>
            )}
            {tab === 'swaps' && (
              <Button size="sm" onClick={() => setSwapOpen(true)}>
                <Plus className="h-4 w-4" />
                <span className="ms-2">{tt('Request swap', 'طلب تبادل')}</span>
              </Button>
            )}
          </div>
        }
      >
        <SegmentedControl
          options={tabs}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
        />
      </PageHeader>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={load}>
            {tt('Retry', 'إعادة المحاولة')}
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : tab === 'open' ? (
        <OpenShiftsView
          shifts={openShifts}
          canManage={canManage}
          busy={busy}
          tt={tt}
          onClaim={(s) => act(`claim-${s.name}`, () => call('claim_open_shift', { name: s.name }), tt('Claim submitted.', 'تم إرسال الطلب.'))}
          onApprove={(s, emp) => act(`appr-${s.name}-${emp}`, () => call('approve_claim', { name: s.name, employee: emp }), tt('Claim approved and shift assigned.', 'تم اعتماد الطلب وإسناد المناوبة.'))}
          onReject={(s, emp) => act(`rej-${s.name}-${emp}`, () => call('reject_claim', { name: s.name, employee: emp }), tt('Claim rejected.', 'تم رفض الطلب.'))}
          onCancel={(s) => act(`cancel-${s.name}`, () => call('cancel_open_shift', { name: s.name }), tt('Open shift cancelled.', 'تم إلغاء المناوبة.'))}
        />
      ) : (
        <SwapsView
          swaps={swaps}
          approvals={approvals}
          canManage={canManage}
          busy={busy}
          tt={tt}
          onApprove={(s) => act(`sappr-${s.name}`, () => call('approve_swap', { name: s.name }), tt('Swap approved and applied.', 'تم اعتماد التبادل وتطبيقه.'))}
          onReject={(s) => act(`srej-${s.name}`, () => call('reject_swap', { name: s.name, reason: tt('Rejected by approver', 'رفض من المعتمد') }), tt('Swap rejected.', 'تم رفض التبادل.'))}
          onCancel={(s) => act(`scancel-${s.name}`, () => call('cancel_swap', { name: s.name }), tt('Swap cancelled.', 'تم إلغاء التبادل.'))}
        />
      )}

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        tt={tt}
        onDone={() => { setPublishOpen(false); load() }}
      />
      <SwapDialog
        open={swapOpen}
        onOpenChange={setSwapOpen}
        tt={tt}
        onDone={() => { setSwapOpen(false); load() }}
      />
    </div>
  )
}

// ── open shifts ───────────────────────────────────────────────────────────────
function OpenShiftsView({
  shifts, canManage, busy, tt, onClaim, onApprove, onReject, onCancel,
}: {
  shifts: OpenShift[]
  canManage: boolean
  busy: string | null
  tt: (en: string, ar: string) => string
  onClaim: (s: OpenShift) => void
  onApprove: (s: OpenShift, emp: string) => void
  onReject: (s: OpenShift, emp: string) => void
  onCancel: (s: OpenShift) => void
}) {
  if (!shifts.length) {
    return (
      <EmptyState
        icon={Store}
        title={tt('No open shifts', 'لا توجد مناوبات متاحة')}
        description={tt('Published open shifts in your branch will appear here.', 'ستظهر هنا المناوبات المنشورة في فرعك.')}
      />
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {shifts.map((s) => (
        <div key={s.name} className="flex flex-col rounded-xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-foreground">{s.shift_type}</p>
              <p className="text-sm text-muted-foreground">{dualDate(s.date)}</p>
            </div>
            <StatusBadge
              status={s.status}
              label={tt(s.status, statusAr(s.status))}
            />
          </div>
          <dl className="mt-3 space-y-1 text-sm">
            <Row k={tt('Branch', 'الفرع')} v={s.branch} />
            {s.designation && <Row k={tt('Designation', 'المسمى')} v={s.designation} />}
            <Row k={tt('Slots left', 'الشواغر المتبقية')} v={`${s.slots_remaining} / ${s.slots}`} />
            {s.notes && <Row k={tt('Notes', 'ملاحظات')} v={s.notes} />}
          </dl>

          {canManage && s.claims.some((c) => c.claim_status === 'Requested') && (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">{tt('Pending claims', 'طلبات معلّقة')}</p>
              {s.claims.filter((c) => c.claim_status === 'Requested').map((c) => (
                <div key={c.employee} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-foreground">{c.employee_name || c.employee}</span>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="outline" className="h-7 px-2"
                      disabled={!!busy} onClick={() => onApprove(s, c.employee)}>
                      {busy === `appr-${s.name}-${c.employee}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2"
                      disabled={!!busy} onClick={() => onReject(s, c.employee)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-auto flex items-center gap-2 pt-3">
            {s.status === 'Open' && !s.my_claim && (
              <Button size="sm" className="flex-1" disabled={!!busy} onClick={() => onClaim(s)}>
                {busy === `claim-${s.name}` ? <Loader2 className="h-4 w-4 animate-spin" /> : tt('Claim', 'حجز')}
              </Button>
            )}
            {s.my_claim && (
              <span className="text-xs text-muted-foreground">
                {tt('Your claim', 'طلبك')}: {tt(s.my_claim, statusAr(s.my_claim))}
              </span>
            )}
            {canManage && s.status === 'Open' && (
              <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => onCancel(s)}>
                {tt('Cancel', 'إلغاء')}
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── swaps ─────────────────────────────────────────────────────────────────────
function SwapsView({
  swaps, approvals, canManage, busy, tt, onApprove, onReject, onCancel,
}: {
  swaps: Swap[]
  approvals: Swap[]
  canManage: boolean
  busy: string | null
  tt: (en: string, ar: string) => string
  onApprove: (s: Swap) => void
  onReject: (s: Swap) => void
  onCancel: (s: Swap) => void
}) {
  return (
    <div className="space-y-8">
      {canManage && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            {tt('Swaps to approve', 'تبادلات بانتظار الاعتماد')}
          </h2>
          {approvals.length ? (
            <div className="space-y-2">
              {approvals.map((s) => (
                <SwapRow key={s.name} s={s} tt={tt} busy={busy}
                  actions={
                    <>
                      <Button size="sm" variant="outline" disabled={!!busy} onClick={() => onApprove(s)}>
                        {busy === `sappr-${s.name}` ? <Loader2 className="h-4 w-4 animate-spin" /> : tt('Approve & apply', 'اعتماد وتطبيق')}
                      </Button>
                      <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => onReject(s)}>
                        {tt('Reject', 'رفض')}
                      </Button>
                    </>
                  } />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{tt('Nothing awaiting your approval.', 'لا يوجد ما ينتظر اعتمادك.')}</p>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">{tt('My swap requests', 'طلبات التبادل الخاصة بي')}</h2>
        {swaps.length ? (
          <div className="space-y-2">
            {swaps.map((s) => (
              <SwapRow key={s.name} s={s} tt={tt} busy={busy}
                actions={
                  s.status === 'Pending' ? (
                    <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => onCancel(s)}>
                      {tt('Cancel', 'إلغاء')}
                    </Button>
                  ) : null
                } />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Repeat}
            title={tt('No swap requests', 'لا توجد طلبات تبادل')}
            description={tt('Create a swap to hand over or exchange a shift.', 'أنشئ طلب تبادل لتسليم أو تبديل مناوبة.')}
          />
        )}
      </section>
    </div>
  )
}

function SwapRow({ s, tt, busy, actions }: {
  s: Swap
  tt: (en: string, ar: string) => string
  busy: string | null
  actions: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">
          {(s.from_employee_name || s.from_employee)} → {(s.to_employee_name || s.to_employee)}
        </p>
        <p className="text-xs text-muted-foreground">
          {dualDate(s.swap_date)} · {s.from_shift}
          {s.to_shift ? ` ⇄ ${s.to_shift}` : ` → ${tt('handover', 'تسليم')}`}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={s.status} label={tt(s.status, statusAr(s.status))} />
        {actions}
      </div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="truncate text-end font-medium text-foreground">{v}</dd>
    </div>
  )
}

function statusAr(status: string | null | undefined): string {
  switch (status) {
    case 'Open': return 'متاحة'
    case 'Filled': return 'مكتملة'
    case 'Cancelled': return 'ملغاة'
    case 'Requested': return 'مطلوبة'
    case 'Approved': return 'معتمدة'
    case 'Rejected': return 'مرفوضة'
    case 'Pending': return 'قيد الانتظار'
    case 'Applied': return 'مطبّقة'
    case 'Draft': return 'مسودة'
    default: return status || ''
  }
}

// ── publish dialog ────────────────────────────────────────────────────────────
function PublishDialog({ open, onOpenChange, tt, onDone }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  tt: (en: string, ar: string) => string
  onDone: () => void
}) {
  const { toast } = useToast()
  const [branches, setBranches] = useState<BranchRow[]>([])
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeRow[]>([])
  const [branch, setBranch] = useState('')
  const [shiftType, setShiftType] = useState('')
  const [date, setDate] = useState('')
  const [slots, setSlots] = useState('1')
  const [designation, setDesignation] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setBranch(''); setShiftType(''); setDate(''); setSlots('1'); setDesignation(''); setNotes('')
    Promise.all([
      frappeClient.getList<BranchRow>('Branch', { fields: ['name'], limit_page_length: 200 }),
      // custom_is_rotational_internal rows are hidden helper Shift Types the rotational
      // group feature creates internally — this is a plain, uncurated Shift Type list
      // fetched directly (unlike list_shift_options, which already excludes them
      // server-side), so it must filter them out itself (Opus review round 2, item 2).
      frappeClient.getList<ShiftTypeRow>('Shift Type', { fields: ['name'], filters: [['custom_is_rotational_internal', '!=', 1]], limit_page_length: 200 }),
    ]).then(([b, st]) => { setBranches(b); setShiftTypes(st) }).catch(() => { /* handled on submit */ })
  }, [open])

  const submit = async () => {
    if (!branch || !shiftType || !date) {
      toast({ title: tt('Missing fields', 'حقول ناقصة'), description: tt('Branch, shift and date are required.', 'الفرع والمناوبة والتاريخ مطلوبة.'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await call('publish_open_shift', {
        branch, shift_type: shiftType, date,
        slots: Number(slots) || 1,
        designation: designation || null, notes: notes || null,
      })
      toast({ title: tt('Published', 'تم النشر'), description: tt('The open shift is now visible.', 'المناوبة متاحة الآن.') })
      onDone()
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Please try again.', 'يرجى المحاولة مرة أخرى.')
      toast({ title: tt('Could not publish', 'تعذر النشر'), description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tt('Publish open shift', 'نشر مناوبة متاحة')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={tt('Branch', 'الفرع')}>
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger><SelectValue placeholder={tt('Select branch', 'اختر الفرع')} /></SelectTrigger>
              <SelectContent>
                {branches.map((b) => <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={tt('Shift type', 'نوع المناوبة')}>
            <Select value={shiftType} onValueChange={setShiftType}>
              <SelectTrigger><SelectValue placeholder={tt('Select shift', 'اختر المناوبة')} /></SelectTrigger>
              <SelectContent>
                {shiftTypes.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tt('Date', 'التاريخ')}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label={tt('Slots', 'عدد الشواغر')}>
              <Input type="number" min={1} value={slots} onChange={(e) => setSlots(e.target.value)} />
            </Field>
          </div>
          <Field label={tt('Designation (optional)', 'المسمى (اختياري)')}>
            <Input value={designation} onChange={(e) => setDesignation(e.target.value)}
              placeholder={tt('Any', 'الكل')} />
          </Field>
          <Field label={tt('Notes (optional)', 'ملاحظات (اختياري)')}>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {tt('Cancel', 'إلغاء')}
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tt('Publish', 'نشر')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── swap dialog ───────────────────────────────────────────────────────────────
function SwapDialog({ open, onOpenChange, tt, onDone }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  tt: (en: string, ar: string) => string
  onDone: () => void
}) {
  const { toast } = useToast()
  const [shiftTypes, setShiftTypes] = useState<ShiftTypeRow[]>([])
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Employee[]>([])
  const [searching, setSearching] = useState(false)
  const [toEmp, setToEmp] = useState<{ name: string; label: string } | null>(null)
  const [swapDate, setSwapDate] = useState('')
  const [fromShift, setFromShift] = useState('')
  const [toShift, setToShift] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setQ(''); setResults([]); setToEmp(null); setSwapDate(''); setFromShift(''); setToShift(''); setReason('')
    // See the matching filter above — hides internal rotational-group helper Shift Types.
    frappeClient.getList<ShiftTypeRow>('Shift Type', { fields: ['name'], filters: [['custom_is_rotational_internal', '!=', 1]], limit_page_length: 200 })
      .then(setShiftTypes).catch(() => { /* handled on submit */ })
  }, [open])

  useEffect(() => {
    if (q.trim().length < 1) { setResults([]); return }
    let cancelled = false
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const rows = await frappeClient.searchEmployees(q.trim())
        if (!cancelled) setResults(rows.slice(0, 6))
      } catch { if (!cancelled) setResults([]) } finally { if (!cancelled) setSearching(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q])

  const submit = async () => {
    if (!toEmp || !swapDate || !fromShift) {
      toast({ title: tt('Missing fields', 'حقول ناقصة'), description: tt('Colleague, date and your shift are required.', 'الزميل والتاريخ ومناوبتك مطلوبة.'), variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await call('create_swap', {
        to_employee: toEmp.name, swap_date: swapDate,
        from_shift: fromShift, to_shift: toShift || null, reason: reason || null,
      })
      toast({ title: tt('Requested', 'تم الطلب'), description: tt('Your swap request was created.', 'تم إنشاء طلب التبادل.') })
      onDone()
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt('Please try again.', 'يرجى المحاولة مرة أخرى.')
      toast({ title: tt('Swap not allowed', 'التبادل غير مسموح'), description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{tt('Request a shift swap', 'طلب تبادل مناوبة')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label={tt('Swap with (colleague)', 'التبادل مع (زميل)')}>
            {toEmp ? (
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="truncate text-foreground">{toEmp.label}</span>
                <button type="button" className="text-muted-foreground hover:text-foreground"
                  onClick={() => setToEmp(null)}><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="ps-9" value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder={tt('Search employee…', 'ابحث عن موظف…')} />
                {searching && <Loader2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                {results.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
                    {results.map((r) => (
                      <button key={r.name} type="button"
                        className="block w-full px-3 py-2 text-start text-sm hover:bg-accent"
                        onClick={() => { setToEmp({ name: r.name, label: r.employee_name || r.name }); setResults([]); setQ('') }}>
                        {r.employee_name || r.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Field>
          <Field label={tt('Swap date', 'تاريخ التبادل')}>
            <Input type="date" value={swapDate} onChange={(e) => setSwapDate(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tt('Your shift', 'مناوبتك')}>
              <Select value={fromShift} onValueChange={setFromShift}>
                <SelectTrigger><SelectValue placeholder={tt('Select', 'اختر')} /></SelectTrigger>
                <SelectContent>
                  {shiftTypes.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={tt('Their shift (optional)', 'مناوبتهم (اختياري)')}>
              <Select value={toShift} onValueChange={setToShift}>
                <SelectTrigger><SelectValue placeholder={tt('Handover', 'تسليم')} /></SelectTrigger>
                <SelectContent>
                  {shiftTypes.map((s) => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label={tt('Reason (optional)', 'السبب (اختياري)')}>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {tt('Cancel', 'إلغاء')}
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : tt('Request', 'إرسال الطلب')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  )
}
