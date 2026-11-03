'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ApexDatePicker } from '@/components/hr/apex/date-picker'
import { EmployeePickerDialog } from '@/components/hr/apex/employee-picker-dialog'

interface Preview { employees: number; posted_days: number; unposted_days: number; unmatched_punches: number; checkins: number }
interface Result { employees: number; cancelled_days?: number; posted_days?: number; recovered_punches: number }

function today() { return new Date().toISOString().slice(0, 10) }

const API = 'base_meena.api.hr_unpost'
type Action = 'unpost' | 'post'
function resultText(action: Action, r: Result) {
  const punches = r.recovered_punches ? ` وأُعيد سحب ${r.recovered_punches} بصمة` : ''
  if (action === 'unpost')
    return r.cancelled_days
      ? `تم إلغاء ترحيل ${r.cancelled_days} يوم${punches} — لن تظهر حركات هذه الأيام في التقارير حتى تُرحَّل من جديد.`
      : `كل أيام هذه الفترة غير مرحّلة بالفعل${punches}.`
  return r.posted_days
    ? `تم ترحيل ${r.posted_days} يوم${punches} — حركات هذه الأيام ظاهرة ومحسوبة في التقارير الآن.`
    : `كل أيام هذه الفترة مرحّلة بالفعل${punches} — حركاتها ظاهرة في التقارير.`
}

/**
 * «إلغاء ترحيل الحركات» — Apex layout: من تاريخ | إلى تاريخ | [+ تحديد الموظفين]
 * | [إلغاء ترحيل الحركات]. No employees chosen = all of them. The server cancels
 * the posted days, replays punches that were waiting for their fingerprint
 * number to be linked, and re-posts; the reports then show the reprocessed days.
 */
export function CancelTransactionsPage() {
  const { toast } = useToast()
  const [from, setFrom] = useState(today())
  const [to, setTo] = useState(today())
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState<Action | null>(null)
  const [working, setWorking] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const valid = !!from && !!to && from <= to
  const args = { from_date: from, to_date: to, employees: JSON.stringify([...selected]) }

  const loadPreview = useCallback(async () => {
    if (!valid) { setPreview(null); return }
    setLoading(true)
    try {
      setPreview((await frappeClient.call<Preview>(`${API}.preview`, args)).message ?? null)
    } catch {
      setPreview(null)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, selected, valid])

  useEffect(() => { loadPreview() }, [loadPreview])

  const run = async () => {
    const action = confirm
    if (!action) return
    setWorking(true)
    try {
      const r = (await frappeClient.call<Result>(`${API}.${action}`, args)).message as Result
      const text = resultText(action, r)
      setDone(text)
      toast({ title: action === 'post' ? 'تم ترحيل الحركات' : 'تم إلغاء ترحيل الحركات', description: text })
      loadPreview()
    } catch (e: any) {
      toast({ title: action === 'post' ? 'تعذّر الترحيل' : 'تعذّر إلغاء الترحيل', description: e?.message, variant: 'destructive' })
    } finally {
      setWorking(false)
      setConfirm(null)
    }
  }

  const who = selected.size ? `${selected.size} موظف` : 'كل الموظفين'

  return (
    <div className="px-4 pt-2 pb-8" dir="rtl">
      <div className="text-[14px] text-slate-700 mb-4">
        <span className="text-slate-600">الاجراءات</span><span className="mx-2 text-slate-400">/</span>
        <span className="text-slate-800">إلغاء ترحيل الحركات</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto_auto] gap-4 items-end">
        <ApexDatePicker label="من تاريخ" required value={from} onChange={setFrom} />
        <ApexDatePicker label="إلى تاريخ" required value={to} onChange={setTo} />
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="h-[58px] px-5 rounded bg-[var(--apex-blue)] text-white text-[15px] flex items-center gap-2 hover:bg-[var(--apex-blue-hover)]"
        >
          <Plus className="h-4 w-4" />
          <span className="text-center leading-tight">تحديد<br />الموظفين{selected.size ? ` (${selected.size})` : ''}</span>
        </button>
        <button
          type="button"
          disabled={!valid || working}
          onClick={() => setConfirm('post')}
          className="h-[42px] px-5 rounded text-white text-[15px] bg-[var(--apex-blue)] hover:bg-[var(--apex-blue-hover)] disabled:opacity-60"
        >
          ترحيل الحركات
        </button>
        <button
          type="button"
          disabled={!valid || working}
          onClick={() => setConfirm('unpost')}
          className="h-[42px] px-5 rounded text-white text-[15px] bg-[var(--apex-red-muted)] disabled:opacity-90 enabled:bg-[var(--apex-red)] enabled:hover:bg-[var(--apex-red-dark)]"
        >
          إلغاء ترحيل الحركات
        </button>
      </div>

      <div className="mt-6 bg-white rounded-sm shadow-sm p-5 text-[15px] text-slate-700" data-testid="unpost-summary">
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--apex-blue)]" />
        ) : !valid ? (
          <p className="text-center text-red-600">الفترة غير صحيحة</p>
        ) : preview ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div><div className="text-slate-500 text-[13px]">الموظفين</div><div className="font-bold text-[20px]">{who}</div></div>
            <div><div className="text-slate-500 text-[13px]">أيام مرحّلة / غير مرحّلة</div><div className="font-bold text-[20px]">{preview.posted_days} / {preview.unposted_days}</div></div>
            <div><div className="text-slate-500 text-[13px]">حركات في الفترة</div><div className="font-bold text-[20px]">{preview.checkins}</div></div>
            <div><div className="text-slate-500 text-[13px]">بصمات تنتظر السحب</div><div className="font-bold text-[20px]">{preview.unmatched_punches}</div></div>
          </div>
        ) : null}
        {done && (
          <p className="mt-4 text-center text-emerald-700 font-semibold">
            {done}
          </p>
        )}
      </div>

      {/* Apex «تحديد الموظف» search dialog */}
      <EmployeePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        initial={selected}
        onAdd={(picked) => setSelected(new Set(picked.map((e) => e.name)))}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => { if (!o) setConfirm(null) }}
        title={confirm === 'post' ? 'ترحيل الحركات' : 'إلغاء ترحيل الحركات'}
        description={confirm === 'post'
          ? `سيتم ترحيل حركات ${who} من ${from} إلى ${to} فتظهر محسوبة في التقارير. متابعة؟`
          : `سيتم إلغاء ترحيل ${who} من ${from} إلى ${to}: لن تظهر حركات هذه الأيام في التقارير حتى تُرحَّل من جديد (البصمات نفسها لا تُحذف). هل أنت متأكد؟`}
        confirmLabel={confirm === 'post' ? 'ترحيل' : 'إلغاء الترحيل'}
        cancelLabel="رجوع"
        loading={working}
        variant={confirm === 'post' ? 'default' : 'destructive'}
        onConfirm={run}
      />
    </div>
  )
}
