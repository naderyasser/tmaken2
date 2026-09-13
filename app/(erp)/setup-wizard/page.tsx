'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import {
    Building2, Globe, CheckCircle2, ArrowRight, ArrowLeft,
    Loader2, Sparkles, ChevronRight, ChevronLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
    checkCompanyExists,
    createCompany,
    COUNTRIES,
    COUNTRY_CURRENCY,
    COUNTRY_AR,
    type CompanyData,
} from '@/lib/company-api'

// ═══════════════════════════════════════════════════════════════════════
// Setup Wizard Page
// ═══════════════════════════════════════════════════════════════════════

export default function SetupWizardPage() {
    const router = useRouter()
    const { isAuthenticated, isLoading: authLoading, user } = useAuth()
    const { isRTL } = useI18n()

    // ── guard: not logged in → /login ──
    useEffect(() => {
        if (!authLoading && !isAuthenticated) router.replace('/login')
    }, [authLoading, isAuthenticated, router])

    // ── guard: already has company → / ──
    const [checking, setChecking] = useState(true)
    useEffect(() => {
        if (!isAuthenticated) return
        checkCompanyExists().then(exists => {
            if (exists) router.replace('/')
            else setChecking(false)
        })
    }, [isAuthenticated, router])

    if (authLoading || checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-gray-50">
                <div className="text-center">
                    <Image src="/logo.jpeg" alt="Tamkeen" width={56} height={56} priority className="rounded-2xl mx-auto mb-4 animate-pulse shadow-lg" />
                    <div className="w-8 h-8 border-[3px] border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-400">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
                </div>
            </div>
        )
    }

    return <WizardForm isRTL={isRTL} userName={user?.full_name} />
}

// ═══════════════════════════════════════════════════════════════════════
// Wizard Form (3 Steps)
// ═══════════════════════════════════════════════════════════════════════

const STEPS = [
    { labelEn: 'Company Info', labelAr: 'بيانات الشركة', icon: Building2 },
    { labelEn: 'Location', labelAr: 'الموقع والعملة', icon: Globe },
    { labelEn: 'Confirm', labelAr: 'التأكيد', icon: CheckCircle2 },
]

function WizardForm({ isRTL, userName }: { isRTL: boolean; userName?: string }) {
    const router = useRouter()
    const [step, setStep] = useState(0)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    // Form state
    const [companyName, setCompanyName] = useState('')
    const [abbr, setAbbr] = useState('')
    const [country, setCountry] = useState('Saudi Arabia')
    const [currency, setCurrency] = useState('SAR')
    const [countrySearch, setCountrySearch] = useState('')

    // Auto-generate abbreviation from company name
    const updateCompanyName = useCallback((name: string) => {
        setCompanyName(name)
        if (name.trim()) {
            const words = name.trim().split(/\s+/)
            const autoAbbr = words.length >= 2
                ? words.map(w => w[0]).join('').toUpperCase().slice(0, 5)
                : name.trim().slice(0, 3).toUpperCase()
            setAbbr(autoAbbr)
        }
    }, [])

    // Auto-fill currency when country changes
    const updateCountry = useCallback((c: string) => {
        setCountry(c)
        const curr = COUNTRY_CURRENCY[c]
        if (curr) setCurrency(curr)
    }, [])

    // Validation
    const step1Valid = companyName.trim().length >= 2 && abbr.trim().length >= 1
    const step2Valid = country.length > 0 && currency.length >= 2
    const canNext = step === 0 ? step1Valid : step === 1 ? step2Valid : true

    // Navigation
    const next = () => { setError(''); if (step < 2) setStep(s => s + 1) }
    const prev = () => { setError(''); if (step > 0) setStep(s => s - 1) }

    // Submit
    const handleSubmit = async () => {
        setSubmitting(true)
        setError('')
        try {
            const data: CompanyData = {
                company_name: companyName.trim(),
                abbr: abbr.trim().toUpperCase(),
                country,
                default_currency: currency,
            }
            await createCompany(data)
            router.replace('/')
        } catch (e: any) {
            setError(e.message || (isRTL ? 'فشل إنشاء الشركة' : 'Failed to create company'))
            setSubmitting(false)
        }
    }

    const progress = ((step + 1) / STEPS.length) * 100

    // Filtered countries for search
    const filteredCountries = countrySearch.trim()
        ? COUNTRIES.filter(c => {
            const q = countrySearch.toLowerCase()
            return c.toLowerCase().includes(q) || (COUNTRY_AR[c] || '').includes(countrySearch)
        })
        : COUNTRIES

    // Arrows based on direction
    const NextIcon = isRTL ? ChevronLeft : ChevronRight
    const PrevIcon = isRTL ? ChevronRight : ChevronLeft
    const ArrowNext = isRTL ? ArrowLeft : ArrowRight

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Header */}
            <header className="border-b border-gray-200/60 bg-white/80 backdrop-blur-sm">
                <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Image src="/logo.jpeg" alt="Tamkeen" width={32} height={32} className="rounded-xl shadow" />
                        <span className="font-semibold text-gray-800 text-sm">{isRTL ? 'إعداد النظام' : 'System Setup'}</span>
                    </div>
                    {userName && (
                        <span className="text-xs text-gray-400">
                            {isRTL ? `مرحباً ${userName}` : `Welcome ${userName}`}
                        </span>
                    )}
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-6 py-10">
                {/* Step indicators */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                        {STEPS.map((s, i) => {
                            const Icon = s.icon
                            const isActive = i === step
                            const isDone = i < step
                            return (
                                <div key={i} className="flex items-center gap-2">
                                    <div className={cn(
                                        'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300',
                                        isActive && 'bg-teal-600 text-white shadow-lg shadow-teal-200 scale-110',
                                        isDone && 'bg-teal-100 text-teal-700',
                                        !isActive && !isDone && 'bg-gray-100 text-gray-400',
                                    )}>
                                        {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                                    </div>
                                    <span className={cn(
                                        'text-xs font-medium hidden sm:inline transition-colors',
                                        isActive ? 'text-teal-700' : isDone ? 'text-teal-600' : 'text-gray-400',
                                    )}>
                                        {isRTL ? s.labelAr : s.labelEn}
                                    </span>
                                    {i < STEPS.length - 1 && (
                                        <div className={cn(
                                            'h-px w-8 sm:w-16 mx-1',
                                            i < step ? 'bg-teal-300' : 'bg-gray-200',
                                        )} />
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    <Progress value={progress} className="h-1.5 bg-gray-100" />
                </div>

                {/* Card */}
                <Card className="shadow-xl shadow-gray-200/50 border-gray-200/60">
                    <CardContent className="p-8">
                        {/* ── Step 1: Company Info ── */}
                        {step === 0 && (
                            <div className="space-y-6">
                                <div className="text-center mb-2">
                                    <div className="w-14 h-14 rounded-2xl bg-teal-50 flex items-center justify-center mx-auto mb-3">
                                        <Building2 className="h-7 w-7 text-teal-600" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-800">
                                        {isRTL ? 'بيانات الشركة' : 'Company Information'}
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {isRTL ? 'أدخل اسم الشركة والاختصار' : 'Enter your company name and abbreviation'}
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-700">
                                            {isRTL ? 'اسم الشركة' : 'Company Name'} <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            value={companyName}
                                            onChange={e => updateCompanyName(e.target.value)}
                                            placeholder={isRTL ? 'مثال: شركة مينا للتجارة' : 'e.g. Meena Trading Co.'}
                                            className="mt-1.5 h-11"
                                            autoFocus
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-sm font-semibold text-gray-700">
                                            {isRTL ? 'الاختصار' : 'Abbreviation'} <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            value={abbr}
                                            onChange={e => setAbbr(e.target.value.toUpperCase())}
                                            placeholder={isRTL ? 'مثال: MTC' : 'e.g. MTC'}
                                            maxLength={5}
                                            className="mt-1.5 h-11 font-mono tracking-wider uppercase"
                                        />
                                        <p className="text-xs text-gray-400 mt-1">
                                            {isRTL ? 'يُستخدم في أكواد المستودعات والحسابات' : 'Used in warehouse & account codes'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Step 2: Country & Currency ── */}
                        {step === 1 && (
                            <div className="space-y-6">
                                <div className="text-center mb-2">
                                    <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                                        <Globe className="h-7 w-7 text-blue-600" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-800">
                                        {isRTL ? 'الموقع والعملة' : 'Location & Currency'}
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {isRTL ? 'اختر الدولة وسيتم تعبئة العملة تلقائياً' : 'Select country — currency auto-fills'}
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    {/* Country search + list */}
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-700">
                                            {isRTL ? 'الدولة' : 'Country'} <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            value={countrySearch}
                                            onChange={e => setCountrySearch(e.target.value)}
                                            placeholder={isRTL ? 'ابحث عن الدولة...' : 'Search country...'}
                                            className="mt-1.5 h-10"
                                        />
                                        <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-50">
                                            {filteredCountries.map(c => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => { updateCountry(c); setCountrySearch('') }}
                                                    className={cn(
                                                        'w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors',
                                                        c === country
                                                            ? 'bg-teal-50 text-teal-800 font-medium'
                                                            : 'hover:bg-gray-50 text-gray-700',
                                                    )}
                                                >
                                                    <span>{isRTL ? (COUNTRY_AR[c] || c) : c}</span>
                                                    <span className="text-xs text-gray-400 font-mono">{COUNTRY_CURRENCY[c]}</span>
                                                </button>
                                            ))}
                                            {filteredCountries.length === 0 && (
                                                <p className="text-center py-4 text-xs text-gray-400">
                                                    {isRTL ? 'لا توجد نتائج' : 'No results'}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Currency (auto-filled) */}
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-700">
                                            {isRTL ? 'العملة' : 'Currency'} <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            value={currency}
                                            onChange={e => setCurrency(e.target.value.toUpperCase())}
                                            className="mt-1.5 h-11 font-mono tracking-wider"
                                            maxLength={3}
                                        />
                                        <p className="text-xs text-gray-400 mt-1">
                                            {isRTL ? 'تعبئة تلقائية — يمكنك التعديل يدوياً' : 'Auto-filled — you can override manually'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Step 3: Confirmation ── */}
                        {step === 2 && (
                            <div className="space-y-6">
                                <div className="text-center mb-2">
                                    <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-3">
                                        <Sparkles className="h-7 w-7 text-green-600" />
                                    </div>
                                    <h2 className="text-xl font-bold text-gray-800">
                                        {isRTL ? 'مراجعة وتأكيد' : 'Review & Confirm'}
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {isRTL ? 'تأكد من البيانات قبل الإنشاء' : 'Verify details before creating'}
                                    </p>
                                </div>

                                <div className="rounded-xl bg-gray-50 border border-gray-200/80 divide-y divide-gray-200/60">
                                    {[
                                        { labelEn: 'Company Name', labelAr: 'اسم الشركة', value: companyName },
                                        { labelEn: 'Abbreviation', labelAr: 'الاختصار', value: abbr.toUpperCase() },
                                        { labelEn: 'Country', labelAr: 'الدولة', value: isRTL ? (COUNTRY_AR[country] || country) : country },
                                        { labelEn: 'Currency', labelAr: 'العملة', value: currency },
                                        { labelEn: 'Chart of Accounts', labelAr: 'شجرة الحسابات', value: 'Standard' },
                                    ].map((row, i) => (
                                        <div key={i} className="flex items-center justify-between px-5 py-3.5">
                                            <span className="text-sm text-gray-500">{isRTL ? row.labelAr : row.labelEn}</span>
                                            <span className="text-sm font-semibold text-gray-800">{row.value}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                                    {isRTL
                                        ? '⚠️ عند إنشاء الشركة سيتم تلقائياً إنشاء: شجرة حسابات، مستودعات افتراضية، سنة مالية، ومركز تكلفة.'
                                        : '⚠️ Creating the company automatically generates: Chart of Accounts, default Warehouses, Fiscal Year, and Cost Center.'}
                                </div>

                                {error && (
                                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                                        {error}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Navigation buttons ── */}
                        <div className={cn('flex items-center mt-8', step === 0 ? 'justify-end' : 'justify-between')}>
                            {step > 0 && (
                                <Button variant="outline" onClick={prev} disabled={submitting} className="gap-1.5">
                                    <PrevIcon className="h-4 w-4" />
                                    {isRTL ? 'السابق' : 'Back'}
                                </Button>
                            )}

                            {step < 2 ? (
                                <Button
                                    onClick={next}
                                    disabled={!canNext}
                                    className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
                                >
                                    {isRTL ? 'التالي' : 'Next'}
                                    <NextIcon className="h-4 w-4" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                    className="bg-teal-600 hover:bg-teal-700 text-white gap-2 px-6"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            {isRTL ? 'جاري الإنشاء...' : 'Creating...'}
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4" />
                                            {isRTL ? 'إنشاء الشركة' : 'Create Company'}
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Footer hint */}
                <p className="text-center text-xs text-gray-400 mt-6">
                    {isRTL
                        ? 'يمكنك تعديل هذه الإعدادات لاحقاً من لوحة الإدارة'
                        : 'You can change these settings later from the admin panel'}
                </p>
            </main>
        </div>
    )
}
