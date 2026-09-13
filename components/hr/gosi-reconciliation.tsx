'use client'

/**
 * GosiReconciliation — the "GOSI Reconciliation / مطابقة GOSI" section.
 *
 * Compares each active employee's internal registered wage (Salary Structure
 * Assignment base) against the GOSI-registered wage into three buckets —
 * غير مسجّل / أجر غير مطابق / متطابق. The office uploads a CSV the GOSI portal
 * exports (columns: employee, gosi_wage) which triggers a fresh reconciliation
 * run server-side; the latest run's three-bucket summary + mismatch rows are
 * shown. Feature-gated server-side (`gosi_reconciliation`); the UI does not gate.
 *
 * Self-contained: fetch fns + types live in this file. Mirrors the other HR
 * dashboard sections (token-only colors, logical-RTL, skeleton + retry,
 * Arabic-first).
 */

import * as React from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ScaleIcon,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  UserX,
  Upload,
  Loader2,
  FileSpreadsheet,
  Building2,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n'
import { frappeClient } from '@/lib/api-client'

const CARD = 'hr-lift rounded-xl border border-border bg-card text-card-foreground shadow-card p-5'

type TX = (en: string, ar: string) => string

/* ─────────────────────────── types (self-contained) ─────────────────────────── */

type BucketKey = 'Not Registered' | 'Wage Mismatch' | 'Matched'

interface GosiRow {
  employee: string
  employee_name: string
  internal_wage: number
  gosi_wage: number
  bucket: BucketKey
}

interface GosiRun {
  run: string
  run_date: string
  not_registered: number
  mismatch: number
  matched: number
  rows: GosiRow[]
}

interface RunResult {
  run: string
  not_registered: number
  mismatch: number
  matched: number
  total: number
}

interface CompanyOpt {
  name: string
  company_name?: string
}

/* ─────────────────────────── fetch fns (self-contained) ─────────────────────────── */

async function fetchCompanies(): Promise<CompanyOpt[]> {
  return frappeClient.getList<CompanyOpt>('Company', {
    fields: ['name', 'company_name'],
    order_by: 'company_name asc',
    limit_page_length: 0,
  })
}

async function fetchLatestRun(company: string, signal?: AbortSignal): Promise<GosiRun | null> {
  const res = await frappeClient.call<GosiRun | null>(
    'base_meena.api.gosi_reconciliation.get_latest_run',
    { company },
    signal,
  )
  return (res?.message ?? null) as GosiRun | null
}

async function runReconciliation(company: string, csv_content: string): Promise<RunResult> {
  const res = await frappeClient.call<RunResult>(
    'base_meena.api.gosi_reconciliation.run_reconciliation',
    { company, csv_content },
  )
  return res?.message as RunResult
}

/* ─────────────────────────── helpers ─────────────────────────── */

const BUCKET_META: Record<
  BucketKey,
  { key: keyof Pick<GosiRun, 'not_registered' | 'mismatch' | 'matched'>; varName: string; en: string; ar: string; icon: React.ComponentType<{ className?: string }> }
> = {
  'Not Registered': { key: 'not_registered', varName: '--destructive', en: 'Not Registered', ar: 'غير مسجّل', icon: UserX },
  'Wage Mismatch': { key: 'mismatch', varName: '--warning', en: 'Wage Mismatch', ar: 'أجر غير مطابق', icon: AlertTriangle },
  'Matched': { key: 'matched', varName: '--success', en: 'Matched', ar: 'متطابق', icon: CheckCircle2 },
}

const BUCKET_ORDER: BucketKey[] = ['Not Registered', 'Wage Mismatch', 'Matched']

function fmtSAR(n: number): string {
  const v = Number(n || 0)
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v)
}

function fmtDateTime(s: string): string {
  if (!s) return ''
  const d = new Date(String(s).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return String(s)
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

/* ─────────────────────────── stat tile ─────────────────────────── */

function StatTile({
  bucket,
  count,
  active,
  onSelect,
  tx,
}: {
  bucket: BucketKey
  count: number
  active: boolean
  onSelect: () => void
  tx: TX
}) {
  const meta = BUCKET_META[bucket]
  const color = `hsl(var(${meta.varName}))`
  const Icon = meta.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`hr-lift flex flex-col items-start gap-3 rounded-xl border p-4 text-start transition-all ${
        active ? 'border-transparent ring-2' : 'border-border hover:border-transparent'
      }`}
      style={{
        backgroundColor: `hsl(var(${meta.varName}) / ${count > 0 ? 0.1 : 0.05})`,
        // ring color via boxShadow keeps it token-driven regardless of ring util color
        boxShadow: active ? `0 0 0 2px ${color}` : undefined,
      }}
    >
      <span
        className="flex h-9 w-9 items-center justify-center rounded-lg"
        style={{ backgroundColor: `hsl(var(${meta.varName}) / 0.16)`, color }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className="text-2xl font-bold leading-none tabular-nums" style={{ color }}>
          {count}
        </div>
        <div className="mt-1 text-xs font-medium text-muted-foreground">{tx(meta.en, meta.ar)}</div>
      </div>
    </button>
  )
}

/* ─────────────────────────── rows table ─────────────────────────── */

function RowsTable({ rows, filter, tx }: { rows: GosiRow[]; filter: BucketKey; tx: TX }) {
  const meta = BUCKET_META[filter]
  const color = `hsl(var(${meta.varName}))`

  if (rows.length === 0) {
    return (
      <div className={`${CARD} flex flex-col items-center gap-2 py-8 text-center`}>
        <span
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: `hsl(var(${meta.varName}) / 0.12)`, color }}
        >
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold text-foreground">
          {tx('No employees in this bucket', 'لا يوجد موظفون في هذه الفئة')}
        </p>
        <p className="text-xs text-muted-foreground">{tx(meta.en, meta.ar)}</p>
      </div>
    )
  }

  const showDiff = filter !== 'Not Registered'

  return (
    <div className={`${CARD} overflow-hidden p-0`}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="text-sm font-semibold text-foreground">{tx(meta.en, meta.ar)}</h3>
        <span className="ms-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {rows.length}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 text-start font-medium">{tx('Employee', 'الموظف')}</th>
              <th className="px-4 py-2.5 text-end font-medium">{tx('Internal wage', 'الأجر الداخلي')}</th>
              <th className="px-4 py-2.5 text-end font-medium">{tx('GOSI wage', 'أجر GOSI')}</th>
              {showDiff && <th className="px-4 py-2.5 text-end font-medium">{tx('Difference', 'الفارق')}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const diff = Number(r.gosi_wage || 0) - Number(r.internal_wage || 0)
              const diffColor =
                diff > 0 ? 'hsl(var(--info))' : diff < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))'
              return (
                <tr key={r.employee} className="border-b border-border/60 last:border-b-0 hover:bg-accent/40">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{r.employee_name || r.employee}</div>
                    <div className="text-[11px] tabular-nums text-muted-foreground">{r.employee}</div>
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-foreground">
                    {fmtSAR(r.internal_wage)}
                    <span className="ms-1 text-[10px] text-muted-foreground">{tx('SAR', 'ر.س')}</span>
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">
                    {filter === 'Not Registered' ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <>
                        <span className="text-foreground">{fmtSAR(r.gosi_wage)}</span>
                        <span className="ms-1 text-[10px] text-muted-foreground">{tx('SAR', 'ر.س')}</span>
                      </>
                    )}
                  </td>
                  {showDiff && (
                    <td className="px-4 py-3 text-end font-semibold tabular-nums" style={{ color: diffColor }}>
                      {diff > 0 ? '+' : ''}
                      {fmtSAR(diff)}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─────────────────────────── skeleton ─────────────────────────── */

function SkeletonState() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`${CARD} space-y-3`}>
            <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
            <div className="h-7 w-12 animate-pulse rounded bg-muted" />
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className={`${CARD} space-y-3`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 w-40 animate-pulse rounded bg-muted" />
            <div className="ms-auto h-3 w-20 animate-pulse rounded bg-muted" />
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─────────────────────────── main export ─────────────────────────── */

export default function GosiReconciliationSection() {
  const { isRTL } = useI18n()
  const tx: TX = (en, ar) => (isRTL ? ar : en)

  const fileRef = useRef<HTMLInputElement>(null)

  const [companies, setCompanies] = useState<CompanyOpt[]>([])
  const [company, setCompany] = useState<string>('')
  const [companiesError, setCompaniesError] = useState(false)

  const [run, setRun] = useState<GosiRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [filter, setFilter] = useState<BucketKey>('Wage Mismatch')

  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null)

  /* load companies once */
  useEffect(() => {
    let alive = true
    setCompaniesError(false)
    fetchCompanies()
      .then((list) => {
        if (!alive) return
        setCompanies(list)
        if (list.length > 0) setCompany((c) => c || list[0].name)
        else setLoading(false)
      })
      .catch(() => {
        if (!alive) return
        setCompaniesError(true)
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  /* load latest run whenever company changes */
  const load = React.useCallback(
    (comp: string, signal?: AbortSignal) => {
      if (!comp) return
      setLoading(true)
      setError(false)
      fetchLatestRun(comp, signal)
        .then((d) => {
          if (signal?.aborted) return
          setRun(d)
          setLoading(false)
        })
        .catch(() => {
          if (signal?.aborted) return
          setError(true)
          setLoading(false)
        })
    },
    [],
  )

  useEffect(() => {
    if (!company) return
    const ctrl = new AbortController()
    load(company, ctrl.signal)
    return () => ctrl.abort()
  }, [company, load])

  /* CSV upload → run_reconciliation → reload latest run */
  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // reset the input so the same file can be re-selected later
    e.target.value = ''
    if (!file || !company) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const text = await file.text()
      if (!text.trim()) throw new Error('empty')
      const result = await runReconciliation(company, text)
      setUploadMsg({
        ok: true,
        text: tx(
          `Reconciled ${result.total} employees — ${result.mismatch} mismatched, ${result.not_registered} not registered.`,
          `تمت مطابقة ${result.total} موظف — ${result.mismatch} غير مطابق، ${result.not_registered} غير مسجّل.`,
        ),
      })
      setFilter('Wage Mismatch')
      load(company)
    } catch {
      setUploadMsg({
        ok: false,
        text: tx('Could not process the CSV. Check the file and try again.', 'تعذّرت معالجة الملف. تحقّق منه وحاول مجددًا.'),
      })
    } finally {
      setUploading(false)
    }
  }

  const filteredRows = useMemo(
    () => (run ? run.rows.filter((r) => r.bucket === filter) : []),
    [run, filter],
  )

  const total = run ? run.not_registered + run.mismatch + run.matched : 0
  const updatedAt = run?.run_date ? fmtDateTime(run.run_date) : null

  return (
    <div className="mb-8">
      {/* header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScaleIcon className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-foreground">{tx('GOSI Reconciliation', 'مطابقة GOSI')}</h2>
        </div>
        <div className="flex items-center gap-2">
          {updatedAt && !loading && !error && (
            <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">
              {tx('Last run', 'آخر مطابقة')} {updatedAt}
            </span>
          )}
          <button
            type="button"
            onClick={() => load(company)}
            disabled={loading || !company}
            aria-label={tx('Refresh', 'تحديث')}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* controls: company + upload */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex items-center">
          <Building2 className="pointer-events-none absolute h-3.5 w-3.5 text-muted-foreground" style={{ insetInlineStart: '0.75rem' }} />
          <select
            aria-label={tx('Company', 'الشركة')}
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            disabled={companies.length === 0}
            className="h-9 rounded-lg border border-border bg-card text-sm text-foreground ps-9 pe-8 outline-none transition-colors hover:border-primary/40 focus:border-primary disabled:opacity-50"
          >
            {companies.length === 0 && <option value="">{tx('No companies', 'لا توجد شركات')}</option>}
            {companies.map((c) => (
              <option key={c.name} value={c.name}>
                {c.company_name || c.name}
              </option>
            ))}
          </select>
        </div>

        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onPickFile} className="hidden" />
        <Button
          type="button"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || !company}
        >
          {uploading ? <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="me-1.5 h-3.5 w-3.5" />}
          {uploading ? tx('Reconciling…', 'جارٍ المطابقة…') : tx('Upload GOSI CSV', 'رفع ملف GOSI')}
        </Button>

        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <FileSpreadsheet className="h-3 w-3" />
          {tx('columns: employee, gosi_wage', 'الأعمدة: employee، gosi_wage')}
        </span>
      </div>

      {/* upload result banner */}
      {uploadMsg && (
        <div
          className="mb-4 flex items-start gap-2 rounded-lg border p-3 text-xs"
          style={{
            backgroundColor: `hsl(var(${uploadMsg.ok ? '--success' : '--destructive'}) / 0.1)`,
            borderColor: `hsl(var(${uploadMsg.ok ? '--success' : '--destructive'}) / 0.25)`,
            color: `hsl(var(${uploadMsg.ok ? '--success' : '--destructive'}))`,
          }}
        >
          {uploadMsg.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span>{uploadMsg.text}</span>
        </div>
      )}

      {/* body */}
      {companiesError ? (
        <div className={`${CARD} flex flex-col items-center gap-3 py-10 text-center`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold text-foreground">{tx("Couldn't load companies", 'تعذّر تحميل الشركات')}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw className="me-1.5 h-3.5 w-3.5" />
            {tx('Retry', 'إعادة المحاولة')}
          </Button>
        </div>
      ) : error ? (
        <div className={`${CARD} flex flex-col items-center gap-3 py-10 text-center`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {tx("Couldn't load the reconciliation", 'تعذّر تحميل المطابقة')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx('Check your connection and try again.', 'تحقّق من الاتصال وحاول مرة أخرى.')}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => load(company)}>
            <RefreshCw className="me-1.5 h-3.5 w-3.5" />
            {tx('Retry', 'إعادة المحاولة')}
          </Button>
        </div>
      ) : loading ? (
        <SkeletonState />
      ) : !run ? (
        <div className={`${CARD} flex flex-col items-center gap-3 py-12 text-center`}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <FileSpreadsheet className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{tx('No reconciliation run yet', 'لم تُجرَ أي مطابقة بعد')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx('Upload the GOSI wage CSV to run the first reconciliation for this company.', 'ارفع ملف أجور GOSI لإجراء أول مطابقة لهذه الشركة.')}
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading || !company}>
            <Upload className="me-1.5 h-3.5 w-3.5" />
            {tx('Upload GOSI CSV', 'رفع ملف GOSI')}
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* three colored stat tiles (also act as row filters) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {BUCKET_ORDER.map((b) => (
              <StatTile
                key={b}
                bucket={b}
                count={run[BUCKET_META[b].key]}
                active={filter === b}
                onSelect={() => setFilter(b)}
                tx={tx}
              />
            ))}
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            {tx('Showing', 'عرض')}{' '}
            <span className="font-medium text-foreground/80">{tx(BUCKET_META[filter].en, BUCKET_META[filter].ar)}</span>{' '}
            {tx('of', 'من')} <span className="tabular-nums text-foreground/70">{total}</span> {tx('employees', 'موظف')}
          </p>

          <RowsTable rows={filteredRows} filter={filter} tx={tx} />
        </div>
      )}
    </div>
  )
}
