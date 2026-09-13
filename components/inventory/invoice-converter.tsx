'use client'

/**
 * تحويل الفواتير — batch supplier-invoice converter.
 *
 * The client receives parts invoices from the supplier as legacy .xls files
 * (17 columns, header buried under title rows). This tool converts any number
 * of them at once into the two formats their own system expects:
 *   - Excel (.xlsx) with columns FITEMNO / FQTY / FPRICE / FDISC
 *   - dBase (.dbf) — byte-compatible with their existing DBF files
 * Part codes are re-formatted from the supplier's dash-less form
 * (9031150064 → 90311-50064). Columns are auto-detected; a manual mapping
 * editor covers any future format drift.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
    parseTabularFile, guessMapping, applyMapping, dashifyToyotaCode,
    writeDbf, writeXlsx, buildZip, downloadBytes,
    type RawTable, type ColumnMapping, type InvoiceLine,
} from '@/lib/invoice-file'
import {
    FileSpreadsheet, Upload, Download, Trash2, Loader2, CheckCircle2,
    AlertTriangle, Settings2, FileArchive,
} from 'lucide-react'

interface ConvFile {
    name: string
    raw: RawTable
    mapping: ColumnMapping
    error?: string
}

/** INV_..._2026_1.xls → INV_..._2026_updated_1 (mirrors the client's naming). */
function outputBase(name: string): string {
    const base = name.replace(/\.[^.]+$/, '')
    const m = base.match(/^(.*)_(\d+)$/)
    return m ? `${m[1]}_updated_${m[2]}` : `${base}_updated`
}

/** Arabic names for the column headers that appear in supplier files, so the
 *  mapping dropdowns aren't a wall of English for an Arabic-only user. The
 *  original header is kept alongside because it has to be matched against the
 *  file, and unknown headers pass through untouched. */
const SOURCE_HEADER_AR: Record<string, string> = {
    'date': 'التاريخ',
    'sold to party': 'المشتري',
    'ship to party': 'المستلم',
    'sales order number': 'رقم أمر البيع',
    'invoice number': 'رقم الفاتورة',
    'customer order number': 'رقم طلب العميل',
    'total net price without vat': 'إجمالي الصافي قبل الضريبة',
    'total net price with vat': 'إجمالي الصافي بعد الضريبة',
    'part number': 'رقم القطعة',
    'part name': 'اسم القطعة',
    'issued quantity': 'الكمية المصروفة',
    'case number': 'رقم الحالة',
    'unit price': 'سعر الوحدة',
    'discount %': 'نسبة الخصم %',
    'net price without vat': 'الصافي قبل الضريبة',
    'vat %': 'نسبة الضريبة %',
    'net price with vat': 'الصافي بعد الضريبة',
    // target-format files (.dbf / converted .xlsx) carry these instead
    'fitemno': 'كود الصنف',
    'fqty': 'الكمية',
    'fprice': 'السعر',
    'fdisc': 'الخصم %',
}

function headerLabel(header: string, isRTL: boolean, index: number): string {
    const h = (header || '').trim()
    if (!h) return isRTL ? `(عمود ${index + 1})` : `(col ${index + 1})`
    if (!isRTL) return h
    const ar = SOURCE_HEADER_AR[h.toLowerCase()]
    return ar ? `${ar} — ${h}` : h
}

const mappingComplete = (m: ColumnMapping) => m.code >= 0 && m.qty >= 0

export function InvoiceConverter() {
    const { isRTL } = useI18n()
    const { toast } = useToast()
    const inputRef = useRef<HTMLInputElement>(null)
    const [files, setFiles] = useState<ConvFile[]>([])
    const [parsing, setParsing] = useState(false)
    const [dashify, setDashify] = useState(true)
    const [showMapping, setShowMapping] = useState(false)

    const linesFor = useCallback((f: ConvFile): InvoiceLine[] => {
        if (f.error || !mappingComplete(f.mapping)) return []
        const lines = applyMapping(f.raw, f.mapping)
        return dashify ? lines.map((l) => ({ ...l, item_code: dashifyToyotaCode(l.item_code) })) : lines
    }, [dashify])

    const allLines = useMemo(() => files.map((f) => ({ f, lines: linesFor(f) })), [files, linesFor])

    const handleFiles = async (list: FileList | null) => {
        if (!list?.length) return
        setParsing(true)
        const next: ConvFile[] = []
        for (const file of Array.from(list)) {
            try {
                const raw = await parseTabularFile(file)
                if (!raw.rows.length) throw new Error(isRTL ? 'لا توجد بيانات في الملف' : 'No data rows')
                next.push({ name: file.name, raw, mapping: guessMapping(raw) })
            } catch (e: any) {
                next.push({ name: file.name, raw: { headers: [], rows: [] }, mapping: { code: -1, qty: -1, price: -1, disc: -1 }, error: e?.message || 'parse error' })
            }
        }
        setFiles((prev) => [...prev, ...next])
        setParsing(false)
        const bad = next.filter((f) => f.error || !mappingComplete(f.mapping)).length
        toast(bad
            ? { title: isRTL ? `تمت قراءة ${next.length - bad} ملفاً — ${bad} يحتاج مراجعة` : `${next.length - bad} parsed, ${bad} need review`, variant: 'destructive' }
            : { title: isRTL ? `تمت قراءة ${next.length} ملفاً بنجاح` : `Parsed ${next.length} file(s)` })
    }

    const downloadOne = (f: ConvFile, kind: 'xlsx' | 'dbf') => {
        const lines = linesFor(f)
        if (!lines.length) return
        const base = outputBase(f.name)
        if (kind === 'xlsx') downloadBytes(`${base}.xlsx`, writeXlsx(lines), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        else downloadBytes(`${base}.dbf`, writeDbf(lines), 'application/x-dbf')
    }

    const downloadAllZip = () => {
        const entries: Array<{ path: string; data: Uint8Array }> = []
        for (const { f, lines } of allLines) {
            if (!lines.length) continue
            const base = outputBase(f.name)
            entries.push({ path: `${base}.xlsx`, data: writeXlsx(lines) })
            entries.push({ path: `${base}.dbf`, data: writeDbf(lines) })
        }
        if (!entries.length) return
        downloadBytes(`invoices_converted_${new Date().toISOString().slice(0, 10)}.zip`, buildZip(entries), 'application/zip')
        toast({ title: isRTL ? `تم تجهيز ${entries.length / 2} فاتورة (Excel + DBF)` : `${entries.length / 2} invoice(s) packed` })
    }

    // Manual mapping editor edits the FIRST reviewable file and can stamp all.
    const editIdx = files.findIndex((f) => !f.error)
    const editFile = editIdx >= 0 ? files[editIdx] : null
    const setMapping = (patch: Partial<ColumnMapping>, applyAll: boolean) => {
        setFiles((prev) => prev.map((f, i) => {
            if (f.error) return f
            if (!applyAll && i !== editIdx) return f
            return { ...f, mapping: { ...f.mapping, ...patch } }
        }))
    }

    const totalLines = allLines.reduce((t, x) => t + x.lines.length, 0)
    const readyCount = allLines.filter((x) => x.lines.length > 0).length

    const FIELD_LABELS: Array<{ key: keyof ColumnMapping; ar: string; en: string }> = [
        { key: 'code', ar: 'كود الصنف (FITEMNO)', en: 'Item code (FITEMNO)' },
        { key: 'qty', ar: 'الكمية (FQTY)', en: 'Quantity (FQTY)' },
        { key: 'price', ar: 'السعر (FPRICE)', en: 'Price (FPRICE)' },
        { key: 'disc', ar: 'الخصم % (FDISC)', en: 'Discount % (FDISC)' },
    ]

    return (
        <div className="p-6 space-y-4 max-w-[1100px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-50"><FileSpreadsheet className="h-5 w-5 text-indigo-600" /></div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">{isRTL ? 'تحويل الفواتير' : 'Invoice Converter'}</h2>
                        <p className="text-xs text-gray-500">
                            {isRTL
                                ? 'حوّل فواتير الشركة (Excel) إلى صيغة النظام: Excel مرتّب + ملف DBF'
                                : 'Convert supplier invoices to the target Excel + DBF formats'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <input ref={inputRef} type="file" multiple accept=".xls,.xlsx,.xlsm,.csv,.txt,.dbf" className="hidden"
                        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }} />
                    <Button onClick={() => inputRef.current?.click()} disabled={parsing} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        {parsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        <span className={cn('text-xs', isRTL ? 'mr-1.5' : 'ml-1.5')}>{isRTL ? 'رفع فواتير الشركة' : 'Upload invoices'}</span>
                    </Button>
                    {files.length > 0 && (
                        <Button variant="outline" onClick={() => setFiles([])}>
                            <Trash2 className="h-4 w-4" />
                            <span className={cn('text-xs', isRTL ? 'mr-1.5' : 'ml-1.5')}>{isRTL ? 'مسح القائمة' : 'Clear'}</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Options */}
            <div className="flex items-center gap-4 flex-wrap bg-white rounded-xl border border-gray-100 px-4 py-3">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={dashify} onChange={(e) => setDashify(e.target.checked)} className="accent-indigo-600" />
                    {isRTL ? 'تنسيق أكواد تويوتا (9031150064 ← 90311-50064)' : 'Format Toyota codes (9031150064 → 90311-50064)'}
                </label>
                <button onClick={() => setShowMapping((v) => !v)} className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800">
                    <Settings2 className="h-3.5 w-3.5" />
                    {isRTL ? 'تعديل تخطيط الأعمدة' : 'Edit column mapping'}
                </button>
            </div>

            {/* Manual mapping editor */}
            {showMapping && editFile && (
                <div className="bg-white rounded-xl border border-indigo-100 p-4 space-y-3">
                    <p className="text-xs text-gray-500">
                        {isRTL ? `تخطيط الأعمدة (من ملف: ${editFile.name}) — يُطبق على كل الملفات` : `Column mapping (from ${editFile.name}) — applied to all files`}
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {FIELD_LABELS.map(({ key, ar, en }) => (
                            <div key={key}>
                                <label className="text-[11px] font-medium text-gray-600 mb-1 block">{isRTL ? ar : en}</label>
                                <select
                                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-xs"
                                    value={editFile.mapping[key]}
                                    onChange={(e) => setMapping({ [key]: Number(e.target.value) } as Partial<ColumnMapping>, true)}
                                >
                                    <option value={-1}>{isRTL ? '— بدون —' : '— none —'}</option>
                                    {editFile.raw.headers.map((h, i) => (
                                        <option key={i} value={i}>{headerLabel(h, isRTL, i)}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {files.length === 0 && (
                <button onClick={() => inputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-200 hover:border-indigo-300 rounded-2xl py-14 text-center transition-colors">
                    <FileSpreadsheet className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600">
                        {isRTL ? 'ارفع فواتير الشركة هنا (ممكن مئات الملفات مرة واحدة)' : 'Upload supplier invoices (hundreds at once is fine)'}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">.xls · .xlsx · .csv · .dbf</p>
                </button>
            )}

            {/* Files table */}
            {files.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                        <p className="text-xs text-gray-600 font-medium">
                            {isRTL ? `${files.length} ملف — ${totalLines} سطر جاهز للتحويل` : `${files.length} file(s) — ${totalLines} lines ready`}
                        </p>
                        <Button size="sm" onClick={downloadAllZip} disabled={readyCount === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <FileArchive className="h-4 w-4" />
                            <span className={cn('text-xs', isRTL ? 'mr-1.5' : 'ml-1.5')}>
                                {isRTL ? `تنزيل الكل في ملف مضغوط (${readyCount})` : `Download all ZIP (${readyCount})`}
                            </span>
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                                    <th className={cn('px-4 py-2.5 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'الملف' : 'File'}</th>
                                    <th className="px-4 py-2.5 font-medium text-center">{isRTL ? 'السطور' : 'Lines'}</th>
                                    <th className={cn('px-4 py-2.5 font-medium', isRTL ? 'text-right' : 'text-left')}>{isRTL ? 'أول صنف' : 'First item'}</th>
                                    <th className="px-4 py-2.5 font-medium text-center">{isRTL ? 'الحالة' : 'Status'}</th>
                                    <th className="px-4 py-2.5 font-medium text-center">{isRTL ? 'تنزيل' : 'Download'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {allLines.map(({ f, lines }, i) => (
                                    <tr key={i} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-2.5 text-xs font-mono text-gray-700 max-w-[300px] truncate" dir="ltr">{f.name}</td>
                                        <td className="px-4 py-2.5 text-center font-semibold">{lines.length || '—'}</td>
                                        <td className="px-4 py-2.5 text-xs font-mono text-gray-500" dir="ltr">{lines[0]?.item_code || '—'}</td>
                                        <td className="px-4 py-2.5 text-center">
                                            {f.error ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-red-600"><AlertTriangle className="h-3.5 w-3.5" />{isRTL ? 'فشل القراءة' : 'Failed'}</span>
                                            ) : lines.length ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />{isRTL ? 'جاهز' : 'Ready'}</span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-xs text-amber-600"><AlertTriangle className="h-3.5 w-3.5" />{isRTL ? 'راجع التخطيط' : 'Check mapping'}</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-700" disabled={!lines.length} onClick={() => downloadOne(f, 'xlsx')}>
                                                    <Download className="h-3 w-3" /><span className={isRTL ? 'mr-1' : 'ml-1'}>{isRTL ? 'ملف Excel' : 'Excel'}</span>
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 text-xs text-indigo-700" disabled={!lines.length} onClick={() => downloadOne(f, 'dbf')}>
                                                    <Download className="h-3 w-3" /><span className={isRTL ? 'mr-1' : 'ml-1'}>{isRTL ? 'ملف DBF' : 'DBF'}</span>
                                                </Button>
                                                <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-gray-100">
                                                    <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Preview of the first ready file */}
            {allLines.find((x) => x.lines.length > 0) && (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">{isRTL ? 'معاينة الناتج (أول 5 سطور)' : 'Output preview (first 5 lines)'}</p>
                    <table className="w-full text-xs" dir="ltr">
                        <thead><tr className="text-gray-500 border-b">
                            {([['FITEMNO', 'كود الصنف', 'left'], ['FQTY', 'الكمية', 'right'], ['FPRICE', 'السعر', 'right'], ['FDISC', 'الخصم %', 'right']] as Array<[string, string, 'left' | 'right']>).map(([code, ar, align]) => (
                                <th key={code} className={cn('py-1.5', align === 'left' ? 'text-left' : 'text-right')}>
                                    <span className="block">{code}</span>
                                    {isRTL && <span className="block font-normal text-[10px] text-gray-400" dir="rtl">{ar}</span>}
                                </th>
                            ))}
                        </tr></thead>
                        <tbody className="font-mono">
                            {allLines.find((x) => x.lines.length > 0)!.lines.slice(0, 5).map((l, i) => (
                                <tr key={i} className="border-b border-gray-50">
                                    <td className="py-1">{l.item_code}</td>
                                    <td className="py-1 text-right">{Number(l.qty).toFixed(2)}</td>
                                    <td className="py-1 text-right">{Number(l.rate || 0).toFixed(2)}</td>
                                    <td className="py-1 text-right">{Number(l.disc || 0).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
