'use client'

/**
 * Per-employee feature visibility (HR-only).
 *
 * HR flips ONE master switch — "restrict this employee" — and then ticks exactly
 * which self-service features that individual sees in the mobile app. Off by
 * default, in which case the employee sees everything (so the tab is inert until
 * HR deliberately opts someone in).
 *
 * Backed by base_meena.api.employee_permissions.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, ShieldCheck, Save, RotateCcw, Check } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type Feature = {
    feature_key: string
    label_ar: string
    label_en: string
    group: string
    group_label_ar: string
    group_label_en: string
    enabled: boolean
}

export function FeaturePermissionsTab({ employeeId }: { employeeId: string }) {
    const { isRTL } = useI18n()
    const tx = (en: string, ar: string) => (isRTL ? ar : en)

    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [savedAt, setSavedAt] = useState<number | null>(null)

    const [restrict, setRestrict] = useState(false)
    const [features, setFeatures] = useState<Feature[]>([])

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const r: any = await frappeClient.call(
                'base_meena.api.employee_permissions.get_employee_permissions',
                { employee: employeeId },
            )
            const m = r?.message ?? r
            setRestrict(Boolean(m?.restrict_features))
            setFeatures(Array.isArray(m?.features) ? m.features : [])
        } catch (e: any) {
            setError(e?.message || tx('Failed to load permissions', 'تعذّر تحميل الصلاحيات'))
        } finally {
            setLoading(false)
        }
    }, [employeeId, isRTL])

    useEffect(() => { load() }, [load])

    const grouped = useMemo(() => {
        const out: Record<string, { label: string; items: Feature[] }> = {}
        for (const f of features) {
            const label = isRTL ? f.group_label_ar : f.group_label_en
            if (!out[f.group]) out[f.group] = { label, items: [] }
            out[f.group].items.push(f)
        }
        return Object.entries(out)
    }, [features, isRTL])

    const allowedCount = features.filter((f) => f.enabled).length

    const toggle = (key: string) =>
        setFeatures((prev) => prev.map((f) => (f.feature_key === key ? { ...f, enabled: !f.enabled } : f)))

    const setAll = (value: boolean) =>
        setFeatures((prev) => prev.map((f) => ({ ...f, enabled: value })))

    const save = async () => {
        setSaving(true)
        setError(null)
        try {
            await frappeClient.call('base_meena.api.employee_permissions.set_employee_permissions', {
                employee: employeeId,
                restrict_features: restrict ? 1 : 0,
                permissions: features.map((f) => ({ feature_key: f.feature_key, enabled: f.enabled ? 1 : 0 })),
            })
            setSavedAt(Date.now())
            setTimeout(() => setSavedAt(null), 2500)
        } catch (e: any) {
            setError(e?.message || tx('Failed to save', 'تعذّر الحفظ'))
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <Card className="flex items-center justify-center p-10 shadow-card">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </Card>
        )
    }

    return (
        <div className="space-y-4">
            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                </div>
            )}

            {/* master switch */}
            <Card className="p-4 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <ShieldCheck className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-foreground">
                                {tx('Restrict this employee', 'تقييد صلاحيات هذا الموظف')}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {restrict
                                    ? tx(
                                        'This employee sees ONLY the features ticked below in the mobile app.',
                                        'هذا الموظف يرى فقط الخدمات المحددة بالأسفل في تطبيق الجوال.',
                                    )
                                    : tx(
                                        'Off — this employee sees every feature (default).',
                                        'غير مفعّل — هذا الموظف يرى جميع الخدمات (الوضع الافتراضي).',
                                    )}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        role="switch"
                        aria-checked={restrict}
                        onClick={() => setRestrict((v) => !v)}
                        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${restrict ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    >
                        <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${restrict ? 'start-[22px]' : 'start-0.5'}`}
                        />
                    </button>
                </div>
            </Card>

            {/* feature checklist */}
            <Card className={`p-4 shadow-card transition-opacity ${restrict ? '' : 'pointer-events-none opacity-50'}`}>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                        {tx('Visible features', 'الخدمات الظاهرة')}{' '}
                        <span className="font-normal text-muted-foreground">
                            ({allowedCount}/{features.length})
                        </span>
                    </h3>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setAll(true)}>
                            {tx('Select all', 'تحديد الكل')}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setAll(false)}>
                            {tx('Clear all', 'إلغاء الكل')}
                        </Button>
                    </div>
                </div>

                <div className="space-y-5">
                    {grouped.map(([groupKey, group]) => (
                        <div key={groupKey}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {group.label}
                            </p>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {group.items.map((f) => (
                                    <label
                                        key={f.feature_key}
                                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${f.enabled
                                            ? 'border-primary/40 bg-primary/5 text-foreground'
                                            : 'border-border bg-background text-muted-foreground'
                                            }`}
                                    >
                                        <span
                                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${f.enabled ? 'border-primary bg-primary text-white' : 'border-muted-foreground/40'
                                                }`}
                                        >
                                            {f.enabled && <Check className="h-3.5 w-3.5" />}
                                        </span>
                                        <input
                                            type="checkbox"
                                            className="sr-only"
                                            checked={f.enabled}
                                            onChange={() => toggle(f.feature_key)}
                                        />
                                        <span className="min-w-0 flex-1 truncate">{isRTL ? f.label_ar : f.label_en}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* actions */}
            <div className="flex flex-wrap items-center gap-2">
                <Button onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    <span className="ms-2">{tx('Save', 'حفظ')}</span>
                </Button>
                <Button variant="outline" onClick={load} disabled={saving}>
                    <RotateCcw className="h-4 w-4" />
                    <span className="ms-2">{tx('Reset', 'استرجاع')}</span>
                </Button>
                {savedAt && (
                    <span className="text-sm text-success">
                        {tx('Saved — applies on the employee\'s next app open.', 'تم الحفظ — يسري عند فتح الموظف للتطبيق.')}
                    </span>
                )}
            </div>
        </div>
    )
}
