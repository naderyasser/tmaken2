'use client'

// Generic list + editor for the rentals mirror doctypes. Rendering is driven by
// lib/rentals/spec.json (derived from egarsys's own schema), so EVERY field is
// visible and editable without hand-built forms — Arabic labels come from the
// config dictionary, the rest fall back to prettified names. Docs are named by
// their egarsys cuid; links between entities are plain Links to those names.

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { frappeClient, type FrappeFilter } from '@/lib/api-client'
import {
    ENTITIES, type EntityConfig, specFields, fieldLabel, fileHref, newDocName, type SpecField,
} from '@/lib/rentals/config'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ListPager } from '@/components/accounting/list-pager'
import { AlertCircle, ArrowRight, Plus, RefreshCw, Save, Search, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 50

const fmtCell = (f: SpecField | undefined, v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—'
    if (f?.type === 'DateTime') return String(v).slice(0, 10)
    if (f?.type === 'Float') return Number(v).toLocaleString('en-SA', { maximumFractionDigits: 2 })
    if (f?.type === 'Boolean') return v ? 'نعم' : 'لا'
    return String(v)
}

async function countDocs(doctype: string, filters: FrappeFilter[], or_filters?: FrappeFilter[]) {
    if (or_filters?.length) {
        const names = await frappeClient.getList<{ name: string }>(doctype, { filters, or_filters, fields: ['name'], limit_page_length: 0 })
        return names.length
    }
    const r = await frappeClient.call<number>('frappe.client.get_count', { doctype, filters })
    return typeof r.message === 'number' ? r.message : 0
}

// ─── List ─────────────────────────────────────────────────────────────────────

export function RentalsList({ entity }: { entity: EntityConfig }) {
    const fields = specFields(entity.model)
    const byName = useMemo(() => new Map(fields.map((f) => [f.fieldname, f])), [fields])

    const [rows, setRows] = useState<Record<string, unknown>[]>([])
    const [query, setQuery] = useState('')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        const id = setTimeout(() => { setSearch(query.trim()); setPage(1) }, 400)
        return () => clearTimeout(id)
    }, [query])

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const or_filters: FrappeFilter[] | undefined = search && entity.searchFields.length
                ? entity.searchFields.map((f) => [entity.doctype, f, 'like', `%${search}%`] as FrappeFilter)
                : undefined
            const [data, count] = await Promise.all([
                frappeClient.getList<Record<string, unknown>>(entity.doctype, {
                    fields: ['name', ...entity.listColumns],
                    or_filters,
                    order_by: 'modified desc',
                    limit_start: (page - 1) * PAGE_SIZE,
                    limit_page_length: PAGE_SIZE,
                }),
                countDocs(entity.doctype, [], or_filters),
            ])
            setRows(data)
            setTotal(count)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'فشل التحميل')
        } finally {
            setLoading(false)
        }
    }, [entity, page, search])

    useEffect(() => { void load() }, [load])

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-4" dir="rtl">
            <div className="flex flex-wrap items-center gap-3">
                <Link href="/rentals-native" className="text-gray-400 hover:text-gray-600"><ArrowRight className="w-5 h-5" /></Link>
                <h1 className="text-2xl font-bold text-gray-900">{entity.labelAr}</h1>
                <span className="text-sm text-gray-500">{total}</span>
                <div className="ms-auto flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="بحث..."
                            className="border border-gray-200 rounded-lg ps-9 pe-3 py-2 text-sm bg-white"
                        />
                    </div>
                    <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
                        <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                    </Button>
                    <Link href={`/rentals-native/${entity.key}/new`}>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Plus className="w-4 h-4 me-1" /> {entity.singularAr} جديد
                        </Button>
                    </Link>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4" /> {error}
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                {entity.listColumns.map((c) => (
                                    <th key={c} className="px-4 py-3 text-start text-xs font-semibold text-gray-600 whitespace-nowrap">
                                        {fieldLabel(c)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? Array.from({ length: 6 }).map((_, i) => (
                                <tr key={i}>{entity.listColumns.map((c) => (
                                    <td key={c} className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                                ))}</tr>
                            )) : rows.length === 0 ? (
                                <tr><td colSpan={entity.listColumns.length} className="text-center py-12 text-gray-400">لا توجد سجلات</td></tr>
                            ) : rows.map((r) => (
                                <tr key={String(r.name)} className="hover:bg-emerald-50/40 cursor-pointer"
                                    onClick={() => { window.location.href = `/rentals-native/${entity.key}/${encodeURIComponent(String(r.name))}` }}>
                                    {entity.listColumns.map((c) => (
                                        <td key={c} className="px-4 py-2.5 text-gray-700 whitespace-nowrap max-w-[260px] truncate">
                                            {fmtCell(byName.get(c), r[c])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <ListPager page={page} pageSize={PAGE_SIZE} total={total} loading={loading} onPage={setPage} />
            </div>
        </div>
    )
}

// ─── Editor (detail / create) ────────────────────────────────────────────────

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400'

function FieldInput({ f, value, onChange }: { f: SpecField; value: unknown; onChange: (v: unknown) => void }) {
    if (f.type === 'Boolean') {
        return (
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked ? 1 : 0)} className="w-4 h-4 accent-emerald-600" />
                {value ? 'نعم' : 'لا'}
            </label>
        )
    }
    if (f.type === 'DateTime') {
        return (
            <input type="date" value={value ? String(value).slice(0, 10) : ''} dir="ltr"
                onChange={(e) => onChange(e.target.value ? `${e.target.value} 00:00:00` : null)} className={inputCls} />
        )
    }
    if (f.type === 'Int' || f.type === 'Float') {
        return (
            <input type="number" step={f.type === 'Float' ? '0.01' : '1'} dir="ltr"
                value={value === null || value === undefined ? '' : String(value)}
                onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className={inputCls} />
        )
    }
    const s = value === null || value === undefined ? '' : String(value)
    const href = fileHref(s)
    if (s.length > 90 || f.type === 'Json') {
        return <textarea value={s} onChange={(e) => onChange(e.target.value || null)} rows={3} className={inputCls} />
    }
    return (
        <div className="flex items-center gap-2">
            <input value={s} onChange={(e) => onChange(e.target.value || null)} className={inputCls} />
            {href && <a href={href} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline whitespace-nowrap">فتح</a>}
        </div>
    )
}

export function RentalsEditor({ entity, docName }: { entity: EntityConfig; docName: string | null }) {
    const router = useRouter()
    const fields = specFields(entity.model)
    const [doc, setDoc] = useState<Record<string, unknown> | null>(docName ? null : {})
    const [dirty, setDirty] = useState<Record<string, unknown>>({})
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [ok, setOk] = useState('')

    useEffect(() => {
        if (!docName) return
        frappeClient.get<Record<string, unknown>>(entity.doctype, docName)
            .then((r) => setDoc(r.data ?? {}))
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'فشل التحميل'))
    }, [entity.doctype, docName])

    const set = (k: string, v: unknown) => {
        setDirty((d) => ({ ...d, [k]: v }))
        setDoc((d) => ({ ...(d ?? {}), [k]: v }))
    }

    const save = async () => {
        setSaving(true)
        setError('')
        setOk('')
        try {
            if (docName) {
                if (Object.keys(dirty).length) await frappeClient.put(entity.doctype, docName, dirty)
                setOk('تم الحفظ')
                setDirty({})
            } else {
                const name = newDocName()
                await frappeClient.post(entity.doctype, { ...doc, name })
                router.replace(`/rentals-native/${entity.key}/${encodeURIComponent(name)}`)
                return
            }
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'فشل الحفظ')
        } finally {
            setSaving(false)
        }
    }

    const remove = async () => {
        if (!docName) return
        if (!window.confirm(`حذف هذا ${entity.singularAr} نهائياً من المنصة؟ (لا يمس النظام الأصلي)`)) return
        setSaving(true)
        try {
            await frappeClient.delete(entity.doctype, docName)
            router.replace(`/rentals-native/${entity.key}`)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'فشل الحذف')
            setSaving(false)
        }
    }

    const linkTargetKey = (f: SpecField) => ENTITIES.find((e) => e.doctype === f.link)?.key

    if (docName && doc === null && !error) {
        return <div className="p-6 space-y-3 max-w-4xl mx-auto">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
    }

    const title = docName
        ? String(doc?.[entity.titleField] ?? docName)
        : `${entity.singularAr} جديد`

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-4" dir="rtl">
            <div className="flex flex-wrap items-center gap-3">
                <Link href={`/rentals-native/${entity.key}`} className="text-gray-400 hover:text-gray-600"><ArrowRight className="w-5 h-5" /></Link>
                <h1 className="text-xl font-bold text-gray-900 truncate max-w-[50%]">{entity.singularAr}: {title}</h1>
                <div className="ms-auto flex items-center gap-2">
                    {docName && (
                        <Button size="sm" variant="outline" onClick={() => void remove()} disabled={saving}
                            className="text-red-600 border-red-200 hover:bg-red-50">
                            <Trash2 className="w-4 h-4 me-1" /> حذف
                        </Button>
                    )}
                    <Button size="sm" onClick={() => void save()} disabled={saving || (!!docName && !Object.keys(dirty).length)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        {saving ? <RefreshCw className="w-4 h-4 me-1 animate-spin" /> : <Save className="w-4 h-4 me-1" />}
                        حفظ
                    </Button>
                </div>
            </div>

            {error && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700"><AlertCircle className="w-4 h-4" />{error}</div>}
            {ok && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-700">{ok}</div>}

            <div className="bg-white border border-gray-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {fields.map((f) => (
                    <div key={f.fieldname} className="space-y-1">
                        <label className="text-xs font-medium text-gray-500 flex items-center gap-2">
                            {fieldLabel(f.fieldname)}
                            {f.link && doc?.[f.fieldname] && linkTargetKey(f) ? (
                                <Link
                                    href={`/rentals-native/${linkTargetKey(f)}/${encodeURIComponent(String(doc[f.fieldname]))}`}
                                    className="text-emerald-700 underline"
                                >فتح</Link>
                            ) : null}
                        </label>
                        <FieldInput f={f} value={doc?.[f.fieldname]} onChange={(v) => set(f.fieldname, v)} />
                    </div>
                ))}
            </div>
        </div>
    )
}
