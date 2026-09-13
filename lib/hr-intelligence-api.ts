/**
 * HR Intelligence API — typed wrapper around the single backend endpoint that
 * powers the dashboard "HR Intelligence" section.
 *
 *   base_meena.api.dashboard_insights.get_hr_intelligence  →  HrIntelligence
 *
 * One call, everything branch-scoped server-side. Read `.message` off the
 * Frappe envelope (see lib/api-client.ts `call`).
 */

import { frappeClient } from '@/lib/api-client'

export type ComplianceGrade = 'excellent' | 'good' | 'fair' | 'at_risk'
export type InsightIcon = 'activity' | 'trophy' | 'alert' | 'user-alert' | 'shield'
export type InsightTone = 'success' | 'warning' | 'danger' | 'info'
export type RiskLevel = 'high' | 'medium' | 'low'

export interface PresenceBranch {
  branch: string
  present: number
  total: number
}

export interface RecentCheckin {
  employee_name: string
  branch: string
  time: string
}

export interface Presence {
  present: number
  total: number
  by_branch: PresenceBranch[]
  recent: RecentCheckin[]
}

export interface AttendanceTrendPoint {
  date: string
  present: number
  /** 0..100 */
  rate: number
}

export interface AtRiskEmployee {
  employee: string
  employee_name: string
  absent: number
  late: number
  score: number
  level: RiskLevel
}

export interface ComplianceFactor {
  key: string
  label_ar: string
  label_en: string
  value: string
  penalty: number
  band?: string
}

export interface ComplianceScore {
  score: number | null
  grade: ComplianceGrade
  band: string | null
  factors: ComplianceFactor[]
  is_estimate: boolean
  disclaimer_ar: string
  disclaimer_en: string
}

export interface Insight {
  icon: InsightIcon
  tone: InsightTone
  text_ar: string
  text_en: string
}

export interface HrIntelligence {
  generated_at: string
  active_count: number
  presence: Presence
  attendance_trend: AttendanceTrendPoint[]
  at_risk: AtRiskEmployee[]
  compliance_score: ComplianceScore
  insights: Insight[]
}

/** Fetch the whole HR Intelligence payload in one round-trip. */
export async function fetchHrIntelligence(signal?: AbortSignal): Promise<HrIntelligence> {
  const res = await frappeClient.call<HrIntelligence>(
    'base_meena.api.dashboard_insights.get_hr_intelligence',
    {},
    signal,
  )
  const message = (res as { message?: HrIntelligence })?.message
  if (!message) throw new Error('Empty HR intelligence response')
  return message
}

/* ─────────────────────── Workforce Analytics ───────────────────────
 * Sibling section powered by a single backend call:
 *   base_meena.api.dashboard_insights.get_workforce_analytics
 * Four cards: headcount trend, diversity/Saudization, labor cost, tenure.
 */

export interface WATrendPoint {
  month: string
  count: number
}

export interface WAHeadcount {
  total: number
  /** 6 items, oldest → newest */
  trend: WATrendPoint[]
  joiners_this_month: number
  leavers_this_month: number
  net_this_month: number
}

export interface WANameCount {
  name: string
  count: number
}

export interface WADiversity {
  total: number
  saudi: number
  non_saudi: number
  saudization_pct: number
  genders: WANameCount[]
  top_departments: WANameCount[]
}

export interface WABranchCost {
  branch: string
  cost: number
}

export interface WALaborCost {
  total_monthly: number
  avg: number
  covered: number
  headcount: number
  by_branch: WABranchCost[]
  is_estimate: boolean
}

export interface WATenureBucket {
  key: string
  label_ar: string
  label_en: string
  count: number
}

export interface WATenure {
  total: number
  buckets: WATenureBucket[]
  unknown: number
}

export interface WorkforceAnalyticsData {
  generated_at: string
  headcount: WAHeadcount
  diversity: WADiversity
  labor_cost: WALaborCost
  tenure: WATenure
}

/** Fetch the whole Workforce Analytics payload in one round-trip. */
export async function fetchWorkforceAnalytics(signal?: AbortSignal): Promise<WorkforceAnalyticsData> {
  const res = await frappeClient.call<WorkforceAnalyticsData>(
    'base_meena.api.dashboard_insights.get_workforce_analytics',
    {},
    signal,
  )
  const message = (res as { message?: WorkforceAnalyticsData })?.message
  if (!message) throw new Error('Empty workforce analytics response')
  return message
}

/* ─────────────────────── HR Management Metrics ───────────────────────
 * Six management-grade decision-support cards powered by one backend call:
 *   base_meena.api.hr_management_metrics.get_hr_management_metrics
 * EWA exposure · document-expiry radar · payroll readiness · actions due ·
 * EOSB & leave liability · absence & lateness cost. All READ-ONLY aggregates,
 * branch-scoped server-side, each defensively wrapped.
 */

export type BlockerTone = 'success' | 'warning' | 'danger'

export interface MgmtBranchAmount {
  branch: string
  amount: number
  count?: number
}

export interface EwaExposure {
  total: number
  requests: number
  employees: number
  by_branch: MgmtBranchAmount[]
  is_estimate: boolean
}

export interface DocRadarDrill {
  employee_name: string
  branch: string | null
  doc_type: string
  days_left: number
  severity: string
}

export interface DocTypeCount {
  type: string
  count: number
}

export interface DocumentRadar {
  expired: number
  d30: number
  d60: number
  d90: number
  total: number
  by_type: DocTypeCount[]
  drill: DocRadarDrill[]
}

export interface ReadinessBlocker {
  key: string
  label_ar: string
  label_en: string
  count: number
  tone: BlockerTone
}

export interface PayrollReadiness {
  score: number | null
  ready: boolean
  grade: ComplianceGrade
  blockers: ReadinessBlocker[]
  last_run: string | null
  total_blockers: number
}

export interface ProbationDue {
  employee_name: string
  branch: string | null
  date: string
  days_left: number
  estimated?: boolean
}

export interface ContractExpiring {
  employee_name: string
  branch: string | null
  date: string
  days_left: number
}

export interface ActionsDue {
  probation_due: ProbationDue[]
  probation_count: number
  contracts_expiring: ContractExpiring[]
  contracts_count: number
  total: number
}

export interface LiabilityBranch {
  branch: string
  eosb: number
  leave: number
  total: number
  count: number
}

export interface EosbLeaveLiability {
  eosb_total: number
  leave_total: number
  total: number
  covered: number
  headcount: number
  by_branch: LiabilityBranch[]
  is_estimate: boolean
}

export interface CostBranch {
  branch: string
  absence: number
  late: number
  total: number
}

export interface AbsenceCost {
  absence: number
  late: number
  early: number
  total: number
  absent_days: number
  prev_total: number
  delta_pct: number | null
  by_branch: CostBranch[]
  is_estimate: boolean
}

export interface HrManagementMetrics {
  generated_at: string
  active_count: number
  ewa_exposure: EwaExposure
  document_radar: DocumentRadar
  payroll_readiness: PayrollReadiness
  actions_due: ActionsDue
  eosb_leave_liability: EosbLeaveLiability
  absence_cost: AbsenceCost
}

/** Fetch the whole HR Management Metrics payload in one round-trip. */
export async function fetchHrManagementMetrics(signal?: AbortSignal): Promise<HrManagementMetrics> {
  const res = await frappeClient.call<HrManagementMetrics>(
    'base_meena.api.hr_management_metrics.get_hr_management_metrics',
    {},
    signal,
  )
  const message = (res as { message?: HrManagementMetrics })?.message
  if (!message) throw new Error('Empty HR management metrics response')
  return message
}

/* ─────────────────────── HR Leadership Metrics ───────────────────────
 * Five executive/governance cards powered by one backend call:
 *   base_meena.api.hr_leadership_metrics.get_hr_leadership_metrics
 * Nitaqat simulator · WPS readiness · overtime cost · leave & coverage ·
 * turnover & retention. All READ-ONLY aggregates, branch-scoped server-side.
 */

export interface NitaqatBand {
  key: string
  label_en: string
  label_ar: string
  min_pct: number
  current?: boolean
}

export interface NitaqatSim {
  pct: number
  saudi: number
  total: number
  band: NitaqatBand | null
  next_band: NitaqatBand | null
  hires_to_next: number | null
  margin_down: number | null
  ladder: NitaqatBand[]
  is_estimate: boolean
  disclaimer_ar?: string | null
  disclaimer_en?: string | null
}

export interface WpsLastPayroll {
  date: string | null
  status: string | null
  period: string | null
  slips: number
  employees: number
}

export interface WpsReadiness {
  wps_ready: number
  wps_missing: number
  headcount: number
  ready_pct: number
  missing_by_branch: { branch: string; count: number }[]
  last_payroll: WpsLastPayroll | null
  payday: number | null
  on_time: boolean | null
  is_estimate: boolean
}

export interface OvertimeBranch {
  branch: string
  cost: number
  hours: number
}

export interface OvertimeCost {
  cost: number
  hours: number
  employees: number
  prev_cost: number
  delta_pct: number | null
  by_branch: OvertimeBranch[]
  is_estimate: boolean
}

export interface LeaveCoverageBranch {
  branch: string
  on_leave: number
  total: number
  pct: number
}

export interface UpcomingLeave {
  employee_name: string
  branch: string
  leave_type: string
  from_date: string
  to_date: string
  days: number
  active: boolean
}

export interface LeaveCoverage {
  on_leave_today: number
  upcoming_14d: number
  total_days: number
  by_branch: LeaveCoverageBranch[]
  upcoming: UpcomingLeave[]
  is_estimate: boolean
}

export interface TurnoverTrendPoint {
  month: string
  count: number
}

export interface Turnover {
  turnover_pct: number
  leavers_this_month: number
  leavers_ytd: number
  leavers_12m: number
  avg_tenure_years_at_exit: number
  trend: TurnoverTrendPoint[]
  by_branch: { branch: string; count: number }[]
  active_headcount: number
  is_estimate: boolean
}

export interface HrLeadershipMetrics {
  generated_at: string
  active_count: number
  nitaqat: NitaqatSim
  wps: WpsReadiness
  overtime: OvertimeCost
  leave: LeaveCoverage
  turnover: Turnover
}

/** Fetch the whole HR Leadership Metrics payload in one round-trip. */
export async function fetchHrLeadershipMetrics(signal?: AbortSignal): Promise<HrLeadershipMetrics> {
  const res = await frappeClient.call<HrLeadershipMetrics>(
    'base_meena.api.hr_leadership_metrics.get_hr_leadership_metrics',
    {},
    signal,
  )
  const message = (res as { message?: HrLeadershipMetrics })?.message
  if (!message) throw new Error('Empty HR leadership metrics response')
  return message
}

/* ─────────────────────── Payroll Pre-flight Audit ───────────────────────
 * A forensic "catch it before you pay" scan, one backend call:
 *   base_meena.api.payroll_audit.get_payroll_preflight_audit
 * Duplicate IBAN/ID, no salary structure, missing IBAN, zero-base, spikes.
 */

export type AuditSeverity = 'high' | 'medium' | 'low'

export interface AuditSample {
  employee_name: string
  branch: string
  value: string | number | null
}

export interface AuditFinding {
  key: string
  severity: AuditSeverity
  title_en: string
  title_ar: string
  detail_en: string
  detail_ar: string
  count: number
  samples: AuditSample[]
}

export interface PayrollAudit {
  generated_at: string
  active_count: number
  score: number
  grade: ComplianceGrade
  clean: boolean
  ready: boolean
  total_flags: number
  severity: { high: number; medium: number; low: number }
  findings: AuditFinding[]
  is_estimate: boolean
}

/** Fetch the payroll pre-flight audit payload in one round-trip. */
export async function fetchPayrollAudit(signal?: AbortSignal): Promise<PayrollAudit> {
  const res = await frappeClient.call<PayrollAudit>(
    'base_meena.api.payroll_audit.get_payroll_preflight_audit',
    {},
    signal,
  )
  const message = (res as { message?: PayrollAudit })?.message
  if (!message) throw new Error('Empty payroll audit response')
  return message
}

/* ─────────────────────── Retention Radar (Dashboard #2) ───────────────────────
 * Transparent, rules-based attrition risk per employee. Every point is traceable
 * to a concrete signal; reasons ship alongside the score. Branch-scoped server-side.
 *   base_meena.api.retention_radar.get_retention_radar
 */

export type RetentionSignal = 'tardiness' | 'advances' | 'contract' | 'stagnation' | 'absence'

export interface RetentionReason {
  key: RetentionSignal
  ar: string
  value: number | null
}

export interface RetentionEmployee {
  employee: string
  employee_name: string
  branch: string
  score: number
  level: RiskLevel
  reasons: RetentionReason[]
}

export interface RetentionRadar {
  generated_at: string
  total_scored: number
  summary: { high: number; medium: number; low: number }
  flagged: RetentionEmployee[]
}

/** Fetch the rules-based retention radar in one round-trip. */
export async function fetchRetentionRadar(signal?: AbortSignal): Promise<RetentionRadar> {
  const res = await frappeClient.call<RetentionRadar>(
    'base_meena.api.retention_radar.get_retention_radar',
    {},
    signal,
  )
  const message = (res as { message?: RetentionRadar })?.message
  if (!message) throw new Error('Empty retention radar response')
  return message
}

/* ─────────────────────── Anomaly Radar (Dashboard #9) ───────────────────────
 * Attendance & payroll integrity flags: duplicate/buddy punches, present-without-
 * biometric, and last-minute pay edits. Read-only, branch-scoped server-side.
 *   base_meena.api.anomaly_radar.get_anomaly_radar
 */

export type AnomalyType = 'duplicate_punch' | 'buddy_punch' | 'present_no_punch' | 'late_pay_edit'
export type AnomalySeverity = 'high' | 'medium'

export interface Anomaly {
  type: AnomalyType
  severity: AnomalySeverity
  employee: string
  employee_name: string
  branch: string
  date: string
  detail_ar: string
  log_type?: string
  device_id?: string
  amount?: number
  pay_type?: string
}

export interface AnomalyRadar {
  generated_at: string
  total: number
  by_severity: { high: number; medium: number }
  anomalies: Anomaly[]
}

/** Fetch attendance/payroll anomaly flags in one round-trip. */
export async function fetchAnomalyRadar(signal?: AbortSignal): Promise<AnomalyRadar> {
  const res = await frappeClient.call<AnomalyRadar>(
    'base_meena.api.anomaly_radar.get_anomaly_radar',
    {},
    signal,
  )
  const message = (res as { message?: AnomalyRadar })?.message
  if (!message) throw new Error('Empty anomaly radar response')
  return message
}

/* ─────────────────────── Cross-Branch Benchmarks (Dashboard #7) ───────────────────────
 * Compare a group's own branches against each other and the company average on
 * headcount, average cost, absence rate and lateness. Branch-scoped server-side.
 *   base_meena.api.branch_benchmarks.get_branch_benchmarks
 */

export interface BranchBenchmarkRow {
  branch: string
  headcount: number
  avg_cost: number
  absence_rate: number
  late_rate: number
}

export interface BranchBenchmarkCompany extends BranchBenchmarkRow {
  currency: string
}

export interface BranchBenchmarks {
  generated_at: string
  branch_count: number
  company: BranchBenchmarkCompany
  branches: BranchBenchmarkRow[]
}

/** Fetch cross-branch benchmark rows in one round-trip. */
export async function fetchBranchBenchmarks(signal?: AbortSignal): Promise<BranchBenchmarks> {
  const res = await frappeClient.call<BranchBenchmarks>(
    'base_meena.api.branch_benchmarks.get_branch_benchmarks',
    {},
    signal,
  )
  const message = (res as { message?: BranchBenchmarks })?.message
  if (!message) throw new Error('Empty branch benchmarks response')
  return message
}

/* ─────────────────────── Hiring & Budget Planner (Dashboard #4) ───────────────────────
 * Baseline for the interactive planner; the cost + Nitaqat math is mirrored client-side
 * for instant feedback (identical formulas to base_meena.api.hiring_planner).
 *   base_meena.api.hiring_planner.get_hiring_baseline
 */

export interface HiringBand {
  key?: string
  label_ar?: string
  min_pct?: number
}

export interface HiringBaseline {
  saudi: number
  non_saudi: number
  total: number
  saudization_pct: number
  band: HiringBand
  avg_base: number
  currency: string
  gosi_saudi_pct: number
  gosi_nonsaudi_pct: number
  is_estimate: boolean
}

/** Fetch the hiring-planner baseline (current Saudization, avg wage, GOSI rates). */
export async function fetchHiringBaseline(signal?: AbortSignal): Promise<HiringBaseline> {
  const res = await frappeClient.call<HiringBaseline>(
    'base_meena.api.hiring_planner.get_hiring_baseline',
    {},
    signal,
  )
  const message = (res as { message?: HiringBaseline })?.message
  if (!message) throw new Error('Empty hiring baseline response')
  return message
}

/* ─────────────────────── Shift Coverage & Overtime (Dashboard #5) ───────────────────────
 * Roster, unscheduled-employee gaps by branch, and overtime forecast (hours+cost).
 *   base_meena.api.shift_planner.get_shift_overview
 */

export interface ShiftType {
  name: string
  hours: number
  assigned: number
}
export interface ShiftBranchGap {
  branch: string
  unscheduled: number
}
export interface ShiftOtBranch {
  branch: string
  hours: number
}
export interface ShiftOtEmployee {
  employee: string
  employee_name: string
  branch: string
  hours: number
  cost: number
}
export interface ShiftWarning {
  severity: 'high' | 'medium' | 'low'
  ar: string
}
export interface ShiftOverview {
  generated_at: string
  currency: string
  headcount: number
  shift_types: ShiftType[]
  coverage: { scheduled: number; unscheduled: number; by_branch: ShiftBranchGap[] }
  overtime: { total_hours: number; total_cost: number; by_branch: ShiftOtBranch[]; top: ShiftOtEmployee[] }
  warnings: ShiftWarning[]
}

/** Fetch shift coverage & overtime forecast in one round-trip. */
export async function fetchShiftOverview(signal?: AbortSignal): Promise<ShiftOverview> {
  const res = await frappeClient.call<ShiftOverview>(
    'base_meena.api.shift_planner.get_shift_overview',
    {},
    signal,
  )
  const message = (res as { message?: ShiftOverview })?.message
  if (!message) throw new Error('Empty shift overview response')
  return message
}
