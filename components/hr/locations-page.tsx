'use client'

/**
 * «المواقع» (Apex M5, `hr/locations`) — bespoke replacement for the generic
 * `locations` list: columns الكود · اسم الموقع · الموقع(map) · نطاق الموقع(م) ·
 * الحالة, with a map + radius picker in the add/edit dialog (Apex uses Google
 * Maps; we reuse `components/branch/geofence-map-picker.tsx` — same
 * pick/drag/radius-circle behaviour, OSM tiles instead of a Google key).
 *
 * Backed by `base_meena.api.hr_locations`. See apex-gap-analysis.md §1 M5.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MapPin, Pencil, Plus, Printer, Search, Trash2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { fmtNumber } from '@/lib/hr-format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ApexEmptyState } from '@/components/hr/apex-empty-state'
import { EmptyState } from '@/components/hr/ui/empty-state'
import { TableSkeleton } from '@/components/hr/ui/table-skeleton'
import { LocationFormDialog } from '@/components/hr/locations/location-form-dialog'
import { LocationMapViewDialog } from '@/components/hr/locations/location-map-view-dialog'
import {
  LOCATION_STATUS_AR, type LocationGroupOption, type LocationRow,
} from '@/components/hr/locations/types'

type StatusFilter = '' | 'Active' | 'Inactive'

export function LocationsPage() {
  const { toast } = useToast()
  const [rows, setRows] = useState<LocationRow[]>([])
  const [groups, setGroups] = useState<LocationGroupOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [actionsOpen, setActionsOpen] = useState(false)
  const [working, setWorking] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<LocationRow | null>(null)
  const [mapRow, setMapRow] = useState<LocationRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LocationRow | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [locRes, groupRes] = await Promise.all([
        frappeClient.call<LocationRow[]>('base_meena.api.hr_locations.list_locations'),
        frappeClient.call<LocationGroupOption[]>('base_meena.api.hr_locations.get_location_groups'),
      ])
      setRows(locRes?.message ?? [])
      setGroups(groupRes?.message ?? [])
      setSelected(new Set())
    } catch (e: any) {
      toast({ title: 'فشل تحميل المواقع', description: e?.message, variant: 'destructive' })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [toast])
  useEffect(() => { load() }, [load])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter && (r.custom_status || 'Active') !== statusFilter) return false
      if (q && !(r.location_name || '').toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, search, statusFilter])

  const hasActiveFilter = search.trim().length > 0 || !!statusFilter

  const allChecked = filteredRows.length > 0 && filteredRows.every((r) => selected.has(r.name))
  const toggleAll = () => {
    setSelected((prev) => {
      if (allChecked) return new Set()
      return new Set(filteredRows.map((r) => r.name))
    })
  }
  const toggleOne = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  const bulkSetStatus = async (status: 'Active' | 'Inactive') => {
    setActionsOpen(false)
    if (selected.size === 0) return
    setWorking(true)
    try {
      await frappeClient.call('base_meena.api.hr_locations.set_location_status', {
        names: Array.from(selected),
        status,
      })
      toast({ title: status === 'Active' ? 'تم التنشيط' : 'تم إلغاء التنشيط' })
      await load()
    } catch (e: any) {
      toast({ title: 'فشل تنفيذ الإجراء', description: e?.message, variant: 'destructive' })
    } finally {
      setWorking(false)
    }
  }

  const confirmBulkDelete = async () => {
    setWorking(true)
    let ok = 0
    for (const name of selected) {
      try {
        await frappeClient.call('base_meena.api.hr_locations.delete_location', { name })
        ok++
      } catch { /* keep going */ }
    }
    setWorking(false)
    setBulkDeleteOpen(false)
    toast({ title: `تم حذف ${ok} من ${selected.size}` })
    await load()
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setWorking(true)
    try {
      await frappeClient.call('base_meena.api.hr_locations.delete_location', { name: deleteTarget.name })
      toast({ title: 'تم الحذف' })
      setDeleteTarget(null)
      await load()
    } catch (e: any) {
      toast({ title: 'فشل الحذف', description: e?.message, variant: 'destructive' })
    } finally {
      setWorking(false)
    }
  }

  const colSpan = 6

  return (
    <div className="p-4" dir="rtl">
      <div className="mb-3">
        <h1 className="text-lg font-bold text-slate-800">المواقع</h1>
        <p className="text-[13px] text-slate-500">مواقع تسجيل الحضور من الجوال</p>
      </div>

      <div className="bg-white rounded shadow-sm border border-slate-200/60 overflow-hidden print:hidden">
        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-100 flex-wrap">
          <Button
            onClick={() => { setEditing(null); setFormOpen(true) }}
            className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white rounded px-4 h-9 font-bold text-[13px] shrink-0"
          >
            <Plus className="h-4 w-4 ml-1" strokeWidth={3} />
            اضافة
          </Button>

          <div className="relative shrink-0">
            <Button
              variant="outline"
              disabled={selected.size === 0}
              onClick={() => setActionsOpen((v) => !v)}
              className="rounded px-4 h-9 font-bold text-[13px] border-[var(--apex-slate)] text-[var(--apex-slate)] disabled:opacity-50 min-w-[120px] justify-between"
            >
              الاجراءات
            </Button>
            {actionsOpen && selected.size > 0 && (
              <div className="absolute z-20 mt-1 w-40 rounded border border-slate-200 bg-white shadow-lg py-1 text-[13px]">
                <button type="button" className="block w-full text-right px-3 py-1.5 hover:bg-slate-50" onClick={() => bulkSetStatus('Active')}>تنشيط</button>
                <button type="button" className="block w-full text-right px-3 py-1.5 hover:bg-slate-50" onClick={() => bulkSetStatus('Inactive')}>إلغاء التنشيط</button>
                <button type="button" className="block w-full text-right px-3 py-1.5 hover:bg-slate-50 text-red-600" onClick={() => { setActionsOpen(false); setBulkDeleteOpen(true) }}>حذف</button>
              </div>
            )}
          </div>

          <Button
            variant="outline"
            onClick={() => window.print()}
            className="rounded px-4 h-9 font-bold text-[13px] border-[var(--apex-slate)] text-[var(--apex-slate)] shrink-0"
          >
            <Printer className="h-4 w-4 ml-1" />
            الطباعة
          </Button>

          <Select value={statusFilter || 'all'} onValueChange={(v) => setStatusFilter(v === 'all' ? '' : v as StatusFilter)}>
            <SelectTrigger aria-label="تصفية بالحالة" className="w-[130px] h-9 rounded border-slate-300 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="Active">نشط</SelectItem>
              <SelectItem value="Inactive">غير نشط</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative flex-1 min-w-[180px]">
            <Input
              placeholder="إبحث بإسم الموقع"
              aria-label="إبحث بإسم الموقع"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 rounded border-slate-300 text-right pr-9 placeholder:text-slate-400"
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          </div>
        </div>

        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] text-right">
            <thead>
              <tr className="bg-[var(--apex-thead)] text-[var(--apex-text)] border-y border-slate-300 h-11">
                <th className="px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle"
                    aria-label="تحديد الكل"
                  />
                </th>
                <th className="px-3 w-10 text-center font-bold">الكود</th>
                <th className="px-3 font-bold whitespace-nowrap">اسم الموقع</th>
                <th className="px-3 font-bold whitespace-nowrap">الموقع</th>
                <th className="px-3 font-bold whitespace-nowrap">نطاق الموقع (متر)</th>
                <th className="px-3 font-bold whitespace-nowrap">الحالة</th>
                <th className="px-3 font-bold w-24 text-center whitespace-nowrap print:hidden">الاجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colSpan + 1} className="p-0"><TableSkeleton rows={6} cols={colSpan + 1} /></td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={colSpan + 1} className="py-10">
                  {hasActiveFilter ? (
                    <ApexEmptyState />
                  ) : (
                    <EmptyState
                      title="لا توجد مواقع بعد"
                      description="لم تتم إضافة أي موقع حتى الآن."
                      action={(
                        <button
                          type="button"
                          onClick={() => { setEditing(null); setFormOpen(true) }}
                          className="h-9 px-4 rounded bg-[var(--apex-green)] text-white text-[13px] font-bold flex items-center gap-1.5 hover:bg-[var(--apex-green-dark)]"
                        >
                          <Plus className="h-4 w-4" strokeWidth={3} />اضافة
                        </button>
                      )}
                    />
                  )}
                </td></tr>
              ) : (
                filteredRows.map((row, i) => (
                  <tr key={row.name} className="border-b border-slate-100 hover:bg-slate-50/70 h-[52px]">
                    <td className="px-3 text-center">
                      <input
                        type="checkbox"
                        checked={selected.has(row.name)}
                        onChange={() => toggleOne(row.name)}
                        className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle"
                        aria-label={`تحديد ${row.location_name}`}
                      />
                    </td>
                    <td className="px-3 text-center text-slate-500">{i + 1}</td>
                    <td className="px-3 text-slate-700">{row.location_name}</td>
                    <td className="px-3 text-slate-700">
                      <button
                        type="button"
                        onClick={() => setMapRow(row)}
                        className="inline-flex items-center gap-1 text-[var(--apex-blue)] hover:underline"
                      >
                        <MapPin className="h-3.5 w-3.5" />عرض
                      </button>
                    </td>
                    <td className="px-3 text-slate-700 tabular-nums">{fmtNumber(row.custom_radius_m || 0)}</td>
                    <td className="px-3 text-slate-700">
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${(row.custom_status || 'Active') === 'Active' ? 'bg-[var(--apex-green)]' : 'bg-slate-400'}`} />
                        {LOCATION_STATUS_AR[row.custom_status || 'Active']}
                      </span>
                    </td>
                    <td className="px-3 print:hidden">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => { setEditing(row); setFormOpen(true) }} title="تعديل" aria-label={`تعديل ${row.location_name}`} className="text-[var(--apex-green)] hover:text-[var(--apex-green-text)] px-1">
                          <Pencil className="h-[17px] w-[17px]" />
                        </button>
                        <button onClick={() => setDeleteTarget(row)} title="حذف" aria-label={`حذف ${row.location_name}`} className="text-slate-400 hover:text-red-600 px-1">
                          <Trash2 className="h-[17px] w-[17px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Print-only view ── */}
      {filteredRows.length > 0 && (
        <div className="hidden print:block">
          <h1 className="text-lg font-bold mb-1">المواقع</h1>
          <table className="w-full text-xs border-collapse mt-4">
            <thead>
              <tr>
                <th className="border border-slate-300 px-2 py-1 text-center">م</th>
                <th className="border border-slate-300 px-2 py-1 text-right">اسم الموقع</th>
                <th className="border border-slate-300 px-2 py-1 text-right">نطاق الموقع (متر)</th>
                <th className="border border-slate-300 px-2 py-1 text-right">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, i) => (
                <tr key={row.name}>
                  <td className="border border-slate-300 px-2 py-1 text-center">{i + 1}</td>
                  <td className="border border-slate-300 px-2 py-1">{row.location_name}</td>
                  <td className="border border-slate-300 px-2 py-1">{fmtNumber(row.custom_radius_m || 0)}</td>
                  <td className="border border-slate-300 px-2 py-1">{LOCATION_STATUS_AR[row.custom_status || 'Active']}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LocationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        groups={groups}
        onSaved={load}
      />

      <LocationMapViewDialog row={mapRow} onOpenChange={(o) => !o && setMapRow(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="حذف الموقع"
        description={`هل تريد حذف الموقع «${deleteTarget?.location_name}»؟`}
        confirmLabel="حذف"
        cancelLabel="رجوع"
        loading={working}
        variant="destructive"
        onConfirm={confirmDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="حذف المواقع المحددة"
        description={`هل تريد حذف ${selected.size} موقع؟`}
        confirmLabel="حذف"
        cancelLabel="رجوع"
        loading={working}
        variant="destructive"
        onConfirm={confirmBulkDelete}
      />
    </div>
  )
}
