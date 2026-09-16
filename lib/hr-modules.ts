import type { FrappeFilter } from '@/lib/api-client'
import type { DrawerFilter } from '@/components/hr/advanced-search-drawer'

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

export type FieldType = 'text' | 'number' | 'date' | 'textarea' | 'checkbox' | 'select' | 'link' | 'time'

export interface FieldDef {
  field: string
  label: string
  type?: FieldType
  /** Options for `select`. */
  options?: string[]
  /** For `link`: the doctype to pick from, and the field shown as the label (default name). */
  link?: { doctype: string; titleField?: string; filters?: FrappeFilter[] }
  required?: boolean
  /** Show as a table column. Default true. */
  inTable?: boolean
  /** Show in the create/edit form. Default true. */
  inForm?: boolean
  /** Shown when the field is empty (رقم → employee_number, else the record name). */
  fallbackField?: string
  /** Render as Apex status cell: green dot + «نشط» / grey dot + «غير نشط». */
  statusDot?: { on: string; onLabel?: string; offLabel?: string }
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
  /**
   * Whitelisted method that returns the rows instead of the resource endpoint —
   * for doctypes the HR role set cannot read directly (Activity Log). Implies readOnly.
   */
  method?: string
  /**
   * Apex «الاجراءات ▾» bulk menu (تنشيط / إلغاء التنشيط / حذف). `active` names the
   * status field and its on/off values; omit it and the menu only offers حذف.
   */
  actionsMenu?: boolean
  active?: { field: string; on: string; off: string }
  /** Hide the running «م» index column (Apex lists that have their own code column). */
  noIndex?: boolean
  /** Show the print dropdown (only some Apex lists have it). Default true. */
  print?: boolean
  /** Full-page form instead of the dialog: where «اضافة» goes, and where ✎ goes. */
  addHref?: string
  editHref?: (name: string) => string
  /** Column whose cell links to editHref (Apex: اسم الفرع / إسم الدوام are links). */
  linkField?: string
  /** Apex «box» empty state with a call-to-action that opens the add form. */
  emptyText?: string
  emptyAction?: string
  /** Apex «بحث متقدم» drawer filters (client-side over the loaded rows). */
  drawerFilters?: DrawerFilter[]
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
  employees: {
    kind: 'list',
    title: 'الموظفين',
    subtitle: 'إدارة موظفي مؤسستك',
    doctype: 'Employee',
    orderBy: 'employee_number desc, employee_name asc',
    addLabel: 'اضافة موظف',
    searchPlaceholder: 'ابحث باسم او كود الموظف',
    actionsMenu: true,
    active: { field: 'status', on: 'Active', off: 'Inactive' },
    noIndex: true,
    addHref: '/employee/new',
    editHref: (name) => `/employee/${encodeURIComponent(name)}`,
    linkField: 'employee_name',
    drawerFilters: [
      { field: 'branch', label: 'الفروع', source: 'branches' },
      { field: 'department', label: 'الإدارة', source: 'departments' },
      { field: 'designation', label: 'الوظائف', source: 'designations' },
      { field: 'default_shift', label: 'الدوام', source: 'shifts' },
      { field: 'status', label: 'الحالة', options: ['Active', 'Inactive', 'Suspended', 'Left'] },
    ],
    fields: [
      { field: 'employee_number', label: 'رقم', fallbackField: 'name' },
      { field: 'employee_name', label: 'اسم الموظف', required: true },
      { field: 'designation', label: 'الوظيفة' },
      { field: 'branch', label: 'فرع' },
      { field: 'default_shift', label: 'الدوام' },
      { field: 'status', label: 'الحالة', statusDot: { on: 'Active' } },
      { field: 'department', label: 'الإدارة', inTable: false, inForm: false },
    ],
  },

  branches: {
    kind: 'list',
    title: 'الفروع',
    subtitle: 'فروع الشركة',
    doctype: 'Branch',
    method: 'base_meena.api.hr_lists.branches',
    addLabel: 'اضافة فرع',
    searchPlaceholder: 'البحث باسم او كود الفرع',
    actionsMenu: true,
    noIndex: true,
    print: false,
    linkField: 'branch',
    fields: [
      { field: 'idx', label: 'رقم', inForm: false },
      { field: 'branch', label: 'اسم الفرع', required: true },
      { field: 'employees', label: 'الموظفين', inForm: false },
      { field: 'manager', label: 'مدير الفرع', inForm: false },
      { field: 'departments', label: 'الادارات', inForm: false },
      { field: 'status', label: 'الحالة', inForm: false, statusDot: { on: 'Active' } },
    ],
  },

  'shift-management': {
    kind: 'list',
    title: 'أوقات العمل',
    subtitle: 'أوقات الدوام',
    doctype: 'Shift Type',
    method: 'base_meena.api.hr_lists.shifts',
    addLabel: 'إضافة دوام',
    searchPlaceholder: 'إبحث بإسم الدوام',
    actionsMenu: true,
    noIndex: true,
    print: false,
    linkField: 'name',
    fields: [
      { field: 'name', label: 'إسم الدوام', required: true },
      { field: 'shift_kind', label: 'نوع الدوام', inForm: false },
      { field: 'hours', label: 'الساعات', inForm: false },
      { field: 'start_time', label: 'بداية الدوام', type: 'time', inTable: false },
      { field: 'end_time', label: 'نهاية الدوام', type: 'time', inTable: false },
      { field: 'enable_late_entry_marking', label: 'احتساب التأخير', type: 'checkbox', inTable: false },
      { field: 'late_entry_grace_period', label: 'سماحية التأخير (دقيقة)', type: 'number', inTable: false },
      { field: 'enable_early_exit_marking', label: 'احتساب الانصراف المبكر', type: 'checkbox', inTable: false },
      { field: 'early_exit_grace_period', label: 'سماحية الانصراف (دقيقة)', type: 'number', inTable: false },
    ],
  },

  devices: {
    kind: 'list',
    title: 'الاجهزة',
    subtitle: 'أجهزة البصمة',
    doctype: 'Biometric Device',
    method: 'base_meena.api.hr_lists.devices',
    addLabel: 'اضافة',
    searchPlaceholder: 'ابحث بالاسم',
    noIndex: true,
    fields: [
      { field: 'idx', label: 'م', inForm: false },
      { field: 'serial', label: 'الرقم التسلسلي', inForm: false },
      { field: 'serial_number', label: 'الرقم التسلسلي', required: true, inTable: false },
      { field: 'device_name', label: 'اسم الجهاز', required: true },
      { field: 'branch', label: 'فرع', inForm: false },
      { field: 'location', label: 'الفرع / الموقع', inTable: false },
      { field: 'status', label: 'الحالة', inForm: false },
    ],
  },

  users: {
    kind: 'list',
    title: 'المستخدمين',
    subtitle: 'مستخدمو النظام',
    doctype: 'User',
    method: 'base_meena.api.hr_lists.users',
    addLabel: 'اضافة مستخدم',
    searchPlaceholder: 'ابحث باسم الموظف او اسم المستخدم',
    noIndex: true,
    print: false,
    fields: [
      { field: 'employee_name', label: 'اسم الموظف', inForm: false },
      { field: 'email', label: 'البريد الالكتروني', required: true, inTable: false },
      { field: 'first_name', label: 'الاسم', required: true, inTable: false },
      { field: 'username', label: 'اسم المستخدم' },
      { field: 'roles', label: 'اخري', inForm: false },
      { field: 'enabled', label: 'الحالة', type: 'checkbox', statusDot: { on: 1 as any } },
    ],
  },

  permissions: {
    kind: 'list',
    title: 'الصلاحيات',
    subtitle: 'أدوار المستخدمين',
    doctype: 'Role',
    method: 'base_meena.api.hr_lists.roles',
    addLabel: 'اضافة صلاحية',
    searchPlaceholder: 'ابحث باسم الصلاحية',
    noIndex: true,
    print: false,
    fields: [
      { field: 'role_name', label: 'اسم الصلاحية', required: true },
      { field: 'perms', label: 'الصلاحيات', inForm: false },
      { field: 'users', label: 'المستخدمين', inForm: false },
    ],
  },

  jobs: {
    kind: 'list',
    title: 'الوظائف',
    subtitle: 'إدارة المسميات الوظيفية',
    doctype: 'Designation',
    orderBy: 'name asc',
    addLabel: 'اضافة وظيفة',
    searchPlaceholder: 'ابحث باسم او كود الوظيفة',
    actionsMenu: true,
    print: false,
    fields: [
      { field: 'designation_name', label: 'اسم الوظيفة', required: true },
      { field: 'description', label: 'الوصف', type: 'textarea', inTable: false },
    ],
  },

  'unregistered-employees': {
    kind: 'list',
    title: 'موظفين غير مسجلين',
    subtitle: 'الموظفون الذين لا يملكون حساب مستخدم بعد',
    doctype: 'Employee',
    orderBy: 'employee_name asc',
    filters: [['user_id', 'is', 'not set']],
    searchPlaceholder: 'ابحث بالكود',
    addLabel: 'إضافة موظف',
    actionsMenu: true,
    active: { field: 'status', on: 'Active', off: 'Inactive' },
    noIndex: true,
    print: false,
    fields: [
      { field: 'name', label: 'الكود', inForm: false },
      { field: 'employee_name', label: 'الاسم', required: true },
      { field: 'default_shift', label: 'الدوام' },
      { field: 'attendance_device_id', label: 'جهاز البصمة' },
      { field: 'status', label: 'الحالة', type: 'select', options: ['Active', 'Inactive', 'Suspended', 'Left'], inTable: false },
    ],
  },

  projects: {
    kind: 'list',
    title: 'المشاريع',
    subtitle: 'مشاريع الشركة',
    doctype: 'Project',
    orderBy: 'modified desc',
    addLabel: 'اضافة مشروع',
    searchPlaceholder: 'ابحث باسم المشروع',
    actionsMenu: true,
    print: false,
    fields: [
      { field: 'name', label: 'الكود', inForm: false },
      { field: 'project_name', label: 'اسم المشروع', required: true },
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
    addLabel: 'اضافة مهمة',
    searchPlaceholder: 'ابحث باسم المهمة',
    actionsMenu: true,
    print: false,
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
    addLabel: 'اضافة مجموعة المواقع',
    searchPlaceholder: 'ابحث باسم مجموعة المواقع',
    fields: [
      { field: 'location_name', label: 'اسم المجموعة', required: true },
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
    addLabel: 'إضافة مجموعة الموظفين',
    searchPlaceholder: 'ابحث باسم مجموعة الموظفين',
    actionsMenu: true,
    print: false,
    fields: [{ field: 'employee_group_name', label: 'اسم المجموعة', required: true }],
  },

  nationality: {
    kind: 'list',
    title: 'الجنسية',
    subtitle: 'قائمة الدول/الجنسيات',
    doctype: 'Country',
    orderBy: 'country_name asc',
    addLabel: 'اضافة جنسية',
    searchPlaceholder: 'ابحث باسم الجنسية',
    actionsMenu: true,
    noIndex: true,
    print: false,
    fields: [
      { field: 'country_name', label: 'اسم الجنسية', required: true },
      { field: 'code', label: 'الرمز', inTable: false },
    ],
  },

  'official-holidays': {
    kind: 'list',
    title: 'العطلات الرسمية',
    subtitle: 'قوائم العطلات الرسمية',
    doctype: 'Holiday List',
    orderBy: 'from_date desc',
    addLabel: 'اضافة عطلة رسمية',
    searchPlaceholder: 'ابحث باسم العطلة الرسمية',
    actionsMenu: true,
    print: false,
    fields: [
      { field: 'holiday_list_name', label: 'اسم العطلة', required: true },
      { field: 'from_date', label: 'من تاريخ', type: 'date' },
      { field: 'to_date', label: 'إلى تاريخ', type: 'date' },
      { field: 'weekly_off', label: 'العطلة الأسبوعية', type: 'select', options: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
    ],
  },

  'leave-types': {
    kind: 'list',
    title: 'انواع الاجازات',
    subtitle: 'تعريف أنواع الإجازات',
    doctype: 'Leave Type',
    orderBy: 'name asc',
    addLabel: 'اضافة اجازة',
    searchPlaceholder: 'ابحث باسم نوع الاجازة',
    actionsMenu: true,
    noIndex: true,
    print: false,
    fields: [
      { field: 'leave_type_name', label: 'اسم الاجازة', required: true },
      { field: 'max_leaves_allowed', label: 'أقصى عدد أيام', type: 'number', inTable: false },
      { field: 'is_carry_forward', label: 'يُرحّل', type: 'checkbox', inTable: false },
      { field: 'is_lwp', label: 'بدون راتب', type: 'checkbox', inTable: false },
      { field: 'include_holiday', label: 'يشمل العطلات', type: 'checkbox', inTable: false },
    ],
  },

  // ── الحضور والانصراف ─────────────────────────────────────────────────────
  'add-leave': {
    kind: 'list',
    title: 'اضافة اجازة',
    subtitle: 'اجازات الموظفين',
    doctype: 'Leave Application',
    orderBy: 'from_date desc',
    addLabel: 'اضافة اجازة',
    searchPlaceholder: 'ابحث بالكود او اسم الموظف',
    actionsMenu: true,
    active: { field: 'status', on: 'Approved', off: 'Rejected' },
    noIndex: true,
    drawerFilters: [
      { field: 'leave_type', label: 'نوع الاجازة', source: 'leave_types' },
      { field: 'status', label: 'الحالة', options: ['Open', 'Approved', 'Rejected', 'Cancelled'] },
      { field: 'from_date', label: 'التاريخ', date: true },
    ],
    fields: [
      { field: 'employee', label: 'الموظف', type: 'link', link: { doctype: 'Employee', titleField: 'employee_name', filters: [['status', '=', 'Active']] }, required: true, inTable: false },
      { field: 'employee_name', label: 'اسم الموظف', inForm: false },
      { field: 'leave_type', label: 'نوع الاجازة', type: 'link', link: { doctype: 'Leave Type' }, required: true },
      { field: 'from_date', label: 'من تاريخ', type: 'date', required: true },
      { field: 'to_date', label: 'إلى تاريخ', type: 'date', required: true },
      { field: 'total_leave_days', label: 'عدد الأيام', type: 'number', inForm: false },
      { field: 'status', label: 'الحالة', type: 'select', options: ['Open', 'Approved', 'Rejected', 'Cancelled'] },
      { field: 'description', label: 'السبب', type: 'textarea', inTable: false },
    ],
  },

  'fingerprint-requests': {
    kind: 'list',
    title: 'البصمات',
    subtitle: 'طلبات إضافة بصمة',
    doctype: 'Attendance Request',
    orderBy: 'from_date desc',
    addLabel: 'اضافة طلب بصمة',
    searchPlaceholder: 'ابحث بالكود او اسم الموظف',
    actionsMenu: true,
    noIndex: true,
    fields: [
      { field: 'employee', label: 'الموظف', type: 'link', link: { doctype: 'Employee', titleField: 'employee_name', filters: [['status', '=', 'Active']] }, required: true, inTable: false },
      { field: 'employee_name', label: 'اسم الموظف', inForm: false },
      { field: 'from_date', label: 'من تاريخ', type: 'date', required: true },
      { field: 'to_date', label: 'إلى تاريخ', type: 'date', required: true },
      { field: 'reason', label: 'السبب', type: 'select', options: ['Work From Home', 'On Duty'] },
      { field: 'explanation', label: 'التفاصيل', type: 'textarea', inTable: false },
    ],
  },

  'add-permission': {
    kind: 'list',
    title: 'اضافة اذن',
    subtitle: 'أذونات الموظفين',
    doctype: 'Permission Request',
    orderBy: 'modified desc',
    addLabel: 'اضافة اذن',
    searchPlaceholder: 'ابحث بالكود او اسم الموظف',
    actionsMenu: true,
    active: { field: 'status', on: 'Approved', off: 'Rejected' },
    noIndex: true,
    drawerFilters: [
      { field: 'status', label: 'الحالة', options: ['Draft', 'Pending', 'Approved', 'Rejected'] },
      { field: 'permission_date', label: 'التاريخ', date: true },
    ],
    fields: [
      { field: 'name', label: 'الرقم', inForm: false },
      { field: 'employee', label: 'الموظف', type: 'link', link: { doctype: 'Employee', titleField: 'employee_name', filters: [['status', '=', 'Active']] }, required: true, inTable: false },
      { field: 'employee_name', label: 'اسم الموظف', inForm: false },
      { field: 'permission_date', label: 'التاريخ', type: 'date', required: true },
      { field: 'from_time', label: 'من الساعة', type: 'time' },
      { field: 'to_time', label: 'إلى الساعة', type: 'time' },
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
    method: 'base_meena.api.user_activity.get_user_activity',
    readOnly: true,
    searchPlaceholder: 'إبحث في السجل',
    fields: [
      { field: 'full_name', label: 'المستخدم' },
      { field: 'user', label: 'البريد' },
      { field: 'operation', label: 'العملية' },
      { field: 'status', label: 'الحالة' },
      { field: 'creation', label: 'الوقت' },
    ],
  },

  // ── الاعدادات ────────────────────────────────────────────────────────────
  'ramadan-schedule': {
    kind: 'list',
    title: 'تفعيل دوام رمضان',
    subtitle: 'إعدادات ساعات العمل في رمضان',
    doctype: 'Ramadan Settings',
    orderBy: 'modified desc',
    addLabel: 'اضافة',
    searchPlaceholder: 'بحث بالاسم',
    noIndex: true,
    emptyText: 'لم يتم اضافة اى دوام لرمضان من قبل',
    emptyAction: 'تفعيل اول دوام رمضان',
    fields: [
      { field: 'name', label: 'الرقم', inForm: false },
      { field: 'company', label: 'الشركة' },
      { field: 'ramadan_start', label: 'بداية رمضان', type: 'date' },
      { field: 'ramadan_end', label: 'نهاية رمضان', type: 'date' },
      { field: 'reduced_daily_hours', label: 'ساعات العمل المخفّضة', type: 'number' },
    ],
  },

  locations: {
    kind: 'list',
    title: 'المواقع',
    subtitle: 'مواقع تسجيل الحضور من الجوال',
    doctype: 'Location',
    orderBy: 'location_name asc',
    filters: [['is_group', '=', 0]],
    addLabel: 'اضافة موقع',
    searchPlaceholder: 'ابحث بالاسم',
    noIndex: true,
    print: false,
    fields: [
      { field: 'location_name', label: 'اسم الموقع', required: true },
      { field: 'latitude', label: 'خط العرض', type: 'number' },
      { field: 'longitude', label: 'خط الطول', type: 'number' },
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
    title: 'اعدادات الطلبات',
    subtitle: 'قواعد اعتماد طلبات الموارد البشرية',
    doctype: 'HR Approval Rule',
    orderBy: 'name asc',
    searchPlaceholder: 'ابحث باسم نوع الطلب',
    noIndex: true,
    print: false,
    fields: [
      { field: 'request_type', label: 'انواع الطلبات', required: true },
      { field: 'enabled', label: 'صلاحيات الاعتماد', type: 'checkbox' },
    ],
  },

  'company-data': {
    kind: 'settings',
    title: 'بيانات الشركة',
    subtitle: 'البيانات الأساسية للشركة',
    doctype: 'Company',
    fields: [
      { field: 'company_name', label: 'اسم الشركة بالعربية', required: true },
      { field: 'custom_company_name_en', label: 'اسم الشركة بالانجليزية' },
      { field: 'domain', label: 'مجال العمل بالعربية' },
      { field: 'company_description', label: 'مجال العمل بالانجليزية' },
      { field: 'registration_details', label: 'السجل التجاري' },
      { field: 'tax_id', label: 'الرقم الضريبي' },
      { field: 'phone_no', label: 'رقم الهاتف 1' },
      { field: 'custom_phone_2', label: 'رقم الهاتف 2' },
      { field: 'fax', label: 'رقم الفاكس' },
      { field: 'website', label: 'الموقع الالكتروني' },
      { field: 'email', label: 'البريد الالكتروني' },
      { field: 'custom_address_ar', label: 'العنوان بالعربيه' },
      { field: 'custom_address_en', label: 'العنوان بالانجليزية' },
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
export const BESPOKE_MODULES = new Set(['cancel-transactions', 'attendance-settings', 'settings', 'subscription-info'])

export function getModuleConfig(id: string): ModuleConfig | undefined {
  return HR_MODULES[id]
}
