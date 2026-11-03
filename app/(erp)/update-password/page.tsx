'use client'
import { csrfFetch } from '@/lib/csrf'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useI18n } from '@/lib/i18n'
import { Loader2, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'

// Pre-auth "set your password" page used by invite/reset links
// (/update-password?key=...). It POSTs the raw key + new password to Frappe's
// guest-callable update_password; on success Frappe sets the session cookie, so we
// send the user to the dashboard. Must be in middleware publicPaths.
function UpdatePasswordInner() {
    const { isRTL } = useI18n()
    const router = useRouter()
    const params = useSearchParams()
    const key = params.get('key') || ''

    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [show, setShow] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [done, setDone] = useState(false)

    useEffect(() => {
        if (!key) setError(isRTL ? 'رابط غير صالح (لا يوجد مفتاح).' : 'Invalid link (no key).')
    }, [key, isRTL])

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)
        if (password.length < 6) { setError(isRTL ? 'كلمة المرور قصيرة جداً' : 'Password is too short'); return }
        if (password !== confirm) { setError(isRTL ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'); return }
        setLoading(true)
        try {
            const res = await csrfFetch('/api/method/frappe.core.doctype.user.user.update_password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ key, new_password: password }),
            })
            const data = await res.json().catch(() => ({}))
            // Frappe returns the redirect path in `message` on success; on a bad/expired key
            // it returns a message string explaining so (HTTP can still be 200).
            const msg = typeof data?.message === 'string' ? data.message : ''
            if (!res.ok || /invalid|expired|used before/i.test(msg)) {
                setError(msg || (isRTL ? 'انتهت صلاحية الرابط أو أنه غير صالح.' : 'This link is invalid or has expired.'))
                return
            }
            setDone(true)
            // update_password logs the user in (sets the session cookie) -> go to dashboard.
            setTimeout(() => router.replace('/'), 1200)
        } catch {
            setError(isRTL ? 'تعذر تعيين كلمة المرور.' : 'Could not set the password.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50/80 px-6" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="w-full max-w-sm">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
                    <h1 className="text-lg font-bold text-gray-900 mb-1">{isRTL ? 'تعيين كلمة المرور' : 'Set your password'}</h1>
                    <p className="text-sm text-gray-500 mb-5">{isRTL ? 'اختر كلمة مرور لحسابك للمتابعة.' : 'Choose a password for your account to continue.'}</p>

                    {done ? (
                        <div className="flex items-center gap-2.5 p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-sm">
                            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                            <span>{isRTL ? 'تم تعيين كلمة المرور. جارٍ تسجيل الدخول…' : 'Password set. Signing you in…'}</span>
                        </div>
                    ) : (
                        <form onSubmit={submit} className="space-y-4">
                            {error && (
                                <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700">{isRTL ? 'كلمة المرور الجديدة' : 'New password'}</label>
                                <div className="relative group">
                                    <Lock className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400`} />
                                    <input
                                        type={show ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className={`w-full h-11 ${isRTL ? 'pr-10 pl-11' : 'pl-10 pr-11'} rounded-xl border border-gray-200 text-gray-900 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white text-sm`}
                                        dir="ltr"
                                        required
                                    />
                                    <button type="button" onClick={() => setShow(!show)} className={`absolute ${isRTL ? 'left-3.5' : 'right-3.5'} top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-400 hover:text-gray-600`}>
                                        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-gray-700">{isRTL ? 'تأكيد كلمة المرور' : 'Confirm password'}</label>
                                <div className="relative group">
                                    <Lock className={`absolute ${isRTL ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400`} />
                                    <input
                                        type={show ? 'text' : 'password'}
                                        value={confirm}
                                        onChange={(e) => setConfirm(e.target.value)}
                                        className={`w-full h-11 ${isRTL ? 'pr-10 pl-4' : 'pl-10 pr-4'} rounded-xl border border-gray-200 text-gray-900 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white text-sm`}
                                        dir="ltr"
                                        required
                                    />
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading || !key}
                                className="w-full h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2.5"
                            >
                                {loading ? <><Loader2 className="h-4 w-4 animate-spin" />{isRTL ? 'جارٍ الحفظ…' : 'Saving…'}</> : (isRTL ? 'تعيين كلمة المرور' : 'Set password')}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function UpdatePasswordPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>}>
            <UpdatePasswordInner />
        </Suspense>
    )
}
