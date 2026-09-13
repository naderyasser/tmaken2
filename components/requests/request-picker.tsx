'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Search, Loader2, Check, X, ArrowRight,
  Calendar, ArrowRightLeft, FileText, DollarSign, Clock, Timer,
  UserMinus, Mail, Coffee, PencilLine,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { frappeClient, type Employee } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { translateEnum } from '@/lib/enums'
import { useToast } from '@/hooks/use-toast'

/**
 * Unified request entry point: pick an employee, then pick a request type.
 *
 * Each enabled type routes to the matching native/ERPNext form (Frappe desk
 * "new" form, prefilled with the chosen employee). The three types whose
 * doctypes are introduced in Phase 4 (Letter Request, Permission/Excuse,
 * Punch Correction) are shown disabled until then — no fake stubs.
 */

interface RequestType {
  key: string
  labelKey: string
  icon: React.ReactNode
  /** Frappe desk doctype slug for the "new" form, or null if not built yet. */
  slug: string | null
  color: string
}

const REQUEST_TYPES: RequestType[] = [
  { key: 'leave', labelKey: 'req.type.leave', icon: <Calendar className="h-5 w-5" />, slug: 'leave-application', color: 'text-amber-600 bg-amber-50' },
  { key: 'advance', labelKey: 'req.type.advance', icon: <DollarSign className="h-5 w-5" />, slug: 'employee-advance', color: 'text-emerald-600 bg-emerald-50' },
  { key: 'attendance', labelKey: 'req.type.attendance', icon: <Clock className="h-5 w-5" />, slug: 'attendance-request', color: 'text-violet-600 bg-violet-50' },
  { key: 'shift', labelKey: 'req.type.shift', icon: <ArrowRightLeft className="h-5 w-5" />, slug: 'shift-request', color: 'text-cyan-600 bg-cyan-50' },
  { key: 'expense', labelKey: 'req.type.expense', icon: <FileText className="h-5 w-5" />, slug: 'expense-claim', color: 'text-blue-600 bg-blue-50' },
  { key: 'overtime', labelKey: 'req.type.overtime', icon: <Timer className="h-5 w-5" />, slug: 'overtime-slip', color: 'text-indigo-600 bg-indigo-50' },
  { key: 'resignation', labelKey: 'req.type.resignation', icon: <UserMinus className="h-5 w-5" />, slug: 'employee-separation', color: 'text-rose-600 bg-rose-50' },
  // Phase 4 doctypes (now live):
  { key: 'letter', labelKey: 'req.type.letter', icon: <Mail className="h-5 w-5" />, slug: 'letter-request', color: 'text-teal-600 bg-teal-50' },
  { key: 'permission', labelKey: 'req.type.permission', icon: <Coffee className="h-5 w-5" />, slug: 'permission-request', color: 'text-pink-600 bg-pink-50' },
  { key: 'punch', labelKey: 'req.type.punch', icon: <PencilLine className="h-5 w-5" />, slug: 'punch-correction', color: 'text-sky-600 bg-sky-50' },
]

export function RequestPicker() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Employee | null>(null)

  useEffect(() => {
    let active = true
    frappeClient
      .getEmployees({
        fields: ['name', 'employee_name', 'designation', 'department', 'branch', 'status'],
        filters: [['Employee', 'status', '=', 'Active']] as any,
        order_by: 'employee_name asc',
        limit_page_length: 0,
      })
      .then((list) => { if (active) setEmployees(list || []) })
      .catch(() => { if (active) toast({ title: t('error'), description: t('req.load_fail'), variant: 'destructive' }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return employees.slice(0, 50)
    return employees
      .filter((e) => (e.employee_name || '').toLowerCase().includes(q) || (e.name || '').toLowerCase().includes(q))
      .slice(0, 50)
  }, [employees, query])

  const openForm = (type: RequestType) => {
    if (!type.slug) {
      toast({ title: t('req.coming_soon'), description: t('req.coming_soon_desc') })
      return
    }
    if (!selected) {
      toast({ title: t('req.select_first'), variant: 'destructive' })
      return
    }
    const url = `/app/${type.slug}/new?employee=${encodeURIComponent(selected.name)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="p-6 md:p-8 max-w-[1100px] mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('req.title')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('req.subtitle')}</p>
      </div>

      {/* Step 1 — pick employee */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">1</span>
          <h2 className="text-sm font-semibold text-gray-900">{t('req.select_employee')}</h2>
        </div>

        {selected ? (
          <div className="flex items-center justify-between p-3 border border-blue-200 bg-blue-50/50 rounded-xl">
            <div>
              <p className="text-[14px] font-semibold text-gray-900">{selected.employee_name}</p>
              <p className="text-[12px] text-gray-500">{translateEnum('designation', selected.designation, isRTL ? 'ar' : 'en') || selected.department || selected.name}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-[12px] font-medium text-blue-600 hover:underline flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> {t('req.change')}
            </button>
          </div>
        ) : (
          <>
            <div className="relative mb-3">
              <Search className={`h-4 w-4 text-gray-400 absolute top-2.5 ${isRTL ? 'right-3' : 'left-3'}`} />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('req.search_placeholder')}
                className={isRTL ? 'pr-9' : 'pl-9'}
              />
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-[13px] text-gray-400 py-6 text-center">{t('req.no_employees')}</p>
            ) : (
              <div className="max-h-64 overflow-auto divide-y divide-gray-50">
                {filtered.map((emp) => (
                  <button
                    key={emp.name}
                    onClick={() => { setSelected(emp); setQuery('') }}
                    className="w-full flex items-center justify-between py-2.5 px-2 hover:bg-gray-50 rounded-lg text-start transition-colors"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-gray-800">{emp.employee_name}</p>
                      <p className="text-[11px] text-gray-400">{translateEnum('designation', emp.designation, isRTL ? 'ar' : 'en') || emp.department || emp.name}</p>
                    </div>
                    <Check className="h-4 w-4 text-transparent" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Step 2 — pick request type */}
      <div className={`bg-white border border-gray-100 rounded-2xl p-5 shadow-sm transition-opacity ${selected ? '' : 'opacity-60'}`}>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">2</span>
          <h2 className="text-sm font-semibold text-gray-900">{t('req.pick_type')}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {REQUEST_TYPES.map((type) => {
            const disabled = !type.slug
            return (
              <button
                key={type.key}
                onClick={() => openForm(type)}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-center
                  ${disabled
                    ? 'border-gray-100 cursor-not-allowed'
                    : 'border-gray-100 hover:border-blue-300 hover:shadow-md cursor-pointer'}`}
                title={disabled ? t('req.coming_soon') : ''}
              >
                <div className={`p-2.5 rounded-xl ${type.color}`}>{type.icon}</div>
                <span className="text-[12px] font-medium text-gray-700">{t(type.labelKey)}</span>
                {disabled && (
                  <span className="text-[9px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{t('req.soon')}</span>
                )}
              </button>
            )
          })}
        </div>
        {!selected && (
          <p className="text-[12px] text-gray-400 mt-4 flex items-center gap-1">
            <ArrowRight className={`h-3 w-3 ${isRTL ? 'rotate-180' : ''}`} /> {t('req.select_first')}
          </p>
        )}
      </div>
    </div>
  )
}
