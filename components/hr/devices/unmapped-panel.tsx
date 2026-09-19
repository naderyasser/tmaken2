'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Link2, Loader2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/hr/ui/empty-state'
import { EmployeeCombobox } from './employee-combobox'
import { formatDateTime, type UnmappedDeviceId, type UnmappedEmployee } from './types'

/**
 * «بصمات غير مربوطة» — device user IDs seen in recent Skipped-No-Employee logs with no
 * Employee.attendance_device_id match yet. One-by-one link, or pick several and «ربط الكل».
 */
export function UnmappedPanel({ onMapped }: { onMapped?: () => void }) {
  const { toast } = useToast()
  const [rows, setRows] = useState<UnmappedDeviceId[]>([])
  const [employees, setEmployees] = useState<UnmappedEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [linkingOne, setLinkingOne] = useState<string | null>(null)
  const [linkingAll, setLinkingAll] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [u, e] = await Promise.all([
        frappeClient.call<UnmappedDeviceId[]>('base_meena.biometric_management.adms.get_unmapped_device_ids'),
        frappeClient.call<UnmappedEmployee[]>('base_meena.biometric_management.adms.get_unmapped_employees'),
      ])
      setRows(u.message ?? [])
      setEmployees(e.message ?? [])
    } catch (err: any) {
      toast({ title: 'تعذّر تحميل البصمات غير المربوطة', description: err?.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const linkOne = async (deviceId: string) => {
    const employee = picks[deviceId]
    if (!employee) return
    setLinkingOne(deviceId)
    try {
      await frappeClient.call('base_meena.biometric_management.adms.set_employee_device_id', { employee, device_id: deviceId })
      toast({ title: 'تم الربط' })
      setPicks((p) => { const n = { ...p }; delete n[deviceId]; return n })
      // Refetch instead of a local splice: get_unmapped_device_ids now excludes
      // ids mapped to an Active employee (D5, round-1), so this is the source of
      // truth — a local-only removal could drift from it (e.g. two admins linking
      // pins at once).
      await load()
      onMapped?.()
    } catch (err: any) {
      toast({ title: 'فشل الربط', description: err?.message, variant: 'destructive' })
    } finally {
      setLinkingOne(null)
    }
  }

  const linkAll = async () => {
    const mapping = rows
      .filter((r) => picks[r.employee_device_id])
      .map((r) => ({ employee: picks[r.employee_device_id], device_id: r.employee_device_id }))
    if (!mapping.length) return
    setLinkingAll(true)
    try {
      const resp = await frappeClient.call<{ success: number; errors: string[]; total: number }>(
        'base_meena.biometric_management.adms.bulk_map_employees',
        { mapping_data: mapping },
      )
      const r = resp.message
      toast({
        title: `تم ربط ${r?.success ?? 0} من ${r?.total ?? mapping.length}`,
        description: r?.errors?.length ? r.errors.join(' · ') : undefined,
        variant: r?.errors?.length ? 'destructive' : undefined,
      })
      setPicks({})
      await load()
      onMapped?.()
    } catch (err: any) {
      toast({ title: 'فشل الربط الجماعي', description: err?.message, variant: 'destructive' })
    } finally {
      setLinkingAll(false)
    }
  }

  if (loading) {
    return <div className="py-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[var(--apex-blue)]" /></div>
  }

  if (!rows.length) {
    return (
      <div className="rounded border border-[var(--apex-border)] bg-white">
        <EmptyState icon={CheckCircle2} title="كل البصمات مربوطة ✓" className="py-6" />
      </div>
    )
  }

  const pickedCount = Object.keys(picks).length

  return (
    <div className="rounded border border-amber-200 bg-amber-50/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-amber-200 flex-wrap gap-2">
        <h3 className="text-[14px] font-bold text-amber-800">بصمات غير مربوطة ({rows.length})</h3>
        <Button
          size="sm"
          onClick={linkAll}
          disabled={linkingAll || !pickedCount}
          className="bg-[var(--apex-green)] hover:bg-[var(--apex-green-dark)] text-white h-8 text-[12.5px] disabled:opacity-50"
        >
          {linkingAll ? <Loader2 className="h-3.5 w-3.5 ml-1 animate-spin" /> : <Link2 className="h-3.5 w-3.5 ml-1" />}
          ربط الكل{pickedCount ? ` (${pickedCount})` : ''}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px] text-right">
          <thead>
            <tr className="bg-[var(--apex-thead)] text-[var(--apex-text)] h-9">
              <th className="px-3 font-bold whitespace-nowrap">رقم البصمة</th>
              <th className="px-3 font-bold whitespace-nowrap">الجهاز</th>
              <th className="px-3 font-bold whitespace-nowrap">آخر ظهور</th>
              <th className="px-3 font-bold whitespace-nowrap">عدد البصمات</th>
              <th className="px-3 font-bold min-w-[220px]">ربط بموظف</th>
              <th className="px-3 font-bold w-14" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.device_serial}-${r.employee_device_id}`} className="border-b border-amber-100">
                <td className="px-3 py-1.5 font-mono">{r.employee_device_id}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{r.device_serial}</td>
                <td className="px-3 py-1.5 whitespace-nowrap">{formatDateTime(r.last_seen)}</td>
                <td className="px-3 py-1.5">{r.punch_count}</td>
                <td className="px-3 py-1.5">
                  <EmployeeCombobox
                    options={employees}
                    value={picks[r.employee_device_id]}
                    onChange={(v) => setPicks((p) => ({ ...p, [r.employee_device_id]: v }))}
                  />
                </td>
                <td className="px-3 py-1.5 text-center">
                  <button
                    type="button"
                    disabled={!picks[r.employee_device_id] || linkingOne === r.employee_device_id}
                    onClick={() => linkOne(r.employee_device_id)}
                    className="text-[var(--apex-green)] hover:text-[var(--apex-green-text)] disabled:opacity-30 disabled:cursor-not-allowed"
                    title="ربط"
                    aria-label={`ربط ${r.employee_device_id}`}
                  >
                    {linkingOne === r.employee_device_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
