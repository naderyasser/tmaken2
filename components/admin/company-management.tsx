'use client'

import { useState, useEffect, useCallback, useId } from 'react'
import { frappeClient } from '@/lib/api-client'
import { getCompanyBranches, addBranch, updateBranchLocation, deleteBranch } from '@/lib/api'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
    Building2, Plus, Loader2, RefreshCw, Search,
    Globe, Banknote, Hash, ChevronRight, ChevronLeft,
    Pencil, Trash2, MapPin, FileText, Calendar,
    Package, Users, Receipt, AlertTriangle, GitBranch,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Switch } from '@/components/ui/switch'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import dynamic from 'next/dynamic'

const LocationPickerMap = dynamic(
    () => import('@/components/sales/location-picker-map').then(m => ({ default: m.LocationPickerMap })),
    { ssr: false, loading: () => <div className="h-[280px] bg-gray-100 rounded-lg animate-pulse" /> }
)

// ==================== Types ====================

interface Company {
    name: string
    company_name: string
    abbr: string
    default_currency: string
    country: string
    is_group?: number
    parent_company?: string
    domain?: string
    tax_id?: string
    date_of_establishment?: string
    total_monthly_sales?: number
    creation?: string
}

interface CompanyStats {
    employees: number
    warehouses: number
    customers: number
}

// Common currencies for Saudi businesses
const COMMON_CURRENCIES = [
    { code: 'SAR', labelEn: 'Saudi Riyal (SAR)', labelAr: 'ريال سعودي (SAR)' },
    { code: 'USD', labelEn: 'US Dollar (USD)', labelAr: 'دولار أمريكي (USD)' },
    { code: 'EUR', labelEn: 'Euro (EUR)', labelAr: 'يورو (EUR)' },
    { code: 'AED', labelEn: 'UAE Dirham (AED)', labelAr: 'درهم إماراتي (AED)' },
    { code: 'GBP', labelEn: 'British Pound (GBP)', labelAr: 'جنيه إسترليني (GBP)' },
    { code: 'KWD', labelEn: 'Kuwaiti Dinar (KWD)', labelAr: 'دينار كويتي (KWD)' },
    { code: 'QAR', labelEn: 'Qatari Riyal (QAR)', labelAr: 'ريال قطري (QAR)' },
    { code: 'BHD', labelEn: 'Bahraini Dinar (BHD)', labelAr: 'دينار بحريني (BHD)' },
    { code: 'OMR', labelEn: 'Omani Rial (OMR)', labelAr: 'ريال عماني (OMR)' },
    { code: 'EGP', labelEn: 'Egyptian Pound (EGP)', labelAr: 'جنيه مصري (EGP)' },
    { code: 'INR', labelEn: 'Indian Rupee (INR)', labelAr: 'روبية هندية (INR)' },
]

// Common countries
const COMMON_COUNTRIES = [
    { code: 'Saudi Arabia', labelEn: 'Saudi Arabia', labelAr: 'المملكة العربية السعودية' },
    { code: 'United Arab Emirates', labelEn: 'United Arab Emirates', labelAr: 'الإمارات العربية المتحدة' },
    { code: 'Kuwait', labelEn: 'Kuwait', labelAr: 'الكويت' },
    { code: 'Qatar', labelEn: 'Qatar', labelAr: 'قطر' },
    { code: 'Bahrain', labelEn: 'Bahrain', labelAr: 'البحرين' },
    { code: 'Oman', labelEn: 'Oman', labelAr: 'عمان' },
    { code: 'Egypt', labelEn: 'Egypt', labelAr: 'مصر' },
    { code: 'Jordan', labelEn: 'Jordan', labelAr: 'الأردن' },
    { code: 'Iraq', labelEn: 'Iraq', labelAr: 'العراق' },
    { code: 'India', labelEn: 'India', labelAr: 'الهند' },
    { code: 'United Kingdom', labelEn: 'United Kingdom', labelAr: 'المملكة المتحدة' },
    { code: 'United States', labelEn: 'United States', labelAr: 'الولايات المتحدة' },
]

// ==================== Create Company Dialog ====================

function CreateCompanyDialog({ open, onClose, onCreated, companies, t, isRTL }: {
    open: boolean
    onClose: () => void
    onCreated: () => void
    companies: Company[]
    t: (key: string) => string
    isRTL: boolean
}) {
    const { toast } = useToast()
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        company_name: '',
        abbr: '',
        default_currency: 'SAR',
        country: 'Saudi Arabia',
        is_group: 0,
        parent_company: '',
        domain: '',
        tax_id: '',
    })

    // Auto-generate abbreviation from company name
    const autoAbbr = (name: string): string => {
        if (!name) return ''
        const words = name.trim().split(/\s+/)
        if (words.length === 1) return words[0].substring(0, 3).toUpperCase()
        return words.map(w => w[0]).join('').toUpperCase().substring(0, 5)
    }

    const handleNameChange = (name: string) => {
        const newAbbr = autoAbbr(name)
        setForm(prev => ({
            ...prev,
            company_name: name,
            abbr: prev.abbr === autoAbbr(prev.company_name) || prev.abbr === '' ? newAbbr : prev.abbr,
        }))
    }

    const handleCreate = async () => {
        if (!form.company_name.trim()) {
            toast({ title: t('company.name_required'), variant: 'destructive' })
            return
        }
        if (!form.abbr.trim()) {
            toast({ title: t('company.abbr_required'), variant: 'destructive' })
            return
        }

        setSaving(true)
        try {
            const payload: Record<string, any> = {
                company_name: form.company_name.trim(),
                abbr: form.abbr.trim(),
                default_currency: form.default_currency,
                country: form.country,
            }
            if (form.is_group) payload.is_group = 1
            if (form.parent_company) payload.parent_company = form.parent_company
            if (form.domain) payload.domain = form.domain
            if (form.tax_id) payload.tax_id = form.tax_id

            await frappeClient.call('base_meena.api.create_company', payload)
            toast({ title: t('company.created_success'), description: form.company_name })
            setForm({ company_name: '', abbr: '', default_currency: 'SAR', country: 'Saudi Arabia', is_group: 0, parent_company: '', domain: '', tax_id: '' })
            onCreated()
            onClose()
        } catch (err: any) {
            console.error('Create company error:', err)
            const msg = err?.message || err?.exc || String(err)
            toast({ title: t('company.create_failed'), description: msg, variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        {t('company.create_title')}
                    </DialogTitle>
                    <DialogDescription>{t('company.create_desc')}</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                    {/* Company Name */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">
                            {t('company.company_name')} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={form.company_name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            placeholder={isRTL ? 'مثال: شركة التقنية المتقدمة' : 'e.g. Advanced Tech Company'}
                            className="text-base"
                        />
                    </div>

                    {/* Abbreviation */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">
                            {t('company.abbr')} <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            value={form.abbr}
                            onChange={(e) => setForm(prev => ({ ...prev, abbr: e.target.value }))}
                            placeholder={isRTL ? 'مثال: ATC' : 'e.g. ATC'}
                            className="max-w-[200px] uppercase"
                            maxLength={10}
                        />
                        <p className="text-xs text-gray-400">{t('company.abbr_desc')}</p>
                    </div>

                    {/* Currency & Country row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-700">
                                {t('company.currency')} <span className="text-red-500">*</span>
                            </Label>
                            <Select value={form.default_currency} onValueChange={(v) => setForm(prev => ({ ...prev, default_currency: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {COMMON_CURRENCIES.map(c => (
                                        <SelectItem key={c.code} value={c.code}>{isRTL ? c.labelAr : c.labelEn}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-700">
                                {t('company.country')} <span className="text-red-500">*</span>
                            </Label>
                            <Select value={form.country} onValueChange={(v) => setForm(prev => ({ ...prev, country: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {COMMON_COUNTRIES.map(c => (
                                        <SelectItem key={c.code} value={c.code}>{isRTL ? c.labelAr : c.labelEn}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Tax ID */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">{t('company.tax_id')}</Label>
                        <Input
                            value={form.tax_id}
                            onChange={(e) => setForm(prev => ({ ...prev, tax_id: e.target.value }))}
                            placeholder={isRTL ? 'الرقم الضريبي (اختياري)' : 'Tax/VAT Number (optional)'}
                            className="max-w-[300px]"
                        />
                    </div>

                    {/* Domain */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-gray-700">{t('company.domain')}</Label>
                        <Select value={form.domain || '_none_'} onValueChange={(v) => setForm(prev => ({ ...prev, domain: v === '_none_' ? '' : v }))}>
                            <SelectTrigger aria-label={t('company.select_domain')}><SelectValue placeholder={t('company.select_domain')} /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="_none_">{isRTL ? '— لم يحدد —' : '— Not specified —'}</SelectItem>
                                <SelectItem value="Distribution">{isRTL ? 'التوزيع' : 'Distribution'}</SelectItem>
                                <SelectItem value="Manufacturing">{isRTL ? 'التصنيع' : 'Manufacturing'}</SelectItem>
                                <SelectItem value="Retail">{isRTL ? 'التجزئة' : 'Retail'}</SelectItem>
                                <SelectItem value="Services">{isRTL ? 'الخدمات' : 'Services'}</SelectItem>
                                <SelectItem value="Education">{isRTL ? 'التعليم' : 'Education'}</SelectItem>
                                <SelectItem value="Healthcare">{isRTL ? 'الصحة' : 'Healthcare'}</SelectItem>
                                <SelectItem value="Non Profit">{isRTL ? 'غير ربحي' : 'Non Profit'}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Parent Company */}
                    {companies.length > 0 && (
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-gray-700">{t('company.parent_company')}</Label>
                            <Select value={form.parent_company || '_none_'} onValueChange={(v) => setForm(prev => ({ ...prev, parent_company: v === '_none_' ? '' : v }))}>
                                <SelectTrigger aria-label={t('company.select_parent')}><SelectValue placeholder={t('company.select_parent')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="_none_">{isRTL ? '— لا يوجد (شركة رئيسية)' : '— None (Top-level company)'}</SelectItem>
                                    {companies.map(c => (
                                        <SelectItem key={c.name} value={c.name}>{c.company_name || c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-400">{t('company.parent_desc')}</p>
                        </div>
                    )}

                    {/* Is Group toggle */}
                    <div className="flex items-center justify-between py-3 px-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <div>
                            <Label className="text-sm font-semibold text-gray-900">{t('company.is_group')}</Label>
                            <p className="text-xs text-gray-500 mt-0.5">{t('company.is_group_desc')}</p>
                        </div>
                        <Switch
                            checked={form.is_group === 1}
                            onCheckedChange={(v) => setForm(prev => ({ ...prev, is_group: v ? 1 : 0 }))}
                        />
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                    <Button onClick={handleCreate} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                        {saving ? <><Loader2 className="h-4 w-4 animate-spin" />{isRTL ? 'جاري الإنشاء...' : 'Creating...'}</> : <><Plus className="h-4 w-4" />{t('company.create_btn')}</>}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ==================== Delete Confirm Dialog ====================

function DeleteCompanyDialog({ company, open, onClose, onDeleted, t, isRTL }: {
    company: Company | null
    open: boolean
    onClose: () => void
    onDeleted: () => void
    t: (key: string) => string
    isRTL: boolean
}) {
    const { toast } = useToast()
    const [deleting, setDeleting] = useState(false)
    const [confirmText, setConfirmText] = useState('')

    const handleDelete = async () => {
        if (!company) return
        setDeleting(true)
        try {
            await frappeClient.call('base_meena.api.delete_company', { company_name: company.name })
            toast({ title: t('company.deleted_success'), description: company.company_name || company.name })
            onDeleted()
            onClose()
        } catch (err: any) {
            const msg = err?.message || String(err)
            toast({ title: t('company.delete_failed'), description: msg, variant: 'destructive' })
        } finally {
            setDeleting(false)
            setConfirmText('')
        }
    }

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); setConfirmText('') } }}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        {t('company.delete_title')}
                    </DialogTitle>
                    <DialogDescription>{t('company.delete_warning')}</DialogDescription>
                </DialogHeader>
                {company && (
                    <div className="space-y-4 mt-2">
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm font-semibold text-red-800">{company.company_name || company.name}</p>
                            <p className="text-xs text-red-600 mt-1">{t('company.delete_consequences')}</p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm text-gray-600">
                                {isRTL
                                    ? `اكتب "${company.company_name || company.name}" للتأكيد`
                                    : `Type "${company.company_name || company.name}" to confirm`}
                            </Label>
                            <Input
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder={company.company_name || company.name}
                            />
                        </div>
                    </div>
                )}
                <DialogFooter className="gap-2 sm:space-x-0">
                    <Button variant="outline" onClick={() => { onClose(); setConfirmText('') }}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={deleting || confirmText !== (company?.company_name || company?.name)}
                    >
                        {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        {t('company.delete_btn')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ==================== Main Component ====================

export function AdminCompanyManagement() {
    const { isRTL, t } = useI18n()
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [companies, setCompanies] = useState<Company[]>([])
    const [stats, setStats] = useState<Record<string, CompanyStats>>({})
    const [search, setSearch] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState<Company | null>(null)
    const [expandedCompany, setExpandedCompany] = useState<string | null>(null)

    const loadCompanies = useCallback(async () => {
        setLoading(true)
        try {
            // Use whitelisted endpoint that bypasses User Permission filtering
            const resp = await frappeClient.call<(Company & { employees: number; warehouses: number })[]>('base_meena.api.get_all_companies')
            const result = resp.message || []
            setCompanies(result)

            // Stats come from the backend in the same response
            const statsObj: Record<string, CompanyStats> = {}
            for (const comp of result) {
                statsObj[comp.name] = {
                    employees: comp.employees || 0,
                    warehouses: comp.warehouses || 0,
                    customers: 0,
                }
            }
            setStats(statsObj)
        } catch (err) {
            console.error('Error loading companies:', err)
            toast({ title: isRTL ? 'خطأ في تحميل الشركات' : 'Error loading companies', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }, [isRTL, toast])

    useEffect(() => { loadCompanies() }, [loadCompanies])

    const filteredCompanies = companies.filter(c => {
        if (!search) return true
        const s = search.toLowerCase()
        return (
            (c.company_name || '').toLowerCase().includes(s) ||
            (c.name || '').toLowerCase().includes(s) ||
            (c.abbr || '').toLowerCase().includes(s)
        )
    })

    const Arrow = isRTL ? ChevronLeft : ChevronRight

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Building2 className="h-6 w-6 text-blue-600" />
                        {t('company.title')}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">{t('company.subtitle')}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadCompanies} disabled={loading}>
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                    </Button>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowCreate(true)}>
                        <Plus className="h-4 w-4" />
                        {t('company.create_btn')}
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('company.search')}
                    className="pl-9"
                />
            </div>

            {/* Company cards */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                </div>
            ) : filteredCompanies.length === 0 ? (
                <div className="text-center py-20">
                    <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">{t('company.no_companies')}</p>
                    <p className="text-sm text-gray-400 mt-1">{t('company.no_companies_sub')}</p>
                    <Button className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => setShowCreate(true)}>
                        <Plus className="h-4 w-4" />
                        {t('company.create_btn')}
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredCompanies.map((company) => {
                        const isExpanded = expandedCompany === company.name
                        const compStats = stats[company.name] || { employees: 0, warehouses: 0, customers: 0 }
                        return (
                            <div
                                key={company.name}
                                className={cn(
                                    'bg-white border rounded-xl transition-all duration-200 overflow-hidden',
                                    isExpanded ? 'border-blue-300 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                )}
                            >
                                {/* Card header - clickable */}
                                <button
                                    className="w-full flex items-center gap-4 p-4 text-left"
                                    onClick={() => setExpandedCompany(isExpanded ? null : company.name)}
                                >
                                    {/* Company icon */}
                                    <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                                        <Building2 className="h-6 w-6 text-blue-600" />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-gray-900 truncate">{company.company_name || company.name}</h3>
                                            <Badge variant="outline" className="text-xs font-mono">{company.abbr}</Badge>
                                            {company.is_group === 1 && (
                                                <Badge className="bg-indigo-100 text-indigo-700 text-xs">{isRTL ? 'مجموعة' : 'Group'}</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                            <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{company.country}</span>
                                            <span className="flex items-center gap-1"><Banknote className="h-3 w-3" />{company.default_currency}</span>
                                            {company.domain && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{company.domain}</span>}
                                        </div>
                                    </div>

                                    {/* Quick stats */}
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-gray-900">{compStats.employees}</p>
                                            <p>{isRTL ? 'موظف' : 'Employees'}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-lg font-bold text-gray-900">{compStats.warehouses}</p>
                                            <p>{isRTL ? 'مستودع' : 'Warehouses'}</p>
                                        </div>
                                    </div>

                                    <Arrow className={cn('h-5 w-5 text-gray-400 flex-shrink-0 transition-transform', isExpanded && 'rotate-90')} />
                                </button>

                                {/* Expanded details */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 p-4 bg-gray-50/50 space-y-3">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                            <InfoItem icon={Hash} label={t('company.abbr')} value={company.abbr} isRTL={isRTL} />
                                            <InfoItem icon={Banknote} label={t('company.currency')} value={company.default_currency} isRTL={isRTL} />
                                            <InfoItem icon={Globe} label={t('company.country')} value={company.country} isRTL={isRTL} />
                                            <InfoItem icon={FileText} label={t('company.tax_id')} value={company.tax_id || '—'} isRTL={isRTL} />
                                            {company.parent_company && (
                                                <InfoItem icon={Building2} label={t('company.parent_company')} value={company.parent_company} isRTL={isRTL} />
                                            )}
                                            {company.domain && (
                                                <InfoItem icon={MapPin} label={t('company.domain')} value={company.domain} isRTL={isRTL} />
                                            )}
                                            <InfoItem icon={Users} label={isRTL ? 'موظفين' : 'Employees'} value={String(compStats.employees)} isRTL={isRTL} />
                                            <InfoItem icon={Package} label={isRTL ? 'مستودعات' : 'Warehouses'} value={String(compStats.warehouses)} isRTL={isRTL} />
                                        </div>

                                        {/* Branches section */}
                                        <CompanyBranchesSection companyName={company.name} t={t} isRTL={isRTL} />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Dialogs */}
            <CreateCompanyDialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
                onCreated={loadCompanies}
                companies={companies}
                t={t}
                isRTL={isRTL}
            />
            <DeleteCompanyDialog
                company={deleteTarget}
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onDeleted={loadCompanies}
                t={t}
                isRTL={isRTL}
            />
        </div>
    )
}

// ==================== Company Branches Section ====================

/** A check-in geofence wider than this is almost certainly a typo, not a policy:
 *  qarawi carries a branch with a 310,000 m radius — 310 km, i.e. no geofence. */
const MAX_SANE_RADIUS = 20000

/** Below this many branches a search box is just clutter. */
const SEARCHABLE_FROM = 6

/** Inline feedback under the radius input: explains 0, warns on absurd values. */
function RadiusHint({ value, t }: { value: string; t: (key: string) => string }) {
    const n = value === '' ? NaN : Number(value)
    if (Number.isFinite(n) && n > MAX_SANE_RADIUS) {
        return (
            <p className="text-xs text-amber-600 mt-1 flex items-start gap-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                <span>{t('branch.radius_too_wide')}</span>
            </p>
        )
    }
    return <p className="text-xs text-gray-400 mt-1">{t('branch.checkin_radius_hint')}</p>
}

interface Branch {
    name: string
    branch: string
    company: string
    /** Admin-entered branch identifier ("01", "B-3") — Data, so leading zeros survive. */
    custom_branch_number: string | null
    latitude: number | null
    longitude: number | null
    checkin_radius: number | null
}

function CompanyBranchesSection({ companyName, t, isRTL }: { companyName: string; t: (key: string) => string; isRTL: boolean }) {
    const { toast } = useToast()
    // Unique per rendered company — several companies can be expanded at once, and
    // duplicate DOM ids would point every label at the first company's inputs.
    const fieldId = useId()
    const [branches, setBranches] = useState<Branch[]>([])
    const [loading, setLoading] = useState(true)
    const [showAdd, setShowAdd] = useState(false)
    const [editBranch, setEditBranch] = useState<Branch | null>(null)

    // Add form state
    const [newName, setNewName] = useState('')
    const [newNumber, setNewNumber] = useState('')
    const [newLat, setNewLat] = useState('')
    const [newLng, setNewLng] = useState('')
    const [newRadius, setNewRadius] = useState('100')
    const [saving, setSaving] = useState(false)

    // Edit form state
    const [editNumber, setEditNumber] = useState('')
    const [editLat, setEditLat] = useState('')
    const [editLng, setEditLng] = useState('')
    const [editRadius, setEditRadius] = useState('')
    const [editSaving, setEditSaving] = useState(false)

    // Delete state
    const [deleting, setDeleting] = useState<string | null>(null)
    const [pendingDelete, setPendingDelete] = useState<Branch | null>(null)

    // A company with two dozen branches is a scroll; a company with three is not.
    const [query, setQuery] = useState('')

    const loadBranches = useCallback(async () => {
        setLoading(true)
        try {
            const data = await getCompanyBranches(companyName)
            setBranches(data || [])
        } catch {
            setBranches([])
        } finally {
            setLoading(false)
        }
    }, [companyName])

    useEffect(() => { loadBranches() }, [loadBranches])

    const resetAddForm = () => {
        setNewName(''); setNewNumber(''); setNewLat(''); setNewLng(''); setNewRadius('100')
    }

    const handleAdd = async () => {
        if (!newName.trim() || saving) return
        setSaving(true)
        try {
            await addBranch(
                companyName,
                newName.trim(),
                newLat ? parseFloat(newLat) : undefined,
                newLng ? parseFloat(newLng) : undefined,
                // '0' is truthy as a string but means "no radius limit" — keep it.
                newRadius === '' ? 100 : parseInt(newRadius),
                newNumber.trim() || undefined,
            )
            toast({ title: t('branch.created') })
            setShowAdd(false)
            resetAddForm()
            await loadBranches()
        } catch (err: any) {
            toast({ title: err?.message || 'Error', variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    const openEdit = (b: Branch) => {
        setEditBranch(b)
        setEditNumber(b.custom_branch_number || '')
        setEditLat(b.latitude != null ? String(b.latitude) : '')
        setEditLng(b.longitude != null ? String(b.longitude) : '')
        setEditRadius(b.checkin_radius != null ? String(b.checkin_radius) : '100')
    }

    const handleEdit = async () => {
        if (!editBranch) return
        setEditSaving(true)
        try {
            // Coordinates are sent only when the admin actually has a point on the
            // map. `parseFloat('') || 0` used to stamp 0,0 onto branches opened
            // just to edit the number or the radius.
            const lat = editLat === '' ? undefined : parseFloat(editLat)
            const lng = editLng === '' ? undefined : parseFloat(editLng)
            await updateBranchLocation(
                editBranch.name,
                Number.isFinite(lat as number) ? lat : undefined,
                Number.isFinite(lng as number) ? lng : undefined,
                editRadius === '' ? undefined : parseInt(editRadius),
                editNumber.trim(),  // '' clears the number; the field is always sent from here
            )
            toast({ title: t('branch.updated') })
            setEditBranch(null)
            await loadBranches()
        } catch (err: any) {
            toast({ title: err?.message || 'Error', variant: 'destructive' })
        } finally {
            setEditSaving(false)
        }
    }

    const handleDelete = async (b: Branch) => {
        setPendingDelete(null)
        setDeleting(b.name)
        try {
            await deleteBranch(b.name)
            toast({ title: t('branch.deleted') })
            await loadBranches()
        } catch (err: any) {
            toast({ title: err?.message || 'Error', variant: 'destructive' })
        } finally {
            setDeleting(null)
        }
    }

    const q = query.trim().toLowerCase()
    // Admins look a branch up by its number as often as by its name.
    const visible = q
        ? branches.filter((b) =>
            b.branch.toLowerCase().includes(q) ||
            (b.custom_branch_number || '').toLowerCase().includes(q))
        : branches

    return (
        <div className="pt-3 border-t border-gray-200">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <GitBranch className="h-4 w-4 text-blue-500" />
                    {t('branch.title')}
                    {branches.length > 0 && (
                        <span className="text-[11px] font-medium text-gray-400 tabular-nums">({branches.length})</span>
                    )}
                </h4>
                <div className="flex items-center gap-2">
                    {branches.length > SEARCHABLE_FROM && (
                        <div className="relative">
                            <Search className={cn(
                                'absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none',
                                isRTL ? 'right-2' : 'left-2',
                            )} />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder={t('branch.search_placeholder')}
                                aria-label={t('branch.search_placeholder')}
                                className={cn('h-7 w-40 sm:w-48 text-xs bg-white', isRTL ? 'pr-7' : 'pl-7')}
                            />
                        </div>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 bg-white" onClick={() => setShowAdd(true)}>
                        <Plus className="h-3 w-3" />
                        {t('branch.add')}
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
            ) : branches.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400 bg-white rounded-lg border border-dashed border-gray-200">
                    {t('branch.no_branches')}
                </div>
            ) : visible.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-400 bg-white rounded-lg border border-dashed border-gray-200">
                    {t('branch.no_results')}
                </div>
            ) : (
                <div className="space-y-1.5">
                    {visible.map((b) => (
                        <div
                            key={b.name}
                            className="group flex items-center justify-between gap-3 bg-white rounded-lg border border-gray-100 px-3 py-2 transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Fixed-width tile so the numbers line up as an index — and a
                                    dashed placeholder makes an unnumbered branch obvious. */}
                                <span
                                    dir="ltr"
                                    title={b.custom_branch_number
                                        ? `${t('branch.number')}: ${b.custom_branch_number}`
                                        : t('branch.no_number')}
                                    className={cn(
                                        'shrink-0 h-8 min-w-[2rem] px-1.5 rounded-lg flex items-center justify-center text-xs font-semibold tabular-nums',
                                        b.custom_branch_number
                                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                            : 'border border-dashed border-gray-200 text-gray-300',
                                    )}
                                >
                                    {b.custom_branch_number || '—'}
                                </span>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{b.branch}</p>
                                    {b.latitude && b.longitude ? (
                                        <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                                            <a
                                                href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title={t('branch.open_in_maps')}
                                                className="inline-flex items-center gap-1 rounded hover:text-blue-600 hover:underline focus:outline-none focus:ring-1 focus:ring-blue-300"
                                            >
                                                <MapPin className="h-3 w-3" />
                                                <span dir="ltr" className="tabular-nums">{Number(b.latitude).toFixed(5)}, {Number(b.longitude).toFixed(5)}</span>
                                            </a>
                                            {b.checkin_radius ? (
                                                <Badge
                                                    variant="outline"
                                                    className={cn("text-[10px] py-0 h-4 tabular-nums", b.checkin_radius > MAX_SANE_RADIUS && "border-amber-400 text-amber-600")}
                                                    title={b.checkin_radius > MAX_SANE_RADIUS ? t('branch.radius_too_wide') : undefined}
                                                >
                                                    {b.checkin_radius > MAX_SANE_RADIUS ? '⚠ ' : ''}{b.checkin_radius}m
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-[10px] py-0 h-4 text-gray-400">
                                                    {t('branch.no_radius')}
                                                </Badge>
                                            )}
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-amber-500 mt-0.5 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3 shrink-0" />
                                            {t('branch.no_location')}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-600 hover:bg-blue-100/60" onClick={() => openEdit(b)}>
                                    <Pencil className="h-3 w-3" />
                                    {t('branch.edit')}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    aria-label={t('branch.delete')}
                                    title={t('branch.delete')}
                                    className="h-7 w-7 p-0 text-gray-300 hover:text-red-600 hover:bg-red-50 group-hover:text-red-400 focus-visible:text-red-600"
                                    onClick={() => setPendingDelete(b)}
                                    disabled={deleting === b.name}
                                >
                                    {deleting === b.name ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Branch Dialog */}
            <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (!open) resetAddForm() }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t('branch.add')}</DialogTitle>
                        <DialogDescription>{t('branch.subtitle')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <Label htmlFor={`${fieldId}-name`}>{t('branch.name')} *</Label>
                            <Input
                                id={`${fieldId}-name`}
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) handleAdd() }}
                                placeholder={t('branch.name_placeholder')}
                                autoFocus
                            />
                        </div>
                        <div>
                            <Label htmlFor={`${fieldId}-number`}>{t('branch.number')}</Label>
                            <Input
                                id={`${fieldId}-number`}
                                value={newNumber}
                                onChange={(e) => setNewNumber(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) handleAdd() }}
                                placeholder={t('branch.number_placeholder')}
                            />
                            <p className="text-xs text-gray-400 mt-1">{t('branch.number_hint')}</p>
                        </div>
                        <div>
                            <Label htmlFor={`${fieldId}-radius`}>{t('branch.checkin_radius')}</Label>
                            <Input id={`${fieldId}-radius`} type="number" min="0" max={MAX_SANE_RADIUS} value={newRadius} onChange={(e) => setNewRadius(e.target.value)} />
                            <RadiusHint value={newRadius} t={t} />
                        </div>
                        <div>
                            <Label>{t('branch.location')}</Label>
                            <LocationPickerMap
                                lat={newLat}
                                lng={newLng}
                                onChange={(lat, lng) => { setNewLat(lat); setNewLng(lng) }}
                                height="260px"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:space-x-0">
                        <Button variant="outline" onClick={() => { setShowAdd(false); resetAddForm() }}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" disabled={saving || !newName.trim()} onClick={handleAdd}>
                            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {t('branch.add')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Branch Location Dialog */}
            <Dialog open={!!editBranch} onOpenChange={(open) => { if (!open) setEditBranch(null) }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{t('branch.edit')}</DialogTitle>
                        <DialogDescription>{editBranch?.branch}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <Label htmlFor={`${fieldId}-edit-number`}>{t('branch.number')}</Label>
                            <Input
                                id={`${fieldId}-edit-number`}
                                value={editNumber}
                                onChange={(e) => setEditNumber(e.target.value)}
                                placeholder={t('branch.number_placeholder')}
                                autoFocus
                            />
                            <p className="text-xs text-gray-400 mt-1">{t('branch.number_hint')}</p>
                        </div>
                        <div>
                            <Label htmlFor={`${fieldId}-edit-radius`}>{t('branch.checkin_radius')}</Label>
                            <Input id={`${fieldId}-edit-radius`} type="number" min="0" max={MAX_SANE_RADIUS} value={editRadius} onChange={(e) => setEditRadius(e.target.value)} />
                            <RadiusHint value={editRadius} t={t} />
                        </div>
                        <div>
                            <Label>{t('branch.location')}</Label>
                            <LocationPickerMap
                                lat={editLat}
                                lng={editLng}
                                onChange={(lat, lng) => { setEditLat(lat); setEditLng(lng) }}
                                height="260px"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:space-x-0">
                        <Button variant="outline" onClick={() => setEditBranch(null)}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                        <Button className="bg-blue-600 hover:bg-blue-700" disabled={editSaving} onClick={handleEdit}>
                            {editSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isRTL ? 'حفظ' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!pendingDelete}
                onOpenChange={(open) => !open && setPendingDelete(null)}
                title={isRTL ? `حذف ${pendingDelete?.branch}؟` : `Delete ${pendingDelete?.branch}?`}
                description={t('branch.delete_confirm')}
                confirmLabel={isRTL ? 'حذف' : 'Delete'}
                cancelLabel={isRTL ? 'إلغاء' : 'Cancel'}
                onConfirm={() => pendingDelete && handleDelete(pendingDelete)}
            />
        </div>
    )
}

// ==================== Helper ====================

function InfoItem({ icon: Icon, label, value, isRTL }: { icon: any; label: string; value: string; isRTL: boolean }) {
    return (
        <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-100">
            <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
            </div>
        </div>
    )
}
