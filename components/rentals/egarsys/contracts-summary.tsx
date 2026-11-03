'use client'

// Ported from egarsys src/components/sections/contracts-summary.tsx (مختصر العقارات).
// Read-only printable report of the company's contracts. Mechanical changes vs the
// original: data fetch (getContracts) → the mirror adapter getContractsList; zustand
// store → useRentalsShell(); @/components/ui/* → scoped ui; @/lib/* → scoped copies.
// The طباعة flow (browser window.print() of the on-screen table) is real, unchanged.

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Search, Printer, X, ChevronsUpDown } from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { CompanyHeaderLogo } from './ui/company-header-logo'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Checkbox } from './ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { DatePicker } from './ui/date-picker'
import { Skeleton } from './ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select'
import { getContractsList } from '@/lib/rentals/contracts-data'
import type { RentalContract } from './types'
import { formatSAR, formatDate } from './format'
import { toast } from 'sonner'
import PrintFooter from './print-footer'
import { useRentalsShell } from './store'

const PRINT_CSS = `
@media print {
  body * { visibility: hidden; }
  #printable-summary, #printable-summary * { visibility: visible; }
  #printable-summary { position: absolute; left: 0; top: 0; width: 100%; padding: 0; }
  header, nav, aside, .no-print { display: none !important; }
  .print-warning { display: none !important; }
}
`

type FilterMode = 'all' | 'id-range' | 'date-range'

export default function ContractsSummarySection() {
  const [rawContracts, setRawContracts] = useState<RentalContract[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [startId, setStartId] = useState('')
  const [endId, setEndId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedCities, setSelectedCities] = useState<string[]>([])

  const { setCurrentSection, setPendingFocus } = useRentalsShell()

  // "تاريخ الإضافة" — egarsys reads createdAt; the mirror carries the Frappe
  // `creation` timestamp (camelized as `creation`), falling back to startDate.
  const addedDate = (c: RentalContract): string =>
    (c.createdAt as string) || (c.creation as string) || c.startDate || ''

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getContractsList({ search: searchQuery || undefined })
      setRawContracts(data || [])
    } catch (error) {
      toast.error('فشل تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }, [searchQuery])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  // Distinct property cities present in the loaded contracts (data-driven, sorted Arabic).
  const cityOptions = useMemo(() => {
    const set = new Set<string>()
    for (const c of rawContracts) {
      const city = (c.propertyCity || '').trim()
      if (city) set.add(city)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'))
  }, [rawContracts])

  // Apply the client-side filters (contract-number range, date range, cities) on top of
  // the server-side search. The printed report reflects exactly this filtered set.
  const contracts = useMemo(() => {
    let filtered = rawContracts

    if (filterMode === 'id-range') {
      const s = parseInt(startId)
      const e = parseInt(endId)
      if (!isNaN(s) && !isNaN(e)) {
        filtered = filtered.filter(c => c.internalId && c.internalId >= s && c.internalId <= e)
      }
    }

    if (filterMode === 'date-range') {
      const s = startDate ? new Date(startDate) : null
      const e = endDate ? new Date(endDate) : null
      if (s || e) {
        filtered = filtered.filter(c => {
          const d = new Date(addedDate(c))
          if (s && d < s) return false
          if (e && d > e) return false
          return true
        })
      }
    }

    if (selectedCities.length > 0) {
      filtered = filtered.filter(c => selectedCities.includes((c.propertyCity || '').trim()))
    }

    return filtered
  }, [rawContracts, filterMode, startId, endId, startDate, endDate, selectedCities])

  const handlePrint = () => {
    window.print()
  }

  const toggleCity = (city: string, checked: boolean) => {
    setSelectedCities(prev => checked ? [...prev, city] : prev.filter(c => c !== city))
  }

  // Click a contract number/name → jump to the Contracts section and open its detail.
  const openContract = useCallback((c: RentalContract) => {
    if (c.internalId) {
      setPendingFocus({ section: 'contracts', contentType: 'contract', key: String(c.internalId) })
    }
    setCurrentSection('contracts')
  }, [setPendingFocus, setCurrentSection])

  const resetFilters = () => {
    setFilterMode('all'); setStartId(''); setEndId(''); setStartDate(''); setEndDate('')
    setSelectedCities([]); setSearchInput('')
  }

  const grandTotal = contracts.reduce((sum, c) => sum + (c.rentAmount || 0), 0)

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* Print CSS — injected via plain style tag for app dir compatibility */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="no-print flex flex-col md:flex-row md:items-end justify-between gap-4 bg-gradient-to-r from-slate-50/50 to-transparent dark:from-slate-950/20 p-6 rounded-2xl border border-slate-100/50 dark:border-slate-900/40">
        <div>
          <div className="flex items-center gap-3"><CompanyHeaderLogo className="h-11" /><h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">مختصر العقارات</h1></div>
          <p className="text-slate-500 text-sm mt-1 font-medium">
            تقرير مختصر للعقود للطباعة
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-lg shadow-blue-600/20 font-semibold">
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
        </div>
      </div>

      {/* Filters – hidden when printing */}
      <Card className="no-print border-slate-100">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>نوع الفلتر</Label>
              <Select value={filterMode} onValueChange={(v) => setFilterMode(v as FilterMode)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="id-range">نطاق رقم العقد</SelectItem>
                  <SelectItem value="date-range">نطاق التاريخ</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filterMode === 'id-range' && (
              <div className="flex items-end gap-2">
                <div className="space-y-2">
                  <Label>من رقم العقد</Label>
                  <Input
                    type="number"
                    className="w-[120px]"
                    value={startId}
                    onChange={(e) => setStartId(e.target.value)}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>إلى رقم العقد</Label>
                  <Input
                    type="number"
                    className="w-[120px]"
                    value={endId}
                    onChange={(e) => setEndId(e.target.value)}
                    placeholder="7"
                  />
                </div>
              </div>
            )}

            {filterMode === 'date-range' && (
              <div className="flex items-end gap-2">
                <div className="space-y-2">
                  <Label>من تاريخ</Label>
                  <DatePicker value={startDate} onChange={setStartDate} />
                </div>
                <div className="space-y-2">
                  <Label>إلى تاريخ</Label>
                  <DatePicker value={endDate} onChange={setEndDate} />
                </div>
              </div>
            )}

            {/* نطاق المدن — multi-select cities (filters by the property's city) */}
            <div className="space-y-2">
              <Label>نطاق المدن</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-between font-normal">
                    <span className="truncate">
                      {selectedCities.length === 0 ? 'كل المدن' : `${selectedCities.length} مدينة محددة`}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[230px] p-2" align="start">
                  <div className="max-h-[260px] overflow-y-auto space-y-0.5">
                    {cityOptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-2 text-center">لا توجد مدن في النتائج</p>
                    ) : (
                      cityOptions.map(city => (
                        <label key={city} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                          <Checkbox
                            checked={selectedCities.includes(city)}
                            onCheckedChange={(ck) => toggleCity(city, ck === true)}
                          />
                          <span className="truncate">{city}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedCities.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full mt-1 text-xs" onClick={() => setSelectedCities([])}>
                      مسح التحديد
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2 flex-1 min-w-0 sm:min-w-[200px]">
              <Label>بحث</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  className="pr-9"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="الاسم، الجوال، المدينة، رقم العقد..."
                />
              </div>
            </div>

            <Button variant="outline" size="icon" onClick={resetFilters} title="مسح الفلاتر">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Selected-cities chips for quick removal */}
          {selectedCities.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedCities.map(city => (
                <button
                  key={city}
                  onClick={() => toggleCity(city, false)}
                  className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-xs px-2.5 py-1 hover:bg-blue-100"
                >
                  {city}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading state — outside printable area */}
      {loading && (
        <Card>
          <CardContent className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          </CardContent>
        </Card>
      )}

      {/* Printable Summary */}
      <div id="printable-summary">
        {!loading && (
          <>
            {/* Print Header */}
            <div className="mb-4 border-b-2 border-slate-800 pb-3">
              <h2 className="text-xl font-bold text-center">مختصر العقارات</h2>
              <p className="text-sm text-slate-500 text-center mt-1">
                تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')} | عدد العقود: {contracts.length} | إجمالي الإيجارات: {formatSAR(grandTotal)}
              </p>
              {selectedCities.length > 0 && (
                <p className="text-sm text-slate-500 text-center mt-0.5">المدن: {selectedCities.join('، ')}</p>
              )}
            </div>

            <div className="overflow-x-auto border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-100">
                    <TableHead className="text-right whitespace-nowrap font-bold">#</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">تاريخ الإضافة</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">الاسم</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">المدينة</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">رقم العقد</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">رقم عقد المنصة</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">رقم العقد الموجود</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">رقم الجوال</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">تاريخ البداية</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">تاريخ النهاية</TableHead>
                    <TableHead className="text-right whitespace-nowrap font-bold">الإيجار</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        لا توجد عقود
                      </TableCell>
                    </TableRow>
                  ) : (
                    contracts.map((c, i) => (
                      <TableRow key={c.id} className="print:border-b print:border-slate-200">
                        <TableCell className="text-xs">{i + 1}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(addedDate(c))}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <button
                            onClick={() => openContract(c)}
                            className="text-right text-blue-700 hover:underline print:text-slate-900 print:no-underline"
                            title="فتح تفاصيل العقد"
                          >
                            {c.tenantName || '—'}
                          </button>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{c.propertyCity || '—'}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap" dir="ltr">
                          <button
                            onClick={() => openContract(c)}
                            className="text-blue-700 hover:underline print:text-slate-900 print:no-underline"
                            title="فتح تفاصيل العقد"
                          >
                            {c.contractNumber}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap" dir="ltr">{c.platformContractNumber || c.ejarContractNumber || '—'}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap" dir="ltr">{c.internalId || '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap" dir="ltr">{c.tenantPhone || '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(c.startDate)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(c.endDate)}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap font-medium">{formatSAR(c.rentAmount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <PrintFooter />
          </>
        )}
      </div>
    </div>
  )
}
