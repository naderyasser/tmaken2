'use client'

/**
 * Fingerprint punch import — upload the Excel the terminals export, review what
 * it would write, then commit it.
 *
 * The preview step is not optional politeness: the two ways this import goes
 * wrong (an employee the file references who is not in the system, and a date
 * column read in the wrong order) both produce a result that looks entirely
 * normal afterwards. So the flow is upload → preview → confirm, and the preview
 * leads with what it could NOT match rather than burying it under totals.
 *
 * Laid out mobile-first throughout: the header wraps, stats are a 2-up grid on
 * a phone, and every table scrolls inside its own container so the page itself
 * never grows wider than the screen.
 */

import React, { useCallback, useRef, useState } from 'react'
import {
  Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, Loader2,
  RefreshCw, Users, UserX, CalendarRange,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/lib/i18n'
import {
  uploadPunchFile, previewPunchImport, runPunchImport, type PunchImportSummary,
} from '@/lib/punch-api'

const ACCEPTED = '.xls,.xlsx,.xlsm,.csv'

/** Reasons the backend reports for an unmatched person, in the user's language. */
function reasonLabel(reason: string, t: (k: string) => string): string {
  if (reason.startsWith('ambiguous:')) return t('pim.reasonAmbiguous')
  if (reason.startsWith('conflict:')) return t('pim.reasonConflict')
  return t('pim.reasonNotFound')
}

function StatCard({ label, value, tone = 'default' }: {
  label: string; value: React.ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad'
}) {
  const toneClass = {
    default: 'text-foreground',
    good: 'text-green-600',
    warn: 'text-amber-600',
    bad: 'text-red-600',
  }[tone]
  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-xl sm:text-2xl font-bold mt-1 ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  )
}

export function PunchImport({ onImported }: {
  /** Called with the YYYY-MM the punches landed in, so the sheet can follow. */
  onImported?: (month?: string) => void
}) {
  const { t } = useI18n()
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [preview, setPreview] = useState<PunchImportSummary | null>(null)
  const [imported, setImported] = useState<PunchImportSummary | null>(null)
  const [busy, setBusy] = useState<'upload' | 'import' | null>(null)

  const reset = useCallback(() => {
    setFile(null); setFileUrl(null); setPreview(null); setImported(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const handleFile = useCallback(async (picked: File) => {
    setBusy('upload')
    setPreview(null); setImported(null)
    try {
      const url = await uploadPunchFile(picked)
      setFile(picked); setFileUrl(url)
      setPreview(await previewPunchImport(url))
    } catch (err: any) {
      toast({ title: t('pim.previewFailed'), description: err?.message, variant: 'destructive' })
      reset()
    } finally {
      setBusy(null)
    }
  }, [reset, t, toast])

  const handleImport = useCallback(async () => {
    if (!fileUrl) return
    setBusy('import')
    try {
      const result = await runPunchImport(fileUrl)
      setImported(result)
      toast({
        title: t('pim.importDone'),
        description: `${result.result?.created ?? 0} ${t('pim.recordsCreated')}`,
      })
      onImported?.(result.range.from?.slice(0, 7))
    } catch (err: any) {
      toast({ title: t('pim.importFailed'), description: err?.message, variant: 'destructive' })
    } finally {
      setBusy(null)
    }
  }, [fileUrl, onImported, t, toast])

  const summary = imported ?? preview

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header — wraps instead of forcing the page wider than the screen */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">{t('pim.title')}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t('pim.subtitle')}</p>
        </div>
        {summary && (
          <Button variant="outline" size="sm" onClick={reset} className="shrink-0">
            <RefreshCw className="w-4 h-4 me-2" />
            {t('pim.startOver')}
          </Button>
        )}
      </div>

      {/* Step 1 — pick a file */}
      {!summary && (
        <Card>
          <CardContent className="p-4 sm:p-8">
            <div className="flex flex-col items-center text-center gap-3">
              <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
              <div className="text-sm text-muted-foreground max-w-md">
                {t('pim.dropHint')}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED}
                className="hidden"
                onChange={e => {
                  const picked = e.target.files?.[0]
                  if (picked) handleFile(picked)
                }}
              />
              <Button onClick={() => inputRef.current?.click()} disabled={busy !== null}>
                {busy === 'upload'
                  ? <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  : <Upload className="w-4 h-4 me-2" />}
                {t('pim.chooseFile')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {summary && (
        <>
          {/* What was read out of the file */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span className="break-all">{file?.name ?? summary.filename}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label={t('pim.rowsRead')} value={summary.file.parsed} />
                <StatCard
                  label={t('pim.rowsSkipped')}
                  value={summary.file.skipped_count}
                  tone={summary.file.skipped_count ? 'warn' : 'default'}
                />
                <StatCard label={t('pim.matched')} value={summary.totals.employees_matched} tone="good" />
                <StatCard
                  label={t('pim.unmatched')}
                  value={summary.totals.employees_unmatched}
                  tone={summary.totals.employees_unmatched ? 'bad' : 'default'}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <CalendarRange className="w-4 h-4 shrink-0" />
                <span dir="ltr">{summary.range.from ?? '—'} → {summary.range.to ?? '—'}</span>
                <span className="mx-1">·</span>
                <Users className="w-4 h-4 shrink-0" />
                <span>{summary.totals.punches} {t('pim.punches')}</span>
                {summary.totals.duplicate > 0 && (
                  <>
                    <span className="mx-1">·</span>
                    <Badge variant="secondary">
                      {summary.totals.duplicate} {t('pim.alreadyPresent')}
                    </Badge>
                  </>
                )}
              </div>

              {summary.file.ambiguous_date_order && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>{t('pim.dateOrderTitle')}</AlertTitle>
                  <AlertDescription>{t('pim.dateOrderBody')}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Who could not be matched — first, because it is what gets missed */}
          {summary.unmatched.length > 0 && (
            <Card className="border-amber-300">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-amber-700">
                  <UserX className="w-4 h-4 shrink-0" />
                  {t('pim.unmatchedTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">{t('pim.unmatchedHint')}</p>
                <div className="space-y-2">
                  {summary.unmatched.map((row, i) => (
                    <div
                      key={`${row.national_id}-${row.employee_no}-${i}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{row.employee_name || '—'}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">
                          {[row.national_id, row.employee_no, row.alt_code].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline">{row.punches} {t('pim.punches')}</Badge>
                        <Badge variant="secondary">{reasonLabel(row.reason, t)}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Who was matched */}
          {summary.employees.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{t('pim.matchedTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="border-b text-muted-foreground">
                        <th className="text-start font-medium py-2">{t('pim.employee')}</th>
                        <th className="text-start font-medium py-2">{t('pim.branch')}</th>
                        <th className="text-center font-medium py-2">{t('pim.punches')}</th>
                        <th className="text-center font-medium py-2">{t('pim.newRecords')}</th>
                        <th className="text-center font-medium py-2">{t('pim.period')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.employees.map(row => (
                        <tr key={row.employee} className="border-b last:border-0">
                          <td className="py-2">
                            <div className="font-medium">{row.employee_name || row.employee}</div>
                            <div className="text-xs text-muted-foreground" dir="ltr">{row.employee}</div>
                          </td>
                          <td className="py-2 text-muted-foreground">{row.branch || '—'}</td>
                          <td className="py-2 text-center">{row.punches}</td>
                          <td className="py-2 text-center font-medium">{row.new}</td>
                          <td className="py-2 text-center text-xs text-muted-foreground" dir="ltr">
                            {row.first_day} → {row.last_day}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2 — commit, or the result of having done so */}
          {imported ? (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>{t('pim.importDone')}</AlertTitle>
              <AlertDescription>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  <span>{t('pim.created')}: <b>{imported.result?.created ?? 0}</b></span>
                  <span>{t('pim.skippedDuplicates')}: <b>{imported.result?.skipped_duplicates ?? 0}</b></span>
                  {(imported.result?.failed ?? 0) > 0 && (
                    <span className="text-red-600">
                      {t('pim.failed')}: <b>{imported.result?.failed}</b>
                    </span>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleImport} disabled={busy !== null || summary.totals.new === 0}>
                {busy === 'import'
                  ? <Loader2 className="w-4 h-4 me-2 animate-spin" />
                  : <Upload className="w-4 h-4 me-2" />}
                {t('pim.confirmImport')} ({summary.totals.new})
              </Button>
              <Button variant="outline" onClick={reset} disabled={busy !== null}>
                {t('pim.cancel')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
