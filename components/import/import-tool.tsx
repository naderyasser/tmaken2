'use client'

/**
 * F10 — Data import/export. Pick an entity, download its template, paste/upload
 * CSV, run a DRY-RUN validation (default), and only write when explicitly toggled
 * (HR-gated on the backend, per-row error isolation). Read-first by design.
 */
import * as React from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Download, Upload, CheckCircle2, XCircle, Loader2, Play, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader, DataTable, EmptyState } from '@/components/shared'
import type { DataTableColumn } from '@/components/shared'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'

const call = async (method: string, args?: any) => (await frappeClient.call(method, args) as any)?.message

function parseCsv(text: string): any[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const cells = line.split(',')
    const o: any = {}
    headers.forEach((h, i) => { o[h] = (cells[i] ?? '').trim() })
    return o
  })
}

// Backend `get_import_templates` returns { key, label, label_ar, doctype, fields }.
// `key` is the canonical entity id that validate_import/run_import expect
// (they do IMPORT_ENTITIES.get(entity)). Use it for the SelectItem value.
const entityKey = (e: any): string => e?.key ?? e?.entity ?? ''

// Fallback bilingual labels, used only when the backend template omits label/label_ar.
const ENTITY_LABELS: Record<string, { en: string; ar: string }> = {
  employee: { en: 'Employees', ar: 'الموظفون' },
  branch: { en: 'Branches', ar: 'الفروع' },
  department: { en: 'Departments', ar: 'الأقسام' },
  designation: { en: 'Designations', ar: 'المسميات الوظيفية' },
  leave_allocation: { en: 'Leave Allocations', ar: 'أرصدة الإجازات' },
  salary: { en: 'Salaries', ar: 'الرواتب' },
  salary_structure_assignment: { en: 'Salaries', ar: 'الرواتب' },
}

export function ImportTool() {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  // Prefer the bilingual label shipped by the backend; fall back to a local map, then the key.
  const entityLabel = (e: any): string => {
    const fromBackend = isRTL ? e?.label_ar : e?.label
    if (fromBackend) return fromBackend
    const m = ENTITY_LABELS[entityKey(e)]
    return m ? (isRTL ? m.ar : m.en) : entityKey(e)
  }
  const { toast } = useToast()
  const [entities, setEntities] = useState<any[]>([])
  const [entity, setEntity] = useState('')
  const [csv, setCsv] = useState('')
  const [results, setResults] = useState<any[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [writeMode, setWriteMode] = useState(false)

  useEffect(() => {
    call('base_meena.api.import_api.get_import_templates')
      .then((r) => {
        const l = (Array.isArray(r) ? r : (r?.templates || [])).filter((e: any) => entityKey(e))
        setEntities(l)
        if (l[0]) setEntity(entityKey(l[0]))
      })
      .catch(() => setEntities([]))
  }, [])

  const rows = useMemo(() => parseCsv(csv), [csv])

  const download = () => {
    if (!entity) return
    window.open(`/api/method/base_meena.api.import_api.download_import_template?entity=${encodeURIComponent(entity)}&file_format=csv`, '_blank')
  }

  const validate = async () => {
    setBusy(true)
    try {
      const r = await call('base_meena.api.import_api.validate_import', { entity, rows })
      setResults((Array.isArray(r) ? r : (r?.results || [])).map((x: any, i: number) => ({ ...x, __idx: i })))
    } catch (e: any) { toast({ title: tx('Validation failed', 'فشل التحقق'), variant: 'destructive' }) } finally { setBusy(false) }
  }

  const runImport = async () => {
    setBusy(true)
    try {
      const r = await call('base_meena.api.import_api.run_import', { entity, rows, dry_run: !writeMode })
      const errs = (r?.errors || []).length
      toast({
        title: writeMode ? tx('Import complete', 'اكتمل الاستيراد') : tx('Dry-run complete', 'اكتملت المحاكاة'),
        description: `${tx('OK', 'ناجح')}: ${r?.updated?.length ?? r?.inserted?.length ?? (rows.length - errs)} · ${tx('Errors', 'أخطاء')}: ${errs}`,
      })
      if (r?.errors) setResults(r.errors.map((x: any, i: number) => ({ row: x.row, ok: false, errors: x.error, __idx: i })))
    } catch (e: any) { toast({ title: tx('Import failed', 'فشل الاستيراد'), variant: 'destructive' }) } finally { setBusy(false) }
  }

  const cols: DataTableColumn<any>[] = [
    { id: 'row', header: tx('Row', 'صف'), cell: (r) => (r.row ?? r.__idx + 1) },
    { id: 'ok', header: tx('Status', 'الحالة'), cell: (r) => r.ok
        ? <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-4 w-4" />{tx('OK', 'ناجح')}</span>
        : <span className="inline-flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" />{tx('Error', 'خطأ')}</span> },
    { id: 'errors', header: tx('Details', 'التفاصيل'), cell: (r) => (Array.isArray(r.errors) ? r.errors.join('; ') : (r.errors || '—')) },
  ]

  return (
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto space-y-5">
      <PageHeader title={tx('Data Import', 'استيراد البيانات')} description={tx('Bulk onboarding & migration — validate first, write only when confirmed.', 'إدخال ونقل جماعي — تحقّق أولاً، والكتابة عند التأكيد فقط.')} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">{tx('Entity', 'النوع')}</Label>
          <Select value={entity} onValueChange={setEntity}>
            <SelectTrigger aria-label={tx('Select…', 'اختر…')} className="w-56"><SelectValue placeholder={tx('Select…', 'اختر…')} /></SelectTrigger>
            <SelectContent>{entities.filter((e) => entityKey(e)).map((e) => { const k = entityKey(e); return <SelectItem key={k} value={k}>{entityLabel(e)}</SelectItem> })}</SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={download} disabled={!entity}><Download className="h-4 w-4 me-1.5" />{tx('Download template', 'تنزيل القالب')}</Button>
      </div>

      <div className="space-y-2">
        <Label className="text-sm">{tx('Paste CSV (first row = headers)', 'ألصق CSV (الصف الأول = العناوين)')}</Label>
        <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={7} className="font-mono text-xs" placeholder="name,employee_name,..." />
        <p className="text-xs text-muted-foreground">{rows.length} {tx('rows parsed', 'صف تم تحليله')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={validate} disabled={busy || !rows.length || !entity}>
          {busy ? <Loader2 className="h-4 w-4 me-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 me-1.5" />}{tx('Validate (dry-run)', 'تحقّق (محاكاة)')}
        </Button>
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
          <Switch checked={writeMode} onCheckedChange={setWriteMode} id="writemode" />
          <Label htmlFor="writemode" className="text-sm text-foreground">{tx('Write to database', 'الكتابة في قاعدة البيانات')}</Label>
        </div>
        <Button onClick={runImport} disabled={busy || !rows.length || !entity} className={writeMode ? '' : 'opacity-90'}>
          <Play className="h-4 w-4 me-1.5" />{writeMode ? tx('Import (write)', 'استيراد (كتابة)') : tx('Import (dry-run)', 'استيراد (محاكاة)')}
        </Button>
      </div>

      {writeMode && (
        <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
          <ShieldAlert className="h-4 w-4 shrink-0 text-warning mt-0.5" />
          <span>{tx('Write mode is ON — rows will be created/updated on this site.', 'وضع الكتابة مفعّل — سيتم إنشاء/تحديث الصفوف على هذا الموقع.')}</span>
        </div>
      )}

      {results && (
        results.length === 0
          ? <EmptyState icon={CheckCircle2} title={tx('All rows valid', 'كل الصفوف صحيحة')} />
          : <DataTable rows={results} columns={cols} getRowId={(r) => String(r.__idx)} isRTL={isRTL} emptyMessage={tx('No results', 'لا نتائج')} />
      )}
    </div>
  )
}
