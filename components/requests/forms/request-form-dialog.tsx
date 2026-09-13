'use client'

/**
 * RequestFormDialog (F1) — the in-app form for creating a request of a given
 * type, on behalf of an employee. Field set is driven by the request type;
 * posts via requestsApi.create → the backend creates the target doc + the
 * approval flow. Token-only, RTL-safe.
 */
import * as React from 'react'
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { frappeClient } from '@/lib/api-client'
import { requestsApi, type RequestType } from '@/lib/requests-api'

type Field = { key: string; label: string; label_ar: string; type: 'date' | 'time' | 'number' | 'text' | 'textarea' | 'leave_type'; required?: boolean }

const FIELDS: Record<string, Field[]> = {
  leave: [
    { key: 'from_date', label: 'From', label_ar: 'من', type: 'date', required: true },
    { key: 'to_date', label: 'To', label_ar: 'إلى', type: 'date', required: true },
    { key: 'leave_type', label: 'Leave type', label_ar: 'نوع الإجازة', type: 'leave_type', required: true },
    { key: 'description', label: 'Reason', label_ar: 'السبب', type: 'textarea' },
  ],
  permission: [
    { key: 'date', label: 'Date', label_ar: 'التاريخ', type: 'date', required: true },
    { key: 'hours', label: 'Hours', label_ar: 'الساعات', type: 'number', required: true },
    { key: 'reason', label: 'Reason', label_ar: 'السبب', type: 'textarea' },
  ],
  letter: [
    { key: 'letter_type', label: 'Letter type', label_ar: 'نوع الخطاب', type: 'text', required: true },
    { key: 'purpose', label: 'Purpose', label_ar: 'الغرض', type: 'textarea' },
  ],
  overtime: [
    { key: 'date', label: 'Date', label_ar: 'التاريخ', type: 'date', required: true },
    { key: 'hours', label: 'Hours', label_ar: 'الساعات', type: 'number', required: true },
    { key: 'reason', label: 'Reason', label_ar: 'السبب', type: 'textarea' },
  ],
  expense: [
    { key: 'amount', label: 'Amount', label_ar: 'المبلغ', type: 'number', required: true },
    { key: 'description', label: 'Description', label_ar: 'الوصف', type: 'textarea', required: true },
  ],
  advance: [
    { key: 'amount', label: 'Amount', label_ar: 'المبلغ', type: 'number', required: true },
    { key: 'reason', label: 'Reason', label_ar: 'السبب', type: 'textarea' },
  ],
  attendance: [
    { key: 'from_date', label: 'From', label_ar: 'من', type: 'date', required: true },
    { key: 'to_date', label: 'To', label_ar: 'إلى', type: 'date', required: true },
    { key: 'reason', label: 'Reason', label_ar: 'السبب', type: 'textarea' },
  ],
  shift: [
    { key: 'from_date', label: 'From', label_ar: 'من', type: 'date', required: true },
    { key: 'to_date', label: 'To', label_ar: 'إلى', type: 'date', required: true },
    { key: 'shift_type', label: 'Shift', label_ar: 'المناوبة', type: 'text', required: true },
    { key: 'reason', label: 'Reason', label_ar: 'السبب', type: 'textarea' },
  ],
  resignation: [
    { key: 'boarding_status', label: 'Notice date', label_ar: 'تاريخ الإشعار', type: 'date', required: true },
    { key: 'reason', label: 'Reason', label_ar: 'السبب', type: 'textarea' },
  ],
  punch: [
    { key: 'date', label: 'Date', label_ar: 'التاريخ', type: 'date', required: true },
    { key: 'time', label: 'Time', label_ar: 'الوقت', type: 'time', required: true },
    { key: 'log_type', label: 'Log type', label_ar: 'نوع التسجيل', type: 'text', required: true },
    { key: 'reason', label: 'Reason', label_ar: 'السبب', type: 'textarea' },
  ],
}

export function RequestFormDialog({
  type,
  employee,
  employeeName,
  open,
  onOpenChange,
  onCreated,
}: {
  type: RequestType
  employee: string
  employeeName?: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated?: () => void
}) {
  const { isRTL } = useI18n()
  const tt = (en: string, ar: string) => (isRTL ? ar : en)
  const { toast } = useToast()
  const fields = FIELDS[type.key] || [{ key: 'reason', label: 'Reason', label_ar: 'السبب', type: 'textarea' as const, required: true }]

  const [values, setValues] = useState<Record<string, string>>({})
  const [leaveTypes, setLeaveTypes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setValues({})
    if (fields.some((f) => f.type === 'leave_type')) {
      frappeClient.get('Leave Type', undefined, { fields: ['name'], limit_page_length: 100 })
        .then((r: any) => setLeaveTypes((r?.data || []).map((x: any) => x.name)))
        .catch(() => setLeaveTypes([]))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type.key])

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }))

  const submit = async () => {
    for (const f of fields) {
      if (f.required && !values[f.key]?.trim?.()) {
        toast({ title: tt('Missing field', 'حقل ناقص'), description: (isRTL ? f.label_ar : f.label), variant: 'destructive' })
        return
      }
    }
    setBusy(true)
    try {
      await requestsApi.create(type.key, employee, values)
      toast({ title: tt('Request submitted', 'تم إرسال الطلب'), description: tt('It is now pending approval.', 'الطلب الآن بانتظار الاعتماد.') })
      onOpenChange(false)
      onCreated?.()
    } catch (e: any) {
      toast({ title: tt('Could not submit', 'تعذر الإرسال'), description: e?.message || tt('Please try again.', 'يرجى المحاولة مرة أخرى.'), variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isRTL ? (type.label_ar || type.label) : type.label}</DialogTitle>
        </DialogHeader>
        {employeeName && (
          <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
            {tt('On behalf of', 'نيابة عن')}: <span className="font-medium">{employeeName}</span>
          </p>
        )}
        <div className="space-y-3 py-1">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-sm">{isRTL ? f.label_ar : f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
              {f.type === 'textarea' ? (
                <Textarea rows={2} value={values[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} />
              ) : f.type === 'leave_type' ? (
                <Select value={values[f.key] || ''} onValueChange={(v) => set(f.key, v)}>
                  <SelectTrigger aria-label={tt('Select…', 'اختر…')}><SelectValue placeholder={tt('Select…', 'اختر…')} /></SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((lt) => <SelectItem key={lt} value={lt}>{lt}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text'} value={values[f.key] || ''} onChange={(e) => set(f.key, e.target.value)} />
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>{tt('Cancel', 'إلغاء')}</Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            {tt('Submit', 'إرسال')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
