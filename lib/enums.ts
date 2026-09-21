/**
 * Central translation layer for DYNAMIC / ENUM values that come back from the
 * backend in ONE language (usually Arabic) and would otherwise leak into the
 * other-language UI — e.g. a Territory stored as "باقي أنحاء العالم" showing in
 * the English interface, or invoice statuses staying Arabic.
 *
 * Unlike static UI labels (lib/i18n.tsx), these are DATA values: we map the
 * known/standard values to a localized display and fall back to the raw value
 * for anything not in the registry (so unknown territories still render).
 *
 * Keyed by BOTH the English canonical AND the Arabic value, because different
 * tenants store the same enum in different languages.
 */

import type { AppLocale } from './format'

type EnumEntry = { ar: string; en: string }
type EnumMap = Record<string, EnumEntry>

// ERPNext default territories + the Arabic variants seen in these installs.
const TERRITORY: EnumMap = {
  'All Territories': { ar: 'كل المناطق', en: 'All Territories' },
  'كل المناطق': { ar: 'كل المناطق', en: 'All Territories' },
  'Rest Of The World': { ar: 'باقي أنحاء العالم', en: 'Rest of the World' },
  'باقي أنحاء العالم': { ar: 'باقي أنحاء العالم', en: 'Rest of the World' },
  'Saudi Arabia': { ar: 'السعودية', en: 'Saudi Arabia' },
  'السعودية': { ar: 'السعودية', en: 'Saudi Arabia' },
  'Egypt': { ar: 'مصر', en: 'Egypt' },
  'مصر': { ar: 'مصر', en: 'Egypt' },
}

// Sales Proposal status enum (backend stays English).
const PROPOSAL_STATUS: EnumMap = {
  Draft: { ar: 'مسودة', en: 'Draft' },
  Sent: { ar: 'مُرسل', en: 'Sent' },
  Open: { ar: 'مفتوح', en: 'Open' },
  Accepted: { ar: 'مقبول', en: 'Accepted' },
  Rejected: { ar: 'مرفوض', en: 'Rejected' },
  Expired: { ar: 'منتهي', en: 'Expired' },
}

// Sales Invoice status enum (ERPNext docstatus/outstanding-derived states).
const INVOICE_STATUS: EnumMap = {
  Draft: { ar: 'مسودة', en: 'Draft' },
  Submitted: { ar: 'مُرسلة', en: 'Submitted' },
  Unpaid: { ar: 'غير مدفوعة', en: 'Unpaid' },
  Paid: { ar: 'مدفوعة', en: 'Paid' },
  Overdue: { ar: 'متأخرة', en: 'Overdue' },
  'Partly Paid': { ar: 'مدفوعة جزئياً', en: 'Partly Paid' },
  Cancelled: { ar: 'ملغاة', en: 'Cancelled' },
  Return: { ar: 'مرتجعة', en: 'Return' },
  'Credit Note Issued': { ar: 'إشعار دائن', en: 'Credit Note Issued' },
}

// HR Leave Types — ERPNext/HRMS seeds these in English on every new tenant, so
// they leak into the Arabic UI (leave-setup list, leave dialogs, employee form).
// Arabic sourced from the backend translation CSVs (base_meena/ar.csv + hrms_ar).
const LEAVE_TYPE: EnumMap = {
  'Annual Leave': { ar: 'إجازة سنوية', en: 'Annual Leave' },
  'إجازة سنوية': { ar: 'إجازة سنوية', en: 'Annual Leave' },
  'Sick Leave': { ar: 'إجازة مرضية', en: 'Sick Leave' },
  'إجازة مرضية': { ar: 'إجازة مرضية', en: 'Sick Leave' },
  'Casual Leave': { ar: 'إجازة عارضة', en: 'Casual Leave' },
  'إجازة عارضة': { ar: 'إجازة عارضة', en: 'Casual Leave' },
  'Compensatory Off': { ar: 'إجازة تعويضية', en: 'Compensatory Off' },
  'إجازة تعويضية': { ar: 'إجازة تعويضية', en: 'Compensatory Off' },
  'Privilege Leave': { ar: 'إجازة امتياز', en: 'Privilege Leave' },
  'إجازة امتياز': { ar: 'إجازة امتياز', en: 'Privilege Leave' },
  'Leave Without Pay': { ar: 'إجازة بدون راتب', en: 'Leave Without Pay' },
  'إجازة بدون راتب': { ar: 'إجازة بدون راتب', en: 'Leave Without Pay' },
  'Unpaid Leave': { ar: 'إجازة بدون أجر', en: 'Unpaid Leave' },
  'إجازة بدون أجر': { ar: 'إجازة بدون أجر', en: 'Unpaid Leave' },
  'Attendance Incentive': { ar: 'حافز الحضور', en: 'Attendance Incentive' },
  'حافز الحضور': { ar: 'حافز الحضور', en: 'Attendance Incentive' },
}

// HR Departments — ERPNext seeds the standard tree in English. NOTE: the DocType
// `name` (PK) carries a " - <company_abbr>" suffix (e.g. "Accounts - A"); callers
// should pass `department_name` or route through translateDepartment(), which
// strips that suffix before lookup. Keyed by the clean English + Arabic value.
const DEPARTMENT: EnumMap = {
  'All Departments': { ar: 'كل الأقسام', en: 'All Departments' },
  'كل الأقسام': { ar: 'كل الأقسام', en: 'All Departments' },
  'Accounts': { ar: 'الحسابات', en: 'Accounts' },
  'الحسابات': { ar: 'الحسابات', en: 'Accounts' },
  'Human Resources': { ar: 'الموارد البشرية', en: 'Human Resources' },
  'الموارد البشرية': { ar: 'الموارد البشرية', en: 'Human Resources' },
  'Marketing': { ar: 'التسويق', en: 'Marketing' },
  'التسويق': { ar: 'التسويق', en: 'Marketing' },
  'Sales': { ar: 'المبيعات', en: 'Sales' },
  'المبيعات': { ar: 'المبيعات', en: 'Sales' },
  'Purchase': { ar: 'المشتريات', en: 'Purchase' },
  'المشتريات': { ar: 'المشتريات', en: 'Purchase' },
  'Production': { ar: 'الإنتاج', en: 'Production' },
  'الإنتاج': { ar: 'الإنتاج', en: 'Production' },
  'Dispatch': { ar: 'الشحن', en: 'Dispatch' },
  'الشحن': { ar: 'الشحن', en: 'Dispatch' },
  'Customer Service': { ar: 'خدمة العملاء', en: 'Customer Service' },
  'خدمة العملاء': { ar: 'خدمة العملاء', en: 'Customer Service' },
  'Legal': { ar: 'الشؤون القانونية', en: 'Legal' },
  'الشؤون القانونية': { ar: 'الشؤون القانونية', en: 'Legal' },
  'Research & Development': { ar: 'البحث والتطوير', en: 'Research & Development' },
  'البحث والتطوير': { ar: 'البحث والتطوير', en: 'Research & Development' },
  'Management': { ar: 'الإدارة', en: 'Management' },
  'الإدارة': { ar: 'الإدارة', en: 'Management' },
  'Quality Management': { ar: 'إدارة الجودة', en: 'Quality Management' },
  'إدارة الجودة': { ar: 'إدارة الجودة', en: 'Quality Management' },
  'Operations': { ar: 'العمليات', en: 'Operations' },
  'العمليات': { ar: 'العمليات', en: 'Operations' },
}

// Employee lifecycle status (ERPNext stores English) — leaks onto badges.
const EMPLOYEE_STATUS: EnumMap = {
  Active: { ar: 'نشط', en: 'Active' },
  'نشط': { ar: 'نشط', en: 'Active' },
  Inactive: { ar: 'غير نشط', en: 'Inactive' },
  'غير نشط': { ar: 'غير نشط', en: 'Inactive' },
  Suspended: { ar: 'موقوف', en: 'Suspended' },
  'موقوف': { ar: 'موقوف', en: 'Suspended' },
  Left: { ar: 'منتهي الخدمة', en: 'Left' },
  'منتهي الخدمة': { ar: 'منتهي الخدمة', en: 'Left' },
}

// Standard ERPNext designations (job titles). Open-ended set → unknown/custom
// titles fall through to their stored value, so nothing is ever hidden.
const DESIGNATION: EnumMap = {
  'Chief Executive Officer': { ar: 'الرئيس التنفيذي', en: 'Chief Executive Officer' },
  'الرئيس التنفيذي': { ar: 'الرئيس التنفيذي', en: 'Chief Executive Officer' },
  'Chief Financial Officer': { ar: 'المدير المالي', en: 'Chief Financial Officer' },
  'المدير المالي': { ar: 'المدير المالي', en: 'Chief Financial Officer' },
  'Chief Operating Officer': { ar: 'مدير العمليات', en: 'Chief Operating Officer' },
  'مدير العمليات': { ar: 'مدير العمليات', en: 'Chief Operating Officer' },
  'HR Manager': { ar: 'مدير الموارد البشرية', en: 'HR Manager' },
  'مدير الموارد البشرية': { ar: 'مدير الموارد البشرية', en: 'HR Manager' },
  'HR User': { ar: 'موظف موارد بشرية', en: 'HR User' },
  'موظف موارد بشرية': { ar: 'موظف موارد بشرية', en: 'HR User' },
  Manager: { ar: 'مدير', en: 'Manager' },
  'مدير': { ar: 'مدير', en: 'Manager' },
  Engineer: { ar: 'مهندس', en: 'Engineer' },
  'مهندس': { ar: 'مهندس', en: 'Engineer' },
  Accountant: { ar: 'محاسب', en: 'Accountant' },
  'محاسب': { ar: 'محاسب', en: 'Accountant' },
  Supervisor: { ar: 'مشرف', en: 'Supervisor' },
  'مشرف': { ar: 'مشرف', en: 'Supervisor' },
  Analyst: { ar: 'محلل', en: 'Analyst' },
  'محلل': { ar: 'محلل', en: 'Analyst' },
  Consultant: { ar: 'استشاري', en: 'Consultant' },
  'استشاري': { ar: 'استشاري', en: 'Consultant' },
  Designer: { ar: 'مصمم', en: 'Designer' },
  'مصمم': { ar: 'مصمم', en: 'Designer' },
  Administrator: { ar: 'مسؤول النظام', en: 'Administrator' },
  'Business Development Manager': { ar: 'مدير تطوير الأعمال', en: 'Business Development Manager' },
  'Projects Manager': { ar: 'مدير المشاريع', en: 'Projects Manager' },
  'Sales Manager': { ar: 'مدير المبيعات', en: 'Sales Manager' },
  'مدير المبيعات': { ar: 'مدير المبيعات', en: 'Sales Manager' },
}

/** Arabic labels for the Frappe status values that show up in HR list cells
 *  (moved here from generic-list-page.tsx so lib/hr-modules.ts field configs
 *  can reuse the same map as `optionLabels` on `select` fields). */
export const VALUE_AR: Record<string, string> = {
  Approved: 'معتمد', Rejected: 'مرفوض', Open: 'مفتوح', Cancelled: 'ملغي', Draft: 'مسودة', Pending: 'قيد الانتظار',
  Active: 'نشط', Inactive: 'غير نشط', Suspended: 'موقوف', Left: 'منتهي', Completed: 'مكتمل', Working: 'قيد العمل',
  'Pending Review': 'قيد المراجعة', Low: 'منخفضة', Medium: 'متوسطة', High: 'عالية', Urgent: 'عاجلة',
  'Work From Home': 'عمل من المنزل', 'On Duty': 'مهمة عمل',
  Sunday: 'الأحد', Monday: 'الاثنين', Tuesday: 'الثلاثاء', Wednesday: 'الأربعاء',
  Thursday: 'الخميس', Friday: 'الجمعة', Saturday: 'السبت',
}

const REGISTRY = {
  territory: TERRITORY,
  proposalStatus: PROPOSAL_STATUS,
  invoiceStatus: INVOICE_STATUS,
  leaveType: LEAVE_TYPE,
  department: DEPARTMENT,
  employeeStatus: EMPLOYEE_STATUS,
  designation: DESIGNATION,
} satisfies Record<string, EnumMap>

export type EnumCategory = keyof typeof REGISTRY

/**
 * Translate a single enum/lookup value to the active locale. Falls back to the
 * raw value when the value isn't a known member of the category.
 */
export function translateEnum(
  category: EnumCategory,
  value: string | null | undefined,
  locale: AppLocale = 'ar',
): string {
  if (value === null || value === undefined || value === '') return ''
  const entry = REGISTRY[category]?.[value]
  return entry ? entry[locale] : value
}

/**
 * Arabic label for a Leave Type name. The stored/submitted value always stays
 * the raw English name — final_settlement.py, leave_summary.py,
 * hr_reports.PERMISSION_TYPES and leave_api.py all key on it — this is
 * display-only, for list columns and link pickers. Unknown/custom leave
 * types fall back to their raw value.
 */
export function leaveTypeAr(name: string | null | undefined): string {
  return translateEnum('leaveType', name, 'ar')
}

/**
 * Strip the ERPNext " - <company_abbr>" suffix that Department PKs carry
 * ("Accounts - A" → "Accounts"). Only the final " - X" segment is removed, so
 * clean names and multi-word departments are left intact. Returns '' for empty.
 */
export function cleanDepartmentName(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/\s*-\s*[^-]+$/, '').trim() || value.trim()
}

/**
 * Localize a Department for display: strips the company-abbrev suffix, then
 * translates the standard ERPNext departments. Unknown/custom departments fall
 * back to their clean (de-suffixed) name so they still render sensibly.
 */
export function translateDepartment(
  value: string | null | undefined,
  locale: AppLocale = 'ar',
): string {
  const clean = cleanDepartmentName(value)
  if (!clean) return ''
  return translateEnum('department', clean, locale)
}
