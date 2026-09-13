'use client'

import { useState, useEffect, useRef } from 'react'
import { useI18n } from '@/lib/i18n'
import { Shield, Lock, AlertCircle, Loader2 } from 'lucide-react'

const ADMIN_SESSION_KEY = 'meena_admin_auth'
const SESSION_DURATION_MS = 60 * 60 * 1000 // 1 hour

interface AdminPinGateProps {
    children: React.ReactNode
}

export function AdminPinGate({ children }: AdminPinGateProps) {
    const { isRTL } = useI18n()
    const [isVerified, setIsVerified] = useState(false)
    const [pin, setPin] = useState('')
    const [error, setError] = useState('')
    const [checking, setChecking] = useState(true)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(ADMIN_SESSION_KEY)
            if (stored) {
                const { timestamp } = JSON.parse(stored)
                if (Date.now() - timestamp < SESSION_DURATION_MS) {
                    setIsVerified(true)
                } else {
                    sessionStorage.removeItem(ADMIN_SESSION_KEY)
                }
            }
        } catch {
            sessionStorage.removeItem(ADMIN_SESSION_KEY)
        }
        setChecking(false)
    }, [])

    useEffect(() => {
        if (!checking && !isVerified && inputRef.current) {
            inputRef.current.focus()
        }
    }, [checking, isVerified])

    const handleVerify = () => {
        const adminPin = process.env.NEXT_PUBLIC_ADMIN_PIN
        if (!adminPin) {
            setError(isRTL ? 'لم يتم تعيين رمز PIN في النظام' : 'Admin PIN is not configured')
            return
        }
        if (pin === adminPin) {
            sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({ timestamp: Date.now() }))
            setIsVerified(true)
            setError('')
        } else {
            setError(isRTL ? 'رمز PIN غير صحيح' : 'Incorrect PIN')
            setPin('')
            inputRef.current?.focus()
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && pin.length > 0) {
            handleVerify()
        }
    }

    if (checking) {
        return (
            <div className="flex items-center justify-center h-screen bg-[#f8f9fb]">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">{isRTL ? 'جاري التحقق...' : 'Verifying...'}</p>
                </div>
            </div>
        )
    }

    if (isVerified) {
        return <>{children}</>
    }

    return (
        <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="w-full max-w-sm mx-4">
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 mb-4">
                        <Shield className="h-8 w-8 text-indigo-400" />
                    </div>
                    <h1 className="text-xl font-bold text-white mb-1">Meena Admin</h1>
                    <p className="text-sm text-indigo-300/70">
                        {isRTL ? 'أدخل رمز PIN للمتابعة' : 'Enter PIN to continue'}
                    </p>
                </div>

                {/* PIN Form */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-indigo-300/80 mb-2 block flex items-center gap-1.5">
                                <Lock className="h-3 w-3" />
                                {isRTL ? 'رمز الدخول' : 'Access PIN'}
                            </label>
                            <input
                                ref={inputRef}
                                type="password"
                                value={pin}
                                onChange={(e) => { setPin(e.target.value); setError('') }}
                                onKeyDown={handleKeyDown}
                                placeholder="••••••"
                                className="w-full text-center text-2xl tracking-[0.5em] bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
                                autoComplete="off"
                                dir="ltr"
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="text-xs">{error}</span>
                            </div>
                        )}

                        <button
                            onClick={handleVerify}
                            disabled={pin.length === 0}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/30 disabled:cursor-not-allowed text-white font-medium text-sm rounded-xl px-4 py-3 transition-all flex items-center justify-center gap-2"
                        >
                            <Shield className="h-4 w-4" />
                            {isRTL ? 'دخول لوحة الإدارة' : 'Enter Admin Panel'}
                        </button>
                    </div>
                </div>

                <p className="text-center text-[10px] text-indigo-400/40 mt-4">
                    {isRTL ? 'الجلسة صالحة لمدة ساعة واحدة' : 'Session valid for 1 hour'}
                </p>
            </div>
        </div>
    )
}
