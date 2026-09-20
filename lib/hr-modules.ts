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
  /** Static kwargs sent with `method` (e.g. `{ doctype: 'Permission Request' }`
   *  for a shared multi-doctype row source like hr_requests.list_requests). */
  methodArgs?: Record<string, any>
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
  /**
   * Apex row «⋮» menu kind (components/hr/apex/row-menu.tsx): 'employee' →
   * عرض + تنشيط/إلغاء التنشيط (employees, jobs, unregistered); 'master' →
   * عرض + سجل الحركات (branches, shifts, nationality, leave types, devices,
   * projects, tasks, location/employee groups). Omit for lists Apex gives no
   * ⋮ menu shape for yet (users, permissions, requests, settings tables) —
   * GenericListPage keeps its legacy تعديل/حذف dropdown for those.
   */
  rowMenu?: 'employee' | 'master'
  /** Apex has no «اضافة» button on this list at all (e.g. unregistered employees). */
  noAdd?: boolean
  /** Per-row delete eligibility (e.g. a branch with employees can't be deleted).
   *  Default: always deletable. Drives the trash icon's disabled/grey state. */
  deletable?: (row: Record<string, any>) => boolean
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
  /**
   * The field (if any) that IS this doctype's autoname source
   * (`autoname: "field:<this>"` in the DocType — Branch.branch,
   * Designation.designation_name, Country.country_name,
   * Employee Group.employee_group_name, Location.location_name,
   * Leave Type.leave_type_name…). A plain PUT that changes this field is a
   * silent no-op in Frappe — the REST API returns 200 with the field
   * unchanged, no error, because renaming a document requires
   * frappe.rename_doc(), not a field update (exhaustive data audit,
   * 2026-09-20: every "master list" edit dialog reported success while the
   * name never actually changed). Declaring it here makes generic-list-page
   * rename the document first, then PUT any other changed fields.
   */
  nameField?: string
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
    rowMenu: 'employee',
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
    rowMenu: 'master',
    linkField: 'branch',
    nameField: 'branch',
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
      // Saudi address fields (Apex GetAllBranches) — optional, form-only.
      // base_meena.hr_management.setup_branch_fields adds the custom fields.
      { field: 'custom_building_number', label: 'رقم المبنى', inTable: false },
      { field: 'custom_district', label: 'الحي', inTable: false },
      { field: 'custom_city', label: 'المدينة', inTable: false },
      { field: 'custom_street', label: 'الشارع', inTable: false },
      { field: 'custom_zip_code', label: 'الرمز البريدي', inTable: false },
      { field: 'custom_phone', label: 'الهاتف', inTable: false },
      { field: 'custom_fax', label: 'الفاكس', inTable: false },
      { field: 'custom_address_en', label: 'العنوان بالانجليزية', inTable: false },
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
    rowMenu: 'master',
    linkField: 'name',
    // Apex `GetMasterShift` columns: اسم الدوام · نوع الدوام · وقت إنتهاء
    // الدوام. Full-page editor (B2) instead of the generic dialog — الحقول
    // custom_shift_kind/custom_day_end_time show «—» via cellValue's default
    // fallback until a shift actually sets them.
    addHref: '/shift-management/new',
    editHref: (name) => `/shift-management/${encodeURIComponent(name)}`,
    deleteMethod: 'base_meena.api.hr_shifts.delete_shift',
    fields: [
      { field: 'name', label: 'اسم الدوام', required: true },
      { field: 'custom_shift_kind', label: 'نوع الدوام', inForm: false },
      { field: 'custom_day_end_time', label: 'وقت إنتهاء الدوام', type: 'time', inForm: false },
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
    // Role autonames on field:role_name — rename_doc is required or edits
    // silently no-op. hr_lists.roles() lists custom roles plus a fixed set
    // of standard platform roles (HR Manager, HR User, System Manager,
    // Employee); rename applies to whichever of those rows the list shows.
    nameField: 'role_name',
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
    // Designation carries no per-employee count of its own — hr_lists.jobs()
    // adds `employees_count`. It also carries no status field, standard or
    // custom (checked against the doctype meta) — Apex still shows a
    // «الحالة» column here, always «نشط», so it's rendered as a synthetic
    // display-only column (deriveFields below); there is no backing field
    // for hr_lists.set_active to flip, so per-row/bulk تنشيط is NOT offered
    // for jobs (rowMenu below only ever shows «عرض»).
    method: 'base_meena.api.hr_lists.jobs',
    addLabel: 'اضافة وظيفة',
    searchPlaceholder: 'ابحث باسم او كود الوظيفة',
    actionsMenu: true,
    print: false,
    noIndex: true,
    rowMenu: 'employee',
    nameField: 'designation_name',
    deriveFields: [
      { as: '_status_label', from: () => 'نشط' },
    ],
    drawerFilters: [
      { field: '_status_label', label: 'الحالة', options: ['نشط'] },
    ],
    fields: [
      { field: 'designation_name', label: 'اسم الوظيفة', required: true },
      { field: '_status_label', label: 'الحالة', inForm: false, statusDot: { on: 'نشط' } },
      { field: 'employees_count', label: 'عدد الموظفين', inForm: false },
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
    // Apex has no «إضافة موظف» button on this list at all — registering an
    // employee happens through the employees list, not from here.
    noAdd: true,
    actionsMenu: true,
    active: { field: 'status', on: 'Active', off: 'Inactive' },
    noIndex: true,
    print: false,
    rowMenu: 'employee',
    drawerFilters: [
      { field: 'default_shift', label: 'الدوام', source: 'shifts' },
      { field: 'status', label: 'الحالة', options: ['Active', 'Inactive', 'Suspended', 'Left'] },
    ],
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
    noIndex: true,
    rowMenu: 'master',
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
    rowMenu: 'master',
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
    noIndex: true,
    rowMenu: 'master',
    // Apex M6 (hr/locations-group-details): the group name opens the on-site
    // transactions screen (components/hr/location-group-details-page.tsx).
    editHref: (name) => `/location-groups/${encodeURIComponent(name)}`,
    linkField: 'location_name',
    nameField: 'location_name',
    fields: [
      { field: 'location_name', label: 'اسم المجموعة', required: true },
      // Was a plain text input: any typed value (real or not) got submitted
      // as-is to this Link field, and an unresolvable parent crashes
      // ERPNext's own NestedSet.on_update with a raw 500 (unpacking a None
      // tree-node) instead of a clean validation error — found by the
      // exhaustive data audit, 2026-09-20. A real link picker can only ever
      // submit an existing Location, which sidesteps the whole class of bug.
      { field: 'parent_location', label: 'الموقع الأب', type: 'link', link: { doctype: 'Location', titleField: 'location_name' } },
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
    // Apex's own placeholder text (measured live) drops the ة in «مجوعة» —
    // kept verbatim rather than "corrected" so this matches Apex exactly.
    searchPlaceholder: 'ابحث باسم مجوعة الموظفين',
    actionsMenu: true,
    print: false,
    noIndex: true,
    rowMenu: 'master',
    // Apex M3 (hr/employeeGroups/specificEmployeeGroup): the group name is a
    // link into the members screen (components/hr/employee-group-members-page.tsx),
    // same linkField/editHref pattern as إسم الدوام on shift-management.
    editHref: (name) => `/hr?module=employee-group-members&group=${encodeURIComponent(name)}`,
    linkField: 'employee_group_name',
    nameField: 'employee_group_name',
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
    rowMenu: 'master',
    nameField: 'country_name',
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
    noIndex: true,
    needsCompany: true,
    drawerFilters: [
      { field: 'weekly_off', label: 'العطلة الأسبوعية', options: Object.keys(WEEKDAY_AR_TO_EN) },
      { field: 'from_date', label: 'التاريخ', date: true },
    ],
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
    nameField: 'holiday_list_name',
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
    rowMenu: 'master',
    nameField: 'leave_type_name',
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
    // Row source instead of the plain resource endpoint: Leave Application
    // has no `branch` of its own — list_requests joins it (and
    // designation/default_shift, for the drawer) from the employee.
    method: 'base_meena.api.hr_requests.list_requests',
    methodArgs: { doctype: 'Leave Application' },
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
      { field: 'branch', label: 'الفروع', source: 'branches' },
      { field: 'department', label: 'الإدارة', source: 'departments' },
      // Apex's own accordion set (§5.11) has «الاقسام» right after «الإدارة»
      // as a distinct control — get_filter_options carries no separate
      // section/sub-department catalogue (see report-page.tsx's own note on
      // the same gap), so this reuses the department field/source rather
      // than omitting the accordion Apex shows.
      { field: 'department', label: 'الاقسام', source: 'departments' },
      { field: 'designation', label: 'الوظائف', source: 'designations' },
      { field: 'default_shift', label: 'الدوام', source: 'shifts' },
      { field: 'leave_type', label: 'نوع الاجازة', source: 'leave_types' },
      { field: 'from_date', label: 'التاريخ', date: true },
    ],
    // Apex columns exactly: الكود · اسم الموظف · الفرع · نوع الاجازة · من ·
    // إلى · المدة · ملاحظات (no separate الحالة column — the ⋮ menu still
    // carries اعتماد/رفض/إلغاء regardless of whether a status column shows).
    fields: [
      { field: 'name', label: 'الكود', inForm: false },
      { field: 'employee', label: 'الموظف', type: 'link', link: { doctype: 'Employee', titleField: 'employee_name', filters: [['status', '=', 'Active']] }, required: true, inTable: false },
      { field: 'employee_name', label: 'اسم الموظف', inForm: false },
      { field: 'branch', label: 'الفرع', inForm: false },
      { field: 'leave_type', label: 'نوع الاجازة', type: 'link', link: { doctype: 'Leave Type' }, required: true },
      { field: 'from_date', label: 'من', type: 'date', required: true },
      { field: 'to_date', label: 'إلى', type: 'date', required: true },
      { field: 'total_leave_days', label: 'المدة', type: 'number', inForm: false },
      { field: 'description', label: 'ملاحظات', type: 'textarea' },
      // Approval happens through the ⋮ menu / bulk «تنشيط» (approve_request /
      // reject_request / cancel_request) — the create form no longer sets it,
      // and create_leave_application doesn't take a `status` kwarg anyway.
      { field: 'status', label: 'الحالة', inForm: false, inTable: false, statusBadge: true },
      { field: 'docstatus', label: 'docstatus', inTable: false, inForm: false },
      { field: 'half_day', label: 'نصف يوم', type: 'checkbox', inTable: false },
      { field: 'department', label: 'الإدارة', inTable: false, inForm: false },
      { field: 'designation', label: 'الوظائف', inTable: false, inForm: false },
      { field: 'default_shift', label: 'الدوام', inTable: false, inForm: false },
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
    // Apex's accordion set here is الفروع/الإدارة/الاقسام/التاريخ (§5.11) —
    // Attendance Request carries a real `department` field (checked against
    // the doctype meta) but no `branch` of its own and no employee join to
    // derive one client-side, so «الفروع» is left out rather than shipped as
    // a filter that can never actually match a row.
    drawerFilters: [
      { field: 'department', label: 'الإدارة', source: 'departments' },
      { field: 'department', label: 'الاقسام', source: 'departments' },
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
      { field: 'department', label: 'الإدارة', inTable: false, inForm: false },
      { field: 'docstatus', label: 'docstatus', inTable: false, inForm: false },
    ],
  },

  'add-permission': {
    kind: 'list',
    title: 'اضافة اذن',
    subtitle: 'أذونات الموظفين',
    doctype: 'Permission Request',
    // Permission Request already carries `branch` (fetch_from employee.branch)
    // but not department/designation/default_shift — list_requests joins
    // those in for the drawer, same as add-leave.
    method: 'base_meena.api.hr_requests.list_requests',
    methodArgs: { doctype: 'Permission Request' },
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
    // «نوع الاذن» is a constant here (Apex `GetOrderTypes.arabicName` for this
    // list is always «طلب اذن» — Permission Request has no per-row type field
    // of its own; see base_meena.api.hr_requests.get_order_types).
    deriveFields: [
      { as: '_order_type', from: () => 'طلب اذن' },
    ],
    drawerFilters: [
      { field: 'branch', label: 'الفروع', source: 'branches' },
      { field: 'department', label: 'الإدارة', source: 'departments' },
      // See add-leave's identical note: Apex shows «الاقسام» as its own
      // accordion (§5.11) but there is no distinct section catalogue behind
      // it, so it reuses the department field/source.
      { field: 'department', label: 'الاقسام', source: 'departments' },
      { field: 'designation', label: 'الوظائف', source: 'designations' },
      { field: 'default_shift', label: 'الدوام', source: 'shifts' },
      { field: '_order_type', label: 'نوع الاذن', options: ['طلب اذن'] },
      { field: 'permission_date', label: 'التاريخ', date: true },
    ],
    // Apex columns exactly: الكود · اسم الموظف · التاريخ · الفرع · نوع الاذن
    fields: [
      { field: 'name', label: 'الكود', inForm: false },
      { field: 'employee', label: 'الموظف', type: 'link', link: { doctype: 'Employee', titleField: 'employee_name', filters: [['status', '=', 'Active']] }, required: true, inTable: false },
      { field: 'employee_name', label: 'اسم الموظف', inForm: false },
      { field: 'permission_date', label: 'التاريخ', type: 'date', required: true },
      { field: 'branch', label: 'الفرع', inForm: false },
      { field: '_order_type', label: 'نوع الاذن', inForm: false },
      { field: 'from_time', label: 'من الساعة', type: 'time', required: true, inTable: false },
      { field: 'to_time', label: 'إلى الساعة', type: 'time', required: true, inTable: false },
      { field: 'reason', label: 'السبب', type: 'textarea', required: true, inTable: false },
      { field: 'status', label: 'الحالة', type: 'select', options: ['Draft', 'Pending', 'Approved', 'Rejected'], statusBadge: true, inTable: false },
      { field: 'docstatus', label: 'docstatus', inTable: false, inForm: false },
      { field: 'department', label: 'الإدارة', inTable: false, inForm: false },
      { field: 'designation', label: 'الوظائف', inTable: false, inForm: false },
      { field: 'default_shift', label: 'الدوام', inTable: false, inForm: false },
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
    // Apex columns: الاسم · تاريخ البداية · تاريخ النهاية · الحالة (نشط when
    // today falls within [ramadan_start, ramadan_end], else غير نشط — there's
    // no status field on the doctype, so it's derived client-side).
    deriveFields: [
      { as: '_status_label', from: (r) => {
        const today = new Date().toISOString().slice(0, 10)
        const start = String(r.ramadan_start || '').slice(0, 10)
        const end = String(r.ramadan_end || '').slice(0, 10)
        return start && end && today >= start && today <= end ? 'نشط' : 'غير نشط'
      } },
    ],
    fields: [
      { field: 'name', label: 'الرقم', inForm: false, inTable: false },
      // `needsCompany` only auto-injects when the field is EMPTY at submit
      // (generic-list-page.tsx:354) — exposing this as a free-text input let
      // a typed value reach the backend as a raw Company link, throwing a
      // raw LinkValidationError for anything not an exact existing company
      // name (found by the exhaustive data audit, 2026-09-20). Hidden from
      // the form so the auto-inject actually runs; still shown as a column.
      { field: 'company', label: 'الاسم', inForm: false },
      { field: 'ramadan_start', label: 'تاريخ البداية', type: 'date' },
      { field: 'ramadan_end', label: 'تاريخ النهاية', type: 'date' },
      { field: '_status_label', label: 'الحالة', inForm: false, statusDot: { on: 'نشط', onLabel: 'نشط', offLabel: 'غير نشط' } },
      { field: 'reduced_daily_hours', label: 'ساعات العمل المخفّضة', type: 'number', inTable: false },
    ],
  },

  // Apex M5 (hr/locations): module-page.tsx renders the bespoke
  // components/hr/locations-page.tsx for this id (map picker + radius +
  // status, base_meena.api.hr_locations) — this entry is kept only as a
  // schema reference (and a safety-net fallback if the bespoke page is ever
  // unregistered) and is otherwise dead code.
  locations: {
    kind: 'list',
    title: 'المواقع',
    subtitle: 'مواقع تسجيل الحضور من الجوال',
    doctype: 'Location',
    orderBy: 'location_name asc',
    filters: [['is_group', '=', 0]],
    addLabel: 'اضافة موقع',
    searchPlaceholder: 'إبحث بإسم الموقع',
    actionsMenu: true,
    active: { field: 'custom_status', on: 'Active', off: 'Inactive' },
    noIndex: true,
    print: false,
    nameField: 'location_name',
    fields: [
      { field: 'location_name', label: 'اسم الموقع', required: true },
      { field: 'parent_location', label: 'مجموعة المواقع' },
      { field: 'latitude', label: 'خط العرض', type: 'number' },
      { field: 'longitude', label: 'خط الطول', type: 'number' },
      { field: 'custom_radius_m', label: 'نطاق الموقع بالمتر', type: 'number' },
      {
        field: 'custom_status', label: 'الحالة', type: 'select', options: ['Active', 'Inactive'],
        statusDot: { on: 'Active', onLabel: 'نشط', offLabel: 'غير نشط' },
      },
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
