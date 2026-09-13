'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { formatSAR } from '@/lib/format'
import { useCompany } from '@/hooks/use-company'
import { useToast } from '@/hooks/use-toast'
import { frappeClient } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, Search, Calendar } from 'lucide-react'

interface FixedAssignment {
  name: string
  employee: string
  employee_name?: string
  base?: number
  from_date?: string
}

interface AdditionalItem {
  name: string
  employee: string
  employee_name?: string
  salary_component: string
  type: 'Earning' | 'Deduction'
  amount: number
  payroll_date: string
}

interface EmployeeRow {
  employee: string
  employee_name: string
  baseSalary: number
  earnings: number
  deductions: number
  netSalary: number
}

export function SalaryStatistics() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const { company: activeCompany } = useCompany()
  const [loading, setLoading] = useState(true)
  const [allAssignments, setAllAssignments] = useState<FixedAssignment[]>([])
  const [allAdditionals, setAllAdditionals] = useState<AdditionalItem[]>([])
  const [employees, setEmployees] = useState<EmployeeRow[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  
  // Default to current month range (last 3 months to current)
  const getCurrentMonth = () => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }
  const getThreeMonthsAgo = () => {
    const now = new Date()
    now.setMonth(now.getMonth() - 2)
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  }
  const [startMonth, setStartMonth] = useState(getThreeMonthsAgo())
  const [endMonth, setEndMonth] = useState(getCurrentMonth())

  useEffect(() => { load() }, [activeCompany])
  useEffect(() => {
    if (allAssignments.length > 0 || allAdditionals.length > 0) {
      recomputeEmployees()
    }
  }, [startMonth, endMonth])

  const load = async () => {
    setLoading(true)
    try {
      // Only submitted rows are real payroll. Without the docstatus filter this
      // report added cancelled and still-draft assignments/additions into the totals.
      const assignmentFilters: any[] = [['Salary Structure Assignment', 'docstatus', '=', 1]]
      const additionalFilters: any[] = [['Additional Salary', 'docstatus', '=', 1]]
      if (activeCompany) {
        assignmentFilters.push(['Salary Structure Assignment', 'company', '=', activeCompany])
        additionalFilters.push(['Additional Salary', 'company', '=', activeCompany])
      }
      const [assignments, additionals] = await Promise.all([
        frappeClient.getSalaryStructureAssignments({
          fields: ['name', 'employee', 'employee_name', 'base', 'from_date'],
          limit_page_length: 0,
          order_by: 'from_date asc',
          filters: assignmentFilters,
        }),
        frappeClient.getAdditionalSalaries({
          fields: ['name', 'employee', 'employee_name', 'salary_component', 'type', 'amount', 'payroll_date'],
          limit_page_length: 0,
          filters: additionalFilters,
        }),
      ])

      setAllAssignments(assignments as FixedAssignment[])
      setAllAdditionals(additionals as AdditionalItem[])
      
      const rows = computeEmployeeRows(
        assignments as FixedAssignment[],
        additionals as AdditionalItem[],
        startMonth,
        endMonth
      )
      setEmployees(rows)
    } catch {
      toast({ title: t('pay.stats.load_fail'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const recomputeEmployees = () => {
    const rows = computeEmployeeRows(allAssignments, allAdditionals, startMonth, endMonth)
    setEmployees(rows)
  }

  const computeEmployeeRows = (
    assignments: FixedAssignment[],
    additionals: AdditionalItem[],
    fromMonth: string,
    toMonth: string
  ): EmployeeRow[] => {
    const employeeMap = new Map<string, EmployeeRow>()

    // Filter additionals by month range (format: YYYY-MM)
    const filteredAdditionals = additionals.filter(item => {
      if (!item.payroll_date) return false
      const itemMonth = item.payroll_date.substring(0, 7) // Get YYYY-MM from YYYY-MM-DD
      return itemMonth >= fromMonth && itemMonth <= toMonth
    })

    // Salary revisions produce several assignments per employee. Take the latest
    // one that is already in force at the end of the window — the previous code
    // just let whichever row arrived last win, so a revised salary could show
    // either the old or the new base depending on fetch order.
    // Compared as ISO strings, so a nominal "-31" is a safe upper bound for any
    // month: every real date in toMonth sorts below it, every later date above.
    const lastDayOfRange = `${toMonth}-31`
    const latestByEmployee = new Map<string, FixedAssignment>()
    assignments.forEach(a => {
      if (a.from_date && a.from_date > lastDayOfRange) return
      const current = latestByEmployee.get(a.employee)
      if (!current || (a.from_date || '') >= (current.from_date || '')) {
        latestByEmployee.set(a.employee, a)
      }
    })

    latestByEmployee.forEach(a => {
      employeeMap.set(a.employee, {
        employee: a.employee,
        employee_name: a.employee_name || a.employee,
        baseSalary: a.base || 0,
        earnings: 0,
        deductions: 0,
        netSalary: a.base || 0,
      })
    })

    // Add additional salaries (earnings/deductions) - filtered by month
    filteredAdditionals.forEach(item => {
      const existing = employeeMap.get(item.employee)
      if (existing) {
        if (item.type === 'Earning') {
          existing.earnings += item.amount
        } else {
          existing.deductions += item.amount
        }
        existing.netSalary = existing.baseSalary + existing.earnings - existing.deductions
      } else {
        // Employee has additional salary but no base (shouldn't happen due to validation, but handle it)
        const earnings = item.type === 'Earning' ? item.amount : 0
        const deductions = item.type === 'Deduction' ? item.amount : 0
        employeeMap.set(item.employee, {
          employee: item.employee,
          employee_name: item.employee_name || item.employee,
          baseSalary: 0,
          earnings,
          deductions,
          netSalary: earnings - deductions,
        })
      }
    })

    return Array.from(employeeMap.values()).sort((a, b) => 
      a.employee_name.localeCompare(b.employee_name, isRTL ? 'ar' : 'en')
    )
  }

  const formatCurrency = (value: number) => formatSAR(value, 2)


  const exportToExcel = () => {
    if (filteredEmployees.length === 0) {
      toast({ title: t('pay.stats.no_data'), variant: 'destructive' })
      return
    }

    // Build CSV content
    const startDate = new Date(startMonth + '-01T00:00:00')
    const endDate = new Date(endMonth + '-01T00:00:00')
    const startMonthYear = startDate.toLocaleDateString(isRTL ? 'ar-SA-u-nu-latn' : 'en-US', {
      year: 'numeric',
      month: 'short',
    })
    const endMonthYear = endDate.toLocaleDateString(isRTL ? 'ar-SA-u-nu-latn' : 'en-US', {
      year: 'numeric',
      month: 'short',
    })
    const dateRange = `${startMonthYear} - ${endMonthYear}`
    
    const headers = [
      t('pay.ssa.employee'),
      t('pay.ssa.base'),
      t('pay.stats.total_earnings'),
      t('pay.stats.total_deductions'),
      t('pay.stats.net_salary'),
    ]
    
    const escapeCsv = (v: string | number | null | undefined) => {
      const s = v == null ? '' : String(v)
      if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        return '"' + s.replace(/"/g, '""') + '"'
      }
      return s
    }

    const csvRows = [
      `"${t('pay.stats.title')} - ${dateRange}"`,
      headers.join(','),
      ...filteredEmployees.map(emp => [
        `"${(emp.employee_name || '').replace(/"/g, '""')}"`,
        emp.baseSalary,
        emp.earnings,
        emp.deductions,
        emp.netSalary,
      ].join(','))
    ]

    const csvContent = csvRows.join('\n')
    const BOM = '\uFEFF' // UTF-8 BOM for Excel Arabic support
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', `salary_report_${startMonth}_to_${endMonth}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast({ title: t('pay.stats.export_success') })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Filter employees based on search query
  const filteredEmployees = employees.filter(emp =>
    emp.employee_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    emp.employee.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalBaseSalary = filteredEmployees.reduce((sum, emp) => sum + emp.baseSalary, 0)
  const totalEarnings = filteredEmployees.reduce((sum, emp) => sum + emp.earnings, 0)
  const totalDeductions = filteredEmployees.reduce((sum, emp) => sum + emp.deductions, 0)
  const totalNet = filteredEmployees.reduce((sum, emp) => sum + emp.netSalary, 0)

  const startDate = new Date(startMonth + '-01T00:00:00')
  const endDate = new Date(endMonth + '-01T00:00:00')
  const startMonthDisplay = startDate.toLocaleDateString(isRTL ? 'ar-SA-u-nu-latn' : 'en-US', {
    year: 'numeric',
    month: 'long',
  })
  const endMonthDisplay = endDate.toLocaleDateString(isRTL ? 'ar-SA-u-nu-latn' : 'en-US', {
    year: 'numeric',
    month: 'long',
  })
  const dateRangeDisplay = startMonth === endMonth ? startMonthDisplay : `${startMonthDisplay} - ${endMonthDisplay}`

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-xl font-bold">{t('pay.stats.title')}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Calendar className="h-4 w-4" />
                  <span>{dateRangeDisplay}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground/90">{t('pay.stats.from_month')}</label>
                  <input
                    type="month"
                    value={startMonth}
                    onChange={(e) => setStartMonth(e.target.value)}
                    className="px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    max={endMonth}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-foreground/90">{t('pay.stats.to_month')}</label>
                  <input
                    type="month"
                    value={endMonth}
                    onChange={(e) => setEndMonth(e.target.value)}
                    className="px-3 py-2 border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    min={startMonth}
                    max={getCurrentMonth()}
                  />
                </div>
                <Button onClick={exportToExcel} variant="outline" size="sm" disabled={filteredEmployees.length === 0}>
                  <Download className="h-4 w-4 mr-2" />
                  {t('pay.stats.export_excel')}
                </Button>
              </div>
            </div>
            {employees.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input
                  placeholder={t('pay.stats.search_employees')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <p className="text-center text-muted-foreground/70 py-8 text-base">{t('pay.stats.no_employees')}</p>
          ) : filteredEmployees.length === 0 ? (
            <p className="text-center text-muted-foreground/70 py-8 text-base">{t('pay.stats.no_results')}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-bold text-base">{t('pay.ssa.employee')}</TableHead>
                    <TableHead className="text-right font-bold text-base">{t('pay.ssa.base')}</TableHead>
                    <TableHead className="text-right font-bold text-base">{t('pay.stats.earnings')}</TableHead>
                    <TableHead className="text-right font-bold text-base">{t('pay.stats.deductions')}</TableHead>
                    <TableHead className="text-right font-bold text-base">{t('pay.stats.net_salary')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.employee} className="hover:bg-accent/50">
                      <TableCell className="font-semibold text-base">{emp.employee_name}</TableCell>
                      <TableCell className="text-right text-base tabular-nums">{formatCurrency(emp.baseSalary)}</TableCell>
                      <TableCell className="text-right text-base text-green-600 font-medium tabular-nums">
                        {emp.earnings > 0 ? `+${formatCurrency(emp.earnings)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-base text-red-600 font-medium tabular-nums">
                        {emp.deductions > 0 ? `-${formatCurrency(emp.deductions)}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-bold text-base tabular-nums">{formatCurrency(emp.netSalary)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-accent border-t-2 border-primary/20">
                    <TableCell className="font-bold text-base">{t('pay.stats.total')}</TableCell>
                    <TableCell className="text-right font-bold text-base tabular-nums">{formatCurrency(totalBaseSalary)}</TableCell>
                    <TableCell className="text-right text-green-700 font-bold text-base tabular-nums">
                      {totalEarnings > 0 ? `+${formatCurrency(totalEarnings)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right text-red-700 font-bold text-base tabular-nums">
                      {totalDeductions > 0 ? `-${formatCurrency(totalDeductions)}` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg tabular-nums">{formatCurrency(totalNet)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
