'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { Header } from '@/components/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TaskKanban } from '@/components/tasks/task-kanban'
import { TaskList } from '@/components/tasks/task-list'
import { TaskDetailSheet } from '@/components/tasks/task-detail-sheet'
import { TaskAnalyticsCharts } from '@/components/tasks/task-analytics-charts'
import { taskApi, type WorkflowTask, type TaskStats, type KanbanData } from '@/lib/task-api'
import { cn } from '@/lib/utils'
import {
  LayoutGrid, List, RefreshCw, Search, AlertTriangle,
  CheckCircle2, Clock, AlertCircle, Inbox, ArrowLeft, ArrowRight,
  Boxes, Truck, Users, Briefcase, Calculator, Shield,
  TrendingUp
} from 'lucide-react'

const L = {
  en: {
    title: 'Workflow Tasks',
    subtitle: 'Cross-module task automation & tracking',
    kanban: 'Kanban', list: 'List',
    refresh: 'Refresh', search: 'Search tasks...',
    allModules: 'All Modules', allStatuses: 'All Statuses', allPriorities: 'All Priorities',
    inventory: 'Inventory', purchases: 'Purchases', sales: 'Sales',
    hr: 'HR', accounting: 'Accounting', admin: 'Admin',
    new: 'New', inProgress: 'In Progress', completed: 'Completed',
    cancelled: 'Cancelled', overdue: 'Overdue',
    low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent',
    totalOpen: 'Total Open', myTasks: 'My Tasks',
    overdueCount: 'Overdue', completedToday: 'Done Today',
    loading: 'Loading tasks...',
    error: 'Failed to load tasks',
    retry: 'Retry',
    back: 'Back',
  },
  ar: {
    title: 'مهام سير العمل',
    subtitle: 'أتمتة وتتبع المهام بين الأقسام',
    kanban: 'كانبان', list: 'قائمة',
    refresh: 'تحديث', search: 'بحث في المهام...',
    allModules: 'جميع الموديولات', allStatuses: 'جميع الحالات', allPriorities: 'جميع الأولويات',
    inventory: 'المخزون', purchases: 'المشتريات', sales: 'المبيعات',
    hr: 'الموارد البشرية', accounting: 'المحاسبة', admin: 'الإدارة',
    new: 'جديد', inProgress: 'قيد التنفيذ', completed: 'مكتمل',
    cancelled: 'ملغي', overdue: 'متأخر',
    low: 'منخفض', medium: 'متوسط', high: 'عالي', urgent: 'عاجل',
    totalOpen: 'المفتوحة', myTasks: 'مهامي',
    overdueCount: 'متأخرة', completedToday: 'مكتملة اليوم',
    loading: 'جاري تحميل المهام...',
    error: 'فشل تحميل المهام',
    retry: 'إعادة المحاولة',
    back: 'رجوع',
  }
}

const modules = ['Inventory', 'Purchases', 'Sales', 'HR', 'Accounting', 'Admin']
const statuses = ['New', 'In Progress', 'Completed', 'Cancelled', 'Overdue']
const priorities = ['Low', 'Medium', 'High', 'Urgent']

const moduleConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  Inventory:  { icon: <Boxes className="h-4 w-4" />, color: 'text-orange-600' },
  Purchases:  { icon: <Truck className="h-4 w-4" />, color: 'text-emerald-600' },
  Sales:      { icon: <Users className="h-4 w-4" />, color: 'text-violet-600' },
  HR:         { icon: <Briefcase className="h-4 w-4" />, color: 'text-blue-600' },
  Accounting: { icon: <Calculator className="h-4 w-4" />, color: 'text-indigo-600' },
  Admin:      { icon: <Shield className="h-4 w-4" />, color: 'text-gray-600' },
}

type ViewMode = 'kanban' | 'list'

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-[3px] border-teal-600 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    }>
      <TasksContent />
    </Suspense>
  )
}

function TasksContent() {
  const { lang, isRTL } = useI18n()
  const { user } = useAuth()
  const t = L[lang]

  const [view, setView] = useState<ViewMode>('kanban')
  const [stats, setStats] = useState<TaskStats | null>(null)
  const [kanbanData, setKanbanData] = useState<KanbanData>({})
  const [listTasks, setListTasks] = useState<WorkflowTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [moduleFilter, setModuleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [priorityFilter, setPriorityFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Detail sheet
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const filters: any = {}
      if (moduleFilter) filters.module = moduleFilter
      if (statusFilter) filters.status = statusFilter
      if (priorityFilter) filters.priority = priorityFilter
      if (debouncedSearch) filters.search = debouncedSearch

      const [statsResult, viewData] = await Promise.allSettled([
        taskApi.getTaskStats({ module: moduleFilter || undefined }),
        view === 'kanban'
          ? taskApi.getKanbanData(filters)
          : taskApi.getTasks(filters),
      ])

      if (statsResult.status === 'fulfilled') setStats(statsResult.value)
      if (viewData.status === 'fulfilled') {
        if (view === 'kanban') {
          setKanbanData(viewData.value as KanbanData)
        } else {
          const result = viewData.value as { tasks: WorkflowTask[]; total: number }
          setListTasks(result.tasks || [])
        }
      }

      if (statsResult.status === 'rejected' && viewData.status === 'rejected') {
        setError(L[lang].error)
      }
    } catch {
      setError(L[lang].error)
    } finally {
      setLoading(false)
    }
  }, [moduleFilter, statusFilter, priorityFilter, debouncedSearch, view, lang])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleTaskClick = (task: WorkflowTask) => {
    setSelectedTask(task.name)
    setSheetOpen(true)
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />

      <main className="container mx-auto px-4 py-6 max-w-[1400px]">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{t.title}</h1>
              <p className="text-sm text-muted-foreground">{t.subtitle}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 me-1', loading && 'animate-spin')} />
            {t.refresh}
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <KPICard
            icon={<Inbox className="h-5 w-5" />}
            label={t.totalOpen}
            value={stats?.total_open ?? '-'}
            color="text-blue-600 bg-blue-50"
            loading={loading}
          />
          <KPICard
            icon={<Clock className="h-5 w-5" />}
            label={t.myTasks}
            value={stats?.my_open ?? '-'}
            color="text-violet-600 bg-violet-50"
            loading={loading}
          />
          <KPICard
            icon={<AlertTriangle className="h-5 w-5" />}
            label={t.overdueCount}
            value={stats?.overdue ?? '-'}
            color="text-red-600 bg-red-50"
            loading={loading}
            danger={!!stats?.overdue}
          />
          <KPICard
            icon={<CheckCircle2 className="h-5 w-5" />}
            label={t.completedToday}
            value={stats?.completed_today ?? '-'}
            color="text-green-600 bg-green-50"
            loading={loading}
          />
        </div>

        {/* Module pills */}
        {stats && (
          <div className="flex flex-wrap gap-2 mb-4">
            {modules.map(mod => {
              const count = stats.by_module?.[mod] || 0
              const cfg = moduleConfig[mod]
              const isActive = moduleFilter === mod
              const modKey = mod.toLowerCase() as keyof typeof t
              return (
                <button
                  key={mod}
                  onClick={() => setModuleFilter(isActive ? '' : mod)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                    isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-white hover:bg-muted/50'
                  )}
                >
                  {cfg.icon}
                  <span>{t[modKey] || mod}</span>
                  {count > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{count}</Badge>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Toolbar: View toggle + Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* View toggle */}
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setView('kanban')}
              className={cn('flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'kanban' ? 'bg-primary text-white' : 'bg-white hover:bg-muted')}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> {t.kanban}
            </button>
            <button
              onClick={() => setView('list')}
              className={cn('flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors',
                view === 'list' ? 'bg-primary text-white' : 'bg-white hover:bg-muted')}
            >
              <List className="h-3.5 w-3.5" /> {t.list}
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={t.search}
              className="ps-9 h-8 text-sm"
            />
          </div>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder={t.allStatuses} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allStatuses}</SelectItem>
              {statuses.map(s => {
                const key = s === 'In Progress' ? 'inProgress' : s.toLowerCase()
                return <SelectItem key={s} value={s}>{t[key as keyof typeof t] || s}</SelectItem>
              })}
            </SelectContent>
          </Select>

          {/* Priority filter */}
          <Select value={priorityFilter} onValueChange={v => setPriorityFilter(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue placeholder={t.allPriorities} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t.allPriorities}</SelectItem>
              {priorities.map(p => (
                <SelectItem key={p} value={p}>{t[p.toLowerCase() as keyof typeof t] || p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Error */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error}</span>
              <Button variant="outline" size="sm" onClick={fetchData}>{t.retry}</Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {loading && !stats && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-[200px] rounded-lg" />)}
            </div>
          </div>
        )}

        {/* Views */}
        {!loading || stats ? (
          view === 'kanban' ? (
            <div className="overflow-x-auto pb-4">
              <TaskKanban
                data={kanbanData}
                lang={lang}
                isRTL={isRTL}
                onTaskClick={handleTaskClick}
                onRefresh={fetchData}
              />
            </div>
          ) : (
            <TaskList
              tasks={listTasks}
              lang={lang}
              isRTL={isRTL}
              onTaskClick={handleTaskClick}
            />
          )
        ) : null}

        {/* Analytics Charts */}
        {stats && (
          <div className="mt-6">
            <TaskAnalyticsCharts lang={lang} isRTL={isRTL} stats={stats} />
          </div>
        )}

        {/* Detail Sheet */}
        <TaskDetailSheet
          taskName={selectedTask}
          open={sheetOpen}
          onClose={() => { setSheetOpen(false); setSelectedTask(null) }}
          lang={lang}
          isRTL={isRTL}
          onRefresh={fetchData}
          currentUser={user?.email}
        />
      </main>
    </div>
  )
}

function KPICard({ icon, label, value, color, loading, danger }: {
  icon: React.ReactNode; label: string; value: number | string
  color: string; loading: boolean; danger?: boolean
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4 flex items-center gap-3',
      danger && 'border-red-200 animate-pulse'
    )}>
      <div className={cn('rounded-lg p-2.5', color)}>
        {icon}
      </div>
      <div>
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <p className={cn('text-2xl font-bold', danger && 'text-red-600')}>{value}</p>
        )}
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
