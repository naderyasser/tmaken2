'use client'

/**
 * RequestsHub (F1) — the unified Requests & Approvals center: My Requests /
 * Tasks / My Approvals / Team Requests, with a New-Request (on-behalf) flow and
 * the approval drawer. Token-only, Arabic-first RTL. Reuses the shared kit.
 */
import * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, Plus, Inbox, ListChecks, UserCheck, Users } from 'lucide-react'
import { PageHeader, SegmentedControl, DataTable, type DataTableColumn } from '@/components/shared'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { dualDate } from '@/lib/format'
import { requestsApi, type FlowRow } from '@/lib/requests-api'
import { taskApi } from '@/lib/task-api'
import { ApprovalDrawer } from './approval-drawer'
import { NewRequestModal } from './new-request-modal'

type Tab = 'my_requests' | 'tasks' | 'my_approvals' | 'team_requests'

const STATUS_OPTIONS = ['Pending', 'Approved', 'Rejected', 'Completed', 'Cancelled']

export function RequestsHub() {
  const { isRTL } = useI18n()
  const tt = (en: string, ar: string) => (isRTL ? ar : en)
  const { isHRUser, isManager } = useAuth()
  const router = useRouter()
  const showTeam = isHRUser || isManager

  const [tab, setTab] = useState<Tab>('my_requests')
  const [flows, setFlows] = useState<FlowRow[]>([])
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')

  const [newOpen, setNewOpen] = useState(false)
  const [drawerFlow, setDrawerFlow] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      if (tab === 'tasks') {
        setTasks((await taskApi.getMyTasks(50)) as any[] || [])
      } else if (tab === 'my_requests') {
        setFlows(await requestsApi.myRequests())
      } else if (tab === 'my_approvals') {
        setFlows(await requestsApi.myApprovals())
      } else {
        setFlows(await requestsApi.teamRequests())
      }
    } catch (e: any) {
      setError(e?.message || tt('Could not load requests.', 'تعذر تحميل الطلبات.'))
      setFlows([]); setTasks([])
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => { load() }, [load])

  const flowColumns: DataTableColumn<FlowRow>[] = useMemo(() => [
    {
      id: 'employee', header: tt('Employee', 'الموظف'), sortable: true,
      sortAccessor: (r) => r.employee_name || r.employee || '',
      exportAccessor: (r) => r.employee_name || r.employee || '',
      cell: (r) => <span className="font-medium text-foreground">{r.employee_name || r.employee || '—'}</span>,
    },
    {
      id: 'type', header: tt('Type', 'النوع'), sortable: true,
      sortAccessor: (r) => r.label || r.request_type,
      exportAccessor: (r) => r.label || r.request_type,
      cell: (r) => <span className="text-foreground">{r.label || r.request_type}</span>,
    },
    {
      id: 'status', header: tt('Status', 'الحالة'),
      exportAccessor: (r) => r.status,
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      id: 'step', header: tt('Step', 'الخطوة'), hideOnMobile: true,
      exportAccessor: (r) => r.step_status || (r.current_step ? String(r.current_step) : ''),
      cell: (r) => <span className="text-sm text-muted-foreground">{r.step_status || (r.current_step ? `#${r.current_step}` : '—')}</span>,
    },
    {
      id: 'date', header: tt('Date', 'التاريخ'), align: 'end', sortable: true, hideOnMobile: true,
      sortAccessor: (r) => r.creation || '',
      exportAccessor: (r) => r.creation || '',
      cell: (r) => <span className="text-xs text-muted-foreground">{r.creation ? dualDate(r.creation) : '—'}</span>,
    },
  ], [isRTL])

  const taskColumns: DataTableColumn<any>[] = useMemo(() => [
    { id: 'subject', header: tt('Task', 'المهمة'), sortable: true, sortAccessor: (r) => r.subject || r.title || r.name || '', exportAccessor: (r) => r.subject || r.title || r.name || '', cell: (r) => <span className="font-medium text-foreground">{r.subject || r.title || r.name}</span> },
    { id: 'status', header: tt('Status', 'الحالة'), exportAccessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { id: 'module', header: tt('Module', 'الوحدة'), hideOnMobile: true, exportAccessor: (r) => r.module || '', cell: (r) => <span className="text-sm text-muted-foreground">{r.module || '—'}</span> },
    { id: 'date', header: tt('Received', 'الاستلام'), align: 'end', hideOnMobile: true, sortable: true, sortAccessor: (r) => r.creation || '', exportAccessor: (r) => r.creation || '', cell: (r) => <span className="text-xs text-muted-foreground">{r.creation ? dualDate(r.creation) : '—'}</span> },
  ], [isRTL])

  const statusFilterDef = tab !== 'tasks' ? [{
    id: 'status', label: tt('Status', 'الحالة'), value: statusFilter, onChange: setStatusFilter,
    options: [{ value: 'all', label: tt('All statuses', 'كل الحالات') }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))],
    predicate: (r: FlowRow, v: string) => r.status === v,
  }] : []

  const tabs = useMemo(() => {
    const base = [
      { id: 'my_requests', label: tt('My Requests', 'طلباتي'), icon: Inbox },
      { id: 'tasks', label: tt('Tasks', 'المهام'), icon: ListChecks },
      { id: 'my_approvals', label: tt('My Approvals', 'اعتماداتي'), icon: UserCheck },
    ]
    if (showTeam) base.push({ id: 'team_requests', label: tt('Team Requests', 'طلبات الفريق'), icon: Users })
    return base
  }, [showTeam, isRTL])

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={Send}
        title={tt('Requests & Approvals', 'الطلبات والاعتمادات')}
        description={tt('Submit, track, and approve requests.', 'إرسال الطلبات ومتابعتها واعتمادها.')}
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus className="me-1.5 h-4 w-4" />
            {tt('New request', 'طلب جديد')}
          </Button>
        }
      >
        <SegmentedControl
          options={tabs}
          value={tab}
          onChange={(v) => { setTab(v as Tab); setStatusFilter('all') }}
        />
      </PageHeader>

      {tab === 'tasks' ? (
        <DataTable
          rows={tasks}
          columns={taskColumns}
          getRowId={(r) => r.name || r.subject}
          isRTL={isRTL}
          loading={loading}
          error={error}
          onRetry={load}
          searchable
          searchAccessor={(r) => `${r.subject || ''} ${r.name || ''} ${r.module || ''}`}
          searchPlaceholder={tt('Search tasks…', 'ابحث في المهام…')}
          onRowClick={() => router.push('/tasks')}
          emptyMessage={tt('No tasks assigned to you.', 'لا توجد مهام مسندة إليك.')}
          emptyDescription={tt('Tasks assigned to you by approval flows appear here.', 'المهام المسندة إليك من مسارات الاعتماد ستظهر هنا.')}
          emptyActionLabel={tt('New request', 'طلب جديد')}
          emptyAction={() => setNewOpen(true)}
          persistKey="req-hub-tasks"
        />
      ) : (
        <DataTable
          rows={flows}
          columns={flowColumns}
          getRowId={(r) => r.flow}
          isRTL={isRTL}
          loading={loading}
          error={error}
          onRetry={load}
          searchable
          searchAccessor={(r) => `${r.employee_name || ''} ${r.employee || ''} ${r.label || r.request_type} ${r.status}`}
          searchPlaceholder={tt('Search requests…', 'ابحث في الطلبات…')}
          filters={statusFilterDef}
          onRowClick={(r) => setDrawerFlow(r.flow)}
          emptyMessage={
            tab === 'my_approvals' ? tt('Nothing awaiting your approval.', 'لا شيء بانتظار اعتمادك.')
            : tab === 'team_requests' ? tt('No team requests.', 'لا توجد طلبات للفريق.')
            : tt('You have no requests yet.', 'ليس لديك طلبات بعد.')
          }
          emptyActionLabel={tab === 'my_requests' || tab === 'team_requests' ? tt('New request', 'طلب جديد') : undefined}
          emptyAction={tab === 'my_requests' || tab === 'team_requests' ? () => setNewOpen(true) : undefined}
          exportFilename="requests"
          exportTitle={tt('Requests', 'الطلبات')}
          persistKey={`req-hub-${tab}`}
        />
      )}

      <NewRequestModal open={newOpen} onOpenChange={setNewOpen} onCreated={load} />
      <ApprovalDrawer
        flow={drawerFlow}
        open={!!drawerFlow}
        onOpenChange={(o) => { if (!o) setDrawerFlow(null) }}
        onActed={load}
      />
    </div>
  )
}
