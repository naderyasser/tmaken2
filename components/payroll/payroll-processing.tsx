'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useCompany } from '@/hooks/use-company'
import { useToast } from '@/hooks/use-toast'
import { frappeClient } from '@/lib/api-client'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale/ar'
import { enUS } from 'date-fns/locale/en-US'
import {
  Button,
} from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import {
  CalendarIcon, Plus, Users, FileText, CheckCircle, Loader2,
  ChevronRight, AlertCircle, Building, RefreshCw,
} from 'lucide-react'

/** Payroll runs cover a period; defaulting both ends to today creates a 1-day run. */
const monthStart = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }
const monthEnd = () => {
  const now = new Date()
  // Day 0 of next month is the last day of this one.
  return new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0)).toISOString().split('T')[0]
}

type Step = 'create' | 'employees' | 'generate' | 'submit' | 'done'

interface PayrollEntryData {
  name: string
  company?: string
  payroll_frequency?: string
  start_date?: string
  end_date?: string
  posting_date?: string
  payroll_payable_account?: string
  number_of_employees?: number
  status?: string
  salary_slips_created?: number
  salary_slips_submitted?: number
}

const FREQUENCIES = [
  { value: 'Monthly', labelEn: 'Monthly', labelAr: 'شهري' },
  { value: 'Bimonthly', labelEn: 'Bimonthly', labelAr: 'نصف شهري' },
  { value: 'Weekly', labelEn: 'Weekly', labelAr: 'أسبوعي' },
]

export function PayrollProcessing() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const { company: activeCompany } = useCompany()

  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [payrollEntry, setPayrollEntry] = useState<PayrollEntryData | null>(null)
  const [activeStep, setActiveStep] = useState<Step>('create')
  const [error, setError] = useState<string | null>(null)

  const [payableAccounts, setPayableAccounts] = useState<{ name: string; account_type?: string }[]>([])

  const [formData, setFormData] = useState({
    payroll_frequency: 'Monthly',
    start_date: monthStart(),
    end_date: monthEnd(),
    payroll_payable_account: '',
  })

  // The payable account is a mandatory Link on Payroll Entry. Offer the company's
  // real payable accounts and preselect its default instead of free text that
  // only fails validation server-side.
  useEffect(() => {
    if (!activeCompany) { setPayableAccounts([]); return }
    let cancelled = false
    Promise.all([
      frappeClient.getPayrollPayableAccounts(activeCompany),
      frappeClient.getPayrollEntryDefaults(activeCompany),
    ]).then(([accounts, defaults]) => {
      if (cancelled) return
      setPayableAccounts(accounts)
      if (defaults.payroll_payable_account) {
        setFormData(f => (f.payroll_payable_account ? f : { ...f, payroll_payable_account: defaults.payroll_payable_account! }))
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [activeCompany])

  const formatDate = (d?: string) => {
    if (!d) return '—'
    return format(new Date(d + 'T00:00:00'), 'PPP', { locale: isRTL ? ar : enUS })
  }

  const handleCreate = async () => {
    if (!activeCompany) {
      toast({ title: t('pay.process.no_company'), variant: 'destructive' })
      return
    }
    if (formData.end_date < formData.start_date) {
      const msg = isRTL ? 'تاريخ النهاية يسبق تاريخ البداية' : 'End date is before start date'
      setError(msg)
      toast({ title: t('pay.process.create_fail'), description: msg, variant: 'destructive' })
      return
    }
    setCreating(true)
    setError(null)
    try {
      const payload: Record<string, any> = {
        company: activeCompany,
        payroll_frequency: formData.payroll_frequency,
        start_date: formData.start_date,
        end_date: formData.end_date,
        posting_date: new Date().toISOString().split('T')[0],
      }
      if (formData.payroll_payable_account) {
        payload.payroll_payable_account = formData.payroll_payable_account
      }

      const result = await frappeClient.createPayrollEntry(payload)
      setPayrollEntry(result)
      setActiveStep('employees')
      toast({ title: t('pay.process.entry_created') })
    } catch (e: any) {
      const msg = e?.message || String(e)
      setError(msg)
      toast({ title: t('pay.process.create_fail'), description: msg, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const handleFetchEmployees = async () => {
    if (!payrollEntry?.name) return
    setLoading(true)
    setError(null)
    try {
      await frappeClient.fillEmployeeDetails(payrollEntry.name)
      const refreshed = await frappeClient.getPayrollEntry(payrollEntry.name)
      // getPayrollEntry swallows its errors and returns null; keeping that null
      // would unmount every step card and strand the user on a blank wizard.
      setPayrollEntry(prev => refreshed || prev)
      setActiveStep('generate')
      toast({ title: t('pay.process.employees_fetched') })
    } catch (e: any) {
      const msg = e?.message || String(e)
      setError(msg)
      toast({ title: t('pay.process.fetch_fail'), description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateSlips = async () => {
    if (!payrollEntry?.name) return
    setLoading(true)
    setError(null)
    try {
      await frappeClient.createSalarySlips(payrollEntry.name)
      const refreshed = await frappeClient.getPayrollEntry(payrollEntry.name)
      setPayrollEntry(prev => refreshed || prev)
      setActiveStep('submit')
      toast({ title: t('pay.process.slips_generated') })
    } catch (e: any) {
      const msg = e?.message || String(e)
      setError(msg)
      toast({ title: t('pay.process.generate_fail'), description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitSlips = async () => {
    if (!payrollEntry?.name) return
    setLoading(true)
    setError(null)
    try {
      await frappeClient.submitSalarySlips(payrollEntry.name)
      const refreshed = await frappeClient.getPayrollEntry(payrollEntry.name)
      setPayrollEntry(prev => refreshed || prev)
      setActiveStep('done')
      toast({ title: t('pay.process.slips_submitted') })
    } catch (e: any) {
      const msg = e?.message || String(e)
      setError(msg)
      toast({ title: t('pay.process.submit_fail'), description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setPayrollEntry(null)
    setActiveStep('create')
    setError(null)
    setFormData({
      payroll_frequency: 'Monthly',
      start_date: monthStart(),
      end_date: monthEnd(),
      payroll_payable_account: '',
    })
  }

  const stepComplete = (step: Step): boolean => {
    const order: Step[] = ['create', 'employees', 'generate', 'submit', 'done']
    return order.indexOf(activeStep) > order.indexOf(step)
  }

  // Payroll Entry refuses to submit unless this account is typed `Payable`
  // (PayrollEntry.validate_payroll_payable_account) — say so before step 3.
  const selectedPayableAccount = payableAccounts.find(a => a.name === formData.payroll_payable_account)
  const payableAccountNotPayable = !!selectedPayableAccount && selectedPayableAccount.account_type !== 'Payable'

  const stepActive = (step: Step): boolean => {
    return activeStep === step
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('pay.process.title')}</h2>
        {payrollEntry && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="h-4 w-4 mr-1" /> {t('pay.process.new_entry')}
          </Button>
        )}
      </div>

      {activeCompany && (
        <div className="flex items-center gap-2 bg-accent border border-primary/20 rounded-lg px-3 py-2 text-sm w-fit">
          <Building className="h-4 w-4 text-primary" />
          <span className="font-medium text-accent-foreground">{t('pay.process.company')}: {activeCompany}</span>
        </div>
      )}

      {/* Step 1: Create Payroll Entry */}
      <Card className={cn(
        'border transition-all',
        stepComplete('create') ? 'border-green-300 bg-green-50/30' : 'border-border',
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
              stepComplete('create') ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground',
            )}>
              {stepComplete('create') ? <CheckCircle className="h-5 w-5" /> : '1'}
            </div>
            <div>
              <CardTitle className="text-base">{t('pay.process.create_entry')}</CardTitle>
              <CardDescription>{t('pay.process.create_desc')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        {!stepComplete('create') && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('pay.process.frequency')}</Label>
                <Select value={formData.payroll_frequency} onValueChange={(v) => setFormData({ ...formData, payroll_frequency: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => (
                      <SelectItem key={f.value} value={f.value}>{isRTL ? f.labelAr : f.labelEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('pay.process.payable_account')}</Label>
                {payableAccounts.length > 0 ? (
                  <Select
                    value={formData.payroll_payable_account}
                    onValueChange={(v) => setFormData({ ...formData, payroll_payable_account: v })}
                  >
                    <SelectTrigger aria-label={t('pay.process.payable_account')}>
                      <SelectValue placeholder={t('pay.process.payable_placeholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {payableAccounts.map(a => (
                        <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={formData.payroll_payable_account}
                    onChange={(e) => setFormData({ ...formData, payroll_payable_account: e.target.value })}
                    placeholder={t('pay.process.payable_placeholder')}
                  />
                )}
                {payableAccountNotPayable && (
                  <p className="text-xs text-amber-600 flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-px" />
                    {isRTL
                      ? 'نوع هذا الحساب ليس «دائن (Payable)»، وترحيل الرواتب سيرفضه. اطلب من المحاسب ضبط نوع الحساب أولًا.'
                      : 'This account is not typed “Payable”; payroll submission will reject it. Ask your accountant to set the account type first.'}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('pay.process.start_date')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start font-normal', isRTL ? 'text-right' : 'text-left')}
                    >
                      <CalendarIcon className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                      {formData.start_date
                        ? format(new Date(formData.start_date + 'T00:00:00'), 'PPP', { locale: isRTL ? ar : enUS })
                        : t('pay.ded.select_date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.start_date ? new Date(formData.start_date + 'T00:00:00') : undefined}
                      onSelect={(d) => d && setFormData({ ...formData, start_date: format(d, 'yyyy-MM-dd') })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>{t('pay.process.end_date')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn('w-full justify-start font-normal', isRTL ? 'text-right' : 'text-left')}
                    >
                      <CalendarIcon className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                      {formData.end_date
                        ? format(new Date(formData.end_date + 'T00:00:00'), 'PPP', { locale: isRTL ? ar : enUS })
                        : t('pay.ded.select_date')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.end_date ? new Date(formData.end_date + 'T00:00:00') : undefined}
                      onSelect={(d) => d && setFormData({ ...formData, end_date: format(d, 'yyyy-MM-dd') })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Button onClick={handleCreate} disabled={creating || !activeCompany} className="w-full">
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              {creating ? t('pay.process.creating') : t('pay.process.create_btn')}
            </Button>
          </CardContent>
        )}
        {stepComplete('create') && payrollEntry && (
          <CardContent>
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="outline" className="gap-1">
                <Building className="h-3 w-3" /> {payrollEntry.company}
              </Badge>
              <Badge variant="outline">{payrollEntry.payroll_frequency}</Badge>
              <Badge variant="outline" className="gap-1">
                <CalendarIcon className="h-3 w-3" />
                {formatDate(payrollEntry.start_date)} — {formatDate(payrollEntry.end_date)}
              </Badge>
              <Badge variant="outline">#{payrollEntry.name}</Badge>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Step 2: Fetch Employees */}
      {payrollEntry && (
        <Card className={cn(
          'border transition-all',
          stepComplete('employees') ? 'border-green-300 bg-green-50/30' : 'border-border',
          !stepComplete('create') && 'opacity-50 pointer-events-none',
        )}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                stepComplete('employees') ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground',
              )}>
                {stepComplete('employees') ? <CheckCircle className="h-5 w-5" /> : '2'}
              </div>
              <div>
                <CardTitle className="text-base">{t('pay.process.fetch_employees')}</CardTitle>
                <CardDescription>{t('pay.process.fetch_desc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          {stepActive('employees') && (
            <CardContent>
              <Button onClick={handleFetchEmployees} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}
                {loading ? t('pay.process.fetching') : t('pay.process.fetch_btn')}
              </Button>
            </CardContent>
          )}
          {stepComplete('employees') && payrollEntry.number_of_employees != null && (
            <CardContent>
              <Badge variant="secondary" className="gap-1">
                <Users className="h-3 w-3" />
                {payrollEntry.number_of_employees} {t('pay.process.employees_count')}
              </Badge>
            </CardContent>
          )}
        </Card>
      )}

      {/* Step 3: Generate Salary Slips */}
      {payrollEntry && (
        <Card className={cn(
          'border transition-all',
          stepComplete('generate') ? 'border-green-300 bg-green-50/30' : 'border-border',
          !stepComplete('employees') && 'opacity-50 pointer-events-none',
        )}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                stepComplete('generate') ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground',
              )}>
                {stepComplete('generate') ? <CheckCircle className="h-5 w-5" /> : '3'}
              </div>
              <div>
                <CardTitle className="text-base">{t('pay.process.generate_slips')}</CardTitle>
                <CardDescription>{t('pay.process.generate_desc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          {stepActive('generate') && (
            <CardContent>
              <Button onClick={handleGenerateSlips} disabled={loading} className="w-full">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                {loading ? t('pay.process.generating') : t('pay.process.generate_btn')}
              </Button>
            </CardContent>
          )}
          {stepComplete('generate') && (
            <CardContent>
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" /> {t('pay.process.slips_generated_badge')}
              </Badge>
            </CardContent>
          )}
        </Card>
      )}

      {/* Step 4: Submit Slips */}
      {payrollEntry && (
        <Card className={cn(
          'border transition-all',
          stepComplete('submit') ? 'border-green-300 bg-green-50/30' : 'border-border',
          !stepComplete('generate') && 'opacity-50 pointer-events-none',
        )}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                stepComplete('submit') ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground',
              )}>
                {stepComplete('submit') ? <CheckCircle className="h-5 w-5" /> : '4'}
              </div>
              <div>
                <CardTitle className="text-base">{t('pay.process.submit_slips')}</CardTitle>
                <CardDescription>{t('pay.process.submit_desc')}</CardDescription>
              </div>
            </div>
          </CardHeader>
          {stepActive('submit') && (
            <CardContent>
              <Button onClick={handleSubmitSlips} disabled={loading} className="w-full bg-green-600 hover:bg-green-700">
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                {loading ? t('pay.process.submitting') : t('pay.process.submit_btn')}
              </Button>
            </CardContent>
          )}
          {stepComplete('submit') && (
            <CardContent>
              <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3" /> {t('pay.process.submitted_badge')}
              </Badge>
            </CardContent>
          )}
        </Card>
      )}

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">{t('pay.process.error_title')}</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
