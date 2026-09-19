'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronUp, ChevronDown, Loader2, Save } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

const DT = 'Attendance Rules Settings'

type Rules = {
  ignore_window_minutes: number; shifts_in_reports: number
  enable_min_ot_before: number; min_ot_before: number; enable_max_ot_before: number; max_ot_before: number
  enable_min_ot_after: number; min_ot_after: number; enable_max_ot_after: number; max_ot_after: number
  enable_absent_early_exit: number; absent_early_exit_minutes: number; enable_absent_late: number; absent_late_minutes: number
  first_in_last_out: number
}

const DEFAULTS: Rules = {
  ignore_window_minutes: 10, shifts_in_reports: 2,
  enable_min_ot_before: 0, min_ot_before: 0, enable_max_ot_before: 0, max_ot_before: 0,
  enable_min_ot_after: 0, min_ot_after: 0, enable_max_ot_after: 0, max_ot_after: 0,
  enable_absent_early_exit: 0, absent_early_exit_minutes: 0, enable_absent_late: 0, absent_late_minutes: 0,
  first_in_last_out: 1,
}

/** Apex number spinner: value on the right, ▲▼ stacked on the left. */
function Spinner({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className={`flex items-center h-[42px] w-[160px] rounded border border-[var(--apex-border)] bg-white ${disabled ? 'opacity-50' : ''}`}>
      <input
        type="number"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="flex-1 min-w-0 w-0 h-full px-3 text-[15px] text-right outline-none bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <div className="flex flex-col border-r border-slate-200 h-full w-9 shrink-0">
        <button type="button" disabled={disabled} onClick={() => onChange(value + 1)} aria-label="زيادة" className="flex-1 flex items-center justify-center text-slate-500 hover:bg-slate-50"><ChevronUp className="h-4 w-4" /></button>
        <button type="button" disabled={disabled} onClick={() => onChange(Math.max(0, value - 1))} aria-label="إنقاص" className="flex-1 flex items-center justify-center text-slate-500 hover:bg-slate-50"><ChevronDown className="h-4 w-4" /></button>
      </div>
    </div>
  )
}

function Row({ label, children, check, onCheck }: {
  label: string; children?: React.ReactNode; check?: number; onCheck?: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <label className="flex items-center gap-3 text-[16px] text-slate-800 cursor-pointer">
        {onCheck && (
          <input type="checkbox" checked={!!check} onChange={(e) => onCheck(e.target.checked ? 1 : 0)} className="h-[18px] w-[18px] accent-[var(--apex-blue)]" />
        )}
        <span>{label}</span>
      </label>
      {children}
    </div>
  )
}

/**
 * «اعدادات الحضور و الانصراف» — the Apex rules card: ignore window, shifts in
 * reports, min/max overtime before/after the shift, absence thresholds, and
 * first-in/last-out. Persists to the Attendance Rules Settings single.
 */
export function AttendanceSettingsPage() {
  const { toast } = useToast()
  const [r, setR] = useState<Rules>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(true)
  const set = <K extends keyof Rules>(k: K) => (v: Rules[K]) => setR((p) => ({ ...p, [k]: v }))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res: any = await frappeClient.get<Rules>(DT, DT)
      const d = res?.data ?? {}
      setR({ ...DEFAULTS, ...Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, Number(d[k] ?? (DEFAULTS as any)[k])])) } as Rules)
    } catch {
      setR(DEFAULTS)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await frappeClient.put(DT, DT, r)
      toast({ title: 'تم الحفظ' })
    } catch (e: any) {
      toast({ title: 'فشل الحفظ', description: e?.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4" dir="rtl">
      <div className="bg-white rounded shadow-sm px-8 py-6 mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[16px] text-slate-800">اعدادات الحضور و الانصراف</h2>
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-slate-500" aria-label="طي">
            {open ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {open && (loading ? (
          <div className="py-12 text-center"><Loader2 className="h-7 w-7 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
        ) : (
          <div className="divide-y-0">
            <Row label="وقت اهمال الحركات بالدقائق"><Spinner value={r.ignore_window_minutes} onChange={set('ignore_window_minutes')} /></Row>
            <Row label="عدد الورديات التي تظهر في التقارير"><Spinner value={r.shifts_in_reports} onChange={set('shifts_in_reports')} /></Row>
            <Row label="الحد الادني لاحتساب الاضافي قبل الدوام بالدقائق" check={r.enable_min_ot_before} onCheck={set('enable_min_ot_before')}>
              <Spinner value={r.min_ot_before} onChange={set('min_ot_before')} disabled={!r.enable_min_ot_before} />
            </Row>
            <Row label="الحد الاقصي لاحتساب الاضافي قبل الدوام بالدقائق" check={r.enable_max_ot_before} onCheck={set('enable_max_ot_before')}>
              <Spinner value={r.max_ot_before} onChange={set('max_ot_before')} disabled={!r.enable_max_ot_before} />
            </Row>
            <Row label="الحد الادني لاحتساب الاضافي بعد الدوام بالدقائق" check={r.enable_min_ot_after} onCheck={set('enable_min_ot_after')}>
              <Spinner value={r.min_ot_after} onChange={set('min_ot_after')} disabled={!r.enable_min_ot_after} />
            </Row>
            <Row label="الحد الاقصي لاحتساب الاضافي بعد الدوام بالدقائق" check={r.enable_max_ot_after} onCheck={set('enable_max_ot_after')}>
              <Spinner value={r.max_ot_after} onChange={set('max_ot_after')} disabled={!r.enable_max_ot_after} />
            </Row>
            <Row label="يتم احتساب اليوم غياب بعد انصراف مبكر بالدقائق" check={r.enable_absent_early_exit} onCheck={set('enable_absent_early_exit')}>
              <Spinner value={r.absent_early_exit_minutes} onChange={set('absent_early_exit_minutes')} disabled={!r.enable_absent_early_exit} />
            </Row>
            <Row label="يتم احتساب اليوم غياب بعد تأخير بالدقائق" check={r.enable_absent_late} onCheck={set('enable_absent_late')}>
              <Spinner value={r.absent_late_minutes} onChange={set('absent_late_minutes')} disabled={!r.enable_absent_late} />
            </Row>
            <Row label="احتساب اول حركة دخول و اخر حركة انصراف" check={r.first_in_last_out} onCheck={set('first_in_last_out')} />

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="h-[42px] px-5 rounded bg-[var(--apex-green)] text-white text-[15px] flex items-center gap-2 hover:bg-[var(--apex-green-dark)] disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
