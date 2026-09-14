import type { FrappeFilter } from '@/lib/api-client'

/**
 * Registry for the HR "proposed version" master-data / settings screens that used
 * to be ComingSoon stubs. Each entry tells the generic page components which
 * Frappe doctype to read/write and how to label the fields.
 *
 * Two kinds:
 *   - 'list'     → GenericListPage   (search + table + add/edit/delete)
 *   - 'settings' → GenericSettingsPage (single record form, saved with PUT)
 *
 * NOTE: doctype / field names mirror the standard Frappe HR schema where one
 * exists (Designation, Project, Task, Holiday List, Leave Type, Company, …).
 * Tenant-specific names (Ramadan / request settings) live on custom doctypes —
 * adjust the `doctype`/`field` strings here in one place if the backend differs.
 */

export type FieldType = 'text' | 'number' | 'date' | 'textarea' | 'checkbox' | 'select'

export interface FieldDef {
  field: string
  label: string
  type?: FieldType
  /** Options for `select`. */
  options?: string[]
  required?: boolean
  /** Show as a table column. Default true. */
  inTable?: boolean
  /** Show in the create/edit form. Default true. */
  inForm?: boolean
}

export interface ListModuleConfig {
  kind: 'list'
  title: string
  subtitle?: string
  doctype: string
  fields: FieldDef[]
  orderBy?: string
  filters?: FrappeFilter[]
  addLabel?: string
  searchPlaceholder?: string
  /** View-only list (no add/edit/delete) — e.g. activity logs. */
  readOnly?: boolean
}

export interface SettingsModuleConfig {
  kind: 'settings'
  title: string
  subtitle?: string
  /** Singleton doctype: read with GET /api/resource/<doctype>, saved with PUT. */
  doctype: string
  fields: FieldDef[]
}

export type ModuleConfig = ListModuleConfig | SettingsModuleConfig

export const HR_MODULES: Record<string, ModuleConfig> = {
  // ── البيانات الاساسية ────────────────────────────────────────────────────
  jobs: {
    kind: 'list',
    title: 'الوظائف',
    subtitle: 'إدارة المسميات الوظيفية',
    doctype: 'Designation',
    orderBy: 'name asc',
    addLabel: 'إضافة وظيفة',
    searchPlaceholder: 'إبحث بإسم الوظيفة',
    fields: [
      { field: 'designation', label: 'المسمى الوظيفي', required: true },
      { field: 'description', label: 'الوصف', type: 'textarea' },
    ],
  },

  'unregistered-employees': {
    kind: 'list',
    title: 'موظفين غير مسجلين',
    subtitle: 'الموظفون الذين لا يملكون حساب مستخدم بعد',
    doctype: 'Employee',
    orderBy: 'employee_name asc',
    filters: [['user_id', 'is', 'not set']],
    searchPlaceholder: 'إبحث بإسم الموظف',
    addLabel: 'إضافة موظف',
    fields: [
      { field: 'name', label: 'الكود', inForm: false },
      { field: 'employee_name', label: 'الاسم', required: true },
      { field: 'designation', label: 'الوظيفة' },
      { field: 'branch', label: 'الفرع' },
      { field: 'status', label: 'الحالة', type: 'select', options: ['Active', 'Inactive', 'Suspended', 'Left'] },
    ],
  },

  projects: {
    kind: 'list',
    title: 'المشاريع',
    subtitle: 'مشاريع الشركة',
    doctype: 'Project',
    orderBy: 'name desc',
    addLabel: 'إضافة مشروع',
    searchPlaceholder: 'إبحث بإسم المشروع',
    fields: [
      { field: 'name', label: 'الكود', inForm: false },
      { field: 'project_name', label: 'إسم المشروع', required: true },
      {
        field: 'status',
        label: 'الحالة',
        type: 'select',
        options: ['Open', 'Completed', 'Cancelled'],
      },
      { field: 'expected_end_date', label: 'تاريخ الانتهاء', type: 'date' },
    ],
  },

  tasks: {
    kind: 'list',
    title: 'المهام',
    subtitle: 'إدارة المهام',
    doctype: 'Task',
    orderBy: 'modified desc',
    addLabel: 'إضافة مهمة',
    searchPlaceholder: 'إبحث في المهام',
    fields: [
      { field: 'name', label: 'الكود', inForm: false },
      { field: 'subject', label: 'الموضوع', required: true },
      {
        field: 'status',
        label: 'الحالة',
        type: 'select',
        options: ['Open', 'Working', 'Pending Review', 'Completed', 'Cancelled'],
      },
      { field: 'priority', label: 'الأولوية', type: 'select', options: ['Low', 'Medium', 'High', 'Urgent'] },
      { field: 'exp_end_date', label: 'تاريخ الاستحقاق', type: 'date' },
    ],
  },

  'location-groups': {
    kind: 'list',
    title: 'مجموعات المواقع',
    subtitle: 'تجميع المواقع/الفروع في مجموعات',
    doctype: 'Location Group',
    orderBy: 'name asc',
    addLabel: 'إضافة مجموعة',
    searchPlaceholder: 'إبحث بإسم المجموعة',
    fields: [
      { field: 'name', label: 'إسم المجموعة', required: true },
      { field: 'description', label: 'الوصف', type: 'textarea' },
    ],
  },

  'employee-groups': {
    kind: 'list',
    title: 'مجموعات الموظفين',
    subtitle: 'تجميع الموظفين في مجموعات',
    doctype: 'Employee Group',
    orderBy: 'name asc',
    addLabel: 'إضافة مجموعة',
    searchPlaceholder: 'إبحث بإسم المجموعة',
    fields: [
      { field: 'name', label: 'إسم المجموعة', required: true },
    ],
  },

  nationality: {
    kind: 'list',
    title: 'الجنسية',
    subtitle: 'قائمة الجنسيات',
    doctype: 'Nationality',
    orderBy: 'name asc',
    addLabel: 'إضافة جنسية',
    searchPlaceholder: 'إبحث بإسم الجنسية',
    fields: [{ field: 'name', label: 'الجنسية', required: true }],
  },

  'official-holidays': {
    kind: 'list',
    title: 'العطلات الرسمية',
    subtitle: 'قوائم العطلات الرسمية',
    doctype: 'Holiday List',
    orderBy: 'from_date desc',
    addLabel: 'إضافة قائمة عطلات',
    searchPlaceholder: 'إبحث بإسم القائمة',
    fields: [
      { field: 'holiday_list_name', label: 'إسم القائمة', required: true },
      { field: 'from_date', label: 'من تاريخ', type: 'date' },
      { field: 'to_date', label: 'إلى تاريخ', type: 'date' },
      { field: 'weekly_off', label: 'العطلة الأسبوعية', type: 'select', options: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
    ],
  },

  'leave-types': {
    kind: 'list',
    title: 'أنواع الإجازات',
    subtitle: 'تعريف أنواع الإجازات',
    doctype: 'Leave Type',
    orderBy: 'name asc',
    addLabel: 'إضافة نوع إجازة',
    searchPlaceholder: 'إبحث بإسم النوع',
    fields: [
      { field: 'leave_type_name', label: 'نوع الإجازة', required: true },
      { field: 'max_days_allowed', label: 'أقصى عدد أيام', type: 'number' },
      { field: 'is_carry_forward', label: 'يُرحّل', type: 'checkbox' },
      { field: 'is_lwp', label: 'بدون راتب', type: 'checkbox' },
      { field: 'include_holiday', label: 'يشمل العطلات', type: 'checkbox' },
    ],
  },

  // ── الحضور والانصراف ─────────────────────────────────────────────────────
  'add-permission': {
    kind: 'list',
    title: 'إضافة إذن',
    subtitle: 'أذونات الموظفين',
    doctype: 'Permission Request',
    orderBy: 'modified desc',
    addLabel: 'إضافة إذن',
    searchPlaceholder: 'إبحث بإسم الموظف',
    fields: [
      { field: 'name', label: 'الرقم', inForm: false },
      { field: 'employee', label: 'الموظف', required: true },
      { field: 'from_date', label: 'من تاريخ', type: 'date', required: true },
      { field: 'to_date', label: 'إلى تاريخ', type: 'date' },
      { field: 'reason', label: 'السبب', type: 'textarea' },
      {
        field: 'status',
        label: 'الحالة',
        type: 'select',
        options: ['Draft', 'Pending', 'Approved', 'Rejected'],
      },
    ],
  },

  // ── المستخدمين ───────────────────────────────────────────────────────────
  'user-transactions': {
    kind: 'list',
    title: 'حركات المستخدمين',
    subtitle: 'سجل نشاط المستخدمين',
    doctype: 'Activity Log',
    orderBy: 'modified desc',
    readOnly: true,
    searchPlaceholder: 'إبحث في السجل',
    fields: [
      { field: 'user', label: 'المستخدم' },
      { field: 'subject', label: 'الحدث' },
      { field: 'status', label: 'الحالة' },
      { field: 'creation', label: 'التاريخ' },
    ],
  },

  // ── الاعدادات ────────────────────────────────────────────────────────────
  'ramadan-schedule': {
    kind: 'settings',
    title: 'تفعيل دوام رمضان',
    subtitle: 'ضبط أوقات العمل خلال شهر رمضان',
    doctype: 'HR Settings',
    fields: [
      { field: 'enable_ramadan_timing', label: 'تفعيل دوام رمضان', type: 'checkbox' },
      { field: 'ramadan_start_date', label: 'بداية رمضان', type: 'date' },
      { field: 'ramadan_end_date', label: 'نهاية رمضان', type: 'date' },
      { field: 'ramadan_working_hours', label: 'عدد ساعات العمل', type: 'number' },
    ],
  },

  'attendance-settings': {
    kind: 'settings',
    title: 'إعدادات الحضور والانصراف',
    subtitle: 'قواعد تسجيل الحضور',
    doctype: 'HR Settings',
    fields: [
      { field: 'standard_working_hours', label: 'ساعات العمل القياسية', type: 'number' },
      { field: 'allow_employee_checkin_from_mobile_app', label: 'السماح بالحضور من التطبيق', type: 'checkbox' },
      { field: 'allow_multiple_checkins_per_day', label: 'السماح بعدة تسجيلات في اليوم', type: 'checkbox' },
      { field: 'allow_overtime', label: 'السماح بالعمل الإضافي', type: 'checkbox' },
    ],
  },

  'requests-settings': {
    kind: 'settings',
    title: 'إعدادات الطلبات',
    subtitle: 'تفعيل أنواع الطلبات المعتمدة',
    doctype: 'HR Settings',
    fields: [
      { field: 'enable_leave_request', label: 'طلبات الإجازات', type: 'checkbox' },
      { field: 'enable_permission_request', label: 'طلبات الأذونات', type: 'checkbox' },
      { field: 'enable_overtime_request', label: 'طلبات العمل الإضافي', type: 'checkbox' },
      { field: 'approver_role', label: 'دور المعتمد', type: 'select', options: ['HR Manager', 'HR User', 'Line Manager'] },
    ],
  },

  'company-data': {
    kind: 'settings',
    title: 'بيانات الشركة',
    subtitle: 'البيانات الأساسية للشركة',
    doctype: 'Company',
    fields: [
      { field: 'company_name', label: 'إسم الشركة' },
      { field: 'abbr', label: 'الاختصار' },
      { field: 'country', label: 'الدولة' },
      { field: 'default_currency', label: 'العملة' },
      { field: 'default_holiday_list', label: 'قائمة العطلات الافتراضية' },
      { field: 'phone_no', label: 'الهاتف' },
      { field: 'email', label: 'البريد الإلكتروني' },
      { field: 'website', label: 'الموقع' },
      { field: 'tax_id', label: 'الرقم الضريبي' },
    ],
  },
}

/** Modules that have a bespoke page instead of the generic list/settings renderer. */
export const BESPOKE_MODULES = new Set(['cancel-transactions', 'subscription-info'])

export function getModuleConfig(id: string): ModuleConfig | undefined {
  return HR_MODULES[id]
}
