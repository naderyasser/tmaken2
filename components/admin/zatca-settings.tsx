/**
 * ZATCA E-Invoicing Settings Page
 * Admin page for managing ZATCA integration settings
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { zatcaApi, type ZatcaSettings } from '@/lib/zatca-api'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import {
  Shield, CheckCircle2, XCircle, AlertTriangle, Loader2,
  FileKey, Key, Server, Send, RefreshCw, Settings2, Building2,
  ChevronRight, Zap, FileText, QrCode
} from 'lucide-react'

interface ZatcaSettingsPageProps {
  company?: string
  companies?: string[]
}

export function ZatcaSettingsPage({ company: propCompany, companies = [] }: ZatcaSettingsPageProps) {
  const { isRTL } = useI18n()
  const { toast } = useToast()
  const [settings, setSettings] = useState<ZatcaSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeStep, setActiveStep] = useState<string | null>(null)
  const [selectedCompany, setSelectedCompany] = useState(propCompany || '')
  const [otp, setOtp] = useState('123456')

  // Sync with global company selector
  useEffect(() => {
    if (propCompany && propCompany !== selectedCompany) {
      setSelectedCompany(propCompany)
    }
  }, [propCompany])

  // Form state
  const [formValues, setFormValues] = useState({
    enabled: false,
    environment: 'Sandbox',
    company_name_arabic: '',
    location: '',
    business_category: '',
    send_background: false,
    attach_xml: false,
    attach_qr: true,
    send_on_submit: 'Live',
    tax_id: '',
  })

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const data = await zatcaApi.getSettings(selectedCompany || undefined)
      setSettings(data)
      if (data) {
        setFormValues({
          enabled: data.enabled,
          environment: data.environment || 'Sandbox',
          company_name_arabic: data.company_name_arabic || '',
          location: '',
          business_category: '',
          send_background: data.send_background,
          attach_xml: data.attach_xml,
          attach_qr: data.attach_qr,
          send_on_submit: data.send_on_submit || 'Live',
          tax_id: data.tax_id || '',
        })
        if (!selectedCompany && data.company) {
          setSelectedCompany(data.company)
        }
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [selectedCompany, toast])

  useEffect(() => { loadSettings() }, [loadSettings])

  const handleSave = async () => {
    if (!selectedCompany) return
    setSaving(true)
    try {
      const result = await zatcaApi.updateSettings(selectedCompany, formValues)
      if (result?.environment_changed) {
        toast({
          title: isRTL ? '⚠️ تم تغيير البيئة' : '⚠️ Environment Changed',
          description: isRTL
            ? 'تم مسح الشهادات. يجب إعادة إعداد ZATCA من البداية (CSR → CSID → Compliance → Production)'
            : 'Certificates reset. You must redo the Setup Wizard for the new environment.',
          variant: 'destructive',
        })
      } else {
        toast({ title: isRTL ? 'تم الحفظ' : 'Saved', description: isRTL ? 'تم حفظ إعدادات زاتكا' : 'ZATCA settings saved' })
      }
      loadSettings()
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleStep = async (step: string) => {
    if (!selectedCompany) return
    setActiveStep(step)
    try {
      let result: any
      switch (step) {
        case 'csr_config':
          result = await zatcaApi.generateCsrConfig(selectedCompany)
          break
        case 'create_csr':
          result = await zatcaApi.createCsr(selectedCompany)
          break
        case 'compliance_csid':
          result = await zatcaApi.generateComplianceCsid(selectedCompany, otp)
          break
        case 'compliance_check':
          result = await zatcaApi.runComplianceCheck(selectedCompany)
          break
        case 'production_csid':
          result = await zatcaApi.generateProductionCsid(selectedCompany)
          break
      }
      if (result?.success) {
        toast({ title: isRTL ? 'نجاح' : 'Success', description: result.message || 'Step completed' })
        loadSettings()
      } else {
        toast({ title: isRTL ? 'خطأ' : 'Error', description: result?.error || 'Step failed', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    } finally {
      setActiveStep(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    )
  }

  const steps = settings?.setup_steps || {
    csr_created: false, compliance_csid: false,
    compliance_check: false, production_csid: false, certificate_ready: false,
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-green-600" />
            {isRTL ? 'إعدادات الفوترة الإلكترونية - زاتكا' : 'ZATCA E-Invoicing Settings'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isRTL ? 'هيئة الزكاة والضريبة والجمارك - المرحلة الثانية' : 'Zakat, Tax and Customs Authority - Phase 2'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {settings?.setup_complete ? (
            <Badge className="bg-green-100 text-green-700 text-sm px-3 py-1">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {isRTL ? 'مُعد بالكامل' : 'Fully Configured'}
            </Badge>
          ) : (
            <Badge className="bg-amber-100 text-amber-700 text-sm px-3 py-1">
              <AlertTriangle className="h-4 w-4 mr-1" />
              {isRTL ? 'يحتاج إعداد' : 'Setup Required'}
            </Badge>
          )}
        </div>
      </div>

      {/* Company Info Banner */}
      {selectedCompany && (
        <Card className="border-blue-100 bg-blue-50/50">
          <CardContent className="p-3 flex items-center gap-3">
            <Building2 className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm font-semibold text-blue-900">{selectedCompany}</p>
              <p className="text-xs text-blue-600">{isRTL ? 'استخدم محوّل الشركات في الأعلى لتغيير الشركة' : 'Use the company switcher in the header to change company'}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Basic Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {isRTL ? 'الإعدادات الأساسية' : 'Basic Settings'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label className="font-medium">{isRTL ? 'تفعيل الفوترة الإلكترونية' : 'Enable ZATCA E-Invoicing'}</Label>
                <p className="text-xs text-gray-500">{isRTL ? 'إرسال الفواتير لزاتكا' : 'Send invoices to ZATCA'}</p>
              </div>
              <Switch
                checked={formValues.enabled}
                onCheckedChange={v => setFormValues(f => ({ ...f, enabled: v }))}
              />
            </div>

            <div>
              <Label>{isRTL ? 'البيئة' : 'Environment'}</Label>
              <Select value={formValues.environment} onValueChange={v => setFormValues(f => ({ ...f, environment: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sandbox">{isRTL ? 'بيئة تجريبية' : 'Sandbox'}</SelectItem>
                  <SelectItem value="Simulation">{isRTL ? 'محاكاة' : 'Simulation'}</SelectItem>
                  <SelectItem value="Production">{isRTL ? 'إنتاج' : 'Production'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{isRTL ? 'اسم الشركة بالعربي' : 'Company Name (Arabic)'}</Label>
              <Input
                value={formValues.company_name_arabic}
                onChange={e => setFormValues(f => ({ ...f, company_name_arabic: e.target.value }))}
                placeholder={isRTL ? 'اسم الشركة' : 'Arabic company name'}
                className="mt-1"
                dir="rtl"
              />
            </div>

            <div>
              <Label>{isRTL ? 'الرقم الضريبي (VAT)' : 'Tax ID (VAT Number)'}</Label>
              <Input
                value={formValues.tax_id}
                onChange={e => setFormValues(f => ({ ...f, tax_id: e.target.value }))}
                placeholder={isRTL ? 'مثال: 300000000000003' : 'e.g. 300000000000003'}
                className="mt-1 font-mono"
                dir="ltr"
                maxLength={15}
              />
              <p className="text-xs text-gray-400 mt-1">{isRTL ? 'رقم ضريبي مكون من 15 رقم' : '15-digit VAT registration number'}</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label className="font-medium">{isRTL ? 'إرسال في الخلفية' : 'Background Submission'}</Label>
                <p className="text-xs text-gray-500">{isRTL ? 'إرسال الفواتير تلقائياً' : 'Auto-submit invoices via scheduler'}</p>
              </div>
              <Switch
                checked={formValues.send_background}
                onCheckedChange={v => setFormValues(f => ({ ...f, send_background: v }))}
              />
            </div>

            <div>
              <Label>{isRTL ? 'طريقة إرسال B2C' : 'B2C Submission Method'}</Label>
              <p className="text-xs text-gray-500 mb-1">{isRTL ? 'B2B يُرسل دائماً مباشرة حسب تعليمات زاتكا' : 'B2B always sends Live as per ZATCA instruction'}</p>
              <Select value={formValues.send_on_submit} onValueChange={v => setFormValues(f => ({ ...f, send_on_submit: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Live">{isRTL ? 'مباشر' : 'Live'}</SelectItem>
                  <SelectItem value="Batches">{isRTL ? 'دفعات' : 'Batches'}</SelectItem>
                  <SelectItem value="Background">{isRTL ? 'في الخلفية' : 'Background'}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label className="font-medium">{isRTL ? 'إرفاق رمز QR' : 'Attach QR Code'}</Label>
                <p className="text-xs text-gray-500">{isRTL ? 'على الفواتير' : 'On invoices'}</p>
              </div>
              <Switch
                checked={formValues.attach_qr}
                onCheckedChange={v => setFormValues(f => ({ ...f, attach_qr: v }))}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <Label className="font-medium">{isRTL ? 'إرفاق XML' : 'Attach XML'}</Label>
                <p className="text-xs text-gray-500">{isRTL ? 'ملف XML على الفواتير' : 'XML file on invoices'}</p>
              </div>
              <Switch
                checked={formValues.attach_xml}
                onCheckedChange={v => setFormValues(f => ({ ...f, attach_xml: v }))}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isRTL ? 'حفظ الإعدادات' : 'Save Settings'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Setup Wizard */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            {isRTL ? 'خطوات الإعداد' : 'Setup Steps'}
          </CardTitle>
          <CardDescription>
            {isRTL
              ? 'أكمل هذه الخطوات بالترتيب لتفعيل الفوترة الإلكترونية'
              : 'Complete these steps in order to activate e-invoicing'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Step 1: CSR Config & Creation */}
          <SetupStep
            step={1}
            icon={<FileKey className="h-5 w-5" />}
            title={isRTL ? 'إنشاء طلب التوقيع (CSR)' : 'Create CSR'}
            description={isRTL ? 'إنشاء طلب شهادة التوقيع الرقمي' : 'Generate Certificate Signing Request'}
            done={steps.csr_created}
            loading={activeStep === 'create_csr' || activeStep === 'csr_config'}
            onAction={() => handleStep('create_csr')}
            isRTL={isRTL}
          />

          {/* Step 2: Compliance CSID */}
          <SetupStep
            step={2}
            icon={<Key className="h-5 w-5" />}
            title={isRTL ? 'شهادة الامتثال (CSID)' : 'Compliance CSID'}
            description={isRTL ? 'الحصول على شهادة الامتثال من زاتكا' : 'Obtain compliance certificate from ZATCA'}
            done={steps.compliance_csid}
            loading={activeStep === 'compliance_csid'}
            disabled={!steps.csr_created}
            onAction={() => handleStep('compliance_csid')}
            isRTL={isRTL}
          >
            <div className="flex items-center gap-2 mt-2">
              <Label className="text-xs">{isRTL ? 'رمز OTP' : 'OTP'}</Label>
              <Input
                value={otp}
                onChange={e => setOtp(e.target.value)}
                className="w-32 h-8 text-sm"
                placeholder="123456"
              />
            </div>
          </SetupStep>

          {/* Step 3: Compliance Check */}
          <SetupStep
            step={3}
            icon={<CheckCircle2 className="h-5 w-5" />}
            title={isRTL ? 'فحص الامتثال' : 'Compliance Check'}
            description={isRTL ? 'التحقق من صحة الفواتير مع زاتكا' : 'Validate invoice format with ZATCA'}
            done={steps.compliance_check}
            loading={activeStep === 'compliance_check'}
            disabled={!steps.compliance_csid}
            onAction={() => handleStep('compliance_check')}
            isRTL={isRTL}
          />

          {/* Step 4: Production CSID */}
          <SetupStep
            step={4}
            icon={<Server className="h-5 w-5" />}
            title={isRTL ? 'شهادة الإنتاج (PCSID)' : 'Production CSID'}
            description={isRTL ? 'الحصول على شهادة الإنتاج النهائية' : 'Obtain production certificate for live use'}
            done={steps.production_csid}
            loading={activeStep === 'production_csid'}
            disabled={!steps.compliance_check}
            onAction={() => handleStep('production_csid')}
            isRTL={isRTL}
          />

          {/* Step 5: Ready */}
          <div className={cn(
            'p-4 rounded-lg border-2 transition-all',
            steps.certificate_ready
              ? 'border-green-300 bg-green-50'
              : 'border-gray-200 bg-gray-50 opacity-60'
          )}>
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
                steps.certificate_ready ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-600'
              )}>
                5
              </div>
              <Send className={cn('h-5 w-5', steps.certificate_ready ? 'text-green-600' : 'text-gray-400')} />
              <div className="flex-1">
                <p className="font-medium">{isRTL ? 'جاهز للفوترة الإلكترونية!' : 'Ready for E-Invoicing!'}</p>
                <p className="text-xs text-gray-500">
                  {isRTL
                    ? 'يمكنك الآن إرسال الفواتير لزاتكا تلقائياً عند التقديم'
                    : 'Invoices will now be sent to ZATCA automatically on submit'}
                </p>
              </div>
              {steps.certificate_ready && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            {isRTL ? 'معلومات التكوين' : 'Configuration Info'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <InfoItem label={isRTL ? 'الشركة' : 'Company'} value={settings?.company || '—'} />
            <InfoItem label={isRTL ? 'الاختصار' : 'Abbreviation'} value={settings?.company_abbr || '—'} />
            <InfoItem label={isRTL ? 'البيئة' : 'Environment'} value={settings?.environment || '—'} />
            <InfoItem label={isRTL ? 'المرحلة' : 'Phase'} value={settings?.phase || '—'} />
            <InfoItem label={isRTL ? 'نوع التسجيل' : 'Registration'} value={settings?.registration_type || '—'} />
            <InfoItem label={isRTL ? 'الرقم الضريبي' : 'Tax ID'} value={settings?.tax_id || '—'} />
            <InfoItem label={isRTL ? 'PIH متوفر' : 'Has PIH'} value={settings?.has_pih ? '✅' : '❌'} />
            <InfoItem label={isRTL ? 'الإعداد مكتمل' : 'Setup Complete'} value={settings?.setup_complete ? '✅' : '❌'} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ---- Sub-components ----

function SetupStep({ step, icon, title, description, done, loading, disabled, onAction, children, isRTL }: {
  step: number; icon: React.ReactNode; title: string; description: string
  done: boolean; loading: boolean; disabled?: boolean
  onAction: () => void; children?: React.ReactNode; isRTL: boolean
}) {
  return (
    <div className={cn(
      'p-4 rounded-lg border-2 transition-all',
      done ? 'border-green-300 bg-green-50' : disabled ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-blue-200 bg-blue-50'
    )}>
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold',
          done ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'
        )}>
          {step}
        </div>
        <div className={cn(done ? 'text-green-600' : 'text-blue-600')}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="font-medium">{title}</p>
          <p className="text-xs text-gray-500">{description}</p>
          {children}
        </div>
        {done ? (
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
        ) : (
          <Button
            size="sm"
            onClick={onAction}
            disabled={disabled || loading}
            className="flex-shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <>
                {isRTL ? 'تنفيذ' : 'Run'}
                <ChevronRight className={cn('h-4 w-4', isRTL ? 'mr-1 rotate-180' : 'ml-1')} />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 bg-gray-50 rounded">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-medium text-gray-700 truncate">{value}</p>
    </div>
  )
}
