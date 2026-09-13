'use client'

import { useState, useEffect } from 'react'
import { useI18n } from '@/lib/i18n'
import { useCompany } from '@/hooks/use-company'
import { useToast } from '@/hooks/use-toast'
import { frappeClient } from '@/lib/api-client'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale/ar'
import { enUS } from 'date-fns/locale/en-US'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { cn } from '@/lib/utils'
import {
  Plus, Trash2, Save, Loader2, RefreshCw, CalendarIcon, FileText, Building, AlertCircle,
} from 'lucide-react'

const VIOLATION_OPTIONS = [
  { value: 'delay_15', labelEn: 'Delay up to 15 min', labelAr: 'تأخير حتى 15 دقيقة' },
  { value: 'delay_15_30', labelEn: 'Delay 15-30 min', labelAr: 'تأخير من 15 إلى 30 دقيقة' },
  { value: 'delay_30_60', labelEn: 'Delay 30-60 min', labelAr: 'تأخير من 30 إلى 60 دقيقة' },
  { value: 'delay_60_plus', labelEn: 'Delay 60+ min', labelAr: 'تأخير أكثر من 60 دقيقة' },
  { value: 'leave_early_15', labelEn: 'Leave early up to 15 min', labelAr: 'ترك العمل مبكراً حتى 15 دقيقة' },
  { value: 'leave_early_15_30', labelEn: 'Leave early 15-30 min', labelAr: 'ترك العمل مبكراً 15-30 دقيقة' },
  { value: 'leave_early_30_60', labelEn: 'Leave early 30-60 min', labelAr: 'ترك العمل مبكراً 30-60 دقيقة' },
  { value: 'absence_half', labelEn: 'Half-day absence', labelAr: 'غياب نصف يوم' },
  { value: 'absence_full', labelEn: 'Full-day absence', labelAr: 'غياب يوم كامل' },
]

const PENALTY_TYPES = [
  { value: 'Warning', labelEn: 'Warning', labelAr: 'إنذار' },
  { value: 'Fixed Amount', labelEn: 'Fixed Amount', labelAr: 'مبلغ ثابت' },
  { value: 'Percentage of Daily Wage', labelEn: '% of Daily Wage', labelAr: 'نسبة من الأجر اليومي' },
]

const OCCURRENCE_LABELS = ['1st', '2nd', '3rd', '4th']
const OCCURRENCE_LABELS_AR = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة']

interface PolicyRule {
  violation_type: string
  minutes_from: number
  minutes_to: number
  occurrence_0: string
  occurrence_0_value: number
  occurrence_1: string
  occurrence_1_value: number
  occurrence_2: string
  occurrence_2_value: number
  occurrence_3: string
  occurrence_3_value: number
}

interface PolicyData {
  name?: string
  policy_name: string
  company: string
  is_default: number
  effective_from: string
  rules: PolicyRule[]
}

const EMPTY_RULE: PolicyRule = {
  violation_type: 'delay_15',
  minutes_from: 0,
  minutes_to: 15,
  occurrence_0: 'Warning', occurrence_0_value: 0,
  occurrence_1: 'Percentage of Daily Wage', occurrence_1_value: 5,
  occurrence_2: 'Percentage of Daily Wage', occurrence_2_value: 10,
  occurrence_3: 'Percentage of Daily Wage', occurrence_3_value: 20,
}

export function PenaltyPolicyManager() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const { company: activeCompany } = useCompany()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [policy, setPolicy] = useState<PolicyData>({
    policy_name: '',
    company: activeCompany || '',
    is_default: 1,
    effective_from: new Date().toISOString().split('T')[0],
    rules: [],
  })
  const [hasExisting, setHasExisting] = useState(false)

  useEffect(() => {
    if (activeCompany) {
      loadPolicy()
    } else {
      setLoading(false)
    }
  }, [activeCompany])

  const loadPolicy = async () => {
    setLoading(true)
    try {
      const resp = await frappeClient.call<{ name?: string | null; policy_name: string | null; company: string; effective_from: string | null; is_default?: boolean; rules: any[]; message?: string }>(
        'base_meena.api.get_active_penalty_policy',
        { company: activeCompany }
      )
      const data = (resp as any).message ?? resp

      if (data?.policy_name) {
        const rules: PolicyRule[] = (data.rules || []).map((r: any) => ({
          violation_type: r.violation_type,
          minutes_from: r.minutes_from || 0,
          minutes_to: r.minutes_to || 0,
          occurrence_0: r.occurrences?.[0]?.penalty_type || 'Warning',
          occurrence_0_value: r.occurrences?.[0]?.penalty_value || 0,
          occurrence_1: r.occurrences?.[1]?.penalty_type || 'Percentage of Daily Wage',
          occurrence_1_value: r.occurrences?.[1]?.penalty_value || 5,
          occurrence_2: r.occurrences?.[2]?.penalty_type || 'Percentage of Daily Wage',
          occurrence_2_value: r.occurrences?.[2]?.penalty_value || 10,
          occurrence_3: r.occurrences?.[3]?.penalty_type || 'Percentage of Daily Wage',
          occurrence_3_value: r.occurrences?.[3]?.penalty_value || 20,
        }))

        setPolicy({
          // Amendments are named "<title>-1", so the title stops being the
          // docname after the first edit — cancel/amend must use the real name.
          name: data.name || data.policy_name,
          policy_name: data.policy_name,
          company: data.company,
          is_default: data.is_default ? 1 : 0,
          effective_from: data.effective_from || new Date().toISOString().split('T')[0],
          rules,
        })
        setHasExisting(true)
      } else {
        setPolicy({
          policy_name: '',
          company: activeCompany || '',
          is_default: 1,
          effective_from: new Date().toISOString().split('T')[0],
          rules: [],
        })
        setHasExisting(false)
      }
    } catch {
      toast({ title: t('pay.policy.load_fail'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const addRule = () => {
    setPolicy(prev => ({ ...prev, rules: [...prev.rules, { ...EMPTY_RULE }] }))
  }

  const removeRule = (index: number) => {
    setPolicy(prev => ({
      ...prev,
      rules: prev.rules.filter((_, i) => i !== index),
    }))
  }

  const updateRule = (index: number, field: string, value: any) => {
    setPolicy(prev => {
      const updated = [...prev.rules]
      updated[index] = { ...updated[index], [field]: value }
      return { ...prev, rules: updated }
    })
  }

  /**
   * get_active_penalty_policy only looks at submitted policies, so a policy left
   * in draft reads back as "no policy" — the old code swallowed both the missing
   * result and the failed submit, and simply showed nothing had happened.
   */
  const createAndSubmitPolicy = async (payload: Record<string, any>) => {
    const result = await frappeClient.post('Penalty Policy' as any, payload)
    const name = result?.data?.name
    if (!name) {
      throw new Error((result?.exc || result?.message || 'Failed to create Penalty Policy') as string)
    }
    const docRes = await frappeClient.get('Penalty Policy' as any, name)
    if (!docRes.data) throw new Error(`Penalty Policy ${name} not found`)
    await frappeClient.call('frappe.client.submit', { doc: { ...docRes.data, doctype: 'Penalty Policy' } })
  }

  const handleSave = async () => {
    if (!policy.policy_name.trim() || !policy.company) {
      toast({ title: t('pay.policy.required_fields'), variant: 'destructive' })
      return
    }
    if (policy.rules.length === 0) {
      toast({ title: t('pay.policy.no_rules'), variant: 'destructive' })
      return
    }
    const invalidRange = policy.rules.find(r => Number(r.minutes_to) < Number(r.minutes_from))
    if (invalidRange) {
      toast({ title: t('pay.policy.invalid_range'), description: violationLabel(invalidRange.violation_type), variant: 'destructive' })
      return
    }
    const seenTypes = new Set<string>()
    const duplicate = policy.rules.find(r => {
      if (seenTypes.has(r.violation_type)) return true
      seenTypes.add(r.violation_type)
      return false
    })
    if (duplicate) {
      // The engine looks a violation type up in this table; two rows for the same
      // type means the penalty applied depends on row order.
      toast({ title: t('pay.policy.duplicate_rule'), description: violationLabel(duplicate.violation_type), variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const ruleRows = policy.rules.map(r => {
        const row: Record<string, any> = {
          violation_type: r.violation_type,
          minutes_from: r.minutes_from,
          minutes_to: r.minutes_to,
          occurrence_0: r.occurrence_0,
          occurrence_1: r.occurrence_1,
          occurrence_2: r.occurrence_2,
          occurrence_3: r.occurrence_3,
        }
        if (r.occurrence_0 !== 'Warning') row.occurrence_0_value = r.occurrence_0_value
        if (r.occurrence_1 !== 'Warning') row.occurrence_1_value = r.occurrence_1_value
        if (r.occurrence_2 !== 'Warning') row.occurrence_2_value = r.occurrence_2_value
        if (r.occurrence_3 !== 'Warning') row.occurrence_3_value = r.occurrence_3_value
        return row
      })

      const payload: Record<string, any> = {
        policy_name: policy.policy_name.trim(),
        company: policy.company,
        is_default: policy.is_default ? 1 : 0,
        effective_from: policy.effective_from,
        rules: ruleRows,
      }

      if (hasExisting && policy.name) {
        // Cancelling first and only then creating meant a failed create left the
        // company with no active policy at all — and both failures were swallowed.
        await frappeClient.call('frappe.client.cancel', { doctype: 'Penalty Policy', name: policy.name })
        payload.amended_from = policy.name
        await createAndSubmitPolicy(payload)
        toast({ title: t('pay.policy.updated') })
      } else {
        await createAndSubmitPolicy(payload)
        toast({ title: t('pay.policy.created') })
      }
      loadPolicy()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      toast({ title: t('pay.policy.save_fail'), description: msg, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (d: string) => {
    try { return format(new Date(d + 'T00:00:00'), 'PPP', { locale: isRTL ? ar : enUS }) } catch { return d }
  }

  const violationLabel = (key: string) => {
    const v = VIOLATION_OPTIONS.find(o => o.value === key)
    return v ? (isRTL ? v.labelAr : v.labelEn) : key
  }

  const penaltyLabel = (key: string) => {
    const p = PENALTY_TYPES.find(o => o.value === key)
    return p ? (isRTL ? p.labelAr : p.labelEn) : key
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('pay.policy.title')}</h2>
        {hasExisting && (
          <Badge variant="secondary" className="gap-1">
            <FileText className="h-3 w-3" /> {t('pay.policy.existing')}
          </Badge>
        )}
      </div>

      {/* Policy Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('pay.policy.settings')}</CardTitle>
          <CardDescription>{t('pay.policy.settings_desc')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t('pay.policy.name')}</Label>
            <Input
              value={policy.policy_name}
              onChange={(e) => setPolicy({ ...policy, policy_name: e.target.value })}
              placeholder={t('pay.policy.name_placeholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('pay.policy.company')}</Label>
            <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50 text-sm">
              <Building className="h-4 w-4 text-muted-foreground" />
              {policy.company || activeCompany || '—'}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('pay.policy.effective_from')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start font-normal', isRTL ? 'text-right' : 'text-left')}>
                  <CalendarIcon className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                  {policy.effective_from ? formatDate(policy.effective_from) : t('pay.ded.select_date')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={policy.effective_from ? new Date(policy.effective_from + 'T00:00:00') : undefined}
                  onSelect={(d) => d && setPolicy({ ...policy, effective_from: format(d, 'yyyy-MM-dd') })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox
              aria-label={isRTL ? 'اللائحة الافتراضية' : 'Default policy'}
              id="is-default"
              checked={policy.is_default === 1}
              onCheckedChange={(checked) => setPolicy({ ...policy, is_default: checked ? 1 : 0 })}
            />
            <Label htmlFor="is-default" className="cursor-pointer">{t('pay.policy.is_default')}</Label>
          </div>
        </CardContent>
      </Card>

      {/* Rules Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t('pay.policy.rules')}</CardTitle>
              <CardDescription>{t('pay.policy.rules_desc')}</CardDescription>
            </div>
            <Button size="sm" onClick={addRule}>
              <Plus className="h-4 w-4 mr-1" /> {t('pay.policy.add_rule')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {policy.rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p>{t('pay.policy.no_rules_yet')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('pay.ded.violation_type')}</TableHead>
                    <TableHead className="w-20">{t('pay.policy.from')}</TableHead>
                    <TableHead className="w-20">{t('pay.policy.to')}</TableHead>
                    <TableHead className="w-28">{t('pay.policy.occ_1st')}</TableHead>
                    <TableHead className="w-28">{t('pay.policy.occ_2nd')}</TableHead>
                    <TableHead className="w-28">{t('pay.policy.occ_3rd')}</TableHead>
                    <TableHead className="w-28">{t('pay.policy.occ_4th')}</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policy.rules.map((rule, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select value={rule.violation_type} onValueChange={(v) => updateRule(idx, 'violation_type', v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VIOLATION_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{isRTL ? o.labelAr : o.labelEn}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          value={rule.minutes_from}
                          onChange={(e) => updateRule(idx, 'minutes_from', parseInt(e.target.value) || 0)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          value={rule.minutes_to}
                          onChange={(e) => updateRule(idx, 'minutes_to', parseInt(e.target.value) || 0)}
                        />
                      </TableCell>
                      {[0, 1, 2, 3].map(occ => {
                        const typeField = `occurrence_${occ}` as keyof PolicyRule
                        const valueField = `${typeField}_value` as keyof PolicyRule
                        return (
                          <TableCell key={occ}>
                            <div className="flex items-center gap-1">
                              <Select
                                value={String(rule[typeField])}
                                onValueChange={(v) => updateRule(idx, typeField, v)}
                              >
                                <SelectTrigger className="h-8 text-xs w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PENALTY_TYPES.map(pt => (
                                    <SelectItem key={pt.value} value={pt.value}>{isRTL ? pt.labelAr : pt.labelEn}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {String(rule[typeField]) !== 'Warning' && (
                                <Input
                                  type="number"
                                  className="h-8 text-xs w-16"
                                  value={Number(rule[valueField]) || ''}
                                  onChange={(e) => updateRule(idx, valueField, parseFloat(e.target.value) || 0)}
                                  placeholder={String(rule[typeField]) === 'Percentage of Daily Wage' ? '%' : '0'}
                                />
                              )}
                            </div>
                          </TableCell>
                        )
                      })}
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => removeRule(idx)} className="h-8 w-8 p-0">
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={loadPolicy} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" /> {t('pay.policy.reset')}
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {saving ? t('pay.policy.saving') : t('pay.policy.save')}
        </Button>
      </div>
    </div>
  )
}
