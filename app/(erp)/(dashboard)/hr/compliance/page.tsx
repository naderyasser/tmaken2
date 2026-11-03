'use client'

/**
 * Compliance cockpit (/hr/compliance) — bilingual, RTL-aware.
 *
 * Surfaces the three additive KSA compliance quick-wins:
 *   1. Saudization / Nitaqat estimate gauge + a what-if hiring simulator
 *   2. End-of-service (EOSB / Article-77) calculator
 *   3. GOSI contribution-rate lookup (July-2025 reform tranches)
 *
 * Reads base_meena.compliance.* whitelisted APIs. Token-only styling, no
 * hardcoded colors. Self-contained; not wired into the rail nav.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ShieldCheck, Users, Calculator, Landmark, Loader2, AlertTriangle } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { PageHeader, KpiTile } from '@/components/shared'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatSAR, formatNumber } from '@/lib/format'

// ---------------------------------------------------------------------------
// Types (mirror the compliance API dicts)
// ---------------------------------------------------------------------------
interface BandEstimate { key: string; label_en: string; label_ar: string; min_pct: number }
interface Saudization {
  total: number; saudi: number; non_saudi: number; saudization_pct: number
  band_estimate: BandEstimate; disclaimer_en: string; disclaimer_ar: string
}
interface SimResult {
  current: Saudization
  projected: Saudization & { added_saudi: number; added_non_saudi: number }
  band_changed: boolean
}
interface EosbBreakdown { key: string; label_en: string; label_ar: string; amount: number }
interface Eosb {
  employee_name: string; date_of_joining: string; relieving_date: string; reason: string
  years_of_service: number; monthly_wage: number; daily_rate: number
  award_months: number; base_award: number; reason_multiplier: number; adjusted_award: number
  leave_balance_days: number; leave_encashment: number; outstanding_advances: number
  net_payable: number; breakdown: EosbBreakdown[]; disclaimer_en: string; disclaimer_ar: string
}
interface GosiRates {
  tranche: string; annuities_pct: number; saned_employee_pct: number; saned_employer_pct: number
  occupational_hazard_pct: number; employee_pct: number; employer_pct: number; total_pct: number
  label_en: string; label_ar: string; disclaimer_en: string; disclaimer_ar: string
}
interface GosiCompute {
  contributory_wage: number; employee_share: number; employer_share: number; total: number; rates: GosiRates
}
interface EmployeeLite { name: string; employee_name: string }

const today = () => new Date().toISOString().slice(0, 10)

/** Semantic tone classes for a Nitaqat band — token-only, no hex. */
function bandTone(key: string): string {
  switch (key) {
    case 'red': return 'bg-destructive/10 text-destructive'
    case 'yellow': return 'bg-warning/10 text-warning'
    case 'platinum': return 'bg-info/10 text-info'
    default: return 'bg-success/10 text-success' // greens
  }
}

export default function CompliancePage() {
  const { isRTL } = useI18n()
  const tx = (en: string, ar: string) => (isRTL ? ar : en)

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="mx-auto max-w-[1100px] p-6 md:p-8">
      <PageHeader
        icon={ShieldCheck}
        title={tx('Compliance Cockpit', 'لوحة الالتزام')}
        description={tx(
          'Saudization, end-of-service and GOSI estimators — indicative only.',
          'مؤشرات السعودة ونهاية الخدمة والتأمينات الاجتماعية — تقديرية فقط.',
        )}
      />
      <div className="space-y-6">
        <SaudizationCard tx={tx} />
        <EosbCard tx={tx} isRTL={isRTL} />
        <GosiCard tx={tx} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 1. Saudization / Nitaqat
// ---------------------------------------------------------------------------
function SaudizationCard({ tx }: { tx: (en: string, ar: string) => string }) {
  const [data, setData] = useState<Saudization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [addSaudi, setAddSaudi] = useState('0')
  const [addNonSaudi, setAddNonSaudi] = useState('0')
  const [sim, setSim] = useState<SimResult | null>(null)
  const [simming, setSimming] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(false)
    try {
      const res = await frappeClient.call('base_meena.compliance.nitaqat.get_saudization_estimate', {})
      setData((res as { message?: Saudization })?.message ?? null)
    } catch { setError(true) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const runSim = async () => {
    setSimming(true)
    try {
      const res = await frappeClient.call('base_meena.compliance.nitaqat.simulate', {
        add_saudi: Number(addSaudi) || 0, add_non_saudi: Number(addNonSaudi) || 0,
      })
      setSim((res as { message?: SimResult })?.message ?? null)
    } catch { setSim(null) } finally { setSimming(false) }
  }

  const band = sim?.projected.band_estimate ?? data?.band_estimate
  const pct = sim?.projected.saudization_pct ?? data?.saudization_pct ?? 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>{tx('Saudization (Nitaqat estimate)', 'السعودة (تقدير نطاقات)')}</CardTitle>
        </div>
        <CardDescription>
          {tx('Active-employee Saudi ratio mapped to an estimated band.',
            'نسبة السعوديين من الموظفين النشطين مقابل نطاق تقديري.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <KpiTile key={i} loading label="" value="" />)}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-3">
              {tx('Failed to load Saudization data.', 'تعذّر تحميل بيانات السعودة.')}
              <Button size="sm" variant="outline" onClick={load}>{tx('Retry', 'إعادة')}</Button>
            </AlertDescription>
          </Alert>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiTile label={tx('Total', 'الإجمالي')} value={formatNumber(data.total)} tone="default" />
              <KpiTile label={tx('Saudi', 'سعوديون')} value={formatNumber(data.saudi)} tone="success" />
              <KpiTile label={tx('Non-Saudi', 'غير سعوديين')} value={formatNumber(data.non_saudi)} tone="info" />
              <KpiTile label={tx('Saudization', 'نسبة السعودة')} value={`${pct}%`} tone="default" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{tx('Band', 'النطاق')}</span>
                {band && (
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${bandTone(band.key)}`}>
                    {tx(band.label_en, band.label_ar)}
                  </span>
                )}
              </div>
              <Progress value={Math.min(pct, 100)} />
            </div>

            {/* What-if simulator */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="mb-3 text-sm font-medium text-foreground">{tx('What-if: hypothetical hires', 'ماذا لو: توظيف افتراضي')}</p>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label htmlFor="add-saudi" className="text-xs">{tx('Add Saudi', 'إضافة سعوديين')}</Label>
                  <Input id="add-saudi" type="number" min={0} value={addSaudi}
                    onChange={(e) => setAddSaudi(e.target.value)} className="w-28" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="add-non-saudi" className="text-xs">{tx('Add non-Saudi', 'إضافة غير سعوديين')}</Label>
                  <Input id="add-non-saudi" type="number" min={0} value={addNonSaudi}
                    onChange={(e) => setAddNonSaudi(e.target.value)} className="w-28" />
                </div>
                <Button onClick={runSim} disabled={simming}>
                  {simming && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tx('Simulate', 'محاكاة')}
                </Button>
              </div>
              {sim && (
                <p className="mt-3 text-sm text-muted-foreground">
                  {tx('Projected', 'المتوقع')}: <span className="font-semibold text-foreground">{sim.projected.saudization_pct}%</span>
                  {' · '}
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${bandTone(sim.projected.band_estimate.key)}`}>
                    {tx(sim.projected.band_estimate.label_en, sim.projected.band_estimate.label_ar)}
                  </span>
                  {sim.band_changed && <span className="ms-2 text-xs text-primary">{tx('(band changes)', '(يتغيّر النطاق)')}</span>}
                </p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">{tx(data.disclaimer_en, data.disclaimer_ar)}</p>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 2. EOSB
// ---------------------------------------------------------------------------
function EosbCard({ tx, isRTL }: { tx: (en: string, ar: string) => string; isRTL: boolean }) {
  const [employees, setEmployees] = useState<EmployeeLite[]>([])
  const [employee, setEmployee] = useState('')
  const [reason, setReason] = useState('termination')
  const [relieving, setRelieving] = useState(today())
  const [result, setResult] = useState<Eosb | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    frappeClient.getEmployees({
      fields: ['name', 'employee_name'],
      filters: [['Employee', 'status', '=', 'Active']] as [string, string, string, string][],
      order_by: 'employee_name asc', limit_page_length: 0,
    }).then((l) => setEmployees((l as EmployeeLite[]) || [])).catch(() => {})
  }, [])

  const reasons = [
    { id: 'termination', label: tx('Termination (by employer)', 'إنهاء (من صاحب العمل)') },
    { id: 'resignation', label: tx('Resignation', 'استقالة') },
    { id: 'end_of_contract', label: tx('End of contract', 'انتهاء العقد') },
  ]

  const calc = async () => {
    if (!employee) { setError(tx('Select an employee first.', 'اختر موظفًا أولًا.')); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await frappeClient.call('base_meena.compliance.eosb.get_eosb', {
        employee, relieving_date: relieving, reason,
      })
      setResult((res as { message?: Eosb })?.message ?? null)
    } catch (e) {
      setError(String((e as Error)?.message || e).slice(0, 180))
    } finally { setLoading(false) }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <CardTitle>{tx('End-of-Service (EOSB)', 'مكافأة نهاية الخدمة')}</CardTitle>
        </div>
        <CardDescription>
          {tx('Article-77 gratuity estimate by tenure and separation reason.',
            'تقدير المكافأة وفق المادة 77 حسب مدة الخدمة وسبب الإنهاء.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1 space-y-1">
            <Label className="text-xs">{tx('Employee', 'الموظف')}</Label>
            <Select value={employee} onValueChange={setEmployee}>
              <SelectTrigger><SelectValue placeholder={tx('Select employee', 'اختر الموظف')} /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.name} value={e.name}>{e.employee_name || e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px] space-y-1">
            <Label className="text-xs">{tx('Reason', 'السبب')}</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {reasons.map((r) => <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="relieving" className="text-xs">{tx('Relieving date', 'تاريخ الانتهاء')}</Label>
            <Input id="relieving" type="date" value={relieving} onChange={(e) => setRelieving(e.target.value)} className="w-44" />
          </div>
          <Button onClick={calc} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {tx('Calculate', 'احسب')}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiTile label={tx('Years of service', 'سنوات الخدمة')} value={result.years_of_service.toFixed(2)} />
              <KpiTile label={tx('Monthly wage', 'الأجر الشهري')} value={formatSAR(result.monthly_wage)} />
              <KpiTile label={tx('Award months', 'أشهر المكافأة')} value={result.award_months.toFixed(2)} />
              <KpiTile label={tx('Net payable', 'الصافي المستحق')} value={formatSAR(result.net_payable)} tone="success" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {result.breakdown.map((b) => (
                    <tr key={b.key} className="border-b border-border last:border-0">
                      <td className="py-2 text-muted-foreground">{tx(b.label_en, b.label_ar)}</td>
                      <td className={`py-2 tabular-nums ${isRTL ? 'text-start' : 'text-end'} ${b.amount < 0 ? 'text-destructive' : 'text-foreground'}`}>
                        {formatSAR(b.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">{tx(result.disclaimer_en, result.disclaimer_ar)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 3. GOSI
// ---------------------------------------------------------------------------
function GosiCard({ tx }: { tx: (en: string, ar: string) => string }) {
  const [registration, setRegistration] = useState('2026-01-01')
  const [asOf, setAsOf] = useState(today())
  const [baseWage, setBaseWage] = useState('10000')
  const [housing, setHousing] = useState('2500')
  const [result, setResult] = useState<GosiCompute | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const lookup = async () => {
    setLoading(true); setError(false); setResult(null)
    try {
      const res = await frappeClient.call('base_meena.compliance.gosi_rates.compute_gosi_contribution', {
        base_wage: Number(baseWage) || 0, housing: Number(housing) || 0,
        registration_date: registration, as_of_date: asOf,
      })
      setResult((res as { message?: GosiCompute })?.message ?? null)
    } catch { setError(true) } finally { setLoading(false) }
  }

  const rates = result?.rates
  const rows = useMemo(() => rates ? [
    { l: tx('Annuities (pension)', 'المعاشات'), v: `${rates.annuities_pct}%` },
    { l: tx('SANED (unemployment)', 'ساند (التعطّل)'), v: `${rates.saned_employee_pct}% / ${rates.saned_employer_pct}%` },
    { l: tx('Occupational hazard (employer)', 'الأخطار المهنية (صاحب العمل)'), v: `${rates.occupational_hazard_pct}%` },
  ] : [], [rates, tx])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-primary" />
          <CardTitle>{tx('GOSI contribution lookup', 'حاسبة اشتراك التأمينات')}</CardTitle>
        </div>
        <CardDescription>
          {tx('July-2025 reform: rate tranche by first-registration date.',
            'إصلاح يوليو 2025: شريحة النسبة حسب تاريخ التسجيل الأول.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="reg" className="text-xs">{tx('First registration', 'تاريخ التسجيل الأول')}</Label>
            <Input id="reg" type="date" value={registration} onChange={(e) => setRegistration(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="asof" className="text-xs">{tx('As of', 'حتى تاريخ')}</Label>
            <Input id="asof" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wage" className="text-xs">{tx('Basic wage', 'الأجر الأساسي')}</Label>
            <Input id="wage" type="number" min={0} value={baseWage} onChange={(e) => setBaseWage(e.target.value)} className="w-32" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="housing" className="text-xs">{tx('Housing', 'بدل السكن')}</Label>
            <Input id="housing" type="number" min={0} value={housing} onChange={(e) => setHousing(e.target.value)} className="w-32" />
          </div>
          <Button onClick={lookup} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {tx('Lookup', 'احسب')}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-3">
              {tx('Lookup failed.', 'تعذّر الحساب.')}
              <Button size="sm" variant="outline" onClick={lookup}>{tx('Retry', 'إعادة')}</Button>
            </AlertDescription>
          </Alert>
        )}

        {loading && !result && <Skeleton className="h-40 w-full" />}

        {result && rates && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{tx('Scheme', 'النظام')}</span>
              <span className="inline-flex rounded-full bg-accent px-3 py-1 text-xs font-semibold text-primary">
                {tx(rates.label_en, rates.label_ar)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiTile label={tx('Employee %', 'نسبة الموظف')} value={`${rates.employee_pct}%`} />
              <KpiTile label={tx('Employer %', 'نسبة صاحب العمل')} value={`${rates.employer_pct}%`} />
              <KpiTile label={tx('Employee share', 'حصة الموظف')} value={formatSAR(result.employee_share)} tone="info" />
              <KpiTile label={tx('Employer share', 'حصة صاحب العمل')} value={formatSAR(result.employer_share)} tone="default" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-2 text-muted-foreground">{tx('Contributory wage', 'الأجر الخاضع للاشتراك')}</td>
                    <td className="py-2 text-end tabular-nums text-foreground">{formatSAR(result.contributory_wage)}</td>
                  </tr>
                  {rows.map((r) => (
                    <tr key={r.l} className="border-b border-border last:border-0">
                      <td className="py-2 text-muted-foreground">{r.l}</td>
                      <td className="py-2 text-end tabular-nums text-foreground">{r.v}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 font-medium text-foreground">{tx('Total contribution', 'إجمالي الاشتراك')}</td>
                    <td className="py-2 text-end font-semibold tabular-nums text-foreground">{formatSAR(result.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">{tx(rates.disclaimer_en, rates.disclaimer_ar)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
