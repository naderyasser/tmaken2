/**
 * Registry of the «التقارير» pages — the 14 reports under الحضور والانصراف
 * plus حالة اليوم, exactly as the Apex ERP reference lists them. Every page
 * renders through <ReportPage /> and calls base_meena.api.hr_reports.run_report
 * with the matching backend key.
 */
export interface ReportConfig {
  /** module slug → /hr?module=report-<slug> */
  slug: string
  /** backend key for run_report */
  report: string
  title: string
  /** show من/إلى تاريخ (employees-report has none) */
  dates: boolean
  /** extra filter fields beyond the shared grid */
  extras?: Array<'leave_type' | 'permission_type' | 'status'>
}

export const HR_REPORTS: ReportConfig[] = [
  { slug: 'daystatus', report: 'daystatus', title: 'حالة اليوم', dates: true },
  { slug: 'detailed', report: 'detailed', title: 'الحضور والانصراف التفصيلي', dates: true },
  { slug: 'total', report: 'total', title: 'الحضور و الانصراف الاجمالي', dates: true },
  { slug: 'vacations', report: 'vacations', title: 'اجازات الموظفين', dates: true, extras: ['leave_type'] },
  { slug: 'delays', report: 'delays', title: 'التأخير التفصيلي للموظفين', dates: true },
  { slug: 'absences', report: 'absences', title: 'الغياب التفصيلي للموظفين', dates: true },
  { slug: 'late-early', report: 'late-early', title: 'التأخير والانصراف المبكر', dates: true },
  { slug: 'total-absence', report: 'total-absence', title: 'الغياب الاجمالي للموظفين', dates: true },
  { slug: 'employees', report: 'employees', title: 'تقرير الموظفين', dates: false },
  { slug: 'overtime', report: 'overtime', title: 'الاضافي التفصيلي للموظفين', dates: true },
  { slug: 'incomplete', report: 'incomplete', title: 'الحركات الغير مكتملة', dates: true },
  { slug: 'permissions', report: 'permissions', title: 'اذونات الموظفين', dates: true, extras: ['permission_type'] },
  { slug: 'by-branch', report: 'by-branch', title: 'الحضور والانصراف بالفروع', dates: true },
  { slug: 'on-site', report: 'on-site', title: 'حركات الموظفين بالموقع', dates: true, extras: ['status'] },
  { slug: 'rejected-on-site', report: 'rejected-on-site', title: 'حركات المرفوضة بالموقع', dates: true },
]

export const REPORT_MODULE_PREFIX = 'report-'

export function getReportConfig(moduleId: string): ReportConfig | undefined {
  if (!moduleId.startsWith(REPORT_MODULE_PREFIX)) return undefined
  const slug = moduleId.slice(REPORT_MODULE_PREFIX.length)
  return HR_REPORTS.find((r) => r.slug === slug)
}
