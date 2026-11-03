/**
 * مساعد تمكين — Copilot API wrapper.
 * Thin typed layer over the whitelisted base_meena.copilot endpoints. The
 * assistant answers from the caller's own data under their Frappe session; v1
 * uses deterministic Arabic/English intents and self-upgrades to Claude when a
 * key is configured (ai_used flips true).
 */
import { frappeClient } from '@/lib/api-client'

export interface CopilotSuggestion {
  type: 'navigate'
  href: string
  action?: string
  label_ar: string
  label_en: string
}

export interface CopilotChip {
  key: string
  label_ar: string
  label_en: string
}

export interface CopilotReply {
  enabled: boolean
  ai_used: boolean
  intent: string
  reply: string
  suggestions: CopilotSuggestion[]
  chips: CopilotChip[]
  lang?: 'ar' | 'en'
  session_id?: string | null
}

/** Admin / manager brain — same seam, workforce-wide (permission-scoped) grounding. */
export interface ManagerCopilotStatus {
  enabled: boolean
  ai_enabled: boolean
  available: boolean
  role_level?: string
  chips: string[]
}

export interface ManagerReply {
  enabled: boolean
  ai_used: boolean
  intent: string
  reply: string
  chips: string[]
  role_level?: string
  session_id?: string | null
  trace_id?: string
  route?: string
  chart?: CopilotChart
  /** True when a narrated version is being streamed behind this reply. */
  streaming?: boolean
  stream_id?: string
  /** Present on an action draft — confirm/cancel spend this one-time token. */
  action?: { token: string; label: string }
  metric?: string
  /** Direct download link when the user asked for the last answer as Excel. */
  export_url?: string
}

export interface StreamChunk {
  delta: string
  cursor: number
  done: boolean
  aborted: boolean
}

export interface ChartBar { label: string; value: number }
export interface CopilotChart {
  type: 'bar'
  unit?: string
  title_ar?: string
  max: number
  bars: ChartBar[]
}

export interface BriefingAlert {
  severity: 'critical' | 'warning' | 'info'
  title_ar: string
  detail_ar: string
  route?: string
  count?: number
}

async function call<T>(method: string, args?: Record<string, unknown>): Promise<T> {
  const r = await frappeClient.call(method, args)
  return (r as any)?.message as T
}

export const copilotApi = {
  status: () => call<{ enabled: boolean; ai_enabled: boolean }>('base_meena.copilot.copilot_api.get_copilot_status'),
  chat: (message: string, session_id?: string) =>
    call<CopilotReply>('base_meena.copilot.copilot_api.copilot_chat', { message, session_id }),

  managerStatus: () =>
    call<ManagerCopilotStatus>('base_meena.copilot.admin_copilot.get_admin_copilot_status'),
  managerChat: (message: string, session_id?: string) =>
    call<ManagerReply>('base_meena.copilot.admin_copilot.admin_chat', { message, session_id }),

  /**
   * Streaming turn: returns the correct deterministic answer immediately; when
   * `streaming` is true, poll `managerPoll` with the stream_id and cursor to
   * receive the narrated text as it is written. Falls back transparently to a
   * plain reply on workers that don't have the streaming endpoint yet.
   */
  managerStream: async (message: string, session_id?: string): Promise<ManagerReply> => {
    try {
      return await call<ManagerReply>('base_meena.copilot.stream.start', { message, session_id })
    } catch {
      const r = await call<ManagerReply>('base_meena.copilot.admin_copilot.admin_chat', { message, session_id })
      r.streaming = false
      return r
    }
  },
  managerPoll: (stream_id: string, cursor: number) =>
    call<StreamChunk>('base_meena.copilot.stream.poll', { stream_id, cursor }),

  /** Employee v2 brain (KB + self-diagnosis + human voice); the drawer falls
   *  back to plain `chat` if this endpoint isn't on the worker yet. */
  employeeChat: (message: string, session_id?: string) =>
    call<CopilotReply & { v2?: boolean; trace_id?: string; route?: string }>(
      'base_meena.copilot.employee_v2.chat', { message, session_id }),

  /** Confirm / cancel a drafted action — the token is one-time and expires in 5 min. */
  actionConfirm: (token: string) =>
    call<{ ok: boolean; reply: string }>('base_meena.copilot.actions.confirm', { token }),
  actionCancel: (token: string) =>
    call<{ ok: boolean; reply: string }>('base_meena.copilot.actions.cancel', { token }),

  /** Usage/health numbers for the insights page (HR admin only server-side). */
  stats: (days = 7) => call<Record<string, any>>('base_meena.copilot.audit.stats', { days }),

  /** Download URL for a data answer's Excel export (opens in a new tab). */
  exportUrl: (trace_id: string) =>
    `/api/method/base_meena.copilot.export.to_xlsx?trace_id=${encodeURIComponent(trace_id)}`,

  /** 👍/👎 on a specific answer, keyed by the turn's trace_id. */
  feedback: (trace_id: string, verdict: 'up' | 'down') =>
    call<{ ok: boolean }>('base_meena.copilot.audit.submit_feedback', { trace_id, verdict }),

  /** Proactive briefing shown when the drawer opens, before the user asks anything. */
  briefing: () =>
    call<{ available: boolean; alerts: BriefingAlert[]; reply?: string }>(
      'base_meena.copilot.briefing.get_briefing',
    ),

  /**
   * Attachment analysis — multipart, so it can't ride the JSON `call` path.
   * `csrfFetch` adds the CSRF header (and retries once on a stale token); the
   * file reaches the whitelisted endpoint as `frappe.request.files`.
   */
  attachmentAnalyze: async (
    file: File,
    question: string | undefined,
    session_id: string,
  ): Promise<{ reply: string; filename: string; kind: string }> => {
    const { csrfFetch } = await import('@/lib/csrf')
    const fd = new FormData()
    fd.append('file', file)
    if (question) fd.append('question', question)
    fd.append('session_id', session_id)
    const res = await csrfFetch('/api/method/base_meena.copilot.attachments.analyze', {
      method: 'POST',
      body: fd,
    })
    if (!res.ok) throw new Error(`attachment analyze failed (${res.status})`)
    const data = await res.json()
    return data.message
  },
}
