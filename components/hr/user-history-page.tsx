'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, Loader2, Search } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { fmtDate } from '@/lib/hr-format'
import { ApexTableCard } from '@/components/hr/apex/table-card'
import { ApexDatePicker } from '@/components/hr/apex/date-picker'
import { ReportIllustration } from '@/components/hr/report-page'
import { PrintDialog } from '@/components/hr/apex/print-dialog'
import { apexExport, apexPrint } from '@/lib/apex-print'

interface Row { name: string; user: string; full_name?: string; subject?: string; operation?: string; status?: string; ip_address?: string; creation: string }
interface UserOpt { name: string; full_name?: string }

// Display-only Arabic for the raw Activity Log values (this bespoke page is
// what module-page.tsx renders for «حركات المستخدمين», not the generic list,
// so the mapping has to live here). Unmapped values fall back to the raw text.
const OPERATION_AR: Record<string, string> = { Login: 'تسجيل دخول', Logout: 'تسجيل خروج', Impersonate: 'انتحال هوية' }
const ar = (map: Record<string, string>, v?: string) => (v && (map[v] || v)) || '—'

function today() { return new Date().toISOString().slice(0, 10) }
/** Apex shows «5:29:54» — 12-hour clock with seconds, no leading zero. */
function apexTime(v: string) {
  const m = /(\d{2}):(\d{2}):(\d{2})/.exec(v || '')
  if (!m) return '—'
  const h = Number(m[1]) % 12 || 12
  return `${h}:${m[2]}:${m[3]}`
}

/**
 * «حركات المستخدمين» (5.18) — Apex is a REPORT-style page, not a plain list:
 * breadcrumb «المستخدمين / حركات المستخدمين», toolbar at the left «الطباعة▾»
 * + «اخفاء البحث▾», filters المستخدم* / من تاريخ / إلى تاريخ + a green search
 * icon, illustration until the first run, then the results table. Backed by
 * base_meena.api.user_activity.get_user_activity (extended with
 * user/from_date/to_date filters for this page).
 */
export function UserHistoryPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<UserOpt[]>([])
  const [showFilters, setShowFilters] = useState(true)
  const [printOpen, setPrintOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [user, setUser] = useState('')
  const [fromDate, setFromDate] = useState(today())
  const [toDate, setToDate] = useState(today())

  useEffect(() => {
    frappeClient.getList<UserOpt>('User', {
      fields: ['name', 'full_name'], filters: [['user_type', '=', 'System User'], ['name', 'not in', ['Administrator', 'Guest']]],
      order_by: 'full_name asc', limit_page_length: 0,
    }).then(setUsers).catch(() => setUsers([]))
  }, [])

  const run = useCallback(async () => {
    setLoading(true)
    try {
      const r: any = await frappeClient.call('base_meena.api.user_activity.get_user_activity', {
        limit: 200, user: user || undefined, from_date: fromDate || undefined, to_date: toDate || undefined,
      })
      setRows((r?.message ?? []) as Row[])
    } catch (e: any) {
      toast({ title: 'تعذّر تحميل السجل', description: e?.message, variant: 'destructive' })
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [user, fromDate, toDate, toast])

  const printSpec = (lang: 'ar' | 'en' = 'ar') => ({
    title: 'حركات المستخدمين', lang,
    subtitle: `من ${fmtDate(fromDate)} إلى ${fmtDate(toDate)}`,
    columns: [{ key: 'user', label: 'المستخدم' }, { key: 'op', label: 'الحركة' }, { key: 'date', label: 'التاريخ' }, { key: 'time', label: 'الوقت', ltr: true }],
    rows: (rows ?? []).map((r) => ({ user: r.full_name || r.user, op: ar(OPERATION_AR, r.operation), date: fmtDate(r.creation), time: apexTime(r.creation) })),
  })

  return (
    <div dir="rtl" className="p-4 pb-8 font-[family-name:var(--font-arabic)]">
      {/* breadcrumb + toolbar */}
      <div className="flex items-center justify-between mb-5">
        <div className="text-[14px] text-slate-700">
          <span className="text-slate-600">المستخدمين</span>
          <span className="mx-2 text-slate-400">/</span>
          <span className="text-slate-800">حركات المستخدمين</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((s) => !s)}
            className="h-[38px] px-3 rounded border border-slate-300 bg-white text-[14px] text-slate-700 flex items-center gap-1"
          >
            {showFilters ? 'اخفاء البحث' : 'اظهار البحث'}
            <ChevronDown className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setPrintOpen((o) => !o)}
              className="h-[38px] px-3 min-w-[110px] rounded border border-[var(--apex-blue-border)] bg-white text-[14px] text-[var(--apex-blue)] flex items-center justify-between gap-3"
            >
              <span>الطباعة</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            {printOpen && (
              <div className="absolute left-0 mt-1 w-40 rounded border bg-white shadow z-20 text-[14px]">
                <button type="button" className="w-full text-right px-3 py-2 hover:bg-slate-50" onClick={() => { setPrintOpen(false); apexPrint(printSpec()) }}>طباعة</button>
                <button type="button" className="w-full text-right px-3 py-2 hover:bg-slate-50" onClick={() => { setPrintOpen(false); setAdvancedOpen(true) }}>طباعة متقدمة</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <PrintDialog
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        templates={[{ key: 'UsersTransactions', label: 'حركات المستخدمين', isDefault: true }]}
        storageKey="report:user-history"
        onPrint={(o) => { setAdvancedOpen(false); apexPrint(printSpec(o.lang)) }}
        onExport={(o) => { setAdvancedOpen(false); apexExport(printSpec(o.lang), o.format) }}
      />

      {/* filters */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-6">
          <div>
            <span className="block text-[13px] text-slate-700 mb-1">المستخدم <span className="text-red-500">*</span></span>
            <div className="relative">
              <select
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="w-full h-[42px] rounded border border-[var(--apex-border)] bg-white px-3 text-[14px] text-slate-800 appearance-none"
              >
                <option value="">الكل</option>
                {users.map((u) => <option key={u.name} value={u.name}>{u.full_name || u.name}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            </div>
          </div>
          <div>
            <span className="block text-[13px] text-slate-700 mb-1">من تاريخ</span>
            <ApexDatePicker value={fromDate} onChange={setFromDate} />
          </div>
          <div>
            <span className="block text-[13px] text-slate-700 mb-1">إلى تاريخ</span>
            <ApexDatePicker value={toDate} onChange={setToDate} />
          </div>
          <div>
            <button
              type="button"
              onClick={run}
              disabled={loading}
              className="h-[42px] w-[42px] rounded bg-[var(--apex-blue)] text-white flex items-center justify-center disabled:opacity-60"
              aria-label="بحث"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            </button>
          </div>
        </div>
      )}

      {/* body */}
      {!rows && !loading && <ReportIllustration />}
      {loading && !rows && (
        <div className="flex justify-center py-16 text-slate-500"><Loader2 className="h-8 w-8 animate-spin" /></div>
      )}
      {rows && (
        <ApexTableCard>
          <table className="apex-table w-full">
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>الحركة</th>
                {/* client 2026-09-27: date and time in their own columns (screen + print) */}
                <th>التاريخ</th>
                <th>الوقت</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={4} className="py-10 text-center text-slate-500">لا يوجد نتائج للبحث ابحث مرة اخري</td></tr>
              ) : rows.map((r) => (
                <tr key={r.name}>
                  <td>{r.full_name || r.user}</td>
                  <td>{ar(OPERATION_AR, r.operation)}{r.status === 'Failed' ? ' (فاشل)' : ''}</td>
                  <td>{fmtDate(r.creation)}</td>
                  <td dir="ltr" className="text-right">{apexTime(r.creation)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ApexTableCard>
      )}
    </div>
  )
}
