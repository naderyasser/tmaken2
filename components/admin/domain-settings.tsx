'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { frappeClient, TenantSite, CreateSiteParams, SiteProvisionState } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
    Globe,
    Plus,
    Trash2,
    Power,
    PowerOff,
    Loader2,
    ExternalLink,
    Server,
    Link2,
    AlertTriangle,
    MessageSquare,
    X,
    RefreshCw,
    LayoutGrid,
    List as ListIcon,
    Palette,
    Upload,
    Users,
    UserPlus,
    Copy,
    Check,
    Eye,
    EyeOff,
    Smartphone,
    Fingerprint,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog'

// The base domain every tenant subdomain is served under. Kept as a single
// constant so the "Open Site" link and any future URL building stay in sync.
const BASE_DOMAIN = 'base.meena.sa'

// Mirrors the server-side validation (domain_manager.api.DOMAIN_RE /
// site_creator.api.SUBDOMAIN_RE) so the UI can reject bad input before any
// network round-trip. Backend still re-validates — this is UX, not security.
const DOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const SUBDOMAIN_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/
const MIN_PASSWORD_LEN = 8

// Provisioning a tenant needs MariaDB root plus passwordless `sudo mv/nginx/certbot`,
// so `site_creator` lives on the control plane only and is deliberately NOT installed
// here. A tenant admin therefore cannot self-serve a copy; they raise a request with
// the operator, who provisions it. This panel is what they see instead of the
// developer-facing "app not installed" notice.
const OPERATOR_WHATSAPP = '966553275000'

const COPYABLE_MODULES: { id: string; ar: string; en: string }[] = [
    { id: 'cashier', ar: 'المبيعات', en: 'Sales' },
    { id: 'accounting', ar: 'المحاسبة', en: 'Accounting' },
    { id: 'inventory', ar: 'المخزون', en: 'Inventory' },
    { id: 'hr', ar: 'الموارد البشرية', en: 'Human Resources' },
    { id: 'purchases', ar: 'المشتريات', en: 'Purchases' },
    { id: 'admin', ar: 'إدارة النظام', en: 'System Administration' },
]

function RequestSiteCopyPanel({ isRTL, currentHost }: { isRTL: boolean; currentHost: string }) {
    const [displayName, setDisplayName] = useState('')
    const [subdomain, setSubdomain] = useState('')
    const [modules, setModules] = useState<string[]>(['cashier', 'accounting'])
    const [notes, setNotes] = useState('')
    const [copied, setCopied] = useState(false)

    const nameError = displayName.trim().length === 0
    const subdomainError = subdomain.trim().length > 0 && !SUBDOMAIN_RE.test(subdomain.trim())
    const canSubmit = !nameError && subdomain.trim().length > 0 && !subdomainError && modules.length > 0

    const toggleModule = (id: string) =>
        setModules(prev => (prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]))

    const requestText = [
        isRTL ? 'طلب نسخة جديدة من النظام' : 'New system copy request',
        `${isRTL ? 'الاسم' : 'Name'}: ${displayName.trim()}`,
        `${isRTL ? 'العنوان' : 'Address'}: ${subdomain.trim()}.${BASE_DOMAIN}`,
        `${isRTL ? 'الأنظمة' : 'Modules'}: ${modules
            .map(id => COPYABLE_MODULES.find(m => m.id === id))
            .filter(Boolean)
            .map(m => (isRTL ? m!.ar : m!.en))
            .join('، ')}`,
        `${isRTL ? 'منسوخة عن' : 'Copy of'}: ${currentHost}`,
        notes.trim() ? `${isRTL ? 'ملاحظات' : 'Notes'}: ${notes.trim()}` : '',
    ].filter(Boolean).join('\n')

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(requestText)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch {
            /* clipboard blocked — the WhatsApp button still works */
        }
    }

    const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500'

    return (
        <div className="p-6 max-w-2xl mx-auto">
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
                <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-cyan-50 flex items-center justify-center shrink-0">
                        <Globe className="h-5 w-5 text-cyan-600" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-800">
                            {isRTL ? 'نسخة جديدة من النظام' : 'New system copy'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            {isRTL
                                ? 'افتح فرعاً أو شركة جديدة بنفس إعدادات هذه النسخة — الأنظمة ودليل الحسابات والضريبة — وبمخزون وحسابات فارغة.'
                                : 'Open a new branch or company with this copy’s setup — modules, chart of accounts and VAT — starting with empty stock and books.'}
                        </p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            {isRTL ? 'اسم النسخة' : 'Copy name'}
                        </label>
                        <input
                            className={inputCls}
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            placeholder={isRTL ? 'مثال: القرعاوي — فرع الرياض' : 'e.g. Qarawi — Riyadh branch'}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            {isRTL ? 'العنوان المطلوب' : 'Preferred address'}
                        </label>
                        <div className="flex items-center gap-2" dir="ltr">
                            <input
                                className={`${inputCls} text-left`}
                                value={subdomain}
                                onChange={e => setSubdomain(e.target.value.toLowerCase())}
                                placeholder="qarawi-riyadh"
                            />
                            <span className="text-xs text-gray-400 shrink-0 font-mono">.{BASE_DOMAIN}</span>
                        </div>
                        {subdomainError && (
                            <p className="text-[11px] text-red-600 mt-1">
                                {isRTL
                                    ? 'حروف إنجليزية صغيرة وأرقام وشرطات فقط، ولا تبدأ أو تنتهي بشرطة.'
                                    : 'Lowercase letters, digits and hyphens only; cannot start or end with a hyphen.'}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            {isRTL ? 'الأنظمة المطلوبة' : 'Modules needed'}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {COPYABLE_MODULES.map(m => {
                                const on = modules.includes(m.id)
                                return (
                                    <button
                                        key={m.id}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => toggleModule(m.id)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${on
                                            ? 'bg-cyan-50 border-cyan-300 text-cyan-700'
                                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}
                                    >
                                        {isRTL ? m.ar : m.en}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            {isRTL ? 'ملاحظات (اختياري)' : 'Notes (optional)'}
                        </label>
                        <textarea
                            className={`${inputCls} min-h-[70px] resize-y`}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder={isRTL ? 'أي تفاصيل تساعد المشغّل على تجهيز النسخة.' : 'Anything that helps the operator set it up.'}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button
                        disabled={!canSubmit}
                        onClick={() => window.open(`https://wa.me/${OPERATOR_WHATSAPP}?text=${encodeURIComponent(requestText)}`, '_blank')}
                        className="gap-1.5 bg-cyan-600 hover:bg-cyan-700"
                    >
                        <Smartphone className="h-3.5 w-3.5" />
                        {isRTL ? 'إرسال الطلب' : 'Send request'}
                    </Button>
                    <Button variant="outline" disabled={!canSubmit} onClick={handleCopy} className="gap-1.5">
                        {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? (isRTL ? 'تم النسخ' : 'Copied') : (isRTL ? 'نسخ نص الطلب' : 'Copy request')}
                    </Button>
                </div>

                <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 leading-relaxed">
                    {isRTL
                        ? 'يصل الطلب إلى مشغّل المنصة لاعتماده. تجهيز النسخة يستغرق ١٥–٢٠ دقيقة بعد الموافقة، ويصلك رابطها وبيانات الدخول.'
                        : 'The request goes to the platform operator for approval. Provisioning takes 15–20 minutes once approved; you then receive the link and credentials.'}
                </p>
            </div>
        </div>
    )
}

type CreateFormErrors = {
    fullname?: string
    email?: string
    subdomain?: string
    admin_password?: string
}

export function AdminDomainSettings() {
    const { isRTL } = useI18n()
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [apiError, setApiError] = useState(false)
    // 403 from the (System-Manager-gated) endpoints means "not authorized on the
    // control-plane site", NOT "app not installed" — tracked separately so the UI
    // shows the right guidance instead of a misleading install hint.
    const [authError, setAuthError] = useState(false)
    const [sites, setSites] = useState<TenantSite[]>([])
    const [apps, setApps] = useState<string[]>([])

    // List vs grid layout for the sites list.
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')

    // Live provisioning state, keyed by site name, layered over what list_sites returned.
    const [statusMap, setStatusMap] = useState<Record<string, SiteProvisionState>>({})

    // Effective provisioning state for a site = latest poll override, else list_sites value.
    const effState = useCallback((site: TenantSite): SiteProvisionState => {
        const o = statusMap[site.name]
        if (o) return o
        return { status: site.status || '', step: site.step ?? (site.total_steps ?? 6), ready: site.ready ?? true, failed: site.failed ?? false }
    }, [statusMap])

    const dotClass = useCallback((site: TenantSite): string => {
        const st = effState(site)
        if (st.failed) return 'bg-red-500'
        if (!st.ready) return 'bg-indigo-400 animate-pulse'
        return (site.disabled === 1 || site.disabled === true) ? 'bg-red-400' : 'bg-green-500'
    }, [effState])

    // Domain linking
    const [domainInput, setDomainInput] = useState('')
    const [domainError, setDomainError] = useState<string | null>(null)
    const [linkingDomain, setLinkingDomain] = useState(false)

    // Site creation dialog
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [creating, setCreating] = useState(false)
    const [newSite, setNewSite] = useState<CreateSiteParams>({
        fullname: '', email: '', phone: '', subdomain: '', domain: 'base.meena.sa', admin_password: '', apps: [], display_name: '',
    })
    const [formErrors, setFormErrors] = useState<CreateFormErrors>({})
    // Logo picked in the Create-Site modal (separate from the per-site branding dialog state).
    const [newLogo, setNewLogo] = useState<{ dataUrl: string; filename: string } | null>(null)
    const [newLogoError, setNewLogoError] = useState<string | null>(null)

    // Login message dialog
    const [messageDialog, setMessageDialog] = useState<{ open: boolean; site: string; message: string }>({ open: false, site: '', message: '' })

    // Delete confirmation (holds the site name pending deletion)
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)

    // Branding dialog
    const [brandingDialog, setBrandingDialog] = useState<{ open: boolean; site: string; displayName: string; currentLogo: string }>({ open: false, site: '', displayName: '', currentLogo: '' })
    const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null)  // newly-picked logo preview/payload
    const [logoFilename, setLogoFilename] = useState<string>('')
    const [brandingError, setBrandingError] = useState<string | null>(null)
    const [savingBranding, setSavingBranding] = useState(false)

    // Sales-rep (المناديب) app feature toggles — per-tenant wallet/payments/samples.
    const [repDialog, setRepDialog] = useState<{ open: boolean; site: string }>({ open: false, site: '' })
    const [repFeatures, setRepFeatures] = useState<{ wallet: boolean; payments: boolean; samples: boolean }>({ wallet: false, payments: false, samples: true })
    const [repLoading, setRepLoading] = useState(false)
    const [savingRep, setSavingRep] = useState(false)

    const openRepDialog = async (site: string) => {
        setRepDialog({ open: true, site })
        setRepLoading(true)
        try {
            const res = await frappeClient.call('tenant_manager.api.tenant_settings.get_sales_rep_features', { site })
            const f = res?.message || {}
            setRepFeatures({ wallet: !!f.wallet, payments: !!f.payments, samples: f.samples !== false })
        } catch {
            toast({ title: isRTL ? 'تعذر جلب الإعدادات' : 'Failed to load settings', variant: 'destructive' })
        } finally {
            setRepLoading(false)
        }
    }

    const saveRepFeatures = async () => {
        setSavingRep(true)
        try {
            await frappeClient.call('tenant_manager.api.tenant_settings.set_sales_rep_features', {
                site: repDialog.site,
                features: JSON.stringify(repFeatures),
            })
            toast({ title: isRTL ? 'تم الحفظ' : 'Saved', description: isRTL ? 'إعدادات تطبيق المناديب' : 'المناديب app settings' })
            setRepDialog({ open: false, site: '' })
        } catch (e: any) {
            toast({ title: isRTL ? 'فشل الحفظ' : 'Save failed', description: e?.message || '', variant: 'destructive' })
        } finally {
            setSavingRep(false)
        }
    }

    // Fingerprint-only plan toggle — trims a tenant's HR to attendance/biometric
    // screens only (backend hr_fingerprint_only flag; other modules untouched).
    // Per-site, mirrors the sales-rep dialog pattern above.
    const [fpDialog, setFpDialog] = useState<{ open: boolean; site: string }>({ open: false, site: '' })
    const [fpEnabled, setFpEnabled] = useState(false)
    const [fpLoading, setFpLoading] = useState(false)
    const [savingFp, setSavingFp] = useState(false)

    const openFpDialog = async (site: string) => {
        setFpDialog({ open: true, site })
        setFpLoading(true)
        try {
            const res = await frappeClient.call('tenant_manager.api.tenant_settings.get_fingerprint_only', { site })
            const f = res?.message || {}
            setFpEnabled(!!f.fingerprint_only)
        } catch {
            toast({ title: isRTL ? 'تعذر جلب الإعدادات' : 'Failed to load settings', variant: 'destructive' })
        } finally {
            setFpLoading(false)
        }
    }

    const saveFpOnly = async () => {
        setSavingFp(true)
        try {
            await frappeClient.call('tenant_manager.api.tenant_settings.set_fingerprint_only', {
                site: fpDialog.site,
                enabled: fpEnabled,
            })
            toast({ title: isRTL ? 'تم الحفظ' : 'Saved', description: isRTL ? 'خطة البصمة فقط (الحضور)' : 'Fingerprint-only (attendance) plan' })
            setFpDialog({ open: false, site: '' })
            loadData()
        } catch (e: any) {
            toast({ title: isRTL ? 'فشل الحفظ' : 'Save failed', description: e?.message || '', variant: 'destructive' })
        } finally {
            setSavingFp(false)
        }
    }

    const LOGO_MAX_BYTES = 512 * 1024
    const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']

    // ── Users & Permissions panel ────────────────────────────────────────────
    const MODULE_LABELS: Record<string, { en: string; ar: string }> = {
        hr: { en: 'Human Resources', ar: 'الموارد البشرية' },
        accounting: { en: 'Accounting', ar: 'المحاسبة' },
        cashier: { en: 'Sales', ar: 'المبيعات' },
        salesReps: { en: 'Sales Reps', ar: 'مندوبو المبيعات' },
        inventory: { en: 'Inventory', ar: 'المخزون' },
        purchases: { en: 'Purchases', ar: 'المشتريات' },
        realEstate: { en: 'Real Estate', ar: 'العقارات' },
    }
    const [usersDialog, setUsersDialog] = useState<{ open: boolean; site: string }>({ open: false, site: '' })
    const [availModules, setAvailModules] = useState<string[]>([])
    const [modulesLoading, setModulesLoading] = useState(false)
    const [newUser, setNewUser] = useState<{ email: string; fullName: string; username: string; password: string; modules: string[] }>({ email: '', fullName: '', username: '', password: '', modules: [] })
    const [showUserPw, setShowUserPw] = useState(false)
    const [creatingUser, setCreatingUser] = useState(false)
    const [userError, setUserError] = useState<string | null>(null)
    // Success state: the operator-set password is the credential; invite link is optional.
    const [createdUser, setCreatedUser] = useState<{ email: string; loginWith: string } | null>(null)
    const [inviteLink, setInviteLink] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)
    const [generatingInvite, setGeneratingInvite] = useState(false)

    const resetUserForm = () => {
        setNewUser({ email: '', fullName: '', username: '', password: '', modules: [] })
        setShowUserPw(false); setUserError(null); setCreatedUser(null); setInviteLink(null); setCopied(false)
    }

    const openUsersDialog = async (site: string) => {
        setUsersDialog({ open: true, site })
        resetUserForm()
        setAvailModules([]); setModulesLoading(true)
        const mods = await frappeClient.getSiteGrantableModules(site)
        setAvailModules(mods)
        setModulesLoading(false)
    }

    const closeUsersDialog = () => {
        setUsersDialog({ open: false, site: '' })
        resetUserForm()
    }

    const toggleUserModule = (m: string) => {
        setNewUser(prev => ({ ...prev, modules: prev.modules.includes(m) ? prev.modules.filter(x => x !== m) : [...prev.modules, m] }))
    }

    const handleCreateUser = async () => {
        setUserError(null)
        const email = newUser.email.trim().toLowerCase()
        const username = newUser.username.trim().toLowerCase()
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setUserError(isRTL ? 'بريد إلكتروني غير صالح' : 'Enter a valid email'); return }
        if (!newUser.fullName.trim()) { setUserError(isRTL ? 'الاسم الكامل مطلوب' : 'Full name is required'); return }
        if (newUser.password.length < 8) { setUserError(isRTL ? 'كلمة المرور 8 أحرف على الأقل' : 'Password must be at least 8 characters'); return }
        if (username && !/^[a-z0-9_.-]{3,32}$/.test(username)) { setUserError(isRTL ? 'اسم مستخدم غير صالح (أحرف صغيرة وأرقام و . _ - فقط)' : 'Invalid username (lowercase letters, numbers, . _ - only)'); return }
        if (newUser.modules.length === 0) { setUserError(isRTL ? 'اختر صلاحية واحدة على الأقل' : 'Select at least one module'); return }
        setCreatingUser(true)
        try {
            const r = await frappeClient.createTenantUser(usersDialog.site, email, newUser.fullName.trim(), newUser.modules, newUser.password, username || undefined)
            if (r.success) {
                setCreatedUser({ email, loginWith: r.login_with || username || email })
                toast({ title: isRTL ? 'تم إنشاء المستخدم' : 'User created', description: email })
            } else {
                setUserError(r.message || (isRTL ? 'تعذر إنشاء المستخدم' : 'Could not create user'))
            }
        } catch (e) {
            setUserError(String(e))
        } finally {
            setCreatingUser(false)
        }
    }

    // Optional: operator can choose to send an invite link instead of the password.
    const handleSendInvite = async () => {
        if (!createdUser) return
        setGeneratingInvite(true)
        try {
            const r = await frappeClient.regenerateTenantInvite(usersDialog.site, createdUser.email)
            if (r.success && r.invite_link) { setInviteLink(r.invite_link); toast({ title: isRTL ? 'تم إنشاء رابط الدعوة' : 'Invite link generated' }) }
            else { toast({ title: isRTL ? 'خطأ' : 'Error', description: r.message, variant: 'destructive' }) }
        } finally {
            setGeneratingInvite(false)
        }
    }

    const handleCopyInvite = async () => {
        if (!inviteLink) return
        try { await navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }
        catch { toast({ title: isRTL ? 'انسخ يدوياً' : 'Copy manually', description: inviteLink }) }
    }

    const onPickLogo = (file: File | undefined) => {
        setBrandingError(null)
        if (!file) return
        if (!LOGO_TYPES.includes(file.type)) {
            setBrandingError(isRTL ? 'الشعار يجب أن يكون PNG أو JPG أو WEBP' : 'Logo must be PNG, JPG or WEBP')
            return
        }
        if (file.size > LOGO_MAX_BYTES) {
            setBrandingError(isRTL ? 'الشعار أكبر من 512 كيلوبايت' : 'Logo exceeds 512 KB')
            return
        }
        const reader = new FileReader()
        reader.onload = () => { setLogoDataUrl(String(reader.result)); setLogoFilename(file.name) }
        reader.onerror = () => setBrandingError(isRTL ? 'تعذر قراءة الملف' : 'Could not read file')
        reader.readAsDataURL(file)
    }

    const handleSaveBranding = async () => {
        setBrandingError(null)
        setSavingBranding(true)
        try {
            const nameRes = await frappeClient.setSiteBranding(brandingDialog.site, brandingDialog.displayName.trim())
            if (!nameRes.success) {
                setBrandingError(nameRes.message || (isRTL ? 'تعذر حفظ الاسم' : 'Could not save name'))
                return
            }
            if (logoDataUrl && logoFilename) {
                const logoRes = await frappeClient.uploadSiteBrandingLogo(brandingDialog.site, logoFilename, logoDataUrl)
                if (!logoRes.success) {
                    setBrandingError(logoRes.message || (isRTL ? 'تعذر رفع الشعار' : 'Could not upload logo'))
                    return
                }
            }
            toast({ title: isRTL ? 'تم الحفظ' : 'Saved', description: isRTL ? `تم تحديث هوية ${brandingDialog.site}` : `Branding updated for ${brandingDialog.site}` })
            setBrandingDialog({ open: false, site: '', displayName: '', currentLogo: '' })
            setLogoDataUrl(null); setLogoFilename('')
            loadData()
        } catch (error) {
            setBrandingError(String(error))
        } finally {
            setSavingBranding(false)
        }
    }

    const loadData = useCallback(async () => {
        setLoading(true)
        setApiError(false)
        setAuthError(false)
        try {
            const results = await Promise.allSettled([
                frappeClient.listSites(),
                frappeClient.getInstalledApps(),
            ])
            if (results[0].status === 'fulfilled') setSites(results[0].value)
            if (results[1].status === 'fulfilled') setApps(results[1].value)
            // Distinguish auth (403) from genuinely-missing apps (404). A 403 means the
            // endpoints exist and resolve to the control-plane site, but the current
            // user isn't a System Manager there — show that, not the install hint.
            const statusOf = (r: PromiseSettledResult<unknown>) =>
                r.status === 'rejected' ? (r.reason as { status?: number })?.status : undefined
            const statuses = results.map(statusOf)
            if (statuses.some(s => s === 403)) {
                setAuthError(true)
            } else if (results.every(r => r.status === 'rejected') && statuses.every(s => s === 404)) {
                setApiError(true)
            }
        } catch (error) {
            console.error('Error loading domain data:', error)
            setApiError(true)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadData() }, [loadData])

    // Poll ONLY sites that are still provisioning (not ready, not failed) every 5s via
    // the gated batch endpoint; stop automatically when none remain. Refs keep a single
    // interval alive without re-subscribing on every state change.
    const sitesRef = useRef<TenantSite[]>([])
    const statusRef = useRef<Record<string, SiteProvisionState>>({})
    const loadDataRef = useRef(loadData)
    useEffect(() => { sitesRef.current = sites }, [sites])
    useEffect(() => { statusRef.current = statusMap }, [statusMap])
    useEffect(() => { loadDataRef.current = loadData }, [loadData])
    useEffect(() => {
        const id = setInterval(async () => {
            const pending = sitesRef.current.filter(s => {
                const o = statusRef.current[s.name]
                const ready = o ? o.ready : (s.ready ?? true)
                const failed = o ? o.failed : (s.failed ?? false)
                return !ready && !failed
            }).map(s => s.name)
            if (pending.length === 0) return
            const res = await frappeClient.getSitesStatus(pending)
            if (res && Object.keys(res).length) {
                setStatusMap(prev => ({ ...prev, ...res }))
                // When a site finishes (ready/failed), refresh the list to pick up its
                // final branding/display fields applied at the end of provisioning.
                if (Object.values(res).some(v => v.ready || v.failed)) loadDataRef.current()
            }
        }, 5000)
        return () => clearInterval(id)
    }, [])

    const handleLinkDomain = async () => {
        const domain = domainInput.trim().toLowerCase().replace(/\.$/, '')
        // Client-side format check first — gives an instant, specific error and
        // stops obviously-invalid input (spaces, symbols, HTML) before the request.
        if (!domain) {
            setDomainError(isRTL ? 'الدومين مطلوب' : 'Domain is required')
            return
        }
        if (!DOMAIN_RE.test(domain)) {
            setDomainError(isRTL
                ? 'صيغة دومين غير صالحة. مثال: my-company.com'
                : 'Invalid domain format. Example: my-company.com')
            return
        }
        if (domain.endsWith(`.${BASE_DOMAIN}`) || domain === BASE_DOMAIN) {
            setDomainError(isRTL
                ? 'يجب أن يكون دومين خارجي مخصص'
                : 'Must be an external custom domain')
            return
        }
        setDomainError(null)
        setLinkingDomain(true)
        try {
            const result = await frappeClient.linkCustomDomain(domain)
            if (result.success) {
                toast({ title: isRTL ? 'تم الربط' : 'Domain Linked', description: isRTL ? `تم ربط ${domain} بنجاح` : `${domain} linked successfully` })
                setDomainInput('')
            } else {
                setDomainError(result.message || (isRTL ? 'تعذر ربط الدومين' : 'Could not link domain'))
                toast({ title: isRTL ? 'خطأ' : 'Error', description: result.message, variant: 'destructive' })
            }
        } catch (error) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: String(error), variant: 'destructive' })
        } finally {
            setLinkingDomain(false)
        }
    }

    const handleToggleSite = async (site: string, isDisabled: boolean) => {
        try {
            const result = isDisabled
                ? await frappeClient.enableSite(site)
                : await frappeClient.disableSite(site)
            if (result.success) {
                // Fully localized — both the title and body follow the active language.
                toast({
                    title: isRTL ? 'تم التحديث' : 'Updated',
                    description: isDisabled
                        ? (isRTL ? `تم تفعيل ${site}` : `${site} enabled`)
                        : (isRTL ? `تم تعطيل ${site}` : `${site} disabled`),
                })
                loadData()
            }
        } catch (error) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: String(error), variant: 'destructive' })
        }
    }

    const handleDeleteSite = async (site: string) => {
        setDeleting(true)
        try {
            const result = await frappeClient.deleteSite(site)
            if (result.success) {
                toast({ title: isRTL ? 'تم الحذف' : 'Deleted', description: isRTL ? `تم حذف ${site}` : `${site} deleted` })
                setDeleteConfirm(null)
                loadData()
            } else {
                toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? `تعذر حذف ${site}` : `Could not delete ${site}`, variant: 'destructive' })
            }
        } catch (error) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: String(error), variant: 'destructive' })
        } finally {
            setDeleting(false)
        }
    }

    const handleUpdateLoginMessage = async () => {
        try {
            const result = await frappeClient.updateSiteLoginMessage(messageDialog.site, messageDialog.message)
            if (result.success) {
                toast({ title: isRTL ? 'تم التحديث' : 'Updated' })
                setMessageDialog({ open: false, site: '', message: '' })
                loadData()
            }
        } catch (error) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: String(error), variant: 'destructive' })
        }
    }

    const validateCreateForm = (): boolean => {
        const errors: CreateFormErrors = {}
        if (!newSite.fullname.trim()) {
            errors.fullname = isRTL ? 'الاسم الكامل مطلوب' : 'Full name is required'
        }
        if (!newSite.email.trim()) {
            errors.email = isRTL ? 'البريد الإلكتروني مطلوب' : 'Email is required'
        } else if (!EMAIL_RE.test(newSite.email.trim())) {
            errors.email = isRTL ? 'بريد إلكتروني غير صالح' : 'Enter a valid email address'
        }
        if (!newSite.subdomain.trim()) {
            errors.subdomain = isRTL ? 'الصب دومين مطلوب' : 'Subdomain is required'
        } else if (!SUBDOMAIN_RE.test(newSite.subdomain.trim())) {
            errors.subdomain = isRTL
                ? 'أحرف إنجليزية صغيرة وأرقام وشرطات فقط'
                : 'Only lowercase letters, numbers and hyphens'
        }
        if (!newSite.admin_password) {
            errors.admin_password = isRTL ? 'كلمة المرور مطلوبة' : 'Password is required'
        } else if (newSite.admin_password.length < MIN_PASSWORD_LEN) {
            errors.admin_password = isRTL
                ? `يجب ألا تقل عن ${MIN_PASSWORD_LEN} أحرف`
                : `Must be at least ${MIN_PASSWORD_LEN} characters`
        }
        setFormErrors(errors)
        return Object.keys(errors).length === 0
    }

    const onPickNewLogo = (file: File | undefined) => {
        setNewLogoError(null)
        if (!file) return
        if (!LOGO_TYPES.includes(file.type)) {
            setNewLogoError(isRTL ? 'الشعار يجب أن يكون PNG أو JPG أو WEBP' : 'Logo must be PNG, JPG or WEBP')
            return
        }
        if (file.size > LOGO_MAX_BYTES) {
            setNewLogoError(isRTL ? 'الشعار أكبر من 512 كيلوبايت' : 'Logo exceeds 512 KB')
            return
        }
        const reader = new FileReader()
        reader.onload = () => setNewLogo({ dataUrl: String(reader.result), filename: file.name })
        reader.onerror = () => setNewLogoError(isRTL ? 'تعذر قراءة الملف' : 'Could not read file')
        reader.readAsDataURL(file)
    }

    const handleCreateSite = async () => {
        if (!validateCreateForm()) {
            toast({ title: isRTL ? 'مطلوب' : 'Required', description: isRTL ? 'يرجى تصحيح الحقول المميزة' : 'Please fix the highlighted fields', variant: 'destructive' })
            return
        }
        setCreating(true)
        try {
            const payload: CreateSiteParams = {
                ...newSite,
                display_name: (newSite.display_name || '').trim(),
                ...(newLogo ? { logo_filename: newLogo.filename, logo_content: newLogo.dataUrl } : {}),
            }
            const result = await frappeClient.createSiteRequest(payload)
            if (result.success) {
                toast({ title: isRTL ? 'تم إنشاء الطلب' : 'Site Request Created', description: isRTL ? 'جاري إنشاء الموقع في الخلفية...' : 'Site is being created in the background...' })
                setShowCreateDialog(false)
                setNewSite({ fullname: '', email: '', phone: '', subdomain: '', domain: 'base.meena.sa', admin_password: '', apps: [], display_name: '' })
                setFormErrors({})
                setNewLogo(null); setNewLogoError(null)
                setTimeout(loadData, 3000)
            } else {
                toast({ title: isRTL ? 'خطأ' : 'Error', description: result.message, variant: 'destructive' })
            }
        } catch (error) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: String(error), variant: 'destructive' })
        } finally {
            setCreating(false)
        }
    }

    // Shared action buttons rendered in both list and grid layouts.
    // While a site is provisioning: disable everything (it isn't usable yet).
    // If it failed: disable everything EXCEPT Delete, so the operator can clean it up.
    const renderSiteActions = (site: TenantSite, isDisabled: boolean) => {
        const st = effState(site)
        const provisioning = !st.ready && !st.failed
        const lock = provisioning || st.failed   // non-delete actions locked unless fully ready
        return (
        <div className="flex items-center gap-1.5">
            <Button
                variant="ghost"
                size="sm"
                disabled={lock}
                onClick={() => setMessageDialog({ open: true, site: site.name, message: site.login_message || '' })}
                className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600 disabled:opacity-40"
                title={isRTL ? 'رسالة الدخول' : 'Login Message'}
            >
                <MessageSquare className="h-3.5 w-3.5" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                disabled={lock}
                onClick={() => { setBrandingDialog({ open: true, site: site.name, displayName: site.display_name || '', currentLogo: site.logo || '' }); setLogoDataUrl(null); setLogoFilename(''); setBrandingError(null) }}
                className="h-8 w-8 p-0 text-gray-400 hover:text-purple-600 disabled:opacity-40"
                title={isRTL ? 'الهوية (الاسم والشعار)' : 'Branding (name & logo)'}
            >
                <Palette className="h-3.5 w-3.5" />
            </Button>
            {site.tenant_type === 'sales' && (
            <Button
                variant="ghost"
                size="sm"
                disabled={lock}
                onClick={() => openRepDialog(site.name)}
                className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600 disabled:opacity-40"
                title={isRTL ? 'تطبيق المناديب (المحفظة، المدفوعات)' : 'المناديب app (wallet, payments)'}
            >
                <Smartphone className="h-3.5 w-3.5" />
            </Button>
            )}
            <Button
                variant="ghost"
                size="sm"
                disabled={lock}
                onClick={() => openFpDialog(site.name)}
                className="h-8 w-8 p-0 text-gray-400 hover:text-cyan-600 disabled:opacity-40"
                title={isRTL ? 'خطة البصمة فقط (الحضور)' : 'Fingerprint-only (attendance) plan'}
            >
                <Fingerprint className="h-3.5 w-3.5" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                disabled={lock}
                onClick={() => openUsersDialog(site.name)}
                className="h-8 w-8 p-0 text-gray-400 hover:text-emerald-600 disabled:opacity-40"
                title={isRTL ? 'المستخدمون والصلاحيات' : 'Users & Permissions'}
            >
                <Users className="h-3.5 w-3.5" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                disabled={lock}
                onClick={() => window.open(`https://${site.name}.${BASE_DOMAIN}`, '_blank')}
                className="h-8 w-8 p-0 text-gray-400 hover:text-indigo-600 disabled:opacity-40"
                title={lock ? (isRTL ? 'متاح بعد اكتمال التجهيز' : 'Available once provisioning completes') : (isRTL ? 'فتح الموقع' : 'Open Site')}
            >
                <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            <Button
                variant="ghost"
                size="sm"
                disabled={lock}
                onClick={() => handleToggleSite(site.name, isDisabled)}
                className={cn('h-8 w-8 p-0 disabled:opacity-40', isDisabled ? 'text-green-500 hover:text-green-600' : 'text-amber-500 hover:text-amber-600')}
                title={isDisabled ? (isRTL ? 'تفعيل' : 'Enable') : (isRTL ? 'تعطيل' : 'Disable')}
            >
                {isDisabled ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
            </Button>
            <Button
                variant="ghost"
                size="sm"
                disabled={provisioning}
                onClick={() => setDeleteConfirm(site.name)}
                className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 disabled:opacity-40"
                title={provisioning ? (isRTL ? 'لا يمكن الحذف أثناء التجهيز' : 'Cannot delete while provisioning') : (isRTL ? 'حذف' : 'Delete')}
            >
                <Trash2 className="h-3.5 w-3.5" />
            </Button>
        </div>
        )
    }

    // A compact provisioning/failed indicator (spinner + live stage + step X/N bar).
    const renderSiteState = (site: TenantSite) => {
        const st = effState(site)
        if (st.failed) {
            return (
                <div className="mt-1 flex items-start gap-1.5 text-xs text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span className="break-words">{st.status || (isRTL ? 'فشل التجهيز' : 'Provisioning failed')}</span>
                </div>
            )
        }
        if (!st.ready) {
            const total = site.total_steps ?? 6
            const pct = Math.max(8, Math.round((st.step / total) * 100))
            return (
                <div className="mt-1.5 max-w-xs">
                    <div className="flex items-center gap-1.5 text-xs text-indigo-600">
                        <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
                        <span className="truncate">{st.status || (isRTL ? 'جاري التجهيز…' : 'Provisioning…')}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-gray-400 flex-shrink-0">{isRTL ? `خطوة ${st.step}/${total}` : `step ${st.step}/${total}`}</span>
                    </div>
                </div>
            )
        }
        return null
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
                </div>
            </div>
        )
    }

    if (authError && sites.length === 0) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
                    <Globe className="h-10 w-10 text-amber-300 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">{isRTL ? 'صلاحية غير كافية' : 'Not authorized'}</h3>
                    <p className="text-xs text-gray-500 mb-4">{isRTL ? 'يجب تسجيل الدخول كـ System Manager على موقع التحكم (base.meena.sa) للوصول إلى إدارة المواقع.' : 'You must be signed in as a System Manager on the control-plane site (base.meena.sa) to manage sites.'}</p>
                    <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" />
                        {isRTL ? 'إعادة المحاولة' : 'Retry'}
                    </Button>
                </div>
            </div>
        )
    }

    if (apiError && sites.length === 0) {
        // Not an error from the tenant's point of view: this site simply is not the
        // control plane. Offer the request flow rather than bench commands.
        return (
            <RequestSiteCopyPanel
                isRTL={isRTL}
                currentHost={typeof window !== 'undefined' ? window.location.host : ''}
            />
        )
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Globe className="h-5 w-5 text-cyan-600" />
                        {isRTL ? 'إدارة الدومين والمواقع' : 'Domain & Site Management'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">{isRTL ? 'ربط الدومينات وإدارة المواقع' : 'Link domains and manage sites'}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" />
                        {isRTL ? 'تحديث' : 'Refresh'}
                    </Button>
                    <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
                        <Plus className="h-3.5 w-3.5" />
                        {isRTL ? 'موقع جديد' : 'New Site'}
                    </Button>
                </div>
            </div>

            {/* Link Custom Domain */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <Link2 className="h-4 w-4 text-indigo-600" />
                        {isRTL ? 'ربط دومين مخصص' : 'Link Custom Domain'}
                    </h3>
                </div>
                <div className="p-4">
                    <p className="text-xs text-gray-500 mb-3">
                        {isRTL
                            ? 'أضف دومين مخصص لهذا الموقع. سيتم إنشاء إعدادات Nginx وشهادة SSL تلقائياً.'
                            : 'Add a custom domain for this site. Nginx config and SSL certificates will be set up automatically.'
                        }
                    </p>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={domainInput}
                            onChange={(e) => { setDomainInput(e.target.value); if (domainError) setDomainError(null) }}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleLinkDomain() }}
                            placeholder={isRTL ? 'مثال: my-company.com' : 'e.g., my-company.com'}
                            className={cn(
                                'flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2',
                                domainError
                                    ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400'
                                    : 'border-gray-200 focus:ring-indigo-500/20 focus:border-indigo-400'
                            )}
                            dir="ltr"
                        />
                        <Button onClick={handleLinkDomain} disabled={linkingDomain} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
                            {linkingDomain ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                            {isRTL ? 'ربط' : 'Link'}
                        </Button>
                    </div>
                    {domainError && (
                        <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                            {domainError}
                        </p>
                    )}
                </div>
            </div>

            {/* Sites List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <Server className="h-4 w-4 text-gray-600" />
                        {isRTL ? 'المواقع' : 'Sites'}
                        <span className="text-xs text-gray-400 font-normal">({sites.length})</span>
                    </h3>
                    {/* List / grid view toggle */}
                    <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                        <button
                            onClick={() => setViewMode('list')}
                            className={cn(
                                'p-1.5 rounded-md transition-colors',
                                viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                            )}
                            title={isRTL ? 'عرض قائمة' : 'List view'}
                            aria-pressed={viewMode === 'list'}
                        >
                            <ListIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                'p-1.5 rounded-md transition-colors',
                                viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                            )}
                            title={isRTL ? 'عرض شبكة' : 'Grid view'}
                            aria-pressed={viewMode === 'grid'}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
                {sites.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <Server className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                        <p className="text-sm">{isRTL ? 'لا توجد مواقع' : 'No sites found'}</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {sites.map((site) => {
                            const isDisabled = site.disabled === 1 || site.disabled === true
                            return (
                                <div key={site.name} className="border border-gray-200 rounded-lg p-3 hover:border-indigo-200 hover:shadow-sm transition-all">
                                    <div className="flex items-start gap-2 mb-3">
                                        <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1', dotClass(site))} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-gray-800 truncate" dir="ltr">{site.name}</p>
                                            {site.login_message && effState(site).ready && (
                                                <p className="text-xs text-gray-400 mt-0.5 truncate">{site.login_message}</p>
                                            )}
                                            {renderSiteState(site)}
                                        </div>
                                    </div>
                                    <div className="flex justify-end">
                                        {renderSiteActions(site, isDisabled)}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {sites.map((site) => {
                            const isDisabled = site.disabled === 1 || site.disabled === true
                            return (
                                <div key={site.name} className="p-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', dotClass(site))} />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-800" dir="ltr">{site.name}</p>
                                            {site.login_message && effState(site).ready && (
                                                <p className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{site.login_message}</p>
                                            )}
                                            {renderSiteState(site)}
                                        </div>
                                    </div>
                                    {renderSiteActions(site, isDisabled)}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Login Message Dialog */}
            <Dialog open={messageDialog.open} onOpenChange={(open) => !open && setMessageDialog({ open: false, site: '', message: '' })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'رسالة تسجيل الدخول' : 'Login Message'}</DialogTitle>
                        <DialogDescription>
                            {isRTL
                                ? 'حدد رسالة تظهر لمستخدمي هذا الموقع عند تسجيل الدخول.'
                                : 'Set a message shown to this site’s users on the login screen.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <p className="text-xs text-gray-500" dir="ltr">{messageDialog.site}</p>
                        <textarea
                            value={messageDialog.message}
                            onChange={(e) => setMessageDialog(prev => ({ ...prev, message: e.target.value }))}
                            rows={3}
                            dir="auto"
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none"
                            placeholder={isRTL ? 'أدخل رسالة تسجيل الدخول...' : 'Enter login message...'}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMessageDialog({ open: false, site: '', message: '' })}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={handleUpdateLoginMessage} className="bg-indigo-600 hover:bg-indigo-700">
                            {isRTL ? 'حفظ' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Branding Dialog */}
            <Dialog open={brandingDialog.open} onOpenChange={(open) => { if (!open) { setBrandingDialog({ open: false, site: '', displayName: '', currentLogo: '' }); setLogoDataUrl(null); setLogoFilename(''); setBrandingError(null) } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Palette className="h-4 w-4 text-purple-600" />
                            {isRTL ? 'هوية الموقع' : 'Site Branding'}
                        </DialogTitle>
                        <DialogDescription>
                            {isRTL
                                ? 'يظهر هذا الاسم والشعار في صفحة تسجيل الدخول الخاصة بهذا الموقع.'
                                : 'This name and logo appear on this site’s login page.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <p className="text-xs text-gray-500" dir="ltr">{brandingDialog.site}.{BASE_DOMAIN}</p>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'الاسم المعروض' : 'Display Name'}</label>
                            <input
                                type="text"
                                value={brandingDialog.displayName}
                                onChange={(e) => setBrandingDialog(prev => ({ ...prev, displayName: e.target.value }))}
                                maxLength={100}
                                placeholder={isRTL ? 'مثال: شركة فلان' : 'e.g., Acme Corp'}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                            />
                            <p className="text-[11px] text-gray-400 mt-1">{isRTL ? 'اتركه فارغاً للرجوع للاسم الافتراضي.' : 'Leave empty to fall back to the default name.'}</p>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'الشعار' : 'Logo'}</label>
                            <div className="flex items-center gap-3">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={logoDataUrl || (brandingDialog.currentLogo || '/logo.jpeg')}
                                    alt="logo preview"
                                    className="h-12 w-12 rounded-lg object-cover border border-gray-200 bg-white"
                                />
                                <label className="cursor-pointer inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                                    <Upload className="h-3.5 w-3.5" />
                                    {isRTL ? 'اختر صورة' : 'Choose image'}
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        className="hidden"
                                        onChange={(e) => onPickLogo(e.target.files?.[0])}
                                    />
                                </label>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-1">{isRTL ? 'PNG أو JPG أو WEBP، بحد أقصى 512 كيلوبايت.' : 'PNG, JPG or WEBP, max 512 KB.'}</p>
                        </div>
                        {brandingError && (
                            <p className="text-xs text-red-600 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                                {brandingError}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setBrandingDialog({ open: false, site: '', displayName: '', currentLogo: '' }); setLogoDataUrl(null); setLogoFilename(''); setBrandingError(null) }} disabled={savingBranding}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={handleSaveBranding} disabled={savingBranding} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
                            {savingBranding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Palette className="h-3.5 w-3.5" />}
                            {isRTL ? 'حفظ' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* المناديب app feature toggles Dialog */}
            <Dialog open={repDialog.open} onOpenChange={(open) => { if (!open) setRepDialog({ open: false, site: '' }) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse text-right')}>
                            <Smartphone className="h-5 w-5 text-blue-600" />
                            {isRTL ? 'تطبيق المناديب' : 'المناديب App'}
                        </DialogTitle>
                        <DialogDescription className={cn(isRTL && 'text-right')}>
                            {isRTL
                                ? `الميزات الظاهرة للمندوب في «${repDialog.site}». المبيعات والمخزون متاحة دائماً.`
                                : `Features visible to reps on "${repDialog.site}". Sales & inventory are always available.`}
                        </DialogDescription>
                    </DialogHeader>

                    {repLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
                    ) : (
                        <div className="space-y-1 py-2">
                            {([
                                { key: 'wallet' as const, en: 'Wallet', ar: 'المحفظة', descEn: 'Rep commission wallet', descAr: 'محفظة عمولات المندوب' },
                                { key: 'payments' as const, en: 'Collect payments', ar: 'تحصيل المدفوعات', descEn: 'Cash collection from customers', descAr: 'تحصيل النقد من العملاء' },
                                { key: 'samples' as const, en: 'Free samples', ar: 'العينات المجانية', descEn: 'Distribute free samples', descAr: 'توزيع العينات المجانية' },
                            ]).map((f) => (
                                <div key={f.key} className={cn('flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5', isRTL && 'flex-row-reverse')}>
                                    <div className={cn(isRTL && 'text-right')}>
                                        <p className="text-sm font-semibold text-slate-900">{isRTL ? f.ar : f.en}</p>
                                        <p className="text-xs text-slate-500">{isRTL ? f.descAr : f.descEn}</p>
                                    </div>
                                    <Switch
                                        checked={repFeatures[f.key]}
                                        onCheckedChange={(v) => setRepFeatures((prev) => ({ ...prev, [f.key]: v }))}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRepDialog({ open: false, site: '' })} disabled={savingRep}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={saveRepFeatures} disabled={savingRep || repLoading} className="gap-1.5">
                            {savingRep && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {isRTL ? 'حفظ' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Fingerprint-only plan Dialog */}
            <Dialog open={fpDialog.open} onOpenChange={(open) => { if (!open) setFpDialog({ open: false, site: '' }) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse text-right')}>
                            <Fingerprint className="h-5 w-5 text-cyan-600" />
                            {isRTL ? 'خطة البصمة فقط' : 'Fingerprint-only plan'}
                        </DialogTitle>
                        <DialogDescription className={cn(isRTL && 'text-right')}>
                            {isRTL
                                ? `يقصر «${fpDialog.site}» على شاشات الحضور والبصمة فقط، ويخفي باقي وحدات الموارد البشرية.`
                                : `Limits "${fpDialog.site}" to the attendance & biometric screens only, hiding the rest of HR.`}
                        </DialogDescription>
                    </DialogHeader>

                    {fpLoading ? (
                        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-cyan-600" /></div>
                    ) : (
                        <div className="py-2">
                            <div className={cn('flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5', isRTL && 'flex-row-reverse')}>
                                <div className={cn(isRTL && 'text-right')}>
                                    <p className="text-sm font-semibold text-slate-900">{isRTL ? 'خطة البصمة فقط (الحضور)' : 'Fingerprint-only (attendance)'}</p>
                                    <p className="text-xs text-slate-500">{isRTL ? 'يقصر العميل على شاشات الحضور والبصمة فقط.' : 'Limits the client to attendance & biometric screens.'}</p>
                                </div>
                                <Switch
                                    checked={fpEnabled}
                                    onCheckedChange={setFpEnabled}
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFpDialog({ open: false, site: '' })} disabled={savingFp}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button onClick={saveFpOnly} disabled={savingFp || fpLoading} className="gap-1.5">
                            {savingFp && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {isRTL ? 'حفظ' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Users & Permissions Dialog */}
            <Dialog open={usersDialog.open} onOpenChange={(open) => { if (!open) closeUsersDialog() }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-emerald-600" />
                            {isRTL ? 'المستخدمون والصلاحيات' : 'Users & Permissions'}
                        </DialogTitle>
                        <DialogDescription>
                            {isRTL
                                ? 'أضف مستخدماً لهذا الموقع وحدد الوحدات التي يمكنه الوصول إليها.'
                                : 'Add a user to this site and choose which modules they can access.'}
                        </DialogDescription>
                    </DialogHeader>
                    <p className="text-xs text-gray-500" dir="ltr">{usersDialog.site}.{BASE_DOMAIN}</p>

                    {createdUser ? (
                        /* ── Success state: credentials (operator-set password) + optional invite ── */
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
                                <Check className="h-4 w-4 flex-shrink-0" />
                                <span>{isRTL ? `تم إنشاء ${createdUser.email}` : `${createdUser.email} created`}</span>
                            </div>
                            <div className="text-xs text-gray-600 bg-gray-50 border border-gray-100 rounded-lg p-2.5 space-y-1">
                                <p>{isRTL ? 'يسجّل الدخول بـ:' : 'Signs in with:'} <span className="font-mono font-medium text-gray-800" dir="ltr">{createdUser.loginWith}</span></p>
                                <p>{isRTL ? 'وكلمة المرور التي عيّنتها.' : 'and the password you set.'}</p>
                            </div>
                            {!inviteLink ? (
                                <button type="button" onClick={handleSendInvite} disabled={generatingInvite}
                                    className="text-xs text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1.5 disabled:opacity-50">
                                    {generatingInvite ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                                    {isRTL ? 'أو أرسل رابط دعوة بدلاً من ذلك' : 'or send an invite link instead'}
                                </button>
                            ) : (
                                <div>
                                    <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'رابط الدعوة (صالح 48 ساعة)' : 'Invite link (valid 48h)'}</label>
                                    <div className="flex items-center gap-1.5">
                                        <input readOnly value={inviteLink} dir="ltr" onFocus={(e) => e.currentTarget.select()}
                                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-2 bg-gray-50 text-gray-600 focus:outline-none" />
                                        <Button size="sm" variant="outline" onClick={handleCopyInvite} className="gap-1 flex-shrink-0">
                                            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                            {copied ? (isRTL ? 'تم' : 'Copied') : (isRTL ? 'نسخ' : 'Copy')}
                                        </Button>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-end gap-2 pt-1">
                                <Button size="sm" variant="ghost" onClick={resetUserForm}>
                                    {isRTL ? 'إضافة آخر' : 'Add another'}
                                </Button>
                                <Button size="sm" onClick={closeUsersDialog} className="bg-indigo-600 hover:bg-indigo-700">
                                    {isRTL ? 'تم' : 'Done'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        /* ── Add-user form ── */
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'البريد الإلكتروني *' : 'Email *'}</label>
                                <input
                                    type="email"
                                    value={newUser.email}
                                    onChange={(e) => { setNewUser(prev => ({ ...prev, email: e.target.value })); if (userError) setUserError(null) }}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'الاسم الكامل *' : 'Full Name *'}</label>
                                <input
                                    type="text"
                                    value={newUser.fullName}
                                    onChange={(e) => { setNewUser(prev => ({ ...prev, fullName: e.target.value })); if (userError) setUserError(null) }}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'اسم المستخدم (اختياري)' : 'Username (optional)'}</label>
                                <input
                                    type="text"
                                    value={newUser.username}
                                    onChange={(e) => { setNewUser(prev => ({ ...prev, username: e.target.value })); if (userError) setUserError(null) }}
                                    placeholder={isRTL ? 'بديل لتسجيل الدخول بدل البريد' : 'alternative login id'}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                    dir="ltr"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'كلمة المرور *' : 'Password *'}</label>
                                <div className="relative">
                                    <input
                                        type={showUserPw ? 'text' : 'password'}
                                        value={newUser.password}
                                        onChange={(e) => { setNewUser(prev => ({ ...prev, password: e.target.value })); if (userError) setUserError(null) }}
                                        className={`w-full text-sm border border-gray-200 rounded-lg px-3 py-2 ${isRTL ? 'pl-10' : 'pr-10'} focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400`}
                                        dir="ltr"
                                    />
                                    <button type="button" onClick={() => setShowUserPw(!showUserPw)}
                                        className={`absolute ${isRTL ? 'left-2.5' : 'right-2.5'} top-1/2 -translate-y-1/2 p-1 rounded text-gray-400 hover:text-gray-600`}>
                                        {showUserPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                    </button>
                                </div>
                                <p className="text-[11px] text-gray-400 mt-1">{isRTL ? '8 أحرف على الأقل. يسجّل المستخدم الدخول بهذه الكلمة.' : 'At least 8 characters. The user signs in with this.'}</p>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1.5 block">{isRTL ? 'الصلاحيات (الوحدات)' : 'Permissions (modules)'}</label>
                                {modulesLoading ? (
                                    <div className="flex items-center gap-2 text-xs text-gray-400 py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" />{isRTL ? 'جارٍ تحميل وحدات هذا الموقع…' : 'Loading this site’s modules…'}</div>
                                ) : availModules.length === 0 ? (
                                    <p className="text-xs text-gray-400 py-2">{isRTL ? 'لا توجد وحدات قابلة للمنح على هذا الموقع.' : 'No grantable modules on this site.'}</p>
                                ) : (
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {availModules.map((m) => {
                                            const on = newUser.modules.includes(m)
                                            const lbl = MODULE_LABELS[m] || { en: m, ar: m }
                                            return (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => { toggleUserModule(m); if (userError) setUserError(null) }}
                                                    className={cn('flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg border transition-colors text-start',
                                                        on ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-gray-600 hover:border-emerald-200')}
                                                >
                                                    <span className={cn('w-3.5 h-3.5 rounded flex items-center justify-center border flex-shrink-0', on ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300')}>
                                                        {on && <Check className="h-2.5 w-2.5 text-white" />}
                                                    </span>
                                                    {isRTL ? lbl.ar : lbl.en}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                            {userError && (
                                <p className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3 flex-shrink-0" />{userError}</p>
                            )}
                            <DialogFooter>
                                <Button variant="outline" onClick={closeUsersDialog} disabled={creatingUser}>
                                    {isRTL ? 'إلغاء' : 'Cancel'}
                                </Button>
                                <Button onClick={handleCreateUser} disabled={creatingUser || modulesLoading} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
                                    {creatingUser ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                                    {isRTL ? 'إنشاء المستخدم' : 'Create user'}
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open && !deleting) setDeleteConfirm(null) }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            {isRTL ? 'تأكيد حذف الموقع' : 'Confirm Site Deletion'}
                        </DialogTitle>
                        <DialogDescription>
                            {isRTL
                                ? 'هذا الإجراء نهائي ولا يمكن التراجع عنه. سيتم حذف الموقع وجميع بياناته بشكل دائم.'
                                : 'This action is permanent and cannot be undone. The site and all of its data will be deleted forever.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                        <p className="text-xs text-gray-600">
                            {isRTL ? 'الموقع المراد حذفه:' : 'Site to delete:'}
                        </p>
                        <p className="text-sm font-semibold text-red-700 mt-0.5" dir="ltr">{deleteConfirm}</p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirm(null)} disabled={deleting}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button
                            onClick={() => deleteConfirm && handleDeleteSite(deleteConfirm)}
                            disabled={deleting}
                            className="gap-1.5 bg-red-600 hover:bg-red-700"
                        >
                            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                            {isRTL ? 'حذف نهائي' : 'Delete Permanently'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Site Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={(open) => { setShowCreateDialog(open); if (!open) { setFormErrors({}); setNewLogo(null); setNewLogoError(null) } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'إنشاء موقع جديد' : 'Create New Site'}</DialogTitle>
                        <DialogDescription>
                            {isRTL
                                ? 'أنشئ موقعاً جديداً لعميل. يستغرق التجهيز عدة دقائق في الخلفية.'
                                : 'Provision a new tenant site. Setup runs in the background and takes a few minutes.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'الاسم الكامل *' : 'Full Name *'}</label>
                            <input
                                type="text"
                                value={newSite.fullname}
                                onChange={(e) => { setNewSite(prev => ({ ...prev, fullname: e.target.value })); if (formErrors.fullname) setFormErrors(prev => ({ ...prev, fullname: undefined })) }}
                                className={cn(
                                    'w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2',
                                    formErrors.fullname ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-gray-200 focus:ring-indigo-500/20 focus:border-indigo-400'
                                )}
                            />
                            {formErrors.fullname && <p className="text-xs text-red-600 mt-1">{formErrors.fullname}</p>}
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'البريد الإلكتروني *' : 'Email *'}</label>
                            <input
                                type="email"
                                value={newSite.email}
                                onChange={(e) => { setNewSite(prev => ({ ...prev, email: e.target.value })); if (formErrors.email) setFormErrors(prev => ({ ...prev, email: undefined })) }}
                                className={cn(
                                    'w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2',
                                    formErrors.email ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-gray-200 focus:ring-indigo-500/20 focus:border-indigo-400'
                                )}
                                dir="ltr"
                            />
                            {formErrors.email && <p className="text-xs text-red-600 mt-1">{formErrors.email}</p>}
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'الهاتف' : 'Phone'}</label>
                            <input
                                type="tel"
                                value={newSite.phone}
                                onChange={(e) => setNewSite(prev => ({ ...prev, phone: e.target.value }))}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                dir="ltr"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'الصب دومين *' : 'Subdomain *'}</label>
                            <div className="flex items-center gap-1">
                                <input
                                    type="text"
                                    value={newSite.subdomain}
                                    onChange={(e) => { setNewSite(prev => ({ ...prev, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })); if (formErrors.subdomain) setFormErrors(prev => ({ ...prev, subdomain: undefined })) }}
                                    className={cn(
                                        'flex-1 text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2',
                                        formErrors.subdomain ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-gray-200 focus:ring-indigo-500/20 focus:border-indigo-400'
                                    )}
                                    placeholder="my-company"
                                    dir="ltr"
                                />
                                <span className="text-xs text-gray-400 flex-shrink-0">.base.meena.sa</span>
                            </div>
                            {formErrors.subdomain
                                ? <p className="text-xs text-red-600 mt-1">{formErrors.subdomain}</p>
                                : <p className="text-[11px] text-gray-400 mt-1">{isRTL ? 'أحرف إنجليزية صغيرة وأرقام وشرطات فقط.' : 'Lowercase letters, numbers and hyphens only.'}</p>
                            }
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'كلمة مرور الأدمن *' : 'Admin Password *'}</label>
                            <input
                                type="password"
                                value={newSite.admin_password}
                                onChange={(e) => { setNewSite(prev => ({ ...prev, admin_password: e.target.value })); if (formErrors.admin_password) setFormErrors(prev => ({ ...prev, admin_password: undefined })) }}
                                className={cn(
                                    'w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2',
                                    formErrors.admin_password ? 'border-red-300 focus:ring-red-500/20 focus:border-red-400' : 'border-gray-200 focus:ring-indigo-500/20 focus:border-indigo-400'
                                )}
                                dir="ltr"
                            />
                            {formErrors.admin_password
                                ? <p className="text-xs text-red-600 mt-1">{formErrors.admin_password}</p>
                                : <p className="text-[11px] text-gray-400 mt-1">{isRTL ? `على الأقل ${MIN_PASSWORD_LEN} أحرف.` : `At least ${MIN_PASSWORD_LEN} characters.`}</p>
                            }
                        </div>

                        {/* Branding (optional) — display name + logo shown on the new site's login page */}
                        <div className="pt-1 border-t border-gray-100">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mt-2 mb-2 flex items-center gap-1.5">
                                <Palette className="h-3 w-3 text-purple-500" />
                                {isRTL ? 'الهوية (اختياري)' : 'Branding (optional)'}
                            </p>
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'اسم العرض' : 'Display Name'}</label>
                                <input
                                    type="text"
                                    value={newSite.display_name || ''}
                                    onChange={(e) => setNewSite(prev => ({ ...prev, display_name: e.target.value }))}
                                    maxLength={100}
                                    placeholder={isRTL ? 'الاسم على صفحة الدخول (اختياري)' : 'Name on the login page (optional)'}
                                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                />
                            </div>
                            <div className="mt-2">
                                <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'الشعار' : 'Logo'}</label>
                                <div className="flex items-center gap-3">
                                    {newLogo && (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={newLogo.dataUrl} alt="logo preview" className="h-10 w-10 rounded-lg object-cover border border-gray-200 bg-white" />
                                    )}
                                    <label className="cursor-pointer inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors">
                                        <Upload className="h-3.5 w-3.5" />
                                        {newLogo ? (isRTL ? 'تغيير' : 'Change') : (isRTL ? 'اختر صورة' : 'Choose image')}
                                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onPickNewLogo(e.target.files?.[0])} />
                                    </label>
                                    {newLogo && (
                                        <button type="button" onClick={() => { setNewLogo(null); setNewLogoError(null) }} className="text-xs text-gray-400 hover:text-red-600">{isRTL ? 'إزالة' : 'Remove'}</button>
                                    )}
                                </div>
                                {newLogoError
                                    ? <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3 flex-shrink-0" />{newLogoError}</p>
                                    : <p className="text-[11px] text-gray-400 mt-1">{isRTL ? 'PNG أو JPG أو WEBP، بحد أقصى 512 كيلوبايت.' : 'PNG, JPG or WEBP, max 512 KB.'}</p>
                                }
                            </div>
                        </div>

                        {apps.length > 0 && (
                            <div>
                                <label className="text-xs font-medium text-gray-600 mb-1.5 block">{isRTL ? 'التطبيقات الإضافية' : 'Additional Apps'}</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {apps.map((app) => (
                                        <button
                                            key={app}
                                            onClick={() => {
                                                setNewSite(prev => ({
                                                    ...prev,
                                                    apps: prev.apps.includes(app) ? prev.apps.filter(a => a !== app) : [...prev.apps, app],
                                                }))
                                            }}
                                            className={cn(
                                                'text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors',
                                                newSite.apps.includes(app)
                                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                                    : 'bg-white border-gray-200 text-gray-500 hover:border-indigo-200'
                                            )}
                                        >
                                            {app}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowCreateDialog(false); setFormErrors({}); setNewLogo(null); setNewLogoError(null) }}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button
                            onClick={handleCreateSite}
                            disabled={creating}
                            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700"
                        >
                            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            {isRTL ? 'إنشاء' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
