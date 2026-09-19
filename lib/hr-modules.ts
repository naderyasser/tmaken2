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
  /**
   * Render as an Apex doc-lifecycle pill (مسودة / معتمد / مرفوض / ملغي) derived
   * from `docstatus` (+ `status` when the doctype carries one) instead of the
   * raw field text. Requires `docstatus` to also be listed in `fields` so it's
   * fetched. Used on the submittable HR request lists.
   */
  statusBadge?: boolean
  /** Only shown/sent on CREATE — hidden from the edit dialog entirely (e.g. an
   *  initial password, or a one-time role picker that doesn't apply to an
   *  already-existing account). */
  createOnly?: boolean
  /** Shown (disabled) on the edit dialog but excluded from the PUT payload —
   *  for fields where the same write op would have an unwanted side effect
   *  (e.g. changing `email` on User renames the account). */
  lockedOnEdit?: boolean
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
  /** Doctype requires `company` on create; inject the active company automatically. */
  needsCompany?: boolean
  /**
   * Whitelisted method to call (with the form payload as args) instead of a
   * plain POST on create — for doctypes where inserting the record isn't the
   * whole story (Biometric Device also needs a gateway route; see
   * base_meena.biometric_management.adms.register_device).
   */
  createMethod?: string
  /** Same idea for delete: called with { [deleteArgField || 'name']: row.name }. */
  deleteMethod?: string
  deleteArgField?: string
  /** Always-visible info banner above the table (e.g. device network-setup steps). */
  noteBanner?: string
  /**
   * One of the submittable HR request doctypes (Leave Application, Attendance
   * Request, Permission Request). Turns on the per-row «اعتماد / رفض / إلغاء»
   * menu items and the «تنشيط ▾» bulk actions, both calling
   * base_meena.api.hr_requests.{approve_request,reject_request,cancel_request}
   * with { doctype: config.doctype, name }.
   */
  requestActions?: boolean
  /**
   * Transform the built create payload right before it's sent to
   * `createMethod` (create only — never applied on edit/PUT). Use it when the
   * whitelisted method's kwargs don't line up 1:1 with the form's field names
   * (renames, Arabic-label → backend-value translation, bundling several
   * fields into one array param, …).
   */
  mapCreatePayload?: (payload: Record<string, any>) => Record<string, any>
  /**
   * Compute extra synthetic fields on each row right after it's fetched, for
   * use as a `drawerFilters` field when the raw value doesn't equality-match a
   * nice option label (booleans, empty checks) — the drawer's filter is plain
   * string equality, so this is the escape hatch instead of teaching it new
   * comparison kinds.
   */
  deriveFields?: { as: string; from: (row: Record<string, any>) => string }[]
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

/** «العطلة الأسبوعية» select shows Arabic weekday names; create_holiday_list
 *  wants the English Frappe weekday value. */
const WEEKDAY_AR_TO_EN: Record<string, string> = {
  'الأحد': 'Sunday', 'الاثنين': 'Monday', 'الثلاثاء': 'Tuesday', 'الأربعاء': 'Wednesday',
  'الخميس': 'Thursday', 'الجمعة': 'Friday', 'السبت': 'Saturday',
}

/** «الصلاحية» select on the new-user dialog shows Arabic module names;
 *  company_create_user wants the module id it maps to concrete roles itself. */
const ROLE_LABEL_TO_MODULE: Record<string, string> = {
  'الموارد البشرية': 'hr',
  'المحاسبة': 'accounting',
  'المبيعات': 'cashier',
  'المناديب': 'salesReps',
  'المخزون': 'inventory',
  'المشتريات': 'purchases',
  'العقارات': 'realEstate',
}

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
    deriveFields: [
      { as: '_no_device', from: (r) => (r.attendance_device_id ? '' : 'نعم') },
    ],
    drawerFilters: [
      { field: 'branch', label: 'الفروع', source: 'branches' },
      { field: 'department', label: 'الإدارة', source: 'departments' },
      { field: 'designation', label: 'الوظائف', source: 'designations' },
      { field: 'default_shift', label: 'الدوام', source: 'shifts' },
      { field: 'status', label: 'الحالة', options: ['Active', 'Inactive', 'Suspended', 'Left'] },
      { field: '_no_device', label: 'بلا رقم بصمة', options: ['نعم'] },
    ],
    fields: [
      { field: 'employee_number', label: 'رقم', fallbackField: 'name' },
      { field: 'employee_name', label: 'اسم الموظف', required: true },
      { field: 'designation', label: 'الوظيفة' },
      { field: 'branch', label: 'فرع' },
      { field: 'default_shift', label: 'الدوام' },
      { field: 'attendance_device_id', label: 'رقم البصمة' },
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
    needsCompany: true,
    drawerFilters: [
      { field: 'status', label: 'الحالة', options: ['Active', 'Inactive'] },
    ],
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
      { field: 'start_time', label: 'بداية الدوام', type: 'time', inTable: false, required: true },
      { field: 'end_time', label: 'نهاية الدوام', type: 'time', inTable: false, required: true },
      { field: 'enable_late_entry_marking', label: 'احتساب التأخير', type: 'checkbox', inTable: false },
      { field: 'late_entry_grace_period', label: 'سماحية التأخير (دقيقة)', type: 'number', inTable: false },
      { field: 'enable_early_exit_marking', label: 'احتساب الانصراف المبكر', type: 'checkbox', inTable: false },
      { field: 'early_exit_grace_period', label: 'سماحية الانصراف (دقيقة)', type: 'number', inTable: false },
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
    // Company-scoped user creation goes through the same safe, role-mapping
    // endpoint the company-admin panel uses — a plain POST /api/resource/User
    // both 417s (missing required doctype fields) and would let a caller set
    // arbitrary roles directly. See base_meena.base_meena.api.company_create_user.
    createMethod: 'base_meena.base_meena.api.company_create_user',
    mapCreatePayload: (p) => ({
      email: p.email,
      full_name: p.first_name,
      username: p.username || undefined,
      password: p.password || undefined,
      modules: [ROLE_LABEL_TO_MODULE[p.role] || 'hr'],
    }),
    deriveFields: [
      { as: '_enabled_label', from: (r) => (r.enabled ? 'نشط' : 'غير نشط') },
    ],
    drawerFilters: [
      { field: '_enabled_label', label: 'الحالة', options: ['نشط', 'غير نشط'] },
    ],
    fields: [
      { field: 'employee_name', label: 'اسم الموظف', inForm: false },
      // `email` renames the User doctype's own name on PUT — locked once created.
      { field: 'email', label: 'البريد الالكتروني', required: true, inTable: false, lockedOnEdit: true },
      { field: 'first_name', label: 'الاسم', required: true, inTable: false },
      { field: 'password', label: 'كلمة المرور', required: true, inTable: false, inForm: true, createOnly: true },
      { field: 'role', label: 'الصلاحية', type: 'select', options: Object.keys(ROLE_LABEL_TO_MODULE), required: true, inTable: false, createOnly: true },
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
    editHref: (name) => `/hr/role-permissions/${encodeURIComponent(name)}`,
    linkField: 'perms',
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
    // The generic add dialog only ever collects the fields listed below, which
    // omits several DB-required Employee fields (e.g. date_of_joining) — every
    // create 417d. Route to the same full employee form the `employees` module
    // uses instead of a bespoke dialog.
    addHref: '/employee/new',
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
    needsCompany: true,
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
    needsCompany: true,
    // Inserting the Holiday List row directly never generates its actual
    // `holidays` child rows — the list of dates HRMS attendance/leave logic
    // reads. Go through the endpoint that builds them from from/to + weekly_off.
    createMethod: 'base_meena.api.hr_requests.create_holiday_list',
    mapCreatePayload: (p) => ({
      holiday_list_name: p.holiday_list_name,
      from_date: p.from_date,
      to_date: p.to_date,
      weekly_off: WEEKDAY_AR_TO_EN[p.weekly_off] || p.weekly_off,
      company: p.company,
    }),
    fields: [
      { field: 'holiday_list_name', label: 'اسم العطلة', required: true },
      { field: 'from_date', label: 'من تاريخ', type: 'date', required: true },
      { field: 'to_date', label: 'إلى تاريخ', type: 'date', required: true },
      { field: 'weekly_off', label: 'العطلة الأسبوعية', type: 'select', required: true, options: Object.keys(WEEKDAY_AR_TO_EN) },
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
    needsCompany: true,
    orderBy: 'from_date desc',
    addLabel: 'اضافة اجازة',
    searchPlaceholder: 'ابحث بالكود او اسم الموظف',
    actionsMenu: true,
    active: { field: 'status', on: 'Approved', off: 'Rejected' },
    requestActions: true,
    // Inserting the Leave Application row directly skips the Leave Allocation
    // balance check/creation the real request flow needs.
    createMethod: 'base_meena.api.hr_requests.create_leave_application',
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
      // Approval now happens through the ⋮ menu / bulk «تنشيط» (approve_request /
      // reject_request / cancel_request) — the create form no longer sets it,
      // and create_leave_application doesn't take a `status` kwarg anyway.
      { field: 'status', label: 'الحالة', inForm: false, statusBadge: true },
      { field: 'docstatus', label: 'docstatus', inTable: false, inForm: false },
      { field: 'description', label: 'السبب', type: 'textarea', inTable: false },
      { field: 'half_day', label: 'نصف يوم', type: 'checkbox', inTable: false },
    ],
  },

  'fingerprint-requests': {
    kind: 'list',
    title: 'البصمات',
    subtitle: 'طلبات إضافة بصمة',
    doctype: 'Attendance Request',
    needsCompany: true,
    orderBy: 'from_date desc',
    addLabel: 'اضافة طلب بصمة',
    searchPlaceholder: 'ابحث بالكود او اسم الموظف',
    actionsMenu: true,
    requestActions: true,
    noIndex: true,
    // Inserting the row directly through /api/resource surfaces the raw English
    // overlap-validation error (D2, round-1). Route through the wrapped
    // endpoint so HRMS errors come back translated to Arabic.
    createMethod: 'base_meena.api.hr_requests.create_request',
    mapCreatePayload: (p) => ({ doctype: 'Attendance Request', values: p }),
    // Attendance Request carries no `status` field (only docstatus) — derive a
    // matching label so the drawer can still filter by lifecycle state.
    deriveFields: [
      { as: '_status_label', from: (r) => (Number(r.docstatus ?? 0) === 2 ? 'ملغي' : Number(r.docstatus ?? 0) === 1 ? 'معتمد' : 'مسودة') },
    ],
    drawerFilters: [
      { field: '_status_label', label: 'الحالة', options: ['مسودة', 'معتمد', 'ملغي'] },
      { field: 'from_date', label: 'التاريخ', date: true },
    ],
    fields: [
      { field: 'employee', label: 'الموظف', type: 'link', link: { doctype: 'Employee', titleField: 'employee_name', filters: [['status', '=', 'Active']] }, required: true, inTable: false },
      { field: 'employee_name', label: 'اسم الموظف', inForm: false },
      { field: 'from_date', label: 'من تاريخ', type: 'date', required: true },
      { field: 'to_date', label: 'إلى تاريخ', type: 'date', required: true },
      { field: 'reason', label: 'السبب', type: 'select', options: ['Work From Home', 'On Duty'], required: true },
      { field: 'explanation', label: 'التفاصيل', type: 'textarea', inTable: false },
      { field: 'docstatus', label: 'docstatus', inTable: false, inForm: false },
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
    requestActions: true,
    noIndex: true,
    // Same fix as fingerprint-requests (D2, round-1): route creation through the
    // wrapped endpoint so HRMS validation errors come back translated to Arabic.
    createMethod: 'base_meena.api.hr_requests.create_request',
    mapCreatePayload: (p) => ({ doctype: 'Permission Request', values: p }),
    drawerFilters: [
      { field: 'status', label: 'الحالة', options: ['Draft', 'Pending', 'Approved', 'Rejected'] },
      { field: 'permission_date', label: 'التاريخ', date: true },
    ],
    fields: [
      { field: 'name', label: 'الرقم', inForm: false },
      { field: 'employee', label: 'الموظف', type: 'link', link: { doctype: 'Employee', titleField: 'employee_name', filters: [['status', '=', 'Active']] }, required: true, inTable: false },
      { field: 'employee_name', label: 'اسم الموظف', inForm: false },
      { field: 'permission_date', label: 'التاريخ', type: 'date', required: true },
      { field: 'from_time', label: 'من الساعة', type: 'time', required: true },
      { field: 'to_time', label: 'إلى الساعة', type: 'time', required: true },
      { field: 'reason', label: 'السبب', type: 'textarea', required: true },
      { field: 'status', label: 'الحالة', type: 'select', options: ['Draft', 'Pending', 'Approved', 'Rejected'], statusBadge: true },
      { field: 'docstatus', label: 'docstatus', inTable: false, inForm: false },
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
    needsCompany: true,
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
}

export function getModuleConfig(id: string): ModuleConfig | undefined {
  return HR_MODULES[id]
}
