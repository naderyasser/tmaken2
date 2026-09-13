'use client'

/**
 * DataTable — one reusable, RTL-aware table shared across the Freelancer
 * Workspace (Clients, Proposals, Invoices). It owns search, multi-filter,
 * column sorting, client-side pagination, row selection + bulk actions, a row
 * action menu, empty/loading/error states, and CSV / Print export.
 *
 * It is token-themed (uses --primary/--accent/--muted), so it renders deep
 * Saudi-green inside `.theme-freelancer` and the ERP theme elsewhere — which is
 * why the (ERP-shared) Proposals list can use it too.
 *
 * Caller supplies only DATA columns; the select + actions columns are injected.
 *
 * Usage:
 *   <DataTable
 *     rows={rows} getRowId={r => r.id} isRTL={isRTL}
 *     columns={[{ id:'name', header:'Name', cell:r => r.name, sortable:true,
 *                 sortAccessor:r => r.name, exportAccessor:r => r.name }]}
 *     searchable searchAccessor={r => `${r.name} ${r.phone}`}
 *     filters={[{ id:'type', label:'Type', value:typeFilter, onChange:setTypeFilter,
 *                 options:[{value:'all',label:'All'},...], predicate:(r,v)=>r.type===v }]}
 *     rowActions={[{ id:'edit', label:'Edit', icon:Pencil, onSelect:openEdit }]}
 *     bulkActions={[{ id:'del', label:'Delete', icon:Trash2, destructive:true, onSelect:bulkDelete }]}
 *     exportFilename="clients" exportTitle="Clients"
 *     onRowClick={openDetail}
 *   />
 */

import * as React from 'react'
import { useMemo, useState } from 'react'
import {
  Search, ArrowUp, ArrowDown, ChevronsUpDown, MoreHorizontal, Printer,
  ChevronLeft, ChevronRight, X, Inbox, FileSpreadsheet, FilterX,
  Download, ChevronDown, Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { exportRowsToCsv, printRows, type ExportColumn } from '@/lib/export-utils'
import { usePersistedState } from '@/lib/freelancer/use-table-prefs'
import { DateRangeFilter, type DateRange } from '@/components/freelancer/shared/date-range-filter'

type Align = 'start' | 'end' | 'center'

export interface DataTableColumn<T> {
  id: string
  header: string
  cell: (row: T) => React.ReactNode
  align?: Align
  sortable?: boolean
  /** Comparable value for sorting; required when `sortable`. */
  sortAccessor?: (row: T) => string | number
  /** Plain value for CSV/print export; column is skipped from export if omitted. */
  exportAccessor?: (row: T) => string | number | null | undefined
  className?: string
  headerClassName?: string
  hideOnMobile?: boolean
}

export interface DataTableFilter {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  /** Returns true to keep the row; called only when value !== 'all'. */
  predicate: (row: any, value: string) => boolean
  width?: string
}

export interface DataTableRowAction<T> {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onSelect: (row: T) => void
  destructive?: boolean
  hidden?: (row: T) => boolean
  separatorBefore?: boolean
}

export interface DataTableBulkAction<T> {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onSelect: (rows: T[]) => void
  destructive?: boolean
}

export interface DataTableDateFilter<T> {
  value: DateRange
  onChange: (range: DateRange) => void
  /** row → ISO yyyy-mm-dd to compare; rows with no date are excluded while a range is active. */
  accessor: (row: T) => string | null | undefined
  label?: string
  lang?: 'ar' | 'en'
}

interface DataTableProps<T> {
  rows: T[]
  columns: DataTableColumn<T>[]
  getRowId: (row: T) => string
  isRTL?: boolean

  loading?: boolean
  error?: string | null
  onRetry?: () => void

  searchable?: boolean
  searchAccessor?: (row: T) => string
  searchPlaceholder?: string

  filters?: DataTableFilter[]
  /** Optional "between dates" filter rendered alongside the select filters. */
  dateFilter?: DataTableDateFilter<T>

  rowActions?: DataTableRowAction<T>[]
  onRowClick?: (row: T) => void

  bulkActions?: DataTableBulkAction<T>[]

  /** Enables the Export (CSV) + Print buttons; export uses the full filtered set. */
  exportFilename?: string
  exportTitle?: string
  exportColumns?: ExportColumn<T>[]

  /** Default rows-per-page; the user can change it via the footer selector.
   *  Pass ALL_ROWS (0) to list everything on one page — paging a set people
   *  need to scan end-to-end just hides most of it behind arrows. Doing so
   *  also adds "All" to the selector, which is why it is opt-in: on a table
   *  of tens of thousands of rows that option is a frozen tab. */
  pageSize?: number
  /** When set, remembers search / sort / page-size in localStorage under this key. */
  persistKey?: string
  emptyIcon?: React.ComponentType<{ className?: string }>
  emptyMessage?: string
  /** Guided empty-state (shown only when there's genuinely no data, not when
   *  filters hide everything): a helpful sub-line + a primary call-to-action. */
  emptyDescription?: string
  emptyActionLabel?: string
  emptyAction?: () => void
  /** Extra toolbar content rendered at the trailing edge (e.g. a "New" button). */
  toolbarEnd?: React.ReactNode
  /** Smaller, denser rows. */
  compact?: boolean
}

/** pageSize sentinel meaning "one page, everything on it". */
export const ALL_ROWS = 0

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100]

type SortState = { id: string; dir: 'asc' | 'desc' } | null

export function DataTable<T>(props: DataTableProps<T>) {
  const {
    rows, columns, getRowId, isRTL = false, loading, error, onRetry,
    searchable, searchAccessor, searchPlaceholder,
    filters = [], dateFilter, rowActions = [], onRowClick, bulkActions = [],
    exportFilename, exportTitle, exportColumns,
    pageSize: pageSizeDefault = 15, persistKey,
    emptyIcon: EmptyIcon = Inbox, emptyMessage,
    emptyDescription, emptyActionLabel, emptyAction,
    toolbarEnd, compact,
  } = props

  const tx = (en: string, ar: string) => (isRTL ? ar : en)

  const [search, setSearch] = usePersistedState(persistKey ? `${persistKey}:q` : null, '')
  const [sort, setSort] = usePersistedState<SortState>(persistKey ? `${persistKey}:sort` : null, null)
  const [pageSize, setPageSize] = usePersistedState(persistKey ? `${persistKey}:ps` : null, pageSizeDefault)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const selectable = bulkActions.length > 0
  const alignClass = (a?: Align) => (a === 'end' ? 'text-end' : a === 'center' ? 'text-center' : 'text-start')

  // ---- filter → search → sort ------------------------------------------------
  const processed = useMemo(() => {
    let out = rows

    for (const f of filters) {
      if (f.value && f.value !== 'all') out = out.filter((r) => f.predicate(r, f.value))
    }

    if (dateFilter && (dateFilter.value.from || dateFilter.value.to)) {
      const { from, to } = dateFilter.value
      out = out.filter((r) => {
        const raw = dateFilter.accessor(r)
        if (!raw) return false
        const d = String(raw).slice(0, 10)
        if (from && d < from) return false
        if (to && d > to) return false
        return true
      })
    }

    if (searchable && search.trim() && searchAccessor) {
      const q = search.trim().toLowerCase()
      out = out.filter((r) => searchAccessor(r).toLowerCase().includes(q))
    }

    if (sort) {
      const col = columns.find((c) => c.id === sort.id)
      if (col?.sortAccessor) {
        const acc = col.sortAccessor
        out = [...out].sort((a, b) => {
          const av = acc(a)
          const bv = acc(b)
          let cmp: number
          if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv
          else cmp = String(av).localeCompare(String(bv), isRTL ? 'ar' : 'en', { numeric: true })
          return sort.dir === 'asc' ? cmp : -cmp
        })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filters.map((f) => f.value).join('|'), dateFilter?.value.from, dateFilter?.value.to, search, sort, columns, searchable, isRTL])

  const dateActive = !!(dateFilter && (dateFilter.value.from || dateFilter.value.to))
  const hasActiveFilters =
    !!search.trim() || filters.some((f) => f.value && f.value !== 'all') || dateActive

  const clearAllFilters = () => {
    setSearch('')
    filters.forEach((f) => f.onChange('all'))
    dateFilter?.onChange({ from: '', to: '' })
  }

  // Reset to first page whenever the result set changes shape.
  const filterKey =
    filters.map((f) => f.value).join('|') + '::' + search + '::' +
    (sort ? sort.id + sort.dir : '') + '::' + (dateFilter ? dateFilter.value.from + '~' + dateFilter.value.to : '') +
    '::' + pageSize
  const lastKey = React.useRef(filterKey)
  if (lastKey.current !== filterKey) {
    lastKey.current = filterKey
    if (page !== 1) setPage(1)
  }

  // Only a table that declares ALL_ROWS as its default offers "All" in the
  // selector; every other table keeps the fixed sizes it always had.
  const allowsAllRows = pageSizeDefault === ALL_ROWS
  const showingAll = pageSize === ALL_ROWS
  const pageCount = showingAll ? 1 : Math.max(1, Math.ceil(processed.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageRows = showingAll
    ? processed
    : processed.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // ---- selection -------------------------------------------------------------
  const selectedRows = useMemo(
    () => processed.filter((r) => selected.has(getRowId(r))),
    [processed, selected, getRowId],
  )
  const allOnPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(getRowId(r)))
  const someSelected = selectedRows.length > 0

  const toggleAllFiltered = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) processed.forEach((r) => next.add(getRowId(r)))
      else processed.forEach((r) => next.delete(getRowId(r)))
      return next
    })
  }
  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }
  const clearSelection = () => setSelected(new Set())

  // ---- export ----------------------------------------------------------------
  const resolvedExportColumns: ExportColumn<T>[] = useMemo(() => {
    if (exportColumns) return exportColumns
    return columns
      .filter((c) => c.exportAccessor)
      .map((c) => ({ header: c.header, value: c.exportAccessor!, align: c.align }))
  }, [exportColumns, columns])

  const canExport = !!exportFilename && resolvedExportColumns.length > 0
  const doCsv = () => exportRowsToCsv(exportFilename!, resolvedExportColumns, processed)
  const doPrint = () =>
    printRows(
      {
        title: exportTitle || exportFilename!,
        subtitle: tx(`${processed.length} records`, `${processed.length} سجل`),
        isRTL,
      },
      resolvedExportColumns,
      processed,
    )

  // ---- sort toggle -----------------------------------------------------------
  const toggleSort = (col: DataTableColumn<T>) => {
    if (!col.sortable) return
    setSort((prev) => {
      if (!prev || prev.id !== col.id) return { id: col.id, dir: 'asc' }
      if (prev.dir === 'asc') return { id: col.id, dir: 'desc' }
      return null
    })
  }

  const totalCols = columns.length + (selectable ? 1 : 0) + (rowActions.length ? 1 : 0)

  // ---- render ----------------------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-3" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {searchable && (
            <div className="relative min-w-[220px] flex-1 sm:max-w-sm md:max-w-md">
              <Search className={cn('absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground', isRTL ? 'right-3' : 'left-3')} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder || tx('Search…', 'بحث…')}
                aria-label={searchPlaceholder || tx('Search', 'بحث')}
                className={cn('h-9', isRTL ? 'pr-9' : 'pl-9')}
              />
            </div>
          )}
          {filters.map((f) => {
            // The selected option's label can be long (e.g. a full company
            // name) and the trigger truncates it — surface the full text on hover.
            const selectedLabel = f.options.find((o) => o.value === f.value)?.label ?? f.label
            return (
            <Select key={f.id} value={f.value} onValueChange={f.onChange}>
              <SelectTrigger aria-label={f.label} title={selectedLabel} className={cn('h-9', f.width || 'w-[150px]')}>
                <SelectValue placeholder={f.label} />
              </SelectTrigger>
              <SelectContent>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            )
          })}
          {dateFilter && (
            <DateRangeFilter
              value={dateFilter.value}
              onChange={dateFilter.onChange}
              isRTL={isRTL}
              lang={dateFilter.lang}
              label={dateFilter.label}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {canExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-1.5" title={tx('Export', 'تصدير')}>
                  <Download className="h-4 w-4" />
                  {tx('Export', 'تصدير')}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                <DropdownMenuItem onClick={doCsv} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  {tx('Excel (CSV)', 'إكسل (CSV)')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={doPrint} className="gap-2">
                  <Printer className="h-4 w-4" />
                  {tx('Print / PDF', 'طباعة / PDF')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {toolbarEnd}
        </div>
      </div>

      {/* Active-filter chips — each removable, plus a quick clear-all */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          {searchable && search.trim() && (
            <FilterChip label={`${tx('Search', 'بحث')}: ${search.trim()}`} onRemove={() => setSearch('')} isRTL={isRTL} />
          )}
          {filters.filter((f) => f.value && f.value !== 'all').map((f) => (
            <FilterChip
              key={f.id}
              label={f.options.find((o) => o.value === f.value)?.label ?? f.value}
              onRemove={() => f.onChange('all')}
              isRTL={isRTL}
            />
          ))}
          {dateActive && dateFilter && (
            <FilterChip
              label={dateFilter.label || tx('Date range', 'نطاق التاريخ')}
              onRemove={() => dateFilter.onChange({ from: '', to: '' })}
              isRTL={isRTL}
            />
          )}
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-muted-foreground hover:text-foreground" onClick={clearAllFilters}>
            <FilterX className="h-3.5 w-3.5" />
            {tx('Clear all', 'مسح الكل')}
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{error}</span>
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>{tx('Retry', 'إعادة المحاولة')}</Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Bulk action bar */}
      {selectable && someSelected && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-accent px-3 py-2">
          <span className="text-sm font-medium text-accent-foreground">
            {tx(`${selectedRows.length} selected`, `${selectedRows.length} محدد`)}
          </span>
          <div className="flex-1" />
          {bulkActions.map((a) => (
            <Button
              key={a.id}
              size="sm"
              variant={a.destructive ? 'destructive' : 'outline'}
              className="h-8"
              onClick={() => a.onSelect(selectedRows)}
            >
              {a.icon && <a.icon className={cn('h-3.5 w-3.5', isRTL ? 'ml-1.5' : 'mr-1.5')} />}
              {a.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" className="h-8" onClick={clearSelection}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                {selectable && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={(c) => toggleAllFiltered(!!c)}
                      aria-label={tx('Select all', 'تحديد الكل')}
                    />
                  </TableHead>
                )}
                {columns.map((col) => {
                  const active = sort?.id === col.id
                  return (
                    <TableHead
                      key={col.id}
                      // aria-sort lives on the columnheader (its valid role). The
                      // interactive part is a REAL <button> inside — putting
                      // role="button" on the th made aria-sort invalid (axe
                      // aria-allowed-attr) and broke the columnheader semantics.
                      aria-sort={
                        col.sortable
                          ? active
                            ? sort!.dir === 'asc' ? 'ascending' : 'descending'
                            : 'none'
                          : undefined
                      }
                      className={cn(
                        'text-xs font-semibold',
                        alignClass(col.align),
                        col.hideOnMobile && 'hidden md:table-cell',
                        col.headerClassName,
                      )}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col)}
                          className={cn(
                            'inline-flex items-center gap-1 select-none rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            col.align === 'end' && 'flex-row-reverse',
                          )}
                        >
                          {col.header}
                          {active ? (
                            sort!.dir === 'asc'
                              ? <ArrowUp className="h-3.5 w-3.5 text-primary" />
                              : <ArrowDown className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                          )}
                        </button>
                      ) : (
                        <span className={cn('inline-flex items-center gap-1', col.align === 'end' && 'flex-row-reverse')}>
                          {col.header}
                        </span>
                      )}
                    </TableHead>
                  )
                })}
                {rowActions.length > 0 && (
                  <TableHead className="w-12 text-end text-xs font-semibold">
                    {tx('Actions', 'إجراءات')}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={totalCols} className="py-16 text-center text-muted-foreground">
                    {hasActiveFilters ? (
                      <>
                        <FilterX className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                        <p className="font-medium">{tx('No results for these filters', 'لا توجد نتائج لهذه التصفية')}</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={clearAllFilters}>
                          <FilterX className={cn('h-4 w-4', isRTL ? 'ml-1.5' : 'mr-1.5')} />
                          {tx('Clear filters', 'مسح التصفية')}
                        </Button>
                      </>
                    ) : (
                      <div className="mx-auto flex max-w-sm flex-col items-center py-4">
                        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                          <EmptyIcon className="h-7 w-7 text-muted-foreground/50" />
                        </div>
                        <p className="font-medium text-foreground">{emptyMessage || tx('No records yet', 'لا توجد سجلات بعد')}</p>
                        {emptyDescription && (
                          <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
                        )}
                        {emptyAction && emptyActionLabel && (
                          <Button size="sm" className="mt-4 gap-1.5" onClick={emptyAction}>
                            <Plus className="h-4 w-4" />
                            {emptyActionLabel}
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => {
                  const id = getRowId(row)
                  const isSel = selected.has(id)
                  const visibleActions = rowActions.filter((a) => !a.hidden?.(row))
                  return (
                    <TableRow
                      key={id}
                      data-state={isSel ? 'selected' : undefined}
                      className={cn(
                        'odd:bg-background even:bg-muted/20 hover:bg-accent/40 data-[state=selected]:bg-accent/60',
                        onRowClick && 'cursor-pointer',
                      )}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                    >
                      {selectable && (
                        <TableCell className={cn(compact ? 'py-1.5' : 'py-2.5')} onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSel}
                            onCheckedChange={(c) => toggleOne(id, !!c)}
                            aria-label={tx('Select row', 'تحديد الصف')}
                          />
                        </TableCell>
                      )}
                      {columns.map((col) => (
                        <TableCell
                          key={col.id}
                          className={cn(
                            compact ? 'py-1.5' : 'py-2.5',
                            alignClass(col.align),
                            col.hideOnMobile && 'hidden md:table-cell',
                            col.className,
                          )}
                        >
                          {col.cell(row)}
                        </TableCell>
                      ))}
                      {rowActions.length > 0 && (
                        <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                          {visibleActions.length > 0 && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label={tx('Row actions', 'إجراءات الصف')} title={tx('Row actions', 'إجراءات الصف')}>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align={isRTL ? 'start' : 'end'}>
                                {visibleActions.map((a) => (
                                  <React.Fragment key={a.id}>
                                    {a.separatorBefore && <DropdownMenuSeparator />}
                                    <DropdownMenuItem
                                      className={cn(a.destructive && 'text-destructive focus:text-destructive')}
                                      onSelect={() => a.onSelect(row)}
                                    >
                                      {a.icon && <a.icon className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />}
                                      {a.label}
                                    </DropdownMenuItem>
                                  </React.Fragment>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer: count + pagination */}
        {processed.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-3">
              <span>
                {showingAll
                  ? tx(`Showing all ${processed.length}`, `عرض الكل — ${processed.length}`)
                  : tx(
                      `Showing ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, processed.length)} of ${processed.length}`,
                      `عرض ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, processed.length)} من ${processed.length}`,
                    )}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs">{tx('Rows', 'صفوف')}</span>
                <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1) }}>
                  <SelectTrigger className="h-8 w-[70px]" aria-label={tx('Rows per page', 'صفوف لكل صفحة')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                    {allowsAllRows && (
                      <SelectItem value={String(ALL_ROWS)}>{tx('All', 'الكل')}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline" size="sm" className="h-8 w-8 p-0"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                  aria-label={tx('Previous page', 'الصفحة السابقة')}
                  title={tx('Previous page', 'الصفحة السابقة')}
                >
                  {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
                <span className="px-2 text-xs">
                  {tx(`Page ${currentPage} / ${pageCount}`, `صفحة ${currentPage} / ${pageCount}`)}
                </span>
                <Button
                  variant="outline" size="sm" className="h-8 w-8 p-0"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                  aria-label={tx('Next page', 'الصفحة التالية')}
                  title={tx('Next page', 'الصفحة التالية')}
                >
                  {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

/**
 * Small helper for cells: renders a MUTED placeholder for empty values so an
 * empty cell reads as "no value" rather than a stark bare dash.
 *
 * Pass `isRTL` to get a localized word ("غير محدد" / "Unassigned"); omit it to
 * keep the muted em-dash. The extra param is optional, so existing call sites
 * (`emptyDash(x)`) are unaffected.
 */
export function emptyDash(v: React.ReactNode, isRTL?: boolean): React.ReactNode {
  if (v === null || v === undefined || v === '') {
    const placeholder = isRTL === undefined ? '—' : isRTL ? 'غير محدد' : 'Unassigned'
    return <span className="text-muted-foreground">{placeholder}</span>
  }
  return v
}

/** Removable active-filter chip shown in the toolbar's filter-summary row. */
function FilterChip({ label, onRemove, isRTL }: { label: string; onRemove: () => void; isRTL?: boolean }) {
  return (
    <span title={label} className="inline-flex items-center gap-1 rounded-full border border-border bg-accent/60 py-1 ps-2.5 pe-1 text-xs font-medium text-foreground">
      <span className="max-w-[180px] truncate" title={label}>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={isRTL ? `إزالة ${label}` : `Remove ${label}`}
        className="flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:bg-muted-foreground/20 hover:text-foreground"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
