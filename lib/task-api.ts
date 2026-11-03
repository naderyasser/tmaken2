// Task API client — calls Workflow Tasks backend endpoints
import { frappeClient } from './api-client'

// ─── Types ──────────────────────────────────────────────────────────────
export interface WorkflowTask {
  name: string
  title: string
  status: 'New' | 'In Progress' | 'Completed' | 'Cancelled' | 'Overdue'
  priority: 'Low' | 'Medium' | 'High' | 'Urgent'
  module: 'Inventory' | 'Purchases' | 'Sales' | 'HR' | 'Accounting' | 'Admin'
  company: string
  source_doctype: string
  source_document: string
  target_doctype?: string
  target_document?: string
  assigned_to: string
  assigned_role?: string
  assigned_by_system: boolean | number
  due_date?: string
  due_hours?: number
  completed_date?: string
  completed_by?: string
  parent_task?: string
  rule?: string
  creation: string
  modified: string
  description?: string
  notes?: string
  auto_complete_on?: string
  // Enriched fields (from API)
  assignee_name?: string
}

export interface TaskLog {
  name: string
  action: string
  from_status?: string
  to_status?: string
  action_by: string
  timestamp: string
  notes?: string
}

export interface TaskFilters {
  module?: string
  status?: string | string[]
  assigned_to?: string
  priority?: string
  company?: string
  source_doctype?: string
  from_date?: string
  to_date?: string
  overdue_only?: boolean
  search?: string
}

export interface TaskStats {
  by_status: Record<string, number>
  by_module: Record<string, number>
  by_priority: Record<string, number>
  overdue: number
  completed_today: number
  total_open: number
  my_open: number
}

export interface KanbanData {
  [status: string]: (WorkflowTask & { assignee_name?: string })[]
}

export interface ModuleTaskSummary {
  total: number
  open: number
  overdue: number
  urgent: number
  completed_today: number
  tasks: WorkflowTask[]
}

// ─── API Functions ──────────────────────────────────────────────────────

export const taskApi = {
  /** Fetch tasks with rich filters + pagination */
  async getTasks(filters?: TaskFilters, orderBy = 'creation desc', limit = 50, offset = 0) {
    const resp = await frappeClient.call<{ tasks: WorkflowTask[]; total: number }>(
      'base_meena.workflow_tasks.task_api.get_tasks',
      { filters, order_by: orderBy, limit_page_length: limit, limit_start: offset }
    )
    return resp.message || resp.data || { tasks: [], total: 0 }
  },

  /** Get full task detail + audit logs */
  async getTaskDetail(taskName: string) {
    const resp = await frappeClient.call<{
      task: WorkflowTask
      logs: TaskLog[]
      assignee_name: string
    }>('base_meena.workflow_tasks.task_api.get_task_detail', { task_name: taskName })
    return resp.message || resp.data
  },

  /** Update task status */
  async updateTaskStatus(taskName: string, status: string, notes?: string) {
    const resp = await frappeClient.call<{ success: boolean }>(
      'base_meena.workflow_tasks.task_api.update_task_status',
      { task_name: taskName, status, notes }
    )
    return resp.message || resp.data
  },

  /** Claim a role-based task for current user */
  async claimTask(taskName: string) {
    const resp = await frappeClient.call<{ success: boolean }>(
      'base_meena.workflow_tasks.task_api.claim_task',
      { task_name: taskName }
    )
    return resp.message || resp.data
  },

  /** Reassign a task to a different user */
  async reassignTask(taskName: string, newUser: string) {
    const resp = await frappeClient.call<{ success: boolean }>(
      'base_meena.workflow_tasks.task_api.reassign_task',
      { task_name: taskName, new_user: newUser }
    )
    return resp.message || resp.data
  },

  /** Get aggregate statistics for dashboard KPIs */
  async getTaskStats(filters?: { company?: string; module?: string }) {
    const resp = await frappeClient.call<TaskStats>(
      'base_meena.workflow_tasks.task_api.get_task_stats',
      { filters }
    )
    return resp.message || resp.data
  },

  /** Get tasks grouped by status for Kanban view */
  async getKanbanData(filters?: TaskFilters) {
    const resp = await frappeClient.call<KanbanData>(
      'base_meena.workflow_tasks.task_api.get_kanban_data',
      { filters }
    )
    return resp.message || resp.data
  },

  /** Get current user's open tasks */
  async getMyTasks(limit = 20) {
    const resp = await frappeClient.call<WorkflowTask[]>(
      'base_meena.workflow_tasks.task_api.get_my_tasks',
      { limit }
    )
    return resp.message || resp.data || []
  },

  /** Get task chain/timeline for a source document */
  async getTaskTimeline(sourceDoctype: string, sourceDocument: string) {
    const resp = await frappeClient.call<WorkflowTask[]>(
      'base_meena.workflow_tasks.task_api.get_task_timeline',
      { source_doctype: sourceDoctype, source_document: sourceDocument }
    )
    return resp.message || resp.data || []
  },

  /** Get task summary for a specific module (widget) */
  async getModuleTaskSummary(module: string, company?: string) {
    const resp = await frappeClient.call<ModuleTaskSummary>(
      'base_meena.workflow_tasks.task_api.get_module_task_summary',
      { module, company }
    )
    return resp.message || resp.data
  },
}
