'use client'

/**
 * Company self-service Users & Team panel — runs on the TENANT site only.
 *
 * A company admin (Company Admin role, or System Manager/Administrator) can create
 * staff users on their OWN site and grant SAFE module access. All role logic lives
 * server-side: the panel only ever sends module ids; the backend
 * (base_meena.base_meena.api.company_*) maps modules -> roles and strips forbidden
 * roles, so a company admin can never grant System Manager or edit a privileged user.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { frappeClient, type CompanyUser } from '@/lib/api-client'
import { Header } from '@/components/header'
import {
    UserPlus, Users, ShieldAlert, Copy, RefreshCw, Loader2, X, Check,
    Lock, Unlock, KeyRound, Link2,
} from 'lucide-react'

// Bilingual labels for the grantable module ids (mirrors backend MODULE_ROLES keys, minus admin).
const MODULE_LABELS: Record<string, { en: string; ar: string }> = {
    hr: { en: 'HR', ar: 'الموارد البشرية' },
    accounting: { en: 'Accounting', ar: 'المحاسبة' },
    cashier: { en: 'Sales', ar: 'المبيعات' },
    salesReps: { en: 'Sales Reps', ar: 'المناديب' },
    inventory: { en: 'Inventory', ar: 'المخزون' },
    purchases: { en: 'Purchases', ar: 'المشتريات' },
    realEstate: { en: 'Real Estate', ar: 'العقارات' },
}

const L = {
    en: {
        title: 'Users & Team', subtitle: 'Create and manage your company users and their access',
        back: 'Back', addUser: 'Add User', refresh: 'Refresh',
        noUsers: 'No users yet. Add your first team member.',
        colUser: 'User', colModules: 'Access', colStatus: 'Status', colActions: 'Actions',
        active: 'Active', disabled: 'Disabled', protectedTag: 'Privileged — read only', employeeTag: 'Employee',
        enable: 'Enable', disable: 'Disable', setPassword: 'Set password', invite: 'Invite link', editAccess: 'Edit access',
        // create form
        newUser: 'New User', fullName: 'Full name', email: 'Email', username: 'Username (optional)',
        password: 'Password', passwordHint: 'At least 8 characters', orInvite: 'Or send an invite link instead',
        useInvite: 'Send invite link (no password)', modules: 'Module access', create: 'Create user', cancel: 'Cancel',
        creating: 'Creating…', saving: 'Saving…',
        // edit modules
        editModulesFor: 'Edit access for', save: 'Save',
        // password dialog
        setPasswordFor: 'Set password for', newPassword: 'New password',
        // results / errors
        created: 'User created', updated: 'Access updated', toggled: 'User updated', pwdSet: 'Password set',
        inviteCopied: 'Invite link copied', copyFailed: 'Copy failed', copy: 'Copy',
        inviteReady: 'Invite link ready — copy and share it with the user:',
        needAuth: 'You need company admin access to manage users.',
        errEmail: 'Enter a valid email', errName: 'Enter a full name', errPwd: 'Password must be at least 8 characters',
        errNeedLogin: 'Set a password or enable the invite link', confirmDisable: 'Disable this user?',
    },
    ar: {
        title: 'المستخدمون والفريق', subtitle: 'أنشئ وأدر مستخدمي شركتك وصلاحياتهم',
        back: 'رجوع', addUser: 'إضافة مستخدم', refresh: 'تحديث',
        noUsers: 'لا يوجد مستخدمون بعد. أضف أول عضو في فريقك.',
        colUser: 'المستخدم', colModules: 'الصلاحيات', colStatus: 'الحالة', colActions: 'إجراءات',
        active: 'مفعل', disabled: 'معطل', protectedTag: 'صلاحية عليا — للعرض فقط', employeeTag: 'موظف',
        enable: 'تفعيل', disable: 'تعطيل', setPassword: 'تعيين كلمة المرور', invite: 'رابط دعوة', editAccess: 'تعديل الصلاحيات',
        newUser: 'مستخدم جديد', fullName: 'الاسم الكامل', email: 'البريد الإلكتروني', username: 'اسم المستخدم (اختياري)',
        password: 'كلمة المرور', passwordHint: '8 أحرف على الأقل', orInvite: 'أو أرسل رابط دعوة بدلاً من ذلك',
        useInvite: 'إرسال رابط دعوة (بدون كلمة مرور)', modules: 'صلاحيات الموديولات', create: 'إنشاء المستخدم', cancel: 'إلغاء',
        creating: 'جاري الإنشاء…', saving: 'جاري الحفظ…',
        editModulesFor: 'تعديل صلاحيات', save: 'حفظ',
        setPasswordFor: 'تعيين كلمة مرور لـ', newPassword: 'كلمة المرور الجديدة',
        created: 'تم إنشاء المستخدم', updated: 'تم تحديث الصلاحيات', toggled: 'تم تحديث المستخدم', pwdSet: 'تم تعيين كلمة المرور',
        inviteCopied: 'تم نسخ رابط الدعوة', copyFailed: 'فشل النسخ', copy: 'نسخ',
        inviteReady: 'رابط الدعوة جاهز — انسخه وشاركه مع المستخدم:',
        needAuth: 'تحتاج صلاحية مدير الشركة لإدارة المستخدمين.',
        errEmail: 'أدخل بريداً إلكترونياً صحيحاً', errName: 'أدخل الاسم الكامل', errPwd: 'كلمة المرور 8 أحرف على الأقل',
        errNeedLogin: 'عيّن كلمة مرور أو فعّل رابط الدعوة', confirmDisable: 'تعطيل هذا المستخدم؟',
    },
}

export function CompanyUsersPanel({ hideHeader = false }: { hideHeader?: boolean } = {}) {
    const router = useRouter()
    const { isCompanyAdmin, isLoading: authLoading } = useAuth()
    const { isRTL, lang } = useI18n()
    const { toast } = useToast()
    const tr = L[lang === 'ar' ? 'ar' : 'en']

    const [loading, setLoading] = useState(true)
    const [users, setUsers] = useState<CompanyUser[]>([])
    const [grantable, setGrantable] = useState<string[]>([])

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [u, g] = await Promise.all([
                frappeClient.companyListUsers().catch(() => [] as CompanyUser[]),
                frappeClient.companyGrantableModules().catch(() => [] as string[]),
            ])
            setUsers(u)
            setGrantable(g)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { if (isCompanyAdmin) load() }, [isCompanyAdmin, load])

    // ── Create form state ──────────────────────────────────────────────────
    const [showCreate, setShowCreate] = useState(false)
    const [creating, setCreating] = useState(false)
    const emptyForm = { email: '', fullName: '', username: '', password: '', useInvite: false, modules: [] as string[] }
    const [form, setForm] = useState(emptyForm)
    const [formErr, setFormErr] = useState<string | null>(null)
    const [inviteLink, setInviteLink] = useState<string | null>(null)

    const toggleModule = (id: string, list: string[]) =>
        list.includes(id) ? list.filter(m => m !== id) : [...list, id]

    const handleCreate = async () => {
        setFormErr(null)
        const email = form.email.trim().toLowerCase()
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setFormErr(tr.errEmail); return }
        if (!form.fullName.trim()) { setFormErr(tr.errName); return }
        if (!form.useInvite && form.password.length < 8) { setFormErr(tr.errPwd); return }
        if (!form.useInvite && !form.password) { setFormErr(tr.errNeedLogin); return }
        setCreating(true)
        try {
            const res = await frappeClient.companyCreateUser({
                email, fullName: form.fullName.trim(), modules: form.modules,
                password: form.useInvite ? undefined : form.password,
                username: form.username.trim() || undefined,
                generateInvite: form.useInvite,
            })
            if (!res.success) { setFormErr(res.message || 'Error'); return }
            toast({ title: tr.created })
            if (res.invite_path) setInviteLink(absoluteInvite(res.invite_path))
            setForm(emptyForm)
            setShowCreate(false)
            load()
        } finally {
            setCreating(false)
        }
    }

    // ── Edit-modules dialog ────────────────────────────────────────────────
    const [editUser, setEditUser] = useState<CompanyUser | null>(null)
    const [editModules, setEditModules] = useState<string[]>([])
    const [savingEdit, setSavingEdit] = useState(false)
    const openEdit = (u: CompanyUser) => { setEditUser(u); setEditModules([...u.modules]) }
    const handleSaveEdit = async () => {
        if (!editUser) return
        setSavingEdit(true)
        try {
            const res = await frappeClient.companySetUserModules(editUser.name, editModules)
            if (!res.success) { toast({ title: res.message || 'Error', variant: 'destructive' }); return }
            toast({ title: tr.updated })
            setEditUser(null)
            load()
        } finally {
            setSavingEdit(false)
        }
    }

    // ── Set-password dialog ────────────────────────────────────────────────
    const [pwdUser, setPwdUser] = useState<CompanyUser | null>(null)
    const [pwdValue, setPwdValue] = useState('')
    const [savingPwd, setSavingPwd] = useState(false)
    const handleSavePwd = async () => {
        if (!pwdUser) return
        if (pwdValue.length < 8) { toast({ title: tr.errPwd, variant: 'destructive' }); return }
        setSavingPwd(true)
        try {
            const res = await frappeClient.companySetPassword(pwdUser.name, pwdValue)
            if (!res.success) { toast({ title: res.message || 'Error', variant: 'destructive' }); return }
            toast({ title: tr.pwdSet })
            setPwdUser(null); setPwdValue('')
        } finally {
            setSavingPwd(false)
        }
    }

    const handleToggle = async (u: CompanyUser) => {
        const enable = !(u.enabled === 1 || u.enabled === true)
        if (!enable && !window.confirm(tr.confirmDisable)) return
        const res = await frappeClient.companyToggleUser(u.name, enable)
        if (!res.success) { toast({ title: res.message || 'Error', variant: 'destructive' }); return }
        toast({ title: tr.toggled })
        load()
    }

    const handleRegenInvite = async (u: CompanyUser) => {
        const res = await frappeClient.companyRegenerateInvite(u.email)
        if (!res.success || !res.invite_path) { toast({ title: res.message || 'Error', variant: 'destructive' }); return }
        setInviteLink(absoluteInvite(res.invite_path))
    }

    const absoluteInvite = (path: string) =>
        typeof window !== 'undefined' ? `${window.location.origin}${path}` : path

    const copyInvite = async () => {
        if (!inviteLink) return
        try { await navigator.clipboard.writeText(inviteLink); toast({ title: tr.inviteCopied }) }
        catch { toast({ title: tr.copyFailed, variant: 'destructive' }) }
    }

    // ── Guards ─────────────────────────────────────────────────────────────
    if (authLoading) {
        return <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
        </div>
    }
    if (!isCompanyAdmin) {
        return <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8 text-center" dir={isRTL ? 'rtl' : 'ltr'}>
            <ShieldAlert className="h-12 w-12 text-amber-500 mb-4" />
            <p className="text-gray-600 mb-4">{tr.needAuth}</p>
            <button onClick={() => router.push('/')} className="px-4 py-2 bg-sky-600 text-white rounded-lg text-sm">{tr.back}</button>
        </div>
    }

    return (
        <div className={hideHeader ? '' : 'min-h-screen bg-gray-50'} dir={isRTL ? 'rtl' : 'ltr'}>
            {!hideHeader && <Header showHomeButton />}
            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Title row */}
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                            <Users className="h-6 w-6 text-sky-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{tr.title}</h1>
                            <p className="text-sm text-gray-500">{tr.subtitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={load} className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm flex items-center gap-1.5">
                            <RefreshCw className="h-4 w-4" /> {tr.refresh}
                        </button>
                        <button onClick={() => { setShowCreate(true); setInviteLink(null) }} className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-sm flex items-center gap-1.5">
                            <UserPlus className="h-4 w-4" /> {tr.addUser}
                        </button>
                    </div>
                </div>

                {/* Invite link banner */}
                {inviteLink && (
                    <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50 p-4">
                        <p className="text-sm text-sky-900 mb-2 flex items-center gap-1.5"><Link2 className="h-4 w-4" /> {tr.inviteReady}</p>
                        <div className="flex items-center gap-2">
                            <input readOnly value={inviteLink} className="flex-1 px-3 py-2 rounded-lg border border-sky-200 bg-white text-xs text-gray-700 font-mono" />
                            <button onClick={copyInvite} className="px-3 py-2 rounded-lg bg-sky-600 text-white text-sm flex items-center gap-1.5"><Copy className="h-4 w-4" /> {tr.copy}</button>
                            <button onClick={() => setInviteLink(null)} className="p-2 rounded-lg text-gray-400 hover:bg-sky-100"><X className="h-4 w-4" /></button>
                        </div>
                    </div>
                )}

                {/* Users table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {loading ? (
                        <div className="p-12 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-sky-600" /></div>
                    ) : users.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 text-sm">{tr.noUsers}</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-xs">
                                <tr>
                                    <th className="text-start font-medium px-4 py-3">{tr.colUser}</th>
                                    <th className="text-start font-medium px-4 py-3">{tr.colModules}</th>
                                    <th className="text-start font-medium px-4 py-3">{tr.colStatus}</th>
                                    <th className="text-end font-medium px-4 py-3">{tr.colActions}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users.map(u => {
                                    const enabled = u.enabled === 1 || u.enabled === true
                                    return (
                                        <tr key={u.name} className="hover:bg-gray-50/60">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-gray-900">{u.full_name || u.email}</div>
                                                <div className="text-xs text-gray-400">{u.email}{u.username ? ` · ${u.username}` : ''}</div>
                                                <div className="flex gap-1.5 mt-1">
                                                    {u.protected && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">{tr.protectedTag}</span>}
                                                    {u.is_employee_user && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-200">{tr.employeeTag}</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {u.modules.length === 0 ? <span className="text-gray-300">—</span> :
                                                        u.modules.map(m => (
                                                            <span key={m} className="text-[11px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100">
                                                                {MODULE_LABELS[m] ? (isRTL ? MODULE_LABELS[m].ar : MODULE_LABELS[m].en) : m}
                                                            </span>
                                                        ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full ${enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                                                    {enabled ? tr.active : tr.disabled}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {u.protected ? (
                                                    <span className="text-xs text-gray-300 flex items-center justify-end gap-1"><Lock className="h-3.5 w-3.5" /></span>
                                                ) : (
                                                    <div className="flex items-center justify-end gap-1">
                                                        <button title={tr.editAccess} onClick={() => openEdit(u)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><Users className="h-4 w-4" /></button>
                                                        <button title={tr.setPassword} onClick={() => { setPwdUser(u); setPwdValue('') }} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><KeyRound className="h-4 w-4" /></button>
                                                        <button title={tr.invite} onClick={() => handleRegenInvite(u)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><Link2 className="h-4 w-4" /></button>
                                                        <button title={enabled ? tr.disable : tr.enable} onClick={() => handleToggle(u)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100">
                                                            {enabled ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ── Create dialog ─────────────────────────────────────────────── */}
            {showCreate && (
                <Modal onClose={() => setShowCreate(false)} title={tr.newUser} isRTL={isRTL}>
                    <div className="space-y-3">
                        <Field label={tr.fullName}>
                            <input value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className="inp" />
                        </Field>
                        <Field label={tr.email}>
                            <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="inp" dir="ltr" />
                        </Field>
                        <Field label={tr.username}>
                            <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="inp" dir="ltr" />
                        </Field>
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                            <input type="checkbox" checked={form.useInvite} onChange={e => setForm({ ...form, useInvite: e.target.checked })} />
                            {tr.useInvite}
                        </label>
                        {!form.useInvite && (
                            <Field label={tr.password} hint={tr.passwordHint}>
                                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="inp" dir="ltr" />
                            </Field>
                        )}
                        <div>
                            <p className="text-xs font-medium text-gray-500 mb-2">{tr.modules}</p>
                            <div className="grid grid-cols-2 gap-2">
                                {grantable.map(m => (
                                    <label key={m} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${form.modules.includes(m) ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-gray-200 text-gray-600'}`}>
                                        <input type="checkbox" checked={form.modules.includes(m)} onChange={() => setForm({ ...form, modules: toggleModule(m, form.modules) })} />
                                        {MODULE_LABELS[m] ? (isRTL ? MODULE_LABELS[m].ar : MODULE_LABELS[m].en) : m}
                                    </label>
                                ))}
                            </div>
                        </div>
                        {formErr && <p className="text-sm text-red-600 flex items-center gap-1.5"><ShieldAlert className="h-4 w-4" /> {formErr}</p>}
                    </div>
                    <DialogActions
                        onCancel={() => setShowCreate(false)} cancelLabel={tr.cancel}
                        onConfirm={handleCreate} confirmLabel={creating ? tr.creating : tr.create}
                        loading={creating} isRTL={isRTL}
                    />
                </Modal>
            )}

            {/* ── Edit-modules dialog ───────────────────────────────────────── */}
            {editUser && (
                <Modal onClose={() => setEditUser(null)} title={`${tr.editModulesFor} ${editUser.full_name || editUser.email}`} isRTL={isRTL}>
                    <div className="grid grid-cols-2 gap-2">
                        {grantable.map(m => (
                            <label key={m} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${editModules.includes(m) ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-gray-200 text-gray-600'}`}>
                                <input type="checkbox" checked={editModules.includes(m)} onChange={() => setEditModules(toggleModule(m, editModules))} />
                                {MODULE_LABELS[m] ? (isRTL ? MODULE_LABELS[m].ar : MODULE_LABELS[m].en) : m}
                            </label>
                        ))}
                    </div>
                    <DialogActions
                        onCancel={() => setEditUser(null)} cancelLabel={tr.cancel}
                        onConfirm={handleSaveEdit} confirmLabel={savingEdit ? tr.saving : tr.save}
                        loading={savingEdit} isRTL={isRTL}
                    />
                </Modal>
            )}

            {/* ── Set-password dialog ───────────────────────────────────────── */}
            {pwdUser && (
                <Modal onClose={() => setPwdUser(null)} title={`${tr.setPasswordFor} ${pwdUser.full_name || pwdUser.email}`} isRTL={isRTL}>
                    <Field label={tr.newPassword} hint={tr.passwordHint}>
                        <input type="password" value={pwdValue} onChange={e => setPwdValue(e.target.value)} className="inp" dir="ltr" />
                    </Field>
                    <DialogActions
                        onCancel={() => setPwdUser(null)} cancelLabel={tr.cancel}
                        onConfirm={handleSavePwd} confirmLabel={savingPwd ? tr.saving : tr.save}
                        loading={savingPwd} isRTL={isRTL}
                    />
                </Modal>
            )}

            <style jsx>{`
                .inp { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; font-size: 0.875rem; outline: none; }
                .inp:focus { border-color: #7dd3fc; box-shadow: 0 0 0 3px rgba(125,211,252,0.2); }
            `}</style>
        </div>
    )
}

// ── small local helpers ────────────────────────────────────────────────────
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">{label}</label>
            {children}
            {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
        </div>
    )
}

function Modal({ title, onClose, isRTL, children }: { title: string; onClose: () => void; isRTL: boolean; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-900">{title}</h3>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    )
}

function DialogActions({ onCancel, cancelLabel, onConfirm, confirmLabel, loading, isRTL }: { onCancel: () => void; cancelLabel: string; onConfirm: () => void; confirmLabel: string; loading: boolean; isRTL: boolean }) {
    return (
        <div className={`flex gap-2 mt-5 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-sm font-medium flex items-center justify-center gap-1.5">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {confirmLabel}
            </button>
            <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm">{cancelLabel}</button>
        </div>
    )
}
