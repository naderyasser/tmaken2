'use client'

import { useCallback, useEffect, useState } from 'react'
import { accountingApi } from '@/lib/accounting-api'
import { useI18n } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw, Lock, Unlock, CalendarCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type Locale = 'ar' | 'en'

interface ClosedDocument { document_type: string; closed: number }
interface Period {
    name: string; period_name: string; start_date: string; end_date: string; company?: string
    closed_documents: ClosedDocument[]
}

const L = {
    en: {
        title: 'Period Closing', subtitle: 'Lock accounting periods to prevent backdated entries. Closed periods block new GL postings.',
        company: 'Company', refresh: 'Refresh',
        period: 'Period Name', start: 'Start Date', end: 'End Date', company_col: 'Company', status: 'Status',
        closed: 'Closed', open: 'Open', partial: 'Partial', close: 'Close All', reopen: 'Open All', actions: 'Actions',
        closedDocs: 'Blocked Doctypes', docType: 'Document Type', docStatus: 'Status',
        noData: 'No accounting periods found. Create them in ERPNext → Accounting → Accounting Period.',
        noClosedDocs: 'No document types configured for this period.',
        error: 'Failed to load periods.', allCompanies: 'All Companies',
        confirmClose: 'Close all document types for this period? Backdated entries will be blocked.',
        confirmOpen: 'Re-open all document types for this period? New entries will be allowed again.',
        blockedCount: 'blocked', ofTotal: 'of',
    },
    ar: {
        title: 'إقفال الفترات المحاسبية', subtitle: 'أقفل الفترات لمنع القيود المؤرخة بأثر رجعي. الفترات المقفلة تمنع أي قيد جديد على دفتر الأستاذ.',
        company: 'الشركة', refresh: 'تحديث',
        period: 'اسم الفترة', start: 'تاريخ البداية', end: 'تاريخ النهاية', company_col: 'الشركة', status: 'الحالة',
        closed: 'مقفل', open: 'مفتوح', partial: 'جزئي', close: 'إقفال الكل', reopen: 'فتح الكل', actions: 'الإجراءات',
        closedDocs: 'أنواع المستندات المحظورة', docType: 'نوع المستند', docStatus: 'الحالة',
        noData: 'لا توجد فترات محاسبية. أنشئها في ERPNext ← المحاسبة ← الفترة المحاسبية.',
        noClosedDocs: 'لا توجد أنواع مستندات مضبوطة لهذه الفترة.',
        error: 'فشل تحميل الفترات.', allCompanies: 'كل الشركات',
        confirmClose: 'إقفال جميع أنواع المستندات لهذه الفترة؟ سيتم منع القيود المؤرخة بأثر رجعي.',
        confirmOpen: 'إعادة فتح جميع أنواع المستندات لهذه الفترة؟ سيُسمح بالقيود الجديدة مجددًا.',
        blockedCount: 'محظور', ofTotal: 'من',
    },
} as const

function periodStatus(p: Period): 'closed' | 'open' | 'partial' {
    const docs = p.closed_documents
    if (!docs || docs.length === 0) return 'open'
    const closedCount = docs.filter(d => d.closed).length
    if (closedCount === docs.length) return 'closed'
    if (closedCount > 0) return 'partial'
    return 'open'
}

export default function PeriodClosingPage() {
    const { lang, isRTL } = useI18n()
    const locale = (lang === 'ar' ? 'ar' : 'en') as Locale
    const t = L[locale]

    const [companies, setCompanies] = useState<Array<{ name: string; company_name: string }>>([])
    const [company, setCompany] = useState('')
    const [periods, setPeriods] = useState<Period[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [toggling, setToggling] = useState<string | null>(null)
    const [expanded, setExpanded] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const data = await accountingApi.getAccountingPeriods(company || undefined)
            setPeriods(data)
        } catch (e: any) { setError(e?.message ?? t.error) }
        finally { setLoading(false) }
    }, [company, t.error])

    useEffect(() => {
        accountingApi.getCompanies().then(list => {
            setCompanies(list)
            if (list.length === 1) setCompany(list[0].name)
        }).catch(() => {})
    }, [])

    useEffect(() => { load() }, [load])

    const toggle = async (period: Period) => {
        const status = periodStatus(period)
        const shouldClose = status !== 'closed'
        const msg = shouldClose ? t.confirmClose : t.confirmOpen
        if (!confirm(msg)) return
        setToggling(period.name)
        try {
            if (shouldClose) await accountingApi.closePeriod(period.name)
            else await accountingApi.openPeriod(period.name)
            await load()
        } catch (e: any) { setError(e?.message ?? t.error) }
        finally { setToggling(null) }
    }

    return (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="p-6 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
                    <CalendarCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
                    <p className="text-sm text-gray-500">{t.subtitle}</p>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-500">{t.company}</label>
                    <select value={company} onChange={e => setCompany(e.target.value)} className="h-9 border border-gray-200 rounded-lg px-3 text-sm">
                        <option value="">{t.allCompanies}</option>
                        {companies.map(c => <option key={c.name} value={c.name}>{c.company_name}</option>)}
                    </select>
                </div>
                <Button onClick={load} disabled={loading} variant="outline" className="h-9">
                    <RefreshCw className={cn('w-4 h-4 me-2', loading && 'animate-spin')} />{t.refresh}
                </Button>
            </div>

            {error && (
                <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" /><p className="text-sm">{error}</p>
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="w-8 px-2" />
                            {[t.period, t.start, t.end, t.company_col, t.status, t.actions].map(h => (
                                <th key={h} className="px-4 py-3 text-start text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? Array.from({ length: 4 }).map((_, i) => (
                            <tr key={i}>
                                <td className="px-2 py-3" />
                                {Array.from({ length: 6 }).map((_, j) => (
                                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                                ))}
                            </tr>
                        )) : periods.length === 0 ? (
                            <tr><td colSpan={7} className="text-center py-12 text-gray-400 text-xs px-4">{t.noData}</td></tr>
                        ) : periods.map(p => {
                            const status = periodStatus(p)
                            const closedCount = p.closed_documents.filter(d => d.closed).length
                            const totalCount = p.closed_documents.length
                            const isExpanded = expanded === p.name
                            return (
                                <>
                                    <tr key={p.name} className={cn('hover:bg-gray-50', status === 'closed' && 'bg-slate-50/60')}>
                                        <td className="px-2 py-3">
                                            {totalCount > 0 && (
                                                <button onClick={() => setExpanded(isExpanded ? null : p.name)} className="p-0.5 hover:bg-gray-200 rounded">
                                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{p.period_name}</td>
                                        <td className="px-4 py-3 text-gray-600">{p.start_date}</td>
                                        <td className="px-4 py-3 text-gray-600">{p.end_date}</td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">{p.company ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            {status === 'closed' ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
                                                    <Lock className="w-3 h-3" />{t.closed}
                                                </span>
                                            ) : status === 'partial' ? (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                                    <Lock className="w-3 h-3" />{t.partial} ({closedCount} {t.ofTotal} {totalCount})
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                                                    <Unlock className="w-3 h-3" />{t.open}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Button
                                                size="sm"
                                                variant={status === 'closed' ? 'outline' : 'default'}
                                                disabled={toggling === p.name || totalCount === 0}
                                                onClick={() => toggle(p)}
                                                className={cn('h-7 text-xs', status !== 'closed' && 'bg-slate-700 hover:bg-slate-800 text-white')}
                                            >
                                                {status === 'closed' ? <Unlock className="w-3 h-3 me-1" /> : <Lock className="w-3 h-3 me-1" />}
                                                {status === 'closed' ? t.reopen : t.close}
                                            </Button>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr key={`${p.name}_detail`}>
                                            <td colSpan={7} className="px-6 py-3 bg-gray-50/50">
                                                {totalCount === 0 ? (
                                                    <p className="text-xs text-gray-400 italic">{t.noClosedDocs}</p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-2">
                                                        {p.closed_documents.map((d, idx) => (
                                                            <span
                                                                key={idx}
                                                                className={cn(
                                                                    'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border',
                                                                    d.closed
                                                                        ? 'bg-red-50 border-red-200 text-red-700'
                                                                        : 'bg-green-50 border-green-200 text-green-700'
                                                                )}
                                                            >
                                                                {d.closed ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                                                                {d.document_type}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
