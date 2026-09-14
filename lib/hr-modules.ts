import type { FrappeFilter } from '@/lib/api-client'

/**
 * Registry for the HR "proposed version" master-data / settings screens.
 *
 * Doctypes and field names below were verified against the live backend
 * (qarawi.base.meena.sa) — every entry resolves to a real, queryable doctype so
 * each page lists real records instead of failing. If a tenant's schema differs,
 * correct it here in one place.
 *
 * Two kinds:
 *   - 'list'     → GenericListPage   (search + table + add/edit/delete)
 *   - 'settings' → GenericSettingsPage (single record form, saved with PUT)
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
  /** View-only list (no add/edit/delete). */
  readOnly?: boolean
}

export interface SettingsModuleConfig {
  kind: 'settings'
  title: string
  subtitle?: string
  /** Doc fetched with GET /api/resource/<doctype>[/<name>] and saved with PUT. */
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
      { field: 'designation_name', label: 'المسمى الوظيفي', required: true },
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
    orderBy: 'modified desc',
    addLabel: 'إضافة مشروع',
    searchPlaceholder: 'إبحث بإسم المشروع',
    fields: [
      { field: 'name', label: 'الكود', inForm: false },
      { field: 'project_name', label: 'إسم المشروع', required: true },
      { field: 'status', label: 'الحالة', type: 'select', options: ['Open', 'Completed', 'Cancelled'] },
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
      { field: 'status', label: 'الحالة', type: 'select', options: ['Open', 'Working', 'Pending Review', 'Completed', 'Cancelled'] },
      { field: 'priority', label: 'الأولوية', type: 'select', options: ['Low', 'Medium', 'High', 'Urgent'] },
      { field: 'exp_end_date', label: 'تاريخ الاستحقاق', type: 'date' },
    ],
  },

  'location-groups': {
    kind: 'list',
    title: 'مجموعات المواقع',
    subtitle: 'المواقع ومجموعاتها',
    doctype: 'Location',
    orderBy: 'name asc',
    addLabel: 'إضافة موقع',
    searchPlaceholder: 'إبحث بإسم الموقع',
    fields: [
      { field: 'location_name', label: 'إسم الموقع', required: true },
      { field: 'parent_location', label: 'الموقع الأب' },
      { field: 'is_group', label: 'مجموعة', type: 'checkbox' },
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
    fields: [{ field: 'employee_group_name', label: 'إسم المجموعة', required: true }],
  },

  nationality: {
    kind: 'list',
    title: 'الجنسية',
    subtitle: 'قائمة الدول/الجنسيات',
    doctype: 'Country',
    orderBy: 'country_name asc',
    addLabel: 'إضافة جنسية',
    searchPlaceholder: 'إبحث بإسم الجنسية',
    fields: [
      { field: 'country_name', label: 'الجنسية', required: true },
      { field: 'code', label: 'الرمز' },
    ],
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
      { field: 'max_leaves_allowed', label: 'أقصى عدد أيام', type: 'number' },
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
      { field: 'employee_name', label: 'إسم الموظف', inTable: false },
      { field: 'permission_date', label: 'تاريخ الإذن', type: 'date', required: true },
      { field: 'from_time', label: 'من الساعة' },
      { field: 'to_time', label: 'إلى الساعة' },
      { field: 'reason', label: 'السبب', type: 'textarea' },
      { field: 'status', label: 'الحالة', type: 'select', options: ['Draft', 'Pending', 'Approved', 'Rejected'] },
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
      { field: 'operation', label: 'العملية' },
      { field: 'status', label: 'الحالة' },
    ],
  },

  // ── الاعدادات ────────────────────────────────────────────────────────────
  'ramadan-schedule': {
    kind: 'list',
    title: 'تفعيل دوام رمضان',
    subtitle: 'إعدادات ساعات العمل في رمضان',
    doctype: 'Ramadan Settings',
    orderBy: 'modified desc',
    addLabel: 'إضافة إعداد',
    searchPlaceholder: 'إبحث بالإسم',
    fields: [
      { field: 'name', label: 'الرقم', inForm: false },
      { field: 'company', label: 'الشركة' },
      { field: 'ramadan_start', label: 'بداية رمضان', type: 'date' },
      { field: 'ramadan_end', label: 'نهاية رمضان', type: 'date' },
      { field: 'reduced_daily_hours', label: 'ساعات العمل المخفّضة', type: 'number' },
    ],
  },

  'attendance-settings': {
    kind: 'list',
    title: 'إعدادات الحضور والانصراف',
    subtitle: 'قواعد التأخير والخروج المبكر والعمل الإضافي لكل مناوبة',
    doctype: 'Shift Type',
    orderBy: 'name asc',
    addLabel: 'إضافة مناوبة',
    searchPlaceholder: 'إبحث بإسم المناوبة',
    fields: [
      { field: 'name', label: 'المناوبة', required: true },
      { field: 'enable_late_entry_marking', label: 'تسجيل التأخير', type: 'checkbox' },
      { field: 'late_entry_grace_period', label: 'سماحية التأخير (د)', type: 'number' },
      { field: 'enable_early_exit_marking', label: 'تسجيل الخروج المبكر', type: 'checkbox' },
      { field: 'early_exit_grace_period', label: 'سماحية الخروج (د)', type: 'number' },
      { field: 'allow_overtime', label: 'السماح بالعمل الإضافي', type: 'checkbox' },
    ],
  },

  'requests-settings': {
    kind: 'list',
    title: 'إعدادات الطلبات',
    subtitle: 'قواعد اعتماد طلبات الموارد البشرية',
    doctype: 'HR Approval Rule',
    orderBy: 'name asc',
    searchPlaceholder: 'إبحث بإسم القاعدة',
    readOnly: true,
    fields: [{ field: 'name', label: 'قاعدة الاعتماد' }],
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

  'subscription-info': {
    kind: 'list',
    title: 'معلومات الاشتراك',
    subtitle: 'اشتراكات الجهات والأطراف',
    doctype: 'Subscription',
    orderBy: 'modified desc',
    searchPlaceholder: 'إبحث بإسم الاشتراك',
    fields: [
      { field: 'name', label: 'الاشتراك' },
      { field: 'party', label: 'الجهة' },
      { field: 'status', label: 'الحالة' },
      { field: 'start_date', label: 'من تاريخ', type: 'date' },
      { field: 'end_date', label: 'إلى تاريخ', type: 'date' },
    ],
  },
}

/** Modules that have a bespoke page instead of the generic list/settings renderer. */
export const BESPOKE_MODULES = new Set(['cancel-transactions'])

export function getModuleConfig(id: string): ModuleConfig | undefined {
  return HR_MODULES[id]
}
