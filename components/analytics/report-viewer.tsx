'use client'

/**
 * F9 — Report viewer: runs a report-hub template, renders rows in a DataTable,
 * and exports via the server (Excel/PDF) or the browser (Print). Filters are
 * built generically from the template's filters_spec. Read-only.
 */
import * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, ArrowLeft, FileSpreadsheet, FileText, Printer, Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader, DataTable, FilterBar } from '@/components/shared'
import type { DataTableColumn } from '@/components/shared'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useBrand, printableLogo } from '@/hooks/use-brand'

const call = async (method: string, args?: any) => (await frappeClient.call(method, args) as any)?.message

function specToFields(spec: any): { fieldname: string; label: string }[] {
  if (Array.isArray(spec)) return spec.map((f: any) => (typeof f === 'string' ? { fieldname: f, label: f } : { fieldname: f.fieldname || f.name || '', label: f.label || f.fieldname || '' })).filter((f) => f.fieldname)
  if (spec && typeof spec === 'object') return Object.keys(spec).map((k) => ({ fieldname: k, label: spec[k]?.label || k }))
  return []
}

function colsFrom(template: any, rows: any[]): DataTableColumn<any>[] {
  let keys: { id: string; header: string }[] = []
  const tc = template?.columns
  if (Array.isArray(tc) && tc.length) {
    keys = tc.map((c: any) => (typeof c === 'string' ? { id: c, header: c } : { id: c.fieldname || c.key || c.id || '', header: c.label || c.header || c.fieldname || '' })).filter((c) => c.id)
  } else if (rows.length) {
    keys = Object.keys(rows[0]).filter((k) => k !== '__idx').map((k) => ({ id: k, header: k }))
  }
  return keys.map((k) => ({
    id: k.id, header: k.header,
    cell: (r: any) => { const v = r[k.id]; return v == null ? '—' : (typeof v === 'object' ? JSON.stringify(v) : String(v)) },
    exportAccessor: (r: any) => { const v = r[k.id]; return v == null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)) },
  }))
}

export function ReportViewer({ template, onBack }: { template: any; onBack: () => void }) {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)
  const fields = useMemo(() => specToFields(template?.filters_spec), [template])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const run = useCallback(async () => {
    setLoading(true)
    try {
      const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
      const r = await call('base_meena.report_hub.api.run_report_template', { template: template.key, filters: active, file_format: 'json' })
      const list = Array.isArray(r) ? r : (r?.rows || r?.data || [])
      setRows(list.map((row: any, i: number) => ({ ...row, __idx: i })))
    } catch { setRows([]) } finally { setLoading(false) }
  }, [filters, template])

  useEffect(() => { run() }, [template]) // eslint-disable-line react-hooks/exhaustive-deps

  const cols = useMemo(() => colsFrom(template, rows), [template, rows])
  const Back = isRTL ? ArrowRight : ArrowLeft

  const exportUrl = (fmt: string) => {
    const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
    const qs = new URLSearchParams({ template: template.key, file_format: fmt, filters: JSON.stringify(active) })
    return `/api/method/base_meena.report_hub.api.run_report_template?${qs.toString()}`
  }

  const brand = useBrand()
  const logo = printableLogo(brand)
  return (
    <div className="space-y-4">
      {/* Letterhead for window.print(): invisible on screen, first thing on paper. */}
      {(logo || brand.appName) && (
        <div className="hidden print:flex items-center gap-3 border-b-2 border-slate-900 pb-2 mb-3">
          {logo && <img src={logo} alt="" className="h-12 w-auto max-w-[160px] object-contain" />}
          <div>
            <div className="text-[15px] font-bold text-slate-900">{brand.appName}</div>
            {brand.tagline && <div className="text-[11px] text-slate-500">{brand.tagline}</div>}
          </div>
        </div>
      )}
      <PageHeader
        title={isRTL ? (template.label_ar || template.label) : template.label}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(exportUrl('xlsx'), '_blank')}><FileSpreadsheet className="h-4 w-4 me-1.5" />{tx('Excel', 'إكسل')}</Button>
            <Button variant="outline" size="sm" onClick={() => window.open(exportUrl('pdf'), '_blank')}><FileText className="h-4 w-4 me-1.5" />PDF</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 me-1.5" />{tx('Print', 'طباعة')}</Button>
            <Button variant="ghost" size="sm" onClick={onBack}><Back className="h-4 w-4 me-1.5" />{tx('Back', 'رجوع')}</Button>
          </div>
        }
      />
      {fields.length > 0 && (
        <FilterBar>
          {fields.map((f) => (
            <div key={f.fieldname} className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <Input
                className="h-9 w-40"
                value={filters[f.fieldname] || ''}
                onChange={(e) => setFilters((s) => ({ ...s, [f.fieldname]: e.target.value }))}
                placeholder={f.label}
              />
            </div>
          ))}
          <Button size="sm" onClick={run} className="self-end"><Play className="h-4 w-4 me-1.5" />{tx('Run', 'تشغيل')}</Button>
        </FilterBar>
      )}
      <DataTable
        rows={rows}
        columns={cols}
        getRowId={(r) => String(r.__idx)}
        isRTL={isRTL}
        loading={loading}
        searchable
        searchPlaceholder={tx('Search…', 'بحث…')}
        emptyMessage={tx('No rows.', 'لا صفوف.')}
        pageSize={25}
      />
    </div>
  )
}
