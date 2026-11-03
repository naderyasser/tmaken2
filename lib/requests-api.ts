/**
 * Requests & Approvals hub API (F1). Thin typed wrappers over the backend
 * approval-chain endpoints (base_meena.hr_requests.approvals_api.*). Data-only —
 * UI in components/requests/*.
 */
import { frappeClient } from '@/lib/api-client'

const M = 'base_meena.hr_requests.approvals_api'
function unwrap<T>(resp: any): T {
  return (resp?.message ?? resp?.data) as T
}

export interface RequestType {
  key: string
  label: string
  label_ar?: string
  doctype?: string
  in_app?: boolean
}

export interface FlowRow {
  flow: string
  request_type: string
  label?: string
  status: string
  employee?: string
  employee_name?: string
  creation?: string
  current_step?: number
  step_status?: string
  summary?: string
}

export interface FlowStep {
  step_order: number
  approver_type: string
  approver_user?: string
  approver_role?: string
  status: string
  acted_by?: string
  acted_on?: string
  comment?: string
}

/**
 * Detail payload for a single flow (get_request_detail). The backend returns
 * the flow summary FLAT — `{...flow_summary, steps, target_summary}` — where
 * `flow` is the flow DOCNAME (a string), NOT a nested object. The nested
 * `{ flow: {...}, target: {...} }` members are kept optional for tolerance of
 * the legacy assumed shape; consumers should normalize (see approval-drawer).
 */
export interface FlowDetail {
  /** Flow docname in the real (flat) shape; nested summary object in the legacy shape. */
  flow: string | Record<string, any>
  request_type?: string
  label?: string
  label_ar?: string
  employee?: string
  employee_name?: string
  status?: string
  current_step?: number
  created?: string
  reference_doctype?: string
  reference_name?: string
  steps: FlowStep[]
  /** Real (flat) key for the target-document summary. */
  target_summary?: Record<string, any>
  /** Legacy nested key — never returned by the current backend. */
  target?: Record<string, any>
}

export const requestsApi = {
  async getTypes(): Promise<RequestType[]> {
    return unwrap<RequestType[]>(await frappeClient.call(`${M}.get_request_types`)) || []
  },
  async myRequests(args: { status?: string; request_type?: string } = {}): Promise<FlowRow[]> {
    return unwrap<FlowRow[]>(await frappeClient.call(`${M}.get_my_requests`, args)) || []
  },
  async myApprovals(args: { status?: string } = {}): Promise<FlowRow[]> {
    return unwrap<FlowRow[]>(await frappeClient.call(`${M}.get_my_approvals`, args)) || []
  },
  async teamRequests(args: { status?: string } = {}): Promise<FlowRow[]> {
    return unwrap<FlowRow[]>(await frappeClient.call(`${M}.get_team_requests`, args)) || []
  },
  async detail(flow: string): Promise<FlowDetail | null> {
    return unwrap<FlowDetail>(await frappeClient.call(`${M}.get_request_detail`, { flow })) || null
  },
  async approve(flow: string, comment?: string) {
    return unwrap(await frappeClient.call(`${M}.approve_step`, { flow, comment }))
  },
  async reject(flow: string, comment: string) {
    return unwrap(await frappeClient.call(`${M}.reject_step`, { flow, comment }))
  },
  async cancel(flow: string) {
    return unwrap(await frappeClient.call(`${M}.cancel_request`, { flow }))
  },
  async create(request_type: string, employee: string, payload: Record<string, any>) {
    return unwrap(await frappeClient.call(`${M}.create_request`, {
      request_type,
      employee,
      payload: JSON.stringify(payload),
    }))
  },
}
