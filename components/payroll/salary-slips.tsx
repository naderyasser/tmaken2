'use client'

import { useState, useEffect, useCallback } from 'react'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { formatDateShort, formatSAR } from '@/lib/format'
import { translateDepartment } from '@/lib/enums'
import { useCompany } from '@/hooks/use-company'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { FileText, Loader2, Clock, RefreshCw, AlertTriangle } from 'lucide-react'

interface SlipRow {
    name: string
    employee: string
    employee_name?: string
    department?: string
    company?: string
    start_date: string
    end_date: string
    status?: string
    currency?: string
    gross_pay?: number
    total_deduction?: number
    net_pay?: number
    rounded_total?: number
    absent_days?: number
    payment_days?: number
    total_working_days?: number
}

interface SalaryDetail { salary_component?: string; amount?: number }
interface SlipDetail extends SlipRow {
    earnings?: SalaryDetail[]
    deductions?: SalaryDetail[]
    lateness?: { late_days: number; total_late_minutes: number }
}

const firstOfMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }
const today = () => new Date().toISOString().split('T')[0]

export function SalarySlips() {
    const { isRTL } = useI18n()
    const { company } = useCompany()
    const { toast } = useToast()

    const [filters, setFilters] = useState({ from_date: firstOfMonth(), to_date: today(), employee: '', department: '' })
    const [slips, setSlips] = useState<SlipRow[]>([])
    const [loading, setLoading] = useState(false)
    const [employees, setEmployees] = useState<{ name: string; employee_name?: string }[]>([])
    const [departments, setDepartments] = useState<{ name: string }[]>([])
    const [detail, setDetail] = useState<SlipDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    const money = (n?: number) => formatSAR(n ?? 0, 2)  // grouped Latin digits + ر.س (canonical)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const rows = await frappeClient.getSalarySlipsReport({
                from_date: filters.from_date || undefined,
                to_date: filters.to_date || undefined,
                employee: filters.employee || undefined,
                department: filters.department || undefined,
                company: company || undefined,
            })
            setSlips(rows)
        } catch {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'تعذر تحميل قسائم الرواتب' : 'Could not load salary slips', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }, [filters, company, isRTL, toast])

    useEffect(() => { load() }, [load])

    // Load filter options once.
    useEffect(() => {
        frappeClient.getEmployees({ fields: ['name', 'employee_name'], filters: [['Employee', 'status', '=', 'Active']], limit_page_length: 0 })
            .then((e) => setEmployees(e as any)).catch(() => {})
        frappeClient.getList('Department', { fields: ['name'], limit_page_length: 0, ...(company ? { filters: [['Department', 'company', '=', company]] } : {}) })
            .then((d) => setDepartments(d as any)).catch(() => {})
    }, [company])

    const openDetail = async (name: string) => {
        setDetailLoading(true)
        setDetail({ name } as SlipDetail)
        try {
            const d = await frappeClient.getSalarySlipDetail(name)
            if (d) {
                setDetail(d)
            } else {
                // Without this the dialog keeps spinning on a slip that never loads.
                setDetail(null)
                toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'تعذر تحميل تفاصيل القسيمة' : 'Could not load slip detail', variant: 'destructive' })
            }
        } finally {
            setDetailLoading(false)
        }
    }

    const period = (s: { start_date: string; end_date: string }) => `${formatDateShort(s.start_date)} → ${formatDateShort(s.end_date)}`

    return (
        <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3 bg-muted/40 border border-border rounded-lg p-3">
                <div>
                    <Label className="text-xs text-muted-foreground">{isRTL ? 'من تاريخ' : 'From'}</Label>
                    <Input type="date" value={filters.from_date} onChange={(e) => setFilters(f => ({ ...f, from_date: e.target.value }))} className="h-9 w-40" />
                </div>
                <div>
                    <Label className="text-xs text-muted-foreground">{isRTL ? 'إلى تاريخ' : 'To'}</Label>
                    <Input type="date" value={filters.to_date} onChange={(e) => setFilters(f => ({ ...f, to_date: e.target.value }))} className="h-9 w-40" />
                </div>
                <div className="min-w-[180px]">
                    <Label className="text-xs text-muted-foreground">{isRTL ? 'الموظف' : 'Employee'}</Label>
                    <Select value={filters.employee || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, employee: v === 'all' ? '' : v }))}>
                        <SelectTrigger aria-label={isRTL ? 'الكل' : 'All'} className="h-9"><SelectValue placeholder={isRTL ? 'الكل' : 'All'} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{isRTL ? 'كل الموظفين' : 'All employees'}</SelectItem>
                            {employees.map(e => <SelectItem key={e.name} value={e.name}>{e.employee_name || e.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="min-w-[160px]">
                    <Label className="text-xs text-muted-foreground">{isRTL ? 'القسم' : 'Department'}</Label>
                    <Select value={filters.department || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, department: v === 'all' ? '' : v }))}>
                        <SelectTrigger aria-label={isRTL ? 'الكل' : 'All'} className="h-9"><SelectValue placeholder={isRTL ? 'الكل' : 'All'} /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">{isRTL ? 'كل الأقسام' : 'All departments'}</SelectItem>
                            {departments.map(d => <SelectItem key={d.name} value={d.name}>{translateDepartment(d.name, isRTL ? 'ar' : 'en')}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <Button variant="outline" onClick={load} disabled={loading} className="h-9 gap-1.5">
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    {isRTL ? 'تحديث' : 'Refresh'}
                </Button>
            </div>

            {/* List */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{isRTL ? 'الموظف' : 'Employee'}</TableHead>
                            <TableHead>{isRTL ? 'الفترة' : 'Period'}</TableHead>
                            <TableHead className="text-end">{isRTL ? 'الإجمالي' : 'Gross'}</TableHead>
                            <TableHead className="text-end">{isRTL ? 'إجمالي الخصومات' : 'Total Deductions'}</TableHead>
                            <TableHead className="text-end">{isRTL ? 'صافي الراتب المستحق' : 'Net Pay'}</TableHead>
                            <TableHead>{isRTL ? 'الحالة' : 'Status'}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground/70"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                        ) : slips.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8">
                                <p className="text-muted-foreground/70 mb-3">{isRTL ? 'لا توجد قسائم رواتب في هذه الفترة' : 'No salary slips in this period'}</p>
                                <Button size="sm" variant="outline" onClick={() => setFilters(f => ({ ...f, from_date: '', to_date: '' }))}>
                                    {isRTL ? 'عرض كل الفترات' : 'Show all periods'}
                                </Button>
                            </TableCell></TableRow>
                        ) : slips.map(s => (
                            <TableRow key={s.name} className="cursor-pointer hover:bg-accent/50" onClick={() => openDetail(s.name)}>
                                <TableCell className="font-medium">{s.employee_name || s.employee}</TableCell>
                                <TableCell className="text-xs text-muted-foreground" dir="ltr">{period(s)}</TableCell>
                                <TableCell className="text-end">{money(s.gross_pay)}</TableCell>
                                <TableCell className="text-end text-red-600">{money(s.total_deduction)}</TableCell>
                                <TableCell className="text-end font-semibold text-emerald-700">{money(s.rounded_total || s.net_pay)}</TableCell>
                                <TableCell><span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{s.status}</span></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Detail */}
            <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null) }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-indigo-600" />
                            {isRTL ? 'تفاصيل قسيمة الراتب' : 'Salary Slip Detail'}
                        </DialogTitle>
                        <DialogDescription>
                            {detail?.employee_name || detail?.employee || ''}{detail?.start_date ? ` · ${formatDateShort(detail.start_date)} → ${formatDateShort(detail.end_date)}` : ''}
                        </DialogDescription>
                    </DialogHeader>

                    {detailLoading || !detail?.start_date ? (
                        <div className="py-10 text-center text-muted-foreground/70"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
                    ) : (
                        <div className="space-y-4">
                            {/* Breakdown: earnings + deductions */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="px-3 py-2 bg-emerald-50 text-xs font-semibold text-emerald-700">{isRTL ? 'الاستحقاقات' : 'Earnings'}</div>
                                    <table className="w-full text-sm">
                                        <tbody>
                                            {(detail.earnings || []).map((e, i) => (
                                                <tr key={i} className="border-t border-border/60">
                                                    <td className="px-3 py-1.5 text-muted-foreground">{e.salary_component}</td>
                                                    <td className="px-3 py-1.5 text-end">{money(e.amount)}</td>
                                                </tr>
                                            ))}
                                            {(detail.earnings || []).length === 0 && <tr><td className="px-3 py-2 text-muted-foreground/70 text-xs" colSpan={2}>—</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="px-3 py-2 bg-red-50 text-xs font-semibold text-red-700">{isRTL ? 'الخصومات' : 'Deductions'}</div>
                                    <table className="w-full text-sm">
                                        <tbody>
                                            {(detail.deductions || []).map((d, i) => (
                                                <tr key={i} className="border-t border-border/60">
                                                    <td className="px-3 py-1.5 text-muted-foreground">{d.salary_component}</td>
                                                    <td className="px-3 py-1.5 text-end">{money(d.amount)}</td>
                                                </tr>
                                            ))}
                                            {(detail.deductions || []).length === 0 && <tr><td className="px-3 py-2 text-muted-foreground/70 text-xs" colSpan={2}>—</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Required summary fields */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <div className="border border-border rounded-lg p-2.5">
                                    <p className="text-[11px] text-muted-foreground">{isRTL ? 'إجمالي الخصومات' : 'Total Deductions'}</p>
                                    <p className="text-sm font-semibold text-red-600">{money(detail.total_deduction)}</p>
                                </div>
                                <div className="border border-border rounded-lg p-2.5">
                                    <p className="text-[11px] text-muted-foreground">{isRTL ? 'أيام الغياب' : 'Absence Days'}</p>
                                    <p className="text-sm font-semibold text-foreground">{detail.absent_days ?? 0}</p>
                                </div>
                                <div className="border border-border rounded-lg p-2.5">
                                    <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{isRTL ? 'التأخير' : 'Lateness'}</p>
                                    <p className="text-sm font-semibold text-amber-600">
                                        {detail.lateness?.late_days ?? 0} {isRTL ? 'يوم' : 'days'} · {detail.lateness?.total_late_minutes ?? 0} {isRTL ? 'دقيقة' : 'min'}
                                    </p>
                                </div>
                                <div className="border border-emerald-200 bg-emerald-50/40 rounded-lg p-2.5">
                                    <p className="text-[11px] text-muted-foreground">{isRTL ? 'صافي الراتب المستحق' : 'Net Salary Due'}</p>
                                    <p className="text-sm font-bold text-emerald-700">{money(detail.rounded_total || detail.net_pay)}</p>
                                </div>
                            </div>

                            {/* Lateness is informational; the money already sits in the deductions above */}
                            <p className="text-[11px] text-muted-foreground/70 flex items-start gap-1.5">
                                <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                {isRTL
                                    ? 'التأخير معروض للعلم فقط (أيام ودقائق مشتقة من الحضور). الأثر المالي للتأخير يظهر كبند خصم (غرامة) ضمن الخصومات أعلاه.'
                                    : 'Lateness is informational (days/minutes derived from attendance). Its financial impact appears as a penalty deduction line in Deductions above.'}
                            </p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
