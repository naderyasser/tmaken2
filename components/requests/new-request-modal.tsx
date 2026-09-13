'use client'

/**
 * NewRequestModal (F1) — "New request" flow: pick an employee (self by default;
 * HR/managers can submit on behalf), pick a request type, then fill the in-app
 * form. Token-only, RTL-safe.
 */
import * as React from 'react'
import { useEffect, useState } from 'react'
import { Search, FileText, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { frappeClient, type Employee } from '@/lib/api-client'
import { requestsApi, type RequestType } from '@/lib/requests-api'
import { RequestFormDialog } from './forms/request-form-dialog'

export function NewRequestModal({
  open,
  onOpenChange,
  onCreated,
  initialTypeKey,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated?: () => void
  /** Pre-select a request type (e.g. 'leave') so tile shortcuts skip the picker. */
  initialTypeKey?: string
}) {
  const { isRTL } = useI18n()
  const tt = (en: string, ar: string) => (isRTL ? ar : en)
  const { isHRUser, isManager, myEmployee, user } = useAuth()
  const canOnBehalf = isHRUser || isManager

  const [types, setTypes] = useState<RequestType[]>([])
  const [emp, setEmp] = useState<{ name: string; label?: string }>({ name: '' })
  const [q, setQ] = useState('')
  const [results, setResults] = useState<Employee[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<RequestType | null>(null)

  useEffect(() => {
    if (!open) return
    setPicked(null); setQ(''); setResults([])
    setEmp(myEmployee ? { name: myEmployee, label: user?.full_name } : { name: '' })
    requestsApi.getTypes().then((ts) => {
      setTypes(ts)
      if (initialTypeKey) {
        const match = ts.find((t) => t.key === initialTypeKey)
        if (match) setPicked(match)
      }
    }).catch(() => setTypes([]))
  }, [open, myEmployee, user?.full_name, initialTypeKey])

  useEffect(() => {
    if (!canOnBehalf || q.trim().length < 1) { setResults([]); return }
    setSearching(true)
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const rows = await frappeClient.searchEmployees(q.trim())
        if (!cancelled) setResults(rows.slice(0, 6))
      } catch { if (!cancelled) setResults([]) } finally { if (!cancelled) setSearching(false) }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q, canOnBehalf])

  const onBehalf = !!emp.name && emp.name !== myEmployee

  return (
    <>
      <Dialog open={open && !picked} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{tt('New request', 'طلب جديد')}</DialogTitle>
          </DialogHeader>

          {/* On-behalf employee picker (HR / managers only) */}
          {canOnBehalf && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">{tt('For employee', 'للموظف')}</p>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="ps-9"
                  placeholder={emp.label || myEmployee ? `${tt('Self', 'نفسي')}${emp.label ? ` · ${emp.label}` : ''}` : tt('Search employee…', 'ابحث عن موظف…')}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {searching && <Loader2 className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
              </div>
              {results.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                  {results.map((e) => (
                    <button
                      key={e.name}
                      className="flex w-full items-center justify-between px-3 py-2 text-start text-sm hover:bg-accent"
                      onClick={() => { setEmp({ name: e.name, label: e.employee_name }); setQ(''); setResults([]) }}
                    >
                      <span className="font-medium text-foreground">{e.employee_name}</span>
                      <span className="text-xs text-muted-foreground">{e.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {onBehalf && (
                <p className="rounded-md bg-accent px-3 py-1.5 text-xs text-accent-foreground">
                  {tt('On behalf of', 'نيابة عن')}: <span className="font-medium">{emp.label || emp.name}</span>
                </p>
              )}
            </div>
          )}

          {/* Type grid */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{tt('Request type', 'نوع الطلب')}</p>
            {types.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{tt('Loading…', 'جارٍ التحميل…')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {types.map((t) => (
                  <button
                    key={t.key}
                    disabled={!emp.name}
                    onClick={() => setPicked(t)}
                    className="flex flex-col items-start gap-1 rounded-lg border border-border p-3 text-start transition-colors hover:border-primary/40 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">{isRTL ? (t.label_ar || t.label) : t.label}</span>
                  </button>
                ))}
              </div>
            )}
            {!emp.name && (
              <p className="text-xs text-muted-foreground">{tt('Pick an employee first.', 'اختر موظفاً أولاً.')}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {picked && (
        <RequestFormDialog
          type={picked}
          employee={emp.name}
          employeeName={onBehalf ? (emp.label || emp.name) : undefined}
          open={!!picked}
          onOpenChange={(o) => { if (!o) setPicked(null) }}
          onCreated={() => { setPicked(null); onOpenChange(false); onCreated?.() }}
        />
      )}
    </>
  )
}
