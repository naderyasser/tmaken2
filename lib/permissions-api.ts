import { frappeClient } from './api-client'

const PM = 'frappe.core.page.permission_manager.permission_manager'

export interface PermissionRule {
  name: string
  parent: string
  role: string
  permlevel: number
  if_owner: number
  read: number
  write: number
  create: number
  delete: number
  submit: number
  cancel: number
  amend: number
  select: number
  print: number
  email: number
  report: number
  import: number
  export: number
  share: number
}

export const PERM_TYPES = [
  { key: 'read', labelEn: 'Read', labelAr: 'قراءة' },
  { key: 'write', labelEn: 'Write', labelAr: 'كتابة' },
  { key: 'create', labelEn: 'Create', labelAr: 'إنشاء' },
  { key: 'delete', labelEn: 'Delete', labelAr: 'حذف' },
  { key: 'submit', labelEn: 'Submit', labelAr: 'تقديم' },
  { key: 'cancel', labelEn: 'Cancel', labelAr: 'إلغاء' },
  { key: 'amend', labelEn: 'Amend', labelAr: 'تعديل' },
  { key: 'print', labelEn: 'Print', labelAr: 'طباعة' },
  { key: 'email', labelEn: 'Email', labelAr: 'بريد' },
  { key: 'report', labelEn: 'Report', labelAr: 'تقرير' },
  { key: 'import', labelEn: 'Import', labelAr: 'استيراد' },
  { key: 'export', labelEn: 'Export', labelAr: 'تصدير' },
  { key: 'share', labelEn: 'Share', labelAr: 'مشاركة' },
] as const

export const permissionsApi = {
  async getRolesAndDoctypes(): Promise<{ roles: string[]; doctypes: string[] }> {
    const res = await frappeClient.call(`${PM}.get_roles_and_doctypes`)
    const data = res.message || { roles: [], doctypes: [] }
    // Frappe may return objects with {name, ...} or plain strings — normalize to strings
    const roles = (data.roles || []).map((r: any) => typeof r === 'string' ? r : r.name || r.value || String(r))
    const doctypes = (data.doctypes || []).map((d: any) => typeof d === 'string' ? d : d.name || d.value || String(d))
    return { roles, doctypes }
  },

  async getPermissions(doctype?: string, role?: string): Promise<PermissionRule[]> {
    const args: Record<string, string> = {}
    if (doctype) args.doctype = doctype
    if (role) args.role = role
    const res = await frappeClient.call(`${PM}.get_permissions`, args)
    return res.message || []
  },

  async addPermission(parent: string, role: string, permlevel = 0): Promise<void> {
    await frappeClient.call(`${PM}.add`, { parent, role, permlevel })
  },

  async updatePermission(
    doctype: string,
    role: string,
    permlevel: number,
    ptype: string,
    value: number,
    ifOwner = 0
  ): Promise<void> {
    await frappeClient.call(`${PM}.update`, {
      doctype,
      role,
      permlevel,
      ptype,
      value: String(value),
      if_owner: ifOwner,
    })
  },

  async removePermission(doctype: string, role: string, permlevel = 0, ifOwner = 0): Promise<void> {
    await frappeClient.call(`${PM}.remove`, { doctype, role, permlevel, if_owner: ifOwner })
  },

  async resetPermissions(doctype: string): Promise<void> {
    await frappeClient.call(`${PM}.reset`, { doctype })
  },

  async getUsersWithRole(role: string): Promise<string[]> {
    const res = await frappeClient.call(`${PM}.get_users_with_role`, { role })
    return res.message || []
  },
}
