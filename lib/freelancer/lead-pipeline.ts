/**
 * Lead pipeline — a clean 4-stage funnel layered on top of ERPNext's standard
 * `Lead.status` field. Frontend-only: no custom doctype field, no migration.
 * We read `Lead.status`, bucket it into a stage for display, and write back a
 * canonical status when the user advances a lead.
 */

export type LeadStage = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'

/** The funnel stages, in order, shown as pipeline columns / filters. */
export const LEAD_STAGES: LeadStage[] = ['new', 'contacted', 'qualified', 'converted']

/** ERPNext Lead.status → our stage bucket. */
const STATUS_TO_STAGE: Record<string, LeadStage> = {
  Lead: 'new',
  Open: 'new',
  Replied: 'contacted',
  Interested: 'contacted',
  Opportunity: 'qualified',
  Quotation: 'qualified',
  Converted: 'converted',
  'Lost Quotation': 'lost',
  'Do Not Contact': 'lost',
}

/** Canonical Lead.status written back when the user picks a stage. */
const STAGE_TO_STATUS: Record<LeadStage, string> = {
  new: 'Lead',
  contacted: 'Replied',
  qualified: 'Opportunity',
  converted: 'Converted',
  lost: 'Do Not Contact',
}

export function leadStatusToStage(status?: string | null): LeadStage {
  if (!status) return 'new'
  return STATUS_TO_STAGE[status] ?? 'new'
}

export function leadStageToStatus(stage: LeadStage): string {
  return STAGE_TO_STATUS[stage]
}

export const LEAD_STAGE_LABELS: Record<LeadStage, { ar: string; en: string }> = {
  new: { ar: 'جديد', en: 'New' },
  contacted: { ar: 'تم التواصل', en: 'Contacted' },
  qualified: { ar: 'مؤهّل', en: 'Qualified' },
  converted: { ar: 'محوّل', en: 'Converted' },
  lost: { ar: 'مغلق', en: 'Lost' },
}

export function leadStageLabel(stage: LeadStage, isRTL: boolean): string {
  return isRTL ? LEAD_STAGE_LABELS[stage].ar : LEAD_STAGE_LABELS[stage].en
}

/** Token-neutral badge classes (render green under .theme-freelancer for `converted`). */
export const LEAD_STAGE_BADGE: Record<LeadStage, string> = {
  new: 'bg-slate-100 text-slate-700',
  contacted: 'bg-blue-100 text-blue-700',
  qualified: 'bg-violet-100 text-violet-700',
  converted: 'bg-primary/10 text-primary',
  lost: 'bg-gray-100 text-gray-500',
}
