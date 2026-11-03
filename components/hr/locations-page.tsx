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
import { MapPin, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { fmtNumber } from '@/lib/hr-format'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ApexToolbar } from '@/components/hr/apex/toolbar'
import { AdvancedSearchDrawer } from '@/components/hr/advanced-search-drawer'
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
  const [drawerOpen, setDrawerOpen] = useState(false)
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

  const setRowStatus = async (row: LocationRow, status: 'Active' | 'Inactive') => {
    try {
      await frappeClient.call('base_meena.api.hr_locations.set_location_status', { names: [row.name], status })
      toast({ title: status === 'Active' ? 'تم التنشيط' : 'تم إلغاء التنشيط' })
      load()
    } catch (e: any) {
      toast({ title: 'تعذّر تغيير الحالة', description: e?.message, variant: 'destructive' })
    }
  }

  // Apex (app-locations): search «ابحث بالاسم» · filter (drawer: الحالة) · «حذف» ·
  // «اضافة موقع», then ☐ · م · اسم الموقع · الموقع (map) · المسافة - القطر ·
  // الحالة · ✎ 🗑 ⋮ (عرض · تنشيط · إلغاء التنشيط).
  return (
    <div className="p-4 space-y-2" dir="rtl">
      <ApexToolbar
        search={{ value: search, onChange: setSearch, placeholder: 'ابحث بالاسم' }}
        onFilter={() => setDrawerOpen(true)}
        deleteButton={{ onClick: () => setBulkDeleteOpen(true), disabled: selected.size === 0 }}
        add={{ label: 'اضافة موقع', onClick: () => { setEditing(null); setFormOpen(true) } }}
      />
      <AdvancedSearchDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={[{ field: 'status', label: 'الحالة', options: ['نشط', 'غير نشط'] }]}
        values={{ status: statusFilter === 'Active' ? 'نشط' : statusFilter === 'Inactive' ? 'غير نشط' : '' }}
        onApply={(v) => { setStatusFilter(v.status === 'نشط' ? 'Active' : v.status === 'غير نشط' ? 'Inactive' : ''); setDrawerOpen(false) }}
      />

      <div className="bg-white rounded shadow-sm overflow-x-auto">
        <table className="apex-table w-full text-[14px] text-right">
          <thead>
            <tr>
              <th className="w-10 text-center">
                <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="تحديد الكل"
                  className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle" />
              </th>
              <th className="w-12">م</th>
              <th>اسم الموقع</th>
              <th>الموقع</th>
              <th className="text-center">المسافة - القطر</th>
              <th>الحالة</th>
              <th className="text-center print:hidden">اجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="p-0"><TableSkeleton rows={6} cols={7} /></td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={7} className="py-10">
                {hasActiveFilter ? <ApexEmptyState /> : (
                  <EmptyState title="لا توجد مواقع بعد" description="لم تتم إضافة أي موقع حتى الآن." />
                )}
              </td></tr>
            ) : filteredRows.map((row, i) => {
              const active = (row.custom_status || 'Active') === 'Active'
              return (
                <tr key={row.name}>
                  <td className="text-center">
                    <input type="checkbox" checked={selected.has(row.name)} onChange={() => toggleOne(row.name)}
                      aria-label={`تحديد ${row.location_name}`} className="h-4 w-4 accent-[var(--apex-blue-light)] cursor-pointer align-middle" />
                  </td>
                  <td>{i + 1}</td>
                  <td>{row.location_name}</td>
                  <td>
                    <button type="button" onClick={() => setMapRow(row)} title="عرض على الخريطة" aria-label={`خريطة ${row.location_name}`}
                      className="h-[50px] w-[50px] rounded border border-slate-200 bg-[linear-gradient(135deg,#e8f0e3_0%,#dfe8f5_100%)] flex items-center justify-center hover:shadow">
                      <MapPin className="h-6 w-6 text-red-500" fill="currentColor" strokeWidth={1.5} />
                    </button>
                  </td>
                  <td className="text-center tabular-nums">{fmtNumber(row.custom_radius_m || 0)}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5">
                      {LOCATION_STATUS_AR[row.custom_status || 'Active']}
                      <span className={`h-2 w-2 rounded-full ${active ? 'bg-[var(--apex-green)]' : 'bg-slate-400'}`} />
                    </span>
                  </td>
                  <td className="print:hidden">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditing(row); setFormOpen(true) }} title="تعديل" className="apex-icon-edit px-1 hover:opacity-75"><Pencil className="h-[17px] w-[17px]" /></button>
                      <button onClick={() => setDeleteTarget(row)} title="حذف" className="apex-icon-delete px-1 hover:opacity-75"><Trash2 className="h-[17px] w-[17px]" /></button>
                      <DropdownMenu dir="rtl">
                        <DropdownMenuTrigger asChild>
                          <button type="button" title="خيارات" aria-label="خيارات" className="apex-icon-more px-1 rounded"><MoreVertical className="h-[18px] w-[18px]" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[150px] text-[13px]">
                          <DropdownMenuItem onClick={() => setMapRow(row)}>عرض</DropdownMenuItem>
                          <DropdownMenuItem disabled={active} onClick={() => setRowStatus(row, 'Active')}>تنشيط</DropdownMenuItem>
                          <DropdownMenuItem disabled={!active} onClick={() => setRowStatus(row, 'Inactive')}>إلغاء التنشيط</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

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
