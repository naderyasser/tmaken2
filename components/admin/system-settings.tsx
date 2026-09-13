'use client'

import { useState, useEffect, useCallback } from 'react'
import { frappeClient, SystemSettings, AdminOptions, SystemInfo } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
    Settings, Shield, Languages, Save, Loader2, ToggleLeft, ToggleRight,
    RefreshCw, Lock, Users, Globe, Server, Clock, Calendar, Hash,
    ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Eye, EyeOff,
    KeyRound, Smartphone, Timer, Fingerprint,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type SettingsSection = 'general' | 'formatting' | 'security'

export function AdminSystemSettings() {
    const { isRTL } = useI18n()
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [apiError, setApiError] = useState(false)
    const [saving, setSaving] = useState(false)
    const [activeSection, setActiveSection] = useState<SettingsSection>('general')
    const [hasChanges, setHasChanges] = useState(false)

    const [settings, setSettings] = useState<SystemSettings>({} as SystemSettings)
    const [originalSettings, setOriginalSettings] = useState<SystemSettings>({} as SystemSettings)
    const [options, setOptions] = useState<AdminOptions>({ languages: [], roles: [], date_formats: [], time_formats: [], number_formats: [], first_day_options: [] })
    const [systemInfo, setSystemInfo] = useState<SystemInfo>({} as SystemInfo)

    const loadSettings = useCallback(async () => {
        setLoading(true)
        setApiError(false)
        try {
            const results = await Promise.allSettled([
                frappeClient.getSystemSettings(),
                frappeClient.getAdminOptions(),
                frappeClient.getSystemInfo(),
            ])
            const anySucceeded = results.some(r => r.status === 'fulfilled')
            if (!anySucceeded) {
                throw new Error('All API calls failed')
            }
            if (results[0].status === 'fulfilled') {
                setSettings(results[0].value)
                setOriginalSettings(results[0].value)
            }
            if (results[1].status === 'fulfilled') setOptions(results[1].value)
            if (results[2].status === 'fulfilled') setSystemInfo(results[2].value)
        } catch (error) {
            console.error('Error loading settings:', error)
            setApiError(true)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadSettings() }, [loadSettings])

    const updateField = (field: keyof SystemSettings, value: string | number) => {
        setSettings(prev => ({ ...prev, [field]: value }))
        setHasChanges(true)
    }

    const toggleField = (field: keyof SystemSettings) => {
        setSettings(prev => ({ ...prev, [field]: prev[field] ? 0 : 1 }))
        setHasChanges(true)
    }

    const handleSave = async () => {
        // Validate session expiry format
        if (settings.session_expiry && !/^\d{1,2}:\d{2}$/.test(settings.session_expiry)) {
            toast({ title: isRTL ? 'خطأ في التحقق' : 'Validation Error', description: isRTL ? 'صيغة مدة الجلسة غير صحيحة (HH:MM)' : 'Invalid session expiry format (HH:MM)', variant: 'destructive' })
            return
        }
        setSaving(true)
        try {
            // Only send changed fields
            const changed: Partial<SystemSettings> = {}
            for (const key of Object.keys(settings) as (keyof SystemSettings)[]) {
                if (settings[key] !== originalSettings[key]) {
                    (changed as Record<string, unknown>)[key] = settings[key]
                }
            }
            if (Object.keys(changed).length === 0) {
                toast({ title: isRTL ? 'لا تغييرات' : 'No changes' })
                setSaving(false)
                return
            }
            const result = await frappeClient.updateSystemSettings(changed)
            if (result.success) {
                setOriginalSettings({ ...settings })
                setHasChanges(false)
                toast({ title: isRTL ? 'تم الحفظ بنجاح' : 'Settings saved', description: isRTL ? 'تم تحديث إعدادات النظام' : 'System settings updated' })
            } else {
                toast({ title: isRTL ? 'خطأ' : 'Error', variant: 'destructive' })
            }
        } catch (error) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: String(error), variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    const handleReset = () => {
        setSettings({ ...originalSettings })
        setHasChanges(false)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">{isRTL ? 'جاري تحميل الإعدادات...' : 'Loading settings...'}</p>
                </div>
            </div>
        )
    }

    if (apiError) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                    <Shield className="h-10 w-10 text-red-300 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-red-800 mb-1">{isRTL ? 'تعذر تحميل الإعدادات' : 'Failed to Load Settings'}</h3>
                    <p className="text-xs text-red-600 mb-3">{isRTL ? 'تأكد من تحديث التطبيق على السيرفر ومن صلاحياتك' : 'Make sure the backend app is updated on the server and you have sufficient permissions'}</p>
                    <Button variant="outline" size="sm" onClick={loadSettings} className="gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" />
                        {isRTL ? 'إعادة المحاولة' : 'Retry'}
                    </Button>
                </div>
            </div>
        )
    }

    const sections: { id: SettingsSection; label: string; labelAr: string; icon: typeof Settings }[] = [
        { id: 'general', label: 'General', labelAr: 'عام', icon: Globe },
        { id: 'formatting', label: 'Formatting', labelAr: 'التنسيق', icon: Calendar },
        { id: 'security', label: 'Security & Login', labelAr: 'الأمان وتسجيل الدخول', icon: Shield },
    ]

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Settings className="h-5 w-5 text-gray-600" />
                        {isRTL ? 'إعدادات النظام' : 'System Settings'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">{isRTL ? 'تحكم كامل في إعدادات النظام والأمان' : 'Full control over system and security settings'}</p>
                </div>
                <div className="flex items-center gap-2">
                    {hasChanges && (
                        <Button variant="ghost" size="sm" onClick={handleReset} className="text-gray-500">
                            {isRTL ? 'تراجع' : 'Reset'}
                        </Button>
                    )}
                    <Button onClick={handleSave} disabled={saving || !hasChanges} size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {isRTL ? 'حفظ التغييرات' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            {/* System Info Cards */}
            {systemInfo.total_users !== undefined && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <InfoCard icon={Users} iconColor="text-blue-500" label={isRTL ? 'المستخدمين' : 'Users'} value={`${systemInfo.active_users}/${systemInfo.total_users}`} />
                    <InfoCard icon={Users} iconColor="text-green-500" label={isRTL ? 'الموظفين' : 'Employees'} value={`${systemInfo.active_employees}/${systemInfo.total_employees}`} />
                    <InfoCard icon={Server} iconColor="text-purple-500" label="Platform" value={systemInfo.frappe_version} />
                    <InfoCard icon={Globe} iconColor="text-cyan-500" label={isRTL ? 'الموقع' : 'Site'} value={systemInfo.site_name} truncate />
                </div>
            )}

            {/* Section Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                {sections.map(s => (
                    <button
                        key={s.id}
                        onClick={() => setActiveSection(s.id)}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-3 rounded-md transition-all',
                            activeSection === s.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        )}
                    >
                        <s.icon className="h-3.5 w-3.5" />
                        {isRTL ? s.labelAr : s.label}
                    </button>
                ))}
            </div>

            {/* General Settings */}
            {activeSection === 'general' && (
                <div className="space-y-4">
                    <SettingsCard title={isRTL ? 'اللغة والمنطقة' : 'Language & Region'} icon={Languages}>
                        <SelectField label={isRTL ? 'اللغة الافتراضية' : 'Default Language'} value={settings.language}
                            options={options.languages.map(l => ({ value: l.value, label: `${l.label} (${l.value})` }))}
                            onChange={v => updateField('language', v)} />
                        <TextField label={isRTL ? 'الدولة' : 'Country'} value={settings.country} disabled hint={isRTL ? 'غير قابل للتعديل من هنا' : 'Not editable from here'} />
                        <TextField label={isRTL ? 'العملة' : 'Currency'} value={settings.currency} disabled hint={isRTL ? 'غير قابل للتعديل من هنا' : 'Not editable from here'} />
                        <TextField label={isRTL ? 'المنطقة الزمنية' : 'Timezone'} value={settings.time_zone || ''}
                            onChange={v => updateField('time_zone', v)}
                            hint={isRTL ? 'مثال: Asia/Riyadh' : 'e.g., Asia/Riyadh'} />
                    </SettingsCard>
                </div>
            )}

            {/* Formatting Settings */}
            {activeSection === 'formatting' && (
                <div className="space-y-4">
                    <SettingsCard title={isRTL ? 'تنسيق التاريخ والوقت' : 'Date & Time Format'} icon={Calendar}>
                        <SelectField label={isRTL ? 'تنسيق التاريخ' : 'Date Format'} value={settings.date_format}
                            options={options.date_formats.map(f => ({ value: f, label: f }))}
                            onChange={v => updateField('date_format', v)} />
                        <SelectField label={isRTL ? 'تنسيق الوقت' : 'Time Format'} value={settings.time_format}
                            options={options.time_formats.map(f => ({ value: f, label: f }))}
                            onChange={v => updateField('time_format', v)} />
                        <SelectField label={isRTL ? 'أول يوم في الأسبوع' : 'First Day of Week'} value={settings.first_day_of_the_week}
                            options={options.first_day_options.map(d => ({ value: d, label: d }))}
                            onChange={v => updateField('first_day_of_the_week', v)} />
                    </SettingsCard>
                    <SettingsCard title={isRTL ? 'تنسيق الأرقام' : 'Number Format'} icon={Hash}>
                        <SelectField label={isRTL ? 'تنسيق الأرقام' : 'Number Format'} value={settings.number_format}
                            options={options.number_formats.map(f => ({ value: f, label: f }))}
                            onChange={v => updateField('number_format', v)} />
                        <SelectField label={isRTL ? 'دقة الأرقام العشرية' : 'Float Precision'} value={settings.float_precision}
                            options={['2', '3', '4', '5', '6'].map(p => ({ value: p, label: `${p} ${isRTL ? 'خانات' : 'digits'}` }))}
                            onChange={v => updateField('float_precision', v)} />
                        <TextField label={isRTL ? 'دقة العملة' : 'Currency Precision'} value={settings.currency_precision || ''}
                            onChange={v => updateField('currency_precision', v)}
                            hint={isRTL ? 'اتركه فارغ لاستخدام القيمة الافتراضية' : 'Leave empty for default'} />
                    </SettingsCard>
                </div>
            )}

            {/* Security Settings */}
            {activeSection === 'security' && (
                <div className="space-y-4">
                    <SettingsCard title={isRTL ? 'الجلسات' : 'Sessions'} icon={Timer}>
                        <TextField label={isRTL ? 'مدة انتهاء الجلسة' : 'Session Expiry'} value={settings.session_expiry}
                            onChange={v => updateField('session_expiry', v)}
                            hint={isRTL ? 'مثال: 06:00 (ساعات:دقائق)' : 'Format: HH:MM'}
                            error={settings.session_expiry && !/^\d{1,2}:\d{2}$/.test(settings.session_expiry) ? (isRTL ? 'الصيغة غير صحيحة (HH:MM)' : 'Invalid format (HH:MM)') : undefined} />
                        <ToggleField label={isRTL ? 'جلسة واحدة لكل مستخدم' : 'One session per user'}
                            description={isRTL ? 'منع تسجيل دخول متعدد لنفس المستخدم' : 'Prevent multiple login sessions'}
                            enabled={!!settings.deny_multiple_sessions} onToggle={() => toggleField('deny_multiple_sessions')} />
                        <ToggleField label={isRTL ? 'تسجيل خروج عند تغيير كلمة المرور' : 'Logout on password reset'}
                            description={isRTL ? 'تسجيل خروج جميع الجلسات عند إعادة تعيين كلمة المرور' : 'Logout all sessions on password change'}
                            enabled={!!settings.logout_on_password_reset} onToggle={() => toggleField('logout_on_password_reset')} />
                    </SettingsCard>

                    <SettingsCard title={isRTL ? 'طرق تسجيل الدخول' : 'Login Methods'} icon={KeyRound}>
                        <ToggleField label={isRTL ? 'تسجيل الدخول برقم الجوال' : 'Login with mobile number'}
                            description={isRTL ? 'السماح بتسجيل الدخول باستخدام رقم الهاتف' : 'Allow login using phone number'}
                            enabled={!!settings.allow_login_using_mobile_number} onToggle={() => toggleField('allow_login_using_mobile_number')} />
                        <ToggleField label={isRTL ? 'تسجيل الدخول باسم المستخدم' : 'Login with username'}
                            description={isRTL ? 'السماح بتسجيل الدخول باسم المستخدم بدلاً من البريد' : 'Allow login using username instead of email'}
                            enabled={!!settings.allow_login_using_user_name} onToggle={() => toggleField('allow_login_using_user_name')} />
                        <ToggleField label={isRTL ? 'تعطيل تسجيل الدخول بكلمة المرور' : 'Disable password login'}
                            description={isRTL ? 'تعطيل تسجيل الدخول باسم المستخدم وكلمة المرور (يبقى فقط طرق أخرى)' : 'Disable username/password login (keep only other methods)'}
                            enabled={!!settings.disable_user_pass_login} onToggle={() => toggleField('disable_user_pass_login')}
                            danger />
                    </SettingsCard>

                    <SettingsCard title={isRTL ? 'المصادقة الثنائية وأمان كلمة المرور' : 'Two-Factor Auth & Password Security'} icon={Fingerprint}>
                        <ToggleField label={isRTL ? 'تفعيل المصادقة الثنائية' : 'Enable Two-Factor Auth (2FA)'}
                            description={isRTL ? 'طلب رمز تحقق إضافي عند تسجيل الدخول' : 'Require additional verification code on login'}
                            enabled={!!settings.enable_two_factor_auth} onToggle={() => toggleField('enable_two_factor_auth')} />
                        <TextField label={isRTL ? 'محاولات تسجيل الدخول المسموحة' : 'Allowed login attempts'}
                            value={String(settings.allow_consecutive_login_attempts || 3)}
                            onChange={v => updateField('allow_consecutive_login_attempts', parseInt(v) || 3)}
                            hint={isRTL ? 'عدد المحاولات قبل القفل المؤقت' : 'Attempts before temporary lockout'}
                            type="number" min="1" max="100" />
                        <TextField label={isRTL ? 'مدة القفل بعد الفشل (ثواني)' : 'Lockout duration (seconds)'}
                            value={String(settings.allow_login_after_fail || 60)}
                            onChange={v => updateField('allow_login_after_fail', parseInt(v) || 60)}
                            hint={isRTL ? 'المدة بالثواني بعد تجاوز عدد المحاولات' : 'Seconds to wait after max attempts exceeded'}
                            type="number" min="0" max="86400" />
                        <TextField label={isRTL ? 'إجبار على تغيير كلمة المرور كل (أيام)' : 'Force password reset every (days)'}
                            value={String(settings.force_user_to_reset_password || 0)}
                            onChange={v => updateField('force_user_to_reset_password', parseInt(v) || 0)}
                            hint={isRTL ? '0 = معطل' : '0 = disabled'}
                            type="number" min="0" max="365" />
                    </SettingsCard>

                    {/* Warning for dangerous settings */}
                    {(settings.disable_user_pass_login || settings.enable_two_factor_auth) && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
                            <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700">
                                {isRTL
                                    ? 'تحذير: تغيير إعدادات الأمان قد يمنع المستخدمين من تسجيل الدخول. تأكد من وجود طريقة بديلة للوصول.'
                                    : 'Warning: Changing security settings may prevent users from logging in. Ensure alternative access methods are in place.'
                                }
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ==================== Reusable Sub-Components ====================

function InfoCard({ icon: Icon, iconColor, label, value, truncate }: { icon: typeof Users; iconColor: string; label: string; value: string | number; truncate?: boolean }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-3">
            <div className="flex items-center gap-2 mb-1">
                <Icon className={cn('h-3.5 w-3.5', iconColor)} />
                <span className="text-[10px] font-medium text-gray-400 uppercase">{label}</span>
            </div>
            <p className={cn('text-sm font-bold text-gray-900', truncate && 'truncate')}>{value}</p>
        </div>
    )
}

function SettingsCard({ title, icon: Icon, children }: { title: string; icon: typeof Settings; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-3.5 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-indigo-500" />
                    {title}
                </h3>
            </div>
            <div className="p-4 space-y-4">{children}</div>
        </div>
    )
}

function SelectField({ label, value, options, onChange, placeholder }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <label className="text-sm text-gray-700 font-medium shrink-0">{label}</label>
            <select value={value || ''} onChange={e => onChange(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 max-w-[220px] w-full">
                {(!value || !options.find(o => o.value === value)) && (
                    <option value={value || ''} disabled>{value || placeholder || '— Select —'}</option>
                )}
                {options.map((o, i) => <option key={`${o.value}-${i}`} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    )
}

function TextField({ label, value, onChange, hint, disabled, type = 'text', min, max, error }: { label: string; value: string; onChange?: (v: string) => void; hint?: string; disabled?: boolean; type?: string; min?: string; max?: string; error?: string }) {
    return (
        <div>
            <div className="flex items-center justify-between gap-4">
                <label className="text-sm text-gray-700 font-medium shrink-0">{label}</label>
                <input type={type} value={value} onChange={e => onChange?.(e.target.value)} disabled={disabled} min={min} max={max}
                    className={cn('text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 max-w-[220px] w-full', disabled && 'bg-gray-50 text-gray-400 cursor-not-allowed', error ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-gray-200')} />
            </div>
            {error && <p className="text-[10px] text-red-500 mt-0.5 text-end">{error}</p>}
            {hint && !error && <p className="text-[10px] text-gray-400 mt-0.5 text-end">{hint}</p>}
        </div>
    )
}

function ToggleField({ label, description, enabled, onToggle, danger }: { label: string; description?: string; enabled: boolean; onToggle: () => void; danger?: boolean }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', danger && enabled ? 'text-red-700' : 'text-gray-700')}>{label}</p>
                {description && <p className="text-[10px] text-gray-400 mt-0.5">{description}</p>}
            </div>
            <button onClick={onToggle} className="flex items-center shrink-0">
                {enabled
                    ? <ToggleRight className={cn('h-7 w-7', danger ? 'text-red-500' : 'text-indigo-600')} />
                    : <ToggleLeft className="h-7 w-7 text-gray-300" />
                }
            </button>
        </div>
    )
}
