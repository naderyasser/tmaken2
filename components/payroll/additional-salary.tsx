'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { getStatusClass } from '@/lib/status-config'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/lib/i18n'
import { formatDateShort, formatSAR } from '@/lib/format'
import { useCompany } from '@/hooks/use-company'
import { frappeClient } from '@/lib/api-client'
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface AdditionalSalary {
    name: string
    employee: string
    employee_name?: string
    salary_component: string
    type: 'Earning' | 'Deduction'
    amount: number
    payroll_date: string
}

export function AdditionalSalaryList() {
    const { t, isRTL } = useI18n()
    const { toast } = useToast()
    const { company: activeCompany } = useCompany()
    const [items, setItems] = useState<AdditionalSalary[]>([])
    const [employees, setEmployees] = useState<{ name: string; employee_name: string }[]>([])
    const [components, setComponents] = useState<{ name: string; type: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [pendingDelete, setPendingDelete] = useState<string | null>(null)
    const [form, setForm] = useState({
        employee: '',
        salary_component: '',
        type: 'Earning' as 'Earning' | 'Deduction',
        amount: 0,
        payroll_date: new Date().toISOString().split('T')[0],
    })

    useEffect(() => { load() }, [activeCompany])

    const translateComponentName = (name: string) => {
        if (!isRTL) return name
        const key = `pay.add.component_name.${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
        const translated = t(key)
        return translated === key ? name : translated
    }

    // Additional Salary.type is read-only and fetched from the salary component, so
    // the type picked here can never be sent. Use it to narrow the component list
    // instead — otherwise choosing "Deduction" and then an earning component
    // silently books an Earning.
    const componentsForType = components.filter(c => c.type === form.type)

    const load = async () => {
        setLoading(true)
        try {
            const employeeFilters: any[] = activeCompany ? [['Employee', 'company', '=', activeCompany]] : []
            const additionalFilters: any[] = activeCompany ? [['Additional Salary', 'company', '=', activeCompany], ['Additional Salary', 'docstatus', '!=', 2]] : [['Additional Salary', 'docstatus', '!=', 2]]
            const [list, emp, comp] = await Promise.all([
                frappeClient.getAdditionalSalaries({
                    fields: ['name', 'employee', 'employee_name', 'salary_component', 'type', 'amount', 'payroll_date'],
                    order_by: 'payroll_date desc',
                    limit_page_length: 200,
                    filters: additionalFilters.length ? additionalFilters : undefined,
                }),
                frappeClient.getEmployees({ fields: ['name', 'employee_name'], limit_page_length: 500, filters: employeeFilters.length ? employeeFilters : undefined }),
                frappeClient.getSalaryComponents({ fields: ['name', 'type'], limit_page_length: 500 }),
            ])
            setItems(list)
            setEmployees(emp)
            setComponents(comp)
        } catch {
            toast({ title: t('pay.add.load_fail'), variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    const create = async () => {
        if (!form.employee || !form.salary_component || !form.payroll_date) {
            toast({ title: t('pay.add.required'), variant: 'destructive' })
            return
        }
        if (!form.amount || form.amount <= 0) {
            toast({ title: t('pay.add.required'), variant: 'destructive' })
            return
        }
        try {
            const assignmentFilters: any[] = [
                ['Salary Structure Assignment', 'employee', '=', form.employee],
                ['Salary Structure Assignment', 'docstatus', '=', 1],
                ['Salary Structure Assignment', 'from_date', '<=', form.payroll_date],
            ]

            if (activeCompany) {
                assignmentFilters.push(['Salary Structure Assignment', 'company', '=', activeCompany])
            }

            const assignments = await frappeClient.getSalaryStructureAssignments({
                fields: ['name', 'employee', 'salary_structure', 'from_date', 'docstatus'],
                filters: assignmentFilters,
                order_by: 'from_date desc',
                limit_page_length: 1,
            })

            if (!assignments.length) {
                toast({
                    title: t('pay.add.no_assignment_title'),
                    description: t('pay.add.no_assignment_desc'),
                    variant: 'destructive',
                })
                return
            }

            const effectiveCompany = activeCompany || ''
            let currency = 'SAR'
            try {
                const cRes = await frappeClient.get('Company', effectiveCompany, { fields: ['default_currency'] })
                currency = cRes.data?.default_currency || 'SAR'
            } catch {}

            const payload: Record<string, any> = {
                employee: form.employee,
                salary_component: form.salary_component,
                amount: form.amount,
                payroll_date: form.payroll_date,
                company: effectiveCompany,
                currency,
                overwrite_salary_structure_amount: 0,
            }

            const newSalary = await frappeClient.createAdditionalSalary(payload)

            // A draft Additional Salary never reaches a salary slip. Swallowing this
            // failure is how a 1,666 SAR penalty ended up sitting in draft while the
            // user was told it had been created.
            if (newSalary?.name) {
                const docRes = await frappeClient.get('Additional Salary', newSalary.name)
                if (!docRes.data) throw new Error(`Additional Salary ${newSalary.name} not found`)
                await frappeClient.call('frappe.client.submit', {
                    doc: { ...docRes.data, doctype: 'Additional Salary' },
                })
            }

            toast({ title: t('pay.add.created') })
            setDialogOpen(false)
            setForm({ employee: '', salary_component: '', type: 'Earning', amount: 0, payroll_date: new Date().toISOString().split('T')[0] })
            load()
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            const missingStructure = /salary\s*structure|salary\s*structure\s*assignment/i.test(message)

            if (missingStructure) {
                toast({
                    title: t('pay.add.no_assignment_title'),
                    description: t('pay.add.no_assignment_desc'),
                    variant: 'destructive',
                })
                return
            }

            toast({ title: t('pay.add.create_fail'), description: message, variant: 'destructive' })
        }
    }

    const remove = async (name: string) => {
        try {
            try {
                await frappeClient.call('frappe.client.cancel', { doctype: 'Additional Salary', name })
            } catch {}
            await frappeClient.deleteAdditionalSalary(name)
            toast({ title: t('pay.add.deleted') })
            load()
        } catch (error) {
            toast({ title: t('pay.add.delete_fail'), description: String(error), variant: 'destructive' })
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">{t('pay.add.title')}</h2>
                <Button aria-label="إضافة" title="إضافة" onClick={() => setDialogOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-1" /> {t('pay.add.new')}
                </Button>
            </div>

            <div className="border rounded-lg bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('pay.add.employee')}</TableHead>
                            <TableHead>{t('pay.add.component')}</TableHead>
                            <TableHead>{t('pay.add.type')}</TableHead>
                            <TableHead className="text-right">{t('pay.add.amount')}</TableHead>
                            <TableHead>{t('pay.add.date')}</TableHead>
                            <TableHead className="text-right">{t('pay.comp.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">
                                    <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                                </TableCell>
                            </TableRow>
                        ) : items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t('pay.add.empty')}</TableCell>
                            </TableRow>
                        ) : (
                            items.map((item) => (
                                <TableRow key={item.name}>
                                    <TableCell className="font-medium">{item.employee_name || item.employee}</TableCell>
                                    <TableCell>{translateComponentName(item.salary_component)}</TableCell>
                                    <TableCell>
                                        <Badge className={getStatusClass(item.type)}>
                                            {item.type === 'Earning' ? t('pay.comp.earning') : t('pay.comp.deduction')}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">{item.amount != null ? formatSAR(item.amount, 2) : '—'}</TableCell>
                                    <TableCell className="tabular-nums">{formatDateShort(item.payroll_date) || '—'}</TableCell>
                                    <TableCell className="text-right">
                                        <Button aria-label={t('pay.add.delete')} variant="ghost" size="sm" onClick={() => setPendingDelete(item.name)}>
                                            <Trash2 className="h-4 w-4 text-red-600" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('pay.add.new')}</DialogTitle>
                        <DialogDescription>{t('pay.add.dialog_desc')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1">
                            <Label>{t('pay.add.employee')}</Label>
                            <Select value={form.employee} onValueChange={(v) => setForm({ ...form, employee: v })}>
                                <SelectTrigger aria-label={t('pay.add.select_employee')}><SelectValue placeholder={t('pay.add.select_employee')} /></SelectTrigger>
                                <SelectContent>
                                    {employees.map(e => (
                                        <SelectItem key={e.name} value={e.name}>{e.employee_name} ({e.name})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>{t('pay.add.component')}</Label>
                            <Select value={form.salary_component} onValueChange={(v) => setForm({ ...form, salary_component: v })}>
                                <SelectTrigger aria-label={t('pay.add.select_component')}><SelectValue placeholder={t('pay.add.select_component')} /></SelectTrigger>
                                <SelectContent>
                                    {componentsForType.length === 0 ? (
                                        <div className="px-2 py-3 text-xs text-muted-foreground">{t('pay.add.no_components_for_type')}</div>
                                    ) : componentsForType.map(c => (
                                        <SelectItem key={c.name} value={c.name}>{translateComponentName(c.name)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label>{t('pay.add.type')}</Label>
                                <Select
                                    value={form.type}
                                    onValueChange={(v: 'Earning' | 'Deduction') => setForm(f => ({
                                        ...f,
                                        type: v,
                                        salary_component: components.some(c => c.name === f.salary_component && c.type === v) ? f.salary_component : '',
                                    }))}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Earning">{t('pay.comp.earning')}</SelectItem>
                                        <SelectItem value="Deduction">{t('pay.comp.deduction')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>{t('pay.add.amount')}</Label>
                                <Input type="number" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} placeholder="0.00" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label>{t('pay.add.date')}</Label>
                            <Input type="date" value={form.payroll_date} onChange={(e) => setForm({ ...form, payroll_date: e.target.value })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('pay.add.cancel')}</Button>
                        <Button onClick={create}>{t('pay.add.create')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                open={!!pendingDelete}
                onOpenChange={(open) => !open && setPendingDelete(null)}
                title={t('pay.add.delete_confirm')}
                onConfirm={() => { if (pendingDelete) { remove(pendingDelete); setPendingDelete(null) } }}
            />
        </div>
    )
}
