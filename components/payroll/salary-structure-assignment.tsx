'use client'

import { useState, useEffect } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { formatDateShort, formatSAR } from '@/lib/format'
import { useCompany } from '@/hooks/use-company'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface Assignment {
  name: string
  employee: string
  employee_name?: string
  salary_structure: string
  from_date: string
  base?: number
}

interface EmployeeOption {
  name: string
  employee_name: string
  company?: string
}

interface StructureOption {
  name: string
  company?: string
  /** Salary Structure.is_active is a Select — the strings "Yes"/"No", not a flag. */
  is_active?: string
  currency?: string
}

/** "No" is a truthy string, so `if (s.is_active)` happily picks a disabled structure. */
const isActiveStructure = (s?: StructureOption) => s?.is_active === 'Yes'

// Canonical dd/mm/yyyy (Gregorian, Latin digits) — never the browser's m/d/yyyy.
const formatSafeDate = (value?: string) => (value ? formatDateShort(value) || '—' : '—')

export function SalaryStructureAssignment() {
  const { t } = useI18n()
  const { toast } = useToast()
  const { company: activeCompany } = useCompany()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [employees, setEmployees] = useState<EmployeeOption[]>([])
  const [structures, setStructures] = useState<StructureOption[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [form, setForm] = useState({
    employee: '',
    from_date: new Date().toISOString().split('T')[0],
    base: 0,
  })

  useEffect(() => { load() }, [activeCompany])

  const isCompatibilityError = (error: unknown, fieldName: string) => {
    const message = error instanceof Error ? error.message : String(error)
    return new RegExp(`unknown column|unknown field|invalid field|cannot resolve field|${fieldName}`, 'i').test(message)
  }

  const loadAssignments = async (filters?: any[]): Promise<Assignment[]> => {
    const activeFilters = [...(filters || []), ['Salary Structure Assignment', 'docstatus', '!=', 2]]
    try {
      return await frappeClient.getSalaryStructureAssignments({
        fields: ['name', 'employee', 'employee_name', 'salary_structure', 'from_date', 'base', 'docstatus'],
        order_by: 'creation desc',
        filters: activeFilters,
      })
    } catch (error) {
      if (isCompatibilityError(error, 'company') || isCompatibilityError(error, 'docstatus')) {
        try {
          return await frappeClient.getSalaryStructureAssignments({
            fields: ['name', 'employee', 'employee_name', 'salary_structure', 'from_date', 'base'],
            order_by: 'creation desc',
          })
        } catch {}
      }
      throw error
    }
  }

  const loadEmployees = async (filters?: any[]): Promise<EmployeeOption[]> => {
    try {
      return await frappeClient.getEmployees({
        fields: ['name', 'employee_name', 'company'],
        filters,
      })
    } catch (error) {
      if (filters?.length && isCompatibilityError(error, 'company')) {
        return frappeClient.getEmployees({ fields: ['name', 'employee_name', 'company'] })
      }
      throw error
    }
  }

  const loadSalaryStructures = async (filters?: any[]): Promise<StructureOption[]> => {
    const primaryFields: Array<keyof StructureOption> = ['name', 'company', 'is_active']

    try {
      return await frappeClient.getSalaryStructures({
        fields: primaryFields as string[],
        filters,
      })
    } catch (error) {
      if (filters?.length && isCompatibilityError(error, 'company')) {
        return loadSalaryStructures()
      }

      const isFieldCompatibilityIssue = isCompatibilityError(error, 'is_active')

      if (!isFieldCompatibilityIssue) {
        throw error
      }

      let fallbackStructures: StructureOption[]
      try {
        fallbackStructures = await frappeClient.getSalaryStructures({
          fields: ['name', 'company'],
          filters,
        })
      } catch (fallbackError) {
        if (filters?.length && isCompatibilityError(fallbackError, 'company')) {
          fallbackStructures = await frappeClient.getSalaryStructures({
            fields: ['name', 'company'],
          })
        } else {
          throw fallbackError
        }
      }

      return fallbackStructures.map((structure) => ({
        ...structure,
        is_active: 'Yes',
      }))
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const employeeFilters: any[] = activeCompany ? [['Employee', 'company', '=', activeCompany]] : []
      const structureFilters: any[] = activeCompany ? [['Salary Structure', 'company', '=', activeCompany]] : []
      const assignmentFilters: any[] = activeCompany ? [['Salary Structure Assignment', 'company', '=', activeCompany]] : []
      const [aData, eData, sData] = await Promise.all([
        loadAssignments(assignmentFilters.length ? assignmentFilters : undefined),
        loadEmployees(employeeFilters.length ? employeeFilters : undefined),
        loadSalaryStructures(structureFilters.length ? structureFilters : undefined),
      ])

      // If company-scoped fetch has no rows, fallback to all structures so admins can still assign.
      const structuresData = activeCompany && sData.length === 0
        ? await loadSalaryStructures()
        : sData

      setAssignments(aData)
      setEmployees(eData)
      setStructures(structuresData)
    } catch {
      toast({ title: t('pay.ssa.load_fail'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const getCompanyCurrency = async (company: string): Promise<string> => {
    try {
      const res = await frappeClient.get('Company', company, { fields: ['default_currency'] })
      return res.data?.default_currency || 'SAR'
    } catch {
      return 'SAR'
    }
  }

  /** Cancelling a draft is a no-op, not an error — anything else must surface. */
  const cancelDoc = async (doctype: string, name: string): Promise<void> => {
    const docstatus = await frappeClient.get(doctype, name)
      .then((r) => (r.data as any)?.docstatus)
      .catch(() => undefined)
    if (docstatus !== 1) return
    await frappeClient.call('frappe.client.cancel', { doctype, name })
  }

  /**
   * A draft Salary Structure Assignment is invisible to payroll — Payroll Entry
   * only collects submitted ones. Swallowing this failure told the user the
   * salary was assigned while it silently stayed in draft.
   */
  const submitDoc = async (doctype: string, name: string): Promise<void> => {
    const docRes = await frappeClient.get(doctype, name)
    const doc = docRes.data
    if (!doc) throw new Error(`${doctype} ${name} not found`)
    await frappeClient.call('frappe.client.submit', {
      doc: { ...doc, doctype },
    })
  }

  const ensureDefaultStructure = async (company?: string): Promise<StructureOption | null> => {
    try {
      const effectiveCompany = company || activeCompany
      if (!effectiveCompany) {
        console.error('No company available to create salary structure')
        return null
      }

      const currency = await getCompanyCurrency(effectiveCompany)

      try {
        await frappeClient.getSalaryComponent('Basic Salary')
      } catch {
        await frappeClient.createSalaryComponent({
          salary_component: 'Basic Salary',
          type: 'Earning',
          salary_component_abbr: 'BS',
        })
      }

      const structureData: Record<string, any> = {
        __newname: `Default Structure - ${effectiveCompany}`,
        company: effectiveCompany,
        currency,
        payroll_frequency: 'Monthly',
        is_active: 'Yes',
        earnings: [{ salary_component: 'Basic Salary' }],
      }

      const newStructure = await frappeClient.createSalaryStructure(structureData)
      const structureName = newStructure?.name

      if (structureName) {
        await submitDoc('Salary Structure', structureName)
      }

      return {
        name: structureName || '',
        company: effectiveCompany,
        is_active: 'Yes',
      }
    } catch (error) {
      console.error('Failed to auto-create default salary structure:', error)
      return null
    }
  }

  const selectStructureForEmployee = (selectedEmployee?: EmployeeOption): StructureOption | undefined => {
    if (editingAssignment) {
      return structures.find((s) => s.name === editingAssignment.salary_structure)
        || structures.find(isActiveStructure)
        || structures[0]
    }
    return structures.find((s) => selectedEmployee?.company && s.company === selectedEmployee.company && isActiveStructure(s))
      || structures.find((s) => selectedEmployee?.company && s.company === selectedEmployee.company)
      || structures.find((s) => !s.company && isActiveStructure(s))
      || structures.find(isActiveStructure)
      || structures[0]
  }

  const assign = async () => {
    if (!form.employee || !form.from_date) {
      toast({ title: t('pay.ssa.required_fields'), variant: 'destructive' })
      return
    }

    const selectedEmployee = employees.find((employee) => employee.name === form.employee)
    let selectedStructure: StructureOption | null | undefined = selectStructureForEmployee(selectedEmployee)

    if (!selectedStructure) {
      toast({ title: t('pay.ssa.creating_structure') })
      const company = selectedEmployee?.company || activeCompany || undefined
      selectedStructure = await ensureDefaultStructure(company)
      if (selectedStructure) {
        setStructures(prev => [...prev, selectedStructure!])
      }
    }

    if (!selectedStructure) {
      toast({ title: t('pay.ssa.structure_create_fail'), variant: 'destructive' })
      return
    }

    if (
      selectedEmployee?.company &&
      selectedStructure.company &&
      selectedEmployee.company !== selectedStructure.company
    ) {
      toast({ title: t('pay.ssa.company_mismatch'), variant: 'destructive' })
      return
    }

    try {
      const effectiveCompany = selectedEmployee?.company || activeCompany || selectedStructure.company || ''
      const currency = selectedStructure.currency || await getCompanyCurrency(effectiveCompany).catch(() => 'SAR')

      const payload: Record<string, any> = {
        employee: form.employee,
        salary_structure: selectedStructure.name,
        from_date: form.from_date,
        company: effectiveCompany,
        currency,
      }

      if (form.base > 0) {
        payload.base = form.base
      }

      const findExistingAssignment = async () => {
        const directMatch = assignments.find((assignment) => assignment.employee === form.employee)
        if (directMatch) return directMatch

        try {
          const data = await frappeClient.getSalaryStructureAssignments({
            fields: ['name', 'employee', 'salary_structure', 'from_date', 'base'],
            filters: [
              ['Salary Structure Assignment', 'employee', '=', form.employee],
              // The caller cancels whatever this returns, and only a submitted
              // document can be cancelled. Without the filter a newer cancelled
              // row wins, cancelDoc no-ops on it, and the still-submitted
              // assignment survives alongside the one we are about to create.
              ['Salary Structure Assignment', 'docstatus', '=', 1],
            ],
            order_by: 'creation desc',
            limit_page_length: 1,
          })
          return data[0] || null
        } catch {
          return null
        }
      }

      if (editingAssignment) {
        await cancelDoc('Salary Structure Assignment', editingAssignment.name)
        const newAssignment = await frappeClient.createSalaryStructureAssignment(payload)
        if (newAssignment?.name) {
          await submitDoc('Salary Structure Assignment', newAssignment.name)
        }
        toast({ title: t('pay.ssa.updated') })
      } else {
        const existingAssignment = await findExistingAssignment()
        if (existingAssignment?.name) {
          await cancelDoc('Salary Structure Assignment', existingAssignment.name)
          const newAssignment = await frappeClient.createSalaryStructureAssignment(payload)
          if (newAssignment?.name) {
            await submitDoc('Salary Structure Assignment', newAssignment.name)
          }
          toast({ title: t('pay.ssa.updated') })
        } else {
          const newAssignment = await frappeClient.createSalaryStructureAssignment(payload)
          if (newAssignment?.name) {
            await submitDoc('Salary Structure Assignment', newAssignment.name)
          }
          toast({ title: t('pay.ssa.assigned') })
        }
      }
      setDialogOpen(false)
      setEditingAssignment(null)
      setForm({ employee: '', from_date: new Date().toISOString().split('T')[0], base: 0 })
      load()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast({
        title: editingAssignment ? t('pay.ssa.update_fail') : t('pay.ssa.assign_fail'),
        description: message,
        variant: 'destructive',
      })
    }
  }

  const startEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment)
    setForm({
      employee: assignment.employee,
      from_date: assignment.from_date || new Date().toISOString().split('T')[0],
      base: assignment.base ?? 0,
    })
    setDialogOpen(true)
  }

  const closeDialog = (open: boolean) => {
    setDialogOpen(open)
    if (!open) {
      setEditingAssignment(null)
      setForm({ employee: '', from_date: new Date().toISOString().split('T')[0], base: 0 })
    }
  }

  const remove = async (name: string) => {
    try {
      await cancelDoc('Salary Structure Assignment', name)
      await frappeClient.deleteSalaryStructureAssignment(name)
      toast({ title: t('pay.ssa.deleted') })
      load()
    } catch (error) {
      toast({ title: t('pay.ssa.delete_fail'), description: String(error), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('pay.ssa.title')}</h2>
        <Button aria-label="إضافة" title="إضافة" onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> {t('pay.ssa.assign')}
        </Button>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('pay.ssa.employee')}</TableHead>
              <TableHead>{t('pay.ssa.from_date')}</TableHead>
              <TableHead className="text-right">{t('pay.ssa.base')}</TableHead>
              <TableHead className="text-right">{t('pay.comp.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : assignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  {t('pay.ssa.no_found')}
                </TableCell>
              </TableRow>
            ) : (
              assignments.map((a) => (
                <TableRow key={a.name}>
                  <TableCell className="font-medium">{a.employee_name || a.employee || '—'}</TableCell>
                  <TableCell className="tabular-nums">{formatSafeDate(a.from_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{a.base != null ? formatSAR(a.base) : '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button aria-label={t('pay.ssa.edit')} variant="ghost" size="sm" onClick={() => startEdit(a)}>
                      <Pencil className="h-4 w-4 text-primary" />
                    </Button>
                    <Button aria-label={t('pay.ssa.delete')} variant="ghost" size="sm" onClick={() => setPendingDelete(a.name)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAssignment ? t('pay.ssa.edit_title') : t('pay.ssa.assign_title')}</DialogTitle>
            <DialogDescription>{t('pay.ssa.dialog_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{t('pay.ssa.employee')}</Label>
              <Select value={form.employee} onValueChange={(v) => setForm({ ...form, employee: v })}>
                <SelectTrigger aria-label={t('pay.ssa.select_employee')}><SelectValue placeholder={t('pay.ssa.select_employee')} /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.name} value={e.name}>{e.employee_name} ({e.name})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('pay.ssa.from_date')}</Label>
              <Input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{t('pay.ssa.base')}</Label>
              <Input type="number" value={form.base || ''} onChange={(e) => setForm({ ...form, base: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => closeDialog(false)}>{t('pay.ssa.cancel')}</Button>
            <Button onClick={assign}>{editingAssignment ? t('pay.ssa.save') : t('pay.ssa.assign')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('pay.ssa.delete_confirm')}
        onConfirm={() => { if (pendingDelete) { remove(pendingDelete); setPendingDelete(null) } }}
      />
    </div>
  )
}
