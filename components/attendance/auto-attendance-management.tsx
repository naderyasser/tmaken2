'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { frappeClient } from '@/lib/api-client'
import {
  Zap, Play, Save, Users, Clock, AlertCircle, AlertTriangle,
  CheckCircle, XCircle, ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Settings, FileText, Eye, X, Loader2, Info, Search, Scale,
} from 'lucide-react'

// =====================================================================
// Types
// =====================================================================

interface EmployeeRule {
  employee: string
  employee_name?: string
  use_custom_times?: number
  checkin_from?: string | null
  checkin_to?: string | null
  checkout_from?: string | null
  checkout_to?: string | null
  latitude?: number | null
  longitude?: number | null
}

interface AutoAttendanceSettings {
  enabled: number
  company: string | null
  scope: string
  branch: string | null
  department: string | null
  auto_checkin: number
  checkin_offset_minutes: number
  auto_checkout: number
  checkout_offset_minutes: number
  skip_if_manual_exists: number
  skip_leaves: number
  skip_holidays: number
  randomize_times: number
  employees: EmployeeRule[]
  cron_expression: string
  last_run: string | null
}

interface EligibleEmployee {
  employee: string
  employee_name: string
  shift: string
  shift_start: string
  shift_end: string
  branch: string | null
  department?: string | null
  custom_times?: boolean
  has_shift?: boolean
}

interface AutoAttendanceLog {
  name: string
  employee: string
  employee_name: string
  log_type: string
  status: string
  message: string
  timestamp: string
  shift_type: string
  employee_checkin: string | null
  branch: string | null
}

interface LogsResponse {
  logs: AutoAttendanceLog[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

interface RunResult {
  processed: number
  created: number
  skipped: number
  errors: number
}

interface LastRunSummary {
  last_run: string | null
  created: number
  skipped: number
  errors: number
}

// =====================================================================
// API helpers
// =====================================================================

async function apiCall(method: string, args: Record<string, any> = {}) {
  const resp = await frappeClient.call(`hrms.api.auto_attendance_api.${method}`, args)
  return (resp as any).message ?? resp
}

// =====================================================================
// Toast component
// =====================================================================

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const colors = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-accent border-primary/20 text-accent-foreground',
  }
  const icons = {
    success: <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />,
    error: <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />,
    info: <Info className="h-4 w-4 text-primary flex-shrink-0" />,
  }

  return (
    <div className={cn('fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg max-w-md animate-in slide-in-from-top-2', colors[type])}>
      {icons[type]}
      <span className="text-sm font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
    </div>
  )
}

// =====================================================================
// Confirmation Dialog
// =====================================================================

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel, t }: {
  title: string; message: string; confirmLabel: string
  onConfirm: () => void; onCancel: () => void; t: (k: string) => string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-2xl max-w-md w-full mx-4 p-6 space-y-4 animate-in zoom-in-95">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-foreground/90 bg-muted rounded-lg hover:bg-muted transition-colors">
            {t('auto_att.confirm_cancel')}
          </button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// =====================================================================
// Tooltip wrapper
// =====================================================================

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip inline-flex">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-50">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 -mt-1" />
      </div>
    </div>
  )
}

// =====================================================================
// Main Component
// =====================================================================

export function AutoAttendanceManagement() {
  const { t, isRTL } = useI18n()
  const [activeTab, setActiveTab] = useState<'settings' | 'logs' | 'preview'>('settings')
  const [settings, setSettings] = useState<AutoAttendanceSettings | null>(null)
  const [savedSettings, setSavedSettings] = useState<AutoAttendanceSettings | null>(null)
  const [eligible, setEligible] = useState<EligibleEmployee[]>([])
  const [logsData, setLogsData] = useState<LogsResponse | null>(null)
  const [logsPage, setLogsPage] = useState(1)
  const [logsStatus, setLogsStatus] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [penaltyRunning, setPenaltyRunning] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; confirmLabel: string; onConfirm: () => void } | null>(null)
  const [lastRunSummary, setLastRunSummary] = useState<LastRunSummary | null>(null)

  // Lookup data
  const [allEmployees, setAllEmployees] = useState<{ employee: string; employee_name: string; branch: string; department: string }[]>([])

  // Debounce ref for eligible preview
  const eligibleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type })
  }, [])

  // ---- Data loaders ----

  const loadSettings = useCallback(async () => {
    try {
      const data = await apiCall('get_auto_attendance_settings')
      // A backend that predates the time-window fields omits them; default so
      // the inputs stay controlled instead of flipping to uncontrolled on edit.
      const normalized: AutoAttendanceSettings = {
        ...data,
        randomize_times: data.randomize_times ?? 0,
        employees: (data.employees || []).map((r: EmployeeRule) => ({
          ...r,
          use_custom_times: r.use_custom_times ?? 0,
          checkin_from: r.checkin_from ?? '',
          checkin_to: r.checkin_to ?? '',
          checkout_from: r.checkout_from ?? '',
          checkout_to: r.checkout_to ?? '',
        })),
      }
      setSettings(normalized)
      setSavedSettings(normalized)
    } catch (e: any) {
      console.error('[AutoAtt] loadSettings error:', e)
      showToast(e.message, 'error')
    }
  }, [showToast])

  const loadEligible = useCallback(async () => {
    try {
      const data = await apiCall('get_eligible_employees', { preview: 1 })
      setEligible(data || [])
    } catch {
      setEligible([])
    }
  }, [])

  const loadLogs = useCallback(async (page = 1, status = '') => {
    try {
      const args: Record<string, any> = { page, page_size: 20 }
      if (status) args.status = status
      const data = await apiCall('get_auto_attendance_logs', args)
      setLogsData(data)
    } catch {
      setLogsData(null)
    }
  }, [])

  const loadLastRunSummary = useCallback(async () => {
    try {
      const data = await apiCall('get_last_run_summary')
      setLastRunSummary(data)
    } catch {
      setLastRunSummary(null)
    }
  }, [])

  const loadEmployeesForPicker = useCallback(async (company: string) => {
    try {
      const data = await apiCall('get_employees_for_picker', { company })
      setAllEmployees(data || [])
    } catch {
      setAllEmployees([])
    }
  }, [])

  // ---- Initial load ----

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([loadSettings(), loadEligible(), loadLogs(), loadLastRunSummary()])
      setLoading(false)
    }
    init()
  }, [loadSettings, loadEligible, loadLogs, loadLastRunSummary])

  // ---- Load conditional data when company changes ----

  useEffect(() => {
    if (settings?.company) {
      loadEmployeesForPicker(settings.company)
    }
  }, [settings?.company, loadEmployeesForPicker])

  // ---- Debounced eligible preview on settings change ----

  const refreshEligibleDebounced = useCallback(() => {
    if (eligibleTimerRef.current) clearTimeout(eligibleTimerRef.current)
    eligibleTimerRef.current = setTimeout(() => { loadEligible() }, 500)
  }, [loadEligible])

  // ---- Handlers ----

  const handleToggleEnabled = async () => {
    if (!settings) return
    const newEnabled = settings.enabled ? 0 : 1
    const prev = { ...settings }
    setSettings({ ...settings, enabled: newEnabled })

    try {
      await apiCall('save_auto_attendance_settings', {
        enabled: newEnabled,
        company: settings.company || '',
        scope: 'Specific Employees',
        branch: '',
        department: '',
        auto_checkin: settings.auto_checkin,
        checkin_offset_minutes: settings.checkin_offset_minutes,
        auto_checkout: settings.auto_checkout,
        checkout_offset_minutes: settings.checkout_offset_minutes,
        skip_if_manual_exists: settings.skip_if_manual_exists,
        skip_leaves: settings.skip_leaves,
        skip_holidays: settings.skip_holidays,
        randomize_times: settings.randomize_times,
        employees: settings.employees,
        cron_expression: settings.cron_expression,
      })
      // Re-fetch to confirm
      await loadSettings()
      showToast(newEnabled ? t('auto_att.enabled_toast') : t('auto_att.disabled_toast'), 'success')
      loadEligible()
    } catch (e: any) {
      setSettings(prev) // revert
      showToast(e.message, 'error')
    }
  }

  const handleSave = async () => {
    if (!settings) return

    // If enabling, show confirmation
    if (settings.enabled) {
      setConfirmDialog({
        title: t('auto_att.confirm_save_title'),
        message: t('auto_att.confirm_save_msg').replace('{count}', String(eligible.length)),
        confirmLabel: t('auto_att.confirm_save'),
        onConfirm: () => { setConfirmDialog(null); doSave() },
      })
    } else {
      doSave()
    }
  }

  const doSave = async () => {
    if (!settings) return
    setSaving(true)
    try {
      // Build payload — always use Specific Employees scope
      const payload: Record<string, any> = {
        enabled: settings.enabled,
        company: settings.company || '',
        scope: 'Specific Employees',
        branch: '',
        department: '',
        auto_checkin: settings.auto_checkin,
        checkin_offset_minutes: settings.checkin_offset_minutes,
        auto_checkout: settings.auto_checkout,
        checkout_offset_minutes: settings.checkout_offset_minutes,
        skip_if_manual_exists: settings.skip_if_manual_exists,
        skip_leaves: settings.skip_leaves,
        skip_holidays: settings.skip_holidays,
        randomize_times: settings.randomize_times,
        employees: settings.employees,
        cron_expression: settings.cron_expression,
      }
      await apiCall('save_auto_attendance_settings', payload)
      // Re-fetch from backend to confirm save and get canonical values
      await loadSettings()
      showToast(t('auto_att.saved'), 'success')
      loadEligible()
      loadLastRunSummary()
    } catch (e: any) {
      showToast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleRunNow = async () => {
    if (!settings?.enabled || eligible.length === 0) return

    setConfirmDialog({
      title: t('auto_att.confirm_run_title'),
      message: t('auto_att.confirm_run_msg').replace('{count}', String(eligible.length)),
      confirmLabel: t('auto_att.confirm_run'),
      onConfirm: () => { setConfirmDialog(null); doRunNow() },
    })
  }

  const doRunNow = async () => {
    setRunning(true)
    try {
      const result: RunResult = await apiCall('run_auto_attendance_now')
      showToast(
        t('auto_att.run_toast')
          .replace('{created}', String(result.created))
          .replace('{skipped}', String(result.skipped))
          .replace('{errors}', String(result.errors)),
        result.errors > 0 ? 'error' : 'success'
      )
      await Promise.all([loadLogs(logsPage, logsStatus), loadSettings(), loadLastRunSummary()])
    } catch (e: any) {
      showToast(e.message, 'error')
    } finally {
      setRunning(false)
    }
  }

  const handlePenaltyEngine = () => {
    setConfirmDialog({
      title: t('auto_att.penalty_confirm_title'),
      message: t('auto_att.penalty_confirm_msg'),
      confirmLabel: t('auto_att.penalty_confirm_btn'),
      onConfirm: () => { setConfirmDialog(null); runPenaltyEngine() },
    })
  }

  const runPenaltyEngine = async () => {
    setPenaltyRunning(true)
    try {
      const resp = await frappeClient.call<{ success: boolean; message: string; stats: any }>(
        'base_meena.api.trigger_penalty_engine'
      )
      const data = (resp as any).message ?? resp
      if (data?.success) {
        showToast(data.message || t('auto_att.penalty_success'), 'success')
      } else {
        showToast(data?.message || t('auto_att.penalty_fail'), 'error')
      }
    } catch (e: any) {
      showToast(e.message || t('auto_att.penalty_fail'), 'error')
    } finally {
      setPenaltyRunning(false)
    }
  }

  const updateSettings = useCallback((patch: Partial<AutoAttendanceSettings>) => {
    setSettings(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      return next
    })
    refreshEligibleDebounced()
  }, [refreshEligibleDebounced])

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
      </div>
    )
  }

  const runNowDisabled = running || !settings?.enabled || eligible.length === 0
  const runNowTooltip = !settings?.enabled ? t('auto_att.enable_first') : eligible.length === 0 ? t('auto_att.no_eligible') : ''

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          t={t}
        />
      )}

      {/* Header */}
      <div className={cn('flex flex-wrap items-center justify-between gap-3', isRTL && 'flex-row-reverse')}>
        <div className={isRTL ? 'text-right' : ''}>
          <h1 className="text-2xl font-bold text-foreground">{t('auto_att.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('auto_att.subtitle')}</p>
        </div>
        <div className={cn('flex items-center gap-3', isRTL && 'flex-row-reverse')}>
          {runNowTooltip ? (
            <Tooltip text={runNowTooltip}>
              <button disabled className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-muted text-muted-foreground/70 cursor-not-allowed">
                <Play className="h-4 w-4" />
                {t('auto_att.run_now')}
              </button>
            </Tooltip>
          ) : (
            <button
              onClick={handleRunNow}
              disabled={running}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 transition-colors"
            >
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running ? t('auto_att.running') : t('auto_att.run_now')}
            </button>
          )}
          <button
            onClick={handlePenaltyEngine}
            disabled={penaltyRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-60 transition-colors"
          >
            {penaltyRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
            {penaltyRunning ? 'جاري التشغيل...' : t('auto_att.run_penalty_engine')}
          </button>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar settings={settings} lastRunSummary={lastRunSummary} t={t} isRTL={isRTL} />

      {/* Tabs */}
      <div className="border-b border-border">
        <nav className={cn('flex gap-6', isRTL && 'flex-row-reverse')}>
          {(['settings', 'preview', 'logs'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                if (tab === 'logs') loadLogs(1, logsStatus)
                if (tab === 'preview') loadEligible()
              }}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                activeTab === tab
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab === 'settings' && <Settings className="h-4 w-4" />}
              {tab === 'logs' && <FileText className="h-4 w-4" />}
              {tab === 'preview' && <Eye className="h-4 w-4" />}
              {t(`auto_att.tab_${tab}`)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'settings' && settings && (
        <SettingsTab
          settings={settings}
          savedSettings={savedSettings}
          eligible={eligible}
          allEmployees={allEmployees}
          onUpdate={updateSettings}
          onToggle={handleToggleEnabled}
          onSave={handleSave}
          saving={saving}
          t={t}
          isRTL={isRTL}
        />
      )}

      {activeTab === 'preview' && (
        <PreviewTab eligible={eligible} t={t} isRTL={isRTL} />
      )}

      {activeTab === 'logs' && (
        <LogsTab
          data={logsData}
          page={logsPage}
          status={logsStatus}
          onPageChange={(p) => { setLogsPage(p); loadLogs(p, logsStatus) }}
          onStatusChange={(s) => { setLogsStatus(s); setLogsPage(1); loadLogs(1, s) }}
          t={t}
          isRTL={isRTL}
        />
      )}
    </div>
  )
}

// =====================================================================
// Status Bar
// =====================================================================

function StatusBar({ settings, lastRunSummary, t, isRTL }: {
  settings: AutoAttendanceSettings | null
  lastRunSummary: LastRunSummary | null
  t: (k: string) => string
  isRTL: boolean
}) {
  return (
    <div className={cn('bg-card rounded-xl border border-border px-5 py-3.5 flex items-center gap-6 flex-wrap', isRTL && 'flex-row-reverse')}>
      {/* Status badge */}
      <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
        <div className={cn('w-2 h-2 rounded-full', settings?.enabled ? 'bg-green-500' : 'bg-gray-400')} />
        <span className={cn('text-sm font-medium', settings?.enabled ? 'text-green-700' : 'text-muted-foreground')}>
          {settings?.enabled ? t('auto_att.status_active') : t('auto_att.status_inactive')}
        </span>
      </div>

      <div className="w-px h-5 bg-muted" />

      {/* Last run */}
      <div className={cn('flex items-center gap-1.5 text-xs text-muted-foreground', isRTL && 'flex-row-reverse')}>
        <Clock className="h-3.5 w-3.5" />
        <span>{t('auto_att.last_run')}:</span>
        <span className="font-medium text-foreground/90">
          {lastRunSummary?.last_run ? new Date(lastRunSummary.last_run).toLocaleString() : t('auto_att.never')}
        </span>
      </div>

      {/* Last result */}
      {lastRunSummary?.last_run && (
        <>
          <div className="w-px h-5 bg-muted" />
          <div className={cn('flex items-center gap-3 text-xs', isRTL && 'flex-row-reverse')}>
            <span className="text-muted-foreground">{t('auto_att.last_result')}:</span>
            <span className="text-green-600 font-medium">{lastRunSummary.created} created</span>
            {lastRunSummary.skipped > 0 && <span className="text-yellow-600 font-medium">{lastRunSummary.skipped} skipped</span>}
            {lastRunSummary.errors > 0 && <span className="text-red-600 font-medium">{lastRunSummary.errors} errors</span>}
          </div>
        </>
      )}
    </div>
  )
}

// =====================================================================
// Settings Tab — fully reorganized
// =====================================================================

function SettingsTab({
  settings, savedSettings, eligible, allEmployees,
  onUpdate, onToggle, onSave, saving, t, isRTL
}: {
  settings: AutoAttendanceSettings
  savedSettings: AutoAttendanceSettings | null
  eligible: EligibleEmployee[]
  allEmployees: { employee: string; employee_name: string; branch: string; department: string }[]
  onUpdate: (patch: Partial<AutoAttendanceSettings>) => void
  onToggle: () => void
  onSave: () => void
  saving: boolean
  t: (key: string) => string
  isRTL: boolean
}) {
  const [empSearch, setEmpSearch] = useState('')

  const disabled = false  // all fields always editable — enable toggle controls runtime behavior

  const filteredPickerEmployees = allEmployees.filter(e =>
    !empSearch || e.employee_name.toLowerCase().includes(empSearch.toLowerCase()) || e.employee.toLowerCase().includes(empSearch.toLowerCase())
  )

  const selectedEmployeeIds = new Set(settings.employees.map(e => e.employee))

  const toggleEmployee = (emp: { employee: string; employee_name: string }) => {
    const current = settings.employees
    if (selectedEmployeeIds.has(emp.employee)) {
      onUpdate({ employees: current.filter(e => e.employee !== emp.employee) })
    } else {
      onUpdate({ employees: [...current, { employee: emp.employee, employee_name: emp.employee_name }] })
    }
  }

  return (
    <div className="space-y-5">
      {/* Section 1: Basic Configuration */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h3 className={cn('text-sm font-semibold text-foreground flex items-center gap-2', isRTL && 'flex-row-reverse text-right')}>
          <Settings className="h-4 w-4 text-muted-foreground" />
          {t('auto_att.basic_config')}
        </h3>

        {/* Enable toggle + badge */}
        <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
          <div className={cn('flex items-center gap-3', isRTL && 'flex-row-reverse')}>
            <Zap className={cn('h-5 w-5', settings.enabled ? 'text-green-500' : 'text-muted-foreground/70')} />
            <span className="text-sm font-medium text-foreground/90">
              {settings.enabled ? t('auto_att.enabled') : t('auto_att.disabled')}
            </span>
            <span className={cn(
              'px-2 py-0.5 text-xs font-medium rounded-full',
              settings.enabled ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground'
            )}>
              {settings.enabled ? t('auto_att.status_active') : t('auto_att.status_inactive')}
            </span>
          </div>
          <button
            onClick={onToggle}
            aria-label={t('auto_att.title')}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring',
              settings.enabled ? 'bg-green-500' : 'bg-muted-foreground/30'
            )}
            role="switch"
            aria-checked={!!settings.enabled}
          >
            <div className={cn(
              'absolute top-0.5 w-5 h-5 bg-card rounded-full shadow-sm transition-all duration-200',
              settings.enabled ? (isRTL ? 'left-0.5' : 'left-[22px]') : (isRTL ? 'left-[22px]' : 'left-0.5')
            )} />
          </button>
        </div>
      </div>

      {/* Section 2: Employee Selection */}
      <div className={cn('bg-card rounded-xl border border-border p-5 space-y-4', disabled && 'opacity-50 pointer-events-none')}>
        <h3 className={cn('text-sm font-semibold text-foreground flex items-center gap-2', isRTL && 'flex-row-reverse text-right')}>
          <Users className="h-4 w-4 text-muted-foreground" />
          {t('auto_att.scope_section')}
        </h3>

        <div className="space-y-2">
          <label className={cn('block text-sm font-medium text-foreground/90', isRTL && 'text-right')}>{t('auto_att.select_employees')}</label>
          {/* Search */}
          <div className="relative">
            <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70', isRTL ? 'right-3' : 'left-3')} />
            <input
              type="text"
              aria-label={t('auto_att.select_employees')}
              value={empSearch}
              onChange={(e) => setEmpSearch(e.target.value)}
              placeholder={t('auto_att.search_employees')}
              className={cn('w-full py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-ring focus:border-ring', isRTL ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3')}
            />
          </div>
          {/* Selected count */}
          {settings.employees.length > 0 && (
            <div className="text-xs text-primary font-medium">{settings.employees.length} selected</div>
          )}
          {/* Employee list */}
          <div className="max-h-48 overflow-y-auto border border-border rounded-lg divide-y divide-border/50">
            {filteredPickerEmployees.slice(0, 100).map(emp => (
              <label key={emp.employee} className={cn('flex items-center gap-3 px-3 py-2 hover:bg-accent/50 cursor-pointer', isRTL && 'flex-row-reverse')}>
                <input
                  type="checkbox"
                  checked={selectedEmployeeIds.has(emp.employee)}
                  onChange={() => toggleEmployee(emp)}
                  className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
                />
                <div className={cn('flex-1 min-w-0', isRTL && 'text-right')}>
                  <div className="text-sm font-medium text-foreground truncate">{emp.employee_name}</div>
                  <div className="text-xs text-muted-foreground/70">{emp.employee}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Per-employee time windows */}
        {!!settings.randomize_times && (
          <TimeWindowRules
            rules={settings.employees}
            eligible={eligible}
            onUpdate={(employees) => onUpdate({ employees })}
            t={t}
            isRTL={isRTL}
          />
        )}

        {/* Impact Preview */}
        <ImpactPreview eligible={eligible} t={t} isRTL={isRTL} />
      </div>

      {/* Section 3: Timing */}
      <div className={cn('bg-card rounded-xl border border-border p-5 space-y-4', disabled && 'opacity-50 pointer-events-none')}>
        <h3 className={cn('text-sm font-semibold text-foreground flex items-center gap-2', isRTL && 'flex-row-reverse text-right')}>
          <Clock className="h-4 w-4 text-muted-foreground" />
          {t('auto_att.timing_section')}
        </h3>

        {/* Randomized per-employee windows */}
        <div className={cn('flex items-start justify-between gap-3 p-3 rounded-lg border border-border/60 bg-muted/30', isRTL && 'flex-row-reverse')}>
          <div className={isRTL ? 'text-right' : ''}>
            <div className="text-sm font-medium text-foreground/90">{t('auto_att.randomize')}</div>
            <div className="text-xs text-muted-foreground/70">{t('auto_att.randomize_desc')}</div>
          </div>
          <button
            onClick={() => onUpdate({ randomize_times: settings.randomize_times ? 0 : 1 })}
            role="switch"
            aria-checked={!!settings.randomize_times}
            aria-label={t('auto_att.randomize')}
            className={cn(
              'relative w-9 h-5 rounded-full transition-colors flex-shrink-0 mt-0.5',
              settings.randomize_times ? 'bg-primary' : 'bg-muted-foreground/30'
            )}
          >
            <div className={cn(
              'absolute top-0.5 w-4 h-4 bg-card rounded-full shadow-sm transition-all duration-200',
              settings.randomize_times ? (isRTL ? 'left-0.5' : 'left-[18px]') : (isRTL ? 'left-[18px]' : 'left-0.5')
            )} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Auto Check-in */}
          <div className="space-y-2 p-3 rounded-lg border border-border/60 bg-muted/30">
            <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
              <div className={isRTL ? 'text-right' : ''}>
                <div className="text-sm font-medium text-foreground/90">{t('auto_att.auto_checkin')}</div>
                <div className="text-xs text-muted-foreground/70">{t('auto_att.auto_checkin_desc')}</div>
              </div>
              <button
                onClick={() => onUpdate({ auto_checkin: settings.auto_checkin ? 0 : 1 })}
                role="switch"
                aria-checked={!!settings.auto_checkin}
                aria-label={t('auto_att.auto_checkin')}
                className={cn(
                  'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
                  settings.auto_checkin ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              >
                <div className={cn(
                  'absolute top-0.5 w-4 h-4 bg-card rounded-full shadow-sm transition-all duration-200',
                  settings.auto_checkin ? (isRTL ? 'left-0.5' : 'left-[18px]') : (isRTL ? 'left-[18px]' : 'left-0.5')
                )} />
              </button>
            </div>
            {!!settings.auto_checkin && (
              <div>
                <label className={cn('block text-xs text-muted-foreground mb-1', isRTL && 'text-right')}>{t('auto_att.checkin_offset')}</label>
                <input
                  type="number"
                  min="0"
                  aria-label={t('auto_att.checkin_offset')}
                  value={settings.checkin_offset_minutes}
                  onChange={(e) => onUpdate({ checkin_offset_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 border border-input rounded-lg text-sm text-left"
                  dir="ltr"
                />
              </div>
            )}
          </div>

          {/* Auto Check-out */}
          <div className="space-y-2 p-3 rounded-lg border border-border/60 bg-muted/30">
            <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
              <div className={isRTL ? 'text-right' : ''}>
                <div className="text-sm font-medium text-foreground/90">{t('auto_att.auto_checkout')}</div>
                <div className="text-xs text-muted-foreground/70">{t('auto_att.auto_checkout_desc')}</div>
              </div>
              <button
                onClick={() => onUpdate({ auto_checkout: settings.auto_checkout ? 0 : 1 })}
                role="switch"
                aria-checked={!!settings.auto_checkout}
                aria-label={t('auto_att.auto_checkout')}
                className={cn(
                  'relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
                  settings.auto_checkout ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              >
                <div className={cn(
                  'absolute top-0.5 w-4 h-4 bg-card rounded-full shadow-sm transition-all duration-200',
                  settings.auto_checkout ? (isRTL ? 'left-0.5' : 'left-[18px]') : (isRTL ? 'left-[18px]' : 'left-0.5')
                )} />
              </button>
            </div>
            {!!settings.auto_checkout && (
              <div>
                <label className={cn('block text-xs text-muted-foreground mb-1', isRTL && 'text-right')}>{t('auto_att.checkout_offset')}</label>
                <input
                  type="number"
                  min="0"
                  aria-label={t('auto_att.checkout_offset')}
                  value={settings.checkout_offset_minutes}
                  onChange={(e) => onUpdate({ checkout_offset_minutes: parseInt(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 border border-input rounded-lg text-sm text-left"
                  dir="ltr"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Safety Rules */}
      <div className={cn('bg-card rounded-xl border border-border p-5 space-y-4', disabled && 'opacity-50 pointer-events-none')}>
        <h3 className={cn('text-sm font-semibold text-foreground flex items-center gap-2', isRTL && 'flex-row-reverse text-right')}>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          {t('auto_att.safety_section')}
        </h3>

        <div className="space-y-3">
          {([
            { key: 'skip_if_manual_exists' as const, label: t('auto_att.skip_manual') },
            { key: 'skip_leaves' as const, label: t('auto_att.skip_leaves') },
            { key: 'skip_holidays' as const, label: t('auto_att.skip_holidays') },
          ]).map(({ key, label }) => (
            <label key={key} className={cn('flex items-center gap-3 cursor-pointer', isRTL && 'flex-row-reverse')}>
              <input
                type="checkbox"
                checked={!!settings[key]}
                onChange={(e) => onUpdate({ [key]: e.target.checked ? 1 : 0 })}
                className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
              />
              <span className={cn('text-sm text-foreground/90', isRTL && 'text-right')}>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Save + Run Now buttons */}
      <div className={cn('flex items-center gap-3', isRTL && 'flex-row-reverse')}>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? t('auto_att.saving') : t('auto_att.save')}
        </button>
      </div>
    </div>
  )
}

// =====================================================================
// Impact Preview Card
// =====================================================================

// =====================================================================
// Per-employee time windows
// =====================================================================

function TimeWindowRules({
  rules, eligible, onUpdate, t, isRTL,
}: {
  rules: EmployeeRule[]
  eligible: EligibleEmployee[]
  onUpdate: (rules: EmployeeRule[]) => void
  t: (k: string) => string
  isRTL: boolean
}) {
  const updateRule = (index: number, patch: Partial<EmployeeRule>) => {
    const next = [...rules]
    next[index] = { ...next[index], ...patch }
    onUpdate(next)
  }

  // Employees the backend confirmed it can't turn into an Attendance record.
  const shiftless = new Set(
    eligible.filter(e => e.custom_times && e.has_shift === false).map(e => e.employee)
  )

  if (rules.length === 0) {
    return (
      <div className={cn('rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground', isRTL && 'text-right')}>
        {t('auto_att.rules_empty')}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className={cn('text-sm font-medium text-foreground/90', isRTL && 'text-right')}>
        {t('auto_att.rules_title')}
      </div>
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className={cn(isRTL ? 'text-right' : 'text-left')}>
              <th className="px-3 py-2 font-medium text-xs text-muted-foreground">{t('auto_att.col_employee')}</th>
              <th className="px-3 py-2 font-medium text-xs text-muted-foreground">{t('auto_att.col_custom')}</th>
              <th className="px-3 py-2 font-medium text-xs text-muted-foreground whitespace-nowrap">{t('auto_att.col_checkin_window')}</th>
              <th className="px-3 py-2 font-medium text-xs text-muted-foreground whitespace-nowrap">{t('auto_att.col_checkout_window')}</th>
              <th className="px-3 py-2 font-medium text-xs text-muted-foreground whitespace-nowrap">{t('auto_att.col_location')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rules.map((rule, i) => {
              const on = !!rule.use_custom_times
              return (
                <tr key={rule.employee} className="hover:bg-accent/30 align-top">
                  <td className={cn('px-3 py-2', isRTL && 'text-right')}>
                    <div className="font-medium text-foreground whitespace-nowrap">{rule.employee_name || rule.employee}</div>
                    <div className="text-xs text-muted-foreground/70">{rule.employee}</div>
                    {on && shiftless.has(rule.employee) && (
                      <div className={cn('mt-1 flex items-start gap-1 text-[11px] text-amber-700', isRTL && 'flex-row-reverse text-right')}>
                        <AlertTriangle className="h-3 w-3 mt-px flex-shrink-0" />
                        <span>{t('auto_att.no_shift_warning')}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={on}
                      aria-label={t('auto_att.col_custom')}
                      onChange={(e) => updateRule(i, { use_custom_times: e.target.checked ? 1 : 0 })}
                      className="w-4 h-4 rounded border-input text-primary focus:ring-ring"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1" dir="ltr">
                      <input
                        type="time" step="1" disabled={!on}
                        aria-label={t('auto_att.col_checkin_window')}
                        value={(rule.checkin_from || '').substring(0, 8)}
                        onChange={(e) => updateRule(i, { checkin_from: e.target.value })}
                        className="px-2 py-1 border border-input rounded-md text-xs disabled:opacity-40"
                      />
                      <span className="text-muted-foreground text-xs">→</span>
                      <input
                        type="time" step="1" disabled={!on}
                        aria-label={t('auto_att.col_checkin_window')}
                        value={(rule.checkin_to || '').substring(0, 8)}
                        onChange={(e) => updateRule(i, { checkin_to: e.target.value })}
                        className="px-2 py-1 border border-input rounded-md text-xs disabled:opacity-40"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1" dir="ltr">
                      <input
                        type="time" step="1" disabled={!on}
                        aria-label={t('auto_att.col_checkout_window')}
                        value={(rule.checkout_from || '').substring(0, 8)}
                        onChange={(e) => updateRule(i, { checkout_from: e.target.value })}
                        className="px-2 py-1 border border-input rounded-md text-xs disabled:opacity-40"
                      />
                      <span className="text-muted-foreground text-xs">→</span>
                      <input
                        type="time" step="1" disabled={!on}
                        aria-label={t('auto_att.col_checkout_window')}
                        value={(rule.checkout_to || '').substring(0, 8)}
                        onChange={(e) => updateRule(i, { checkout_to: e.target.value })}
                        className="px-2 py-1 border border-input rounded-md text-xs disabled:opacity-40"
                      />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1" dir="ltr">
                      <input
                        type="number" step="any" disabled={!on} placeholder="lat"
                        aria-label={t('auto_att.col_location')}
                        value={rule.latitude ?? ''}
                        onChange={(e) => updateRule(i, { latitude: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        className="w-24 px-2 py-1 border border-input rounded-md text-xs disabled:opacity-40"
                      />
                      <input
                        type="number" step="any" disabled={!on} placeholder="lng"
                        aria-label={t('auto_att.col_location')}
                        value={rule.longitude ?? ''}
                        onChange={(e) => updateRule(i, { longitude: e.target.value === '' ? null : parseFloat(e.target.value) })}
                        className="w-24 px-2 py-1 border border-input rounded-md text-xs disabled:opacity-40"
                      />
                    </div>
                    <div className={cn('text-[11px] text-muted-foreground/70 mt-1', isRTL && 'text-right')}>
                      {t('auto_att.location_optional')}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className={cn('flex items-start gap-1.5 text-[11px] text-muted-foreground', isRTL && 'flex-row-reverse text-right')}>
        <Info className="h-3.5 w-3.5 mt-px flex-shrink-0" />
        <span>{t('auto_att.rules_hint')}</span>
      </div>
    </div>
  )
}

function ImpactPreview({ eligible, t, isRTL }: { eligible: EligibleEmployee[]; t: (k: string) => string; isRTL: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const count = eligible.length

  return (
    <div className={cn(
      'rounded-lg border p-3.5 space-y-2',
      count === 0 ? 'border-yellow-200 bg-yellow-50' : count > 100 ? 'border-orange-200 bg-orange-50' : 'border-primary/20 bg-accent'
    )}>
      <div className={cn('flex items-center justify-between', isRTL && 'flex-row-reverse')}>
        <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          {count === 0 ? (
            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
          ) : (
            <Users className="h-4 w-4 text-primary flex-shrink-0" />
          )}
          <span className={cn('text-sm font-medium', count === 0 ? 'text-yellow-800' : 'text-accent-foreground')}>
            {count === 0
              ? t('auto_att.impact_zero')
              : t('auto_att.impact_preview').replace('{count}', String(count))}
          </span>
          {count === 0 && (
            <a href="/shift-management" className="text-xs font-semibold text-primary underline underline-offset-2 whitespace-nowrap">
              {isRTL ? 'إدارة المناوبات ←' : '→ Shift management'}
            </a>
          )}
        </div>
        {count > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
            {expanded ? t('auto_att.hide_employees') : t('auto_att.show_employees')}
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}
      </div>

      {count > 100 && (
        <div className={cn('flex items-center gap-1.5 text-xs text-orange-700', isRTL && 'flex-row-reverse')}>
          <AlertCircle className="h-3.5 w-3.5" />
          {t('auto_att.impact_large')}
        </div>
      )}

      {expanded && count > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1 pt-1">
          {eligible.map(e => (
            <div key={e.employee} className={cn('text-xs text-foreground/90 flex items-center gap-2', isRTL && 'flex-row-reverse')}>
              <span className="font-medium">{e.employee_name}</span>
              {e.shift ? (
                <span className="text-muted-foreground/70">({e.shift})</span>
              ) : (
                <span className={cn('flex items-center gap-1 text-amber-700', isRTL && 'flex-row-reverse')}>
                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                  {t('auto_att.no_shift_warning')}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// =====================================================================
// Preview Tab
// =====================================================================

function PreviewTab({ eligible, t, isRTL }: { eligible: EligibleEmployee[]; t: (k: string) => string; isRTL: boolean }) {
  return (
    <div className="bg-card rounded-xl border border-border">
      <div className={cn('p-4 border-b border-border/60 flex items-center justify-between', isRTL && 'flex-row-reverse')}>
        <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t('auto_att.eligible_employees')}</h3>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {t('auto_att.eligible_count').replace('{count}', String(eligible.length))}
        </span>
      </div>
      {eligible.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground/70 text-sm">{t('auto_att.no_logs')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className={cn('px-4 py-3 font-medium text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>{t('auto_att.log_employee')}</th>
                <th className={cn('px-4 py-3 font-medium text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>{t('auto_att.log_shift')}</th>
                <th className={cn('px-4 py-3 font-medium text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>{t('auto_att.branch')}</th>
                <th className={cn('px-4 py-3 font-medium text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>Shift Start</th>
                <th className={cn('px-4 py-3 font-medium text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>Shift End</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {eligible.map(emp => (
                <tr key={emp.employee} className="hover:bg-accent/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{emp.employee_name}</div>
                    <div className="text-xs text-muted-foreground/70">{emp.employee}</div>
                  </td>
                  <td className="px-4 py-3 text-foreground/90">{emp.shift}</td>
                  <td className="px-4 py-3 text-foreground/90">{emp.branch || '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{emp.shift_start}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{emp.shift_end}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// =====================================================================
// Logs Tab
// =====================================================================

function LogsTab({ data, page, status, onPageChange, onStatusChange, t, isRTL }: {
  data: LogsResponse | null; page: number; status: string
  onPageChange: (p: number) => void; onStatusChange: (s: string) => void
  t: (k: string) => string; isRTL: boolean
}) {
  return (
    <div className="space-y-4">
      <div className={cn('flex items-center gap-3', isRTL && 'flex-row-reverse')}>
        <select
          aria-label={isRTL ? 'الحالة' : 'Status'}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className={cn('px-3 py-2 border border-input rounded-lg text-sm', isRTL && 'text-right')}
        >
          <option value="">{t('auto_att.all_statuses')}</option>
          <option value="Success">{t('auto_att.status_success')}</option>
          <option value="Skipped">{t('auto_att.status_skipped')}</option>
          <option value="Error">{t('auto_att.status_error')}</option>
        </select>
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {!data || data.logs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground/70 text-sm">{t('auto_att.no_logs')}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className={cn('px-4 py-3 font-medium text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>{t('auto_att.log_employee')}</th>
                    <th className={cn('px-4 py-3 font-medium text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>{t('auto_att.log_type')}</th>
                    <th className={cn('px-4 py-3 font-medium text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>{t('auto_att.log_status')}</th>
                    <th className={cn('px-4 py-3 font-medium text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>{t('auto_att.log_message')}</th>
                    <th className={cn('px-4 py-3 font-medium text-muted-foreground', isRTL ? 'text-right' : 'text-left')}>{t('auto_att.log_time')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.logs.map(log => (
                    <tr key={log.name} className="hover:bg-accent/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{log.employee_name}</div>
                        <div className="text-xs text-muted-foreground/70">{log.employee}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', log.log_type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700')}>
                          {log.log_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('flex items-center gap-1 text-xs font-medium',
                          log.status === 'Success' ? 'text-green-600' : log.status === 'Skipped' ? 'text-yellow-600' : 'text-red-600'
                        )}>
                          {log.status === 'Success' ? <CheckCircle className="h-3.5 w-3.5" /> : log.status === 'Error' ? <XCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                          {log.status === 'Success' ? t('auto_att.status_success') : log.status === 'Skipped' ? t('auto_att.status_skipped') : log.status === 'Error' ? t('auto_att.status_error') : log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[300px] truncate">{log.message}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.total_pages > 1 && (
              <div className={cn('flex items-center justify-between px-4 py-3 border-t border-border/60', isRTL && 'flex-row-reverse')}>
                <span className="text-xs text-muted-foreground">
                  {t('page')} {data.page} {t('of')} {data.total_pages} ({data.total} total)
                </span>
                <div className={cn('flex items-center gap-2', isRTL && 'flex-row-reverse')}>
                  <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="p-1.5 rounded border border-border text-muted-foreground hover:bg-accent/50 disabled:opacity-30">
                    {isRTL ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  </button>
                  <button onClick={() => onPageChange(page + 1)} disabled={page >= data.total_pages} className="p-1.5 rounded border border-border text-muted-foreground hover:bg-accent/50 disabled:opacity-30">
                    {isRTL ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
