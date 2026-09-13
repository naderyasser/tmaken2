'use client'

import { useState, useEffect, useCallback } from 'react'
import { permissionsApi, PERM_TYPES, type PermissionRule } from '@/lib/permissions-api'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  Shield, Search, Loader2, RefreshCw, Plus, Trash2,
  ChevronDown, Users, FileText, AlertTriangle, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

export function AdminRolePermissions() {
  const { isRTL } = useI18n()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<string[]>([])
  const [doctypes, setDoctypes] = useState<string[]>([])
  const [selectedDoctype, setSelectedDoctype] = useState<string>('')
  const [permissions, setPermissions] = useState<PermissionRule[]>([])
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [updating, setUpdating] = useState<string | null>(null)
  const [doctypeSearch, setDoctypeSearch] = useState('')
  const [roleSearch, setRoleSearch] = useState('')

  // Add rule dialog
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [addRole, setAddRole] = useState('')
  const [addRoleSearch, setAddRoleSearch] = useState('')
  const [adding, setAdding] = useState(false)

  // Reset confirm
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ role: string; permlevel: number } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Users with role
  const [viewUsersRole, setViewUsersRole] = useState<string | null>(null)
  const [roleUsers, setRoleUsers] = useState<string[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  // Load roles & doctypes on mount
  useEffect(() => {
    loadRolesAndDoctypes()
  }, [])

  const loadRolesAndDoctypes = async () => {
    setLoading(true)
    try {
      const data = await permissionsApi.getRolesAndDoctypes()
      setRoles(data.roles || [])
      setDoctypes(data.doctypes || [])
    } catch (err) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحميل البيانات' : 'Failed to load data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const loadPermissions = useCallback(async (doctype: string) => {
    if (!doctype) return
    setLoadingPerms(true)
    try {
      const data = await permissionsApi.getPermissions(doctype)
      setPermissions(data)
    } catch (err) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحميل الصلاحيات' : 'Failed to load permissions',
        variant: 'destructive',
      })
    } finally {
      setLoadingPerms(false)
    }
  }, [isRTL, toast])

  const handleSelectDoctype = (doctype: string) => {
    setSelectedDoctype(doctype)
    setRoleSearch('')
    loadPermissions(doctype)
  }

  const handleTogglePermission = async (rule: PermissionRule, ptype: string, currentValue: number) => {
    const newValue = currentValue ? 0 : 1
    const key = `${rule.role}-${rule.permlevel}-${ptype}`
    setUpdating(key)
    try {
      await permissionsApi.updatePermission(
        selectedDoctype,
        rule.role,
        rule.permlevel,
        ptype,
        newValue,
        rule.if_owner
      )
      // Update local state
      setPermissions(prev =>
        prev.map(p =>
          p.role === rule.role && p.permlevel === rule.permlevel && p.if_owner === rule.if_owner
            ? { ...p, [ptype]: newValue }
            : p
        )
      )
    } catch (err) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحديث الصلاحية' : 'Failed to update permission',
        variant: 'destructive',
      })
    } finally {
      setUpdating(null)
    }
  }

  const handleAddRule = async () => {
    if (!addRole || !selectedDoctype) return
    setAdding(true)
    try {
      await permissionsApi.addPermission(selectedDoctype, addRole)
      toast({
        title: isRTL ? 'تم' : 'Done',
        description: isRTL ? `تمت إضافة صلاحية ${addRole}` : `Added permission for ${addRole}`,
      })
      setShowAddDialog(false)
      setAddRole('')
      setAddRoleSearch('')
      loadPermissions(selectedDoctype)
    } catch (err) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في إضافة الصلاحية' : 'Failed to add permission rule',
        variant: 'destructive',
      })
    } finally {
      setAdding(false)
    }
  }

  const handleDeleteRule = async () => {
    if (!deleteTarget || !selectedDoctype) return
    setDeleting(true)
    try {
      await permissionsApi.removePermission(selectedDoctype, deleteTarget.role, deleteTarget.permlevel)
      toast({
        title: isRTL ? 'تم الحذف' : 'Deleted',
        description: isRTL ? `تم حذف صلاحية ${deleteTarget.role}` : `Removed permission for ${deleteTarget.role}`,
      })
      setDeleteTarget(null)
      loadPermissions(selectedDoctype)
    } catch (err) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في حذف الصلاحية' : 'Failed to remove permission rule',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  const handleReset = async () => {
    if (!selectedDoctype) return
    setResetting(true)
    try {
      await permissionsApi.resetPermissions(selectedDoctype)
      toast({
        title: isRTL ? 'تم' : 'Done',
        description: isRTL ? 'تم إعادة تعيين الصلاحيات للإعدادات الافتراضية' : 'Permissions reset to defaults',
      })
      setShowResetConfirm(false)
      loadPermissions(selectedDoctype)
    } catch (err) {
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في إعادة التعيين' : 'Failed to reset permissions',
        variant: 'destructive',
      })
    } finally {
      setResetting(false)
    }
  }

  const handleViewUsers = async (role: string) => {
    setViewUsersRole(role)
    setLoadingUsers(true)
    try {
      const users = await permissionsApi.getUsersWithRole(role)
      setRoleUsers(users)
    } catch {
      setRoleUsers([])
    } finally {
      setLoadingUsers(false)
    }
  }

  const filteredDoctypes = doctypeSearch
    ? doctypes.filter(d => d.toLowerCase().includes(doctypeSearch.toLowerCase()))
    : doctypes

  const filteredPermissions = roleSearch
    ? permissions.filter(p => p.role.toLowerCase().includes(roleSearch.toLowerCase()))
    : permissions

  const filteredAddRoles = addRoleSearch
    ? roles.filter(r => r.toLowerCase().includes(addRoleSearch.toLowerCase()))
    : roles

  // Existing roles for this doctype (to filter in add dialog)
  const existingRoles = new Set(permissions.map(p => p.role))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Shield className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isRTL ? 'مدير الصلاحيات' : 'Role Permission Manager'}
            </h1>
            <p className="text-sm text-gray-500">
              {isRTL ? 'إدارة صلاحيات الأدوار على المستندات' : 'Manage role permissions on doctypes'}
            </p>
          </div>
        </div>
      </div>

      {/* Doctype Selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          {isRTL ? 'اختر نوع المستند' : 'Select Document Type'}
        </label>
        <div className="relative">
          <Search className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400", isRTL ? "right-3" : "left-3")} />
          <input
            type="text"
            value={doctypeSearch}
            onChange={e => setDoctypeSearch(e.target.value)}
            placeholder={isRTL ? 'ابحث عن مستند...' : 'Search doctype...'}
            className={cn(
              "w-full h-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
              isRTL ? "pr-10 pl-3" : "pl-10 pr-3"
            )}
          />
        </div>
        {doctypeSearch && (
          <div className="mt-2 max-h-60 overflow-auto border border-gray-200 rounded-lg bg-white shadow-lg">
            {filteredDoctypes.length === 0 ? (
              <p className="p-3 text-sm text-gray-400 text-center">
                {isRTL ? 'لا توجد نتائج' : 'No results'}
              </p>
            ) : (
              filteredDoctypes.slice(0, 50).map(dt => (
                <button
                  key={dt}
                  onClick={() => {
                    handleSelectDoctype(dt)
                    setDoctypeSearch('')
                  }}
                  className={cn(
                    "w-full text-start px-4 py-2.5 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors border-b border-gray-50 last:border-0",
                    selectedDoctype === dt ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-700"
                  )}
                >
                  <FileText className="h-3.5 w-3.5 inline-block me-2 opacity-50" />
                  {dt}
                </button>
              ))
            )}
          </div>
        )}
        {selectedDoctype && !doctypeSearch && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-gray-500">{isRTL ? 'المحدد:' : 'Selected:'}</span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium">
              <FileText className="h-3.5 w-3.5" />
              {selectedDoctype}
            </span>
          </div>
        )}
      </div>

      {/* Permissions Table */}
      {selectedDoctype && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="relative flex-1 max-w-xs">
                <Search className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400", isRTL ? "right-3" : "left-3")} />
                <input
                  type="text"
                  value={roleSearch}
                  onChange={e => setRoleSearch(e.target.value)}
                  placeholder={isRTL ? 'فلترة حسب الدور...' : 'Filter by role...'}
                  className={cn(
                    "w-full h-9 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500",
                    isRTL ? "pr-9 pl-3" : "pl-9 pr-3"
                  )}
                />
              </div>
              <span className="text-xs text-gray-400">
                {filteredPermissions.length} {isRTL ? 'قاعدة' : 'rules'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => loadPermissions(selectedDoctype)}
                disabled={loadingPerms}
              >
                <RefreshCw className={cn("h-3.5 w-3.5 me-1.5", loadingPerms && "animate-spin")} />
                {isRTL ? 'تحديث' : 'Refresh'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowResetConfirm(true)}
                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              >
                <RotateCcw className="h-3.5 w-3.5 me-1.5" />
                {isRTL ? 'إعادة تعيين' : 'Reset'}
              </Button>
              <Button
                size="sm"
                onClick={() => { setShowAddDialog(true); setAddRole(''); setAddRoleSearch('') }}
              >
                <Plus className="h-3.5 w-3.5 me-1.5" />
                {isRTL ? 'دور جديد' : 'New Role'}
              </Button>
            </div>
          </div>

          {/* Table */}
          {loadingPerms ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
            </div>
          ) : filteredPermissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Shield className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">{isRTL ? 'لا توجد صلاحيات لهذا المستند' : 'No permission rules for this doctype'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/80">
                    <th className={cn("px-4 py-3 font-semibold text-gray-600 sticky", isRTL ? "text-right" : "text-left")} style={{ minWidth: 160 }}>
                      {isRTL ? 'الدور' : 'Role'}
                    </th>
                    <th className="px-2 py-3 font-semibold text-gray-600 text-center" style={{ minWidth: 50 }}>
                      {isRTL ? 'مستوى' : 'Level'}
                    </th>
                    {PERM_TYPES.map(pt => (
                      <th key={pt.key} className="px-2 py-3 font-semibold text-gray-600 text-center whitespace-nowrap" style={{ minWidth: 64 }}>
                        <span className="text-[11px]">{isRTL ? pt.labelAr : pt.labelEn}</span>
                      </th>
                    ))}
                    <th className="px-3 py-3 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {filteredPermissions.map((rule, idx) => (
                    <tr key={`${rule.role}-${rule.permlevel}-${rule.if_owner}-${idx}`} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className={cn("px-4 py-2.5", isRTL ? "text-right" : "text-left")}>
                        <button
                          onClick={() => handleViewUsers(rule.role)}
                          className="flex items-center gap-2 text-sm font-medium text-gray-800 hover:text-indigo-600 transition-colors"
                        >
                          <div className="h-6 w-6 rounded-md bg-indigo-50 flex items-center justify-center flex-shrink-0">
                            <Users className="h-3 w-3 text-indigo-500" />
                          </div>
                          {rule.role}
                        </button>
                        {rule.if_owner === 1 && (
                          <span className="text-[10px] text-amber-600 font-medium mt-0.5 block">
                            {isRTL ? '(مالك فقط)' : '(If Owner)'}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <span className="inline-flex items-center justify-center h-5 w-5 rounded bg-gray-100 text-[11px] font-mono text-gray-500">
                          {rule.permlevel}
                        </span>
                      </td>
                      {PERM_TYPES.map(pt => {
                        const val = (rule as any)[pt.key] as number
                        const isUpdating = updating === `${rule.role}-${rule.permlevel}-${pt.key}`
                        return (
                          <td key={pt.key} className="px-2 py-2.5 text-center">
                            <button
                              onClick={() => handleTogglePermission(rule, pt.key, val)}
                              disabled={isUpdating}
                              className={cn(
                                "h-7 w-7 rounded-md inline-flex items-center justify-center transition-all duration-150 border",
                                val
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                                  : "bg-gray-50 border-gray-200 text-gray-300 hover:bg-gray-100 hover:text-gray-400",
                                isUpdating && "opacity-50 cursor-wait"
                              )}
                            >
                              {isUpdating ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : val ? (
                                <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                              ) : (
                                <span className="text-[10px]">—</span>
                              )}
                            </button>
                          </td>
                        )
                      })}
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => setDeleteTarget({ role: rule.role, permlevel: rule.permlevel })}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title={isRTL ? 'حذف' : 'Delete'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add Role Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isRTL ? 'دور جديد' : 'New Role Permission'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              {isRTL
                ? `إضافة صلاحية لدور جديد على ${selectedDoctype}`
                : `Add a role permission rule for ${selectedDoctype}`}
            </p>
            <div className="relative">
              <Search className={cn("absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400", isRTL ? "right-3" : "left-3")} />
              <input
                type="text"
                value={addRoleSearch}
                onChange={e => setAddRoleSearch(e.target.value)}
                placeholder={isRTL ? 'ابحث عن دور...' : 'Search roles...'}
                className={cn(
                  "w-full h-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500",
                  isRTL ? "pr-10 pl-3" : "pl-10 pr-3"
                )}
              />
            </div>
            <div className="max-h-48 overflow-auto border border-gray-200 rounded-lg">
              {filteredAddRoles.filter(r => !existingRoles.has(r)).length === 0 ? (
                <p className="p-3 text-sm text-gray-400 text-center">
                  {isRTL ? 'لا توجد أدوار متاحة' : 'No available roles'}
                </p>
              ) : (
                filteredAddRoles.filter(r => !existingRoles.has(r)).map(r => (
                  <button
                    key={r}
                    onClick={() => setAddRole(r)}
                    className={cn(
                      "w-full text-start px-4 py-2.5 text-sm border-b border-gray-50 last:border-0 transition-colors",
                      addRole === r
                        ? "bg-indigo-50 text-indigo-700 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <Users className="h-3.5 w-3.5 inline-block me-2 opacity-50" />
                    {r}
                  </button>
                ))
              )}
            </div>
            {addRole && (
              <p className="text-sm">
                <span className="text-gray-500">{isRTL ? 'المحدد:' : 'Selected:'} </span>
                <span className="font-medium text-indigo-700">{addRole}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button onClick={handleAddRule} disabled={!addRole || adding}>
              {adding && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
              {isRTL ? 'إضافة' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              {isRTL ? 'حذف الصلاحية' : 'Delete Permission'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            {isRTL
              ? `هل أنت متأكد من حذف صلاحية "${deleteTarget?.role}" على "${selectedDoctype}"؟`
              : `Remove the permission rule for "${deleteTarget?.role}" on "${selectedDoctype}"?`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button variant="destructive" onClick={handleDeleteRule} disabled={deleting}>
              {deleting && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
              {isRTL ? 'حذف' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirm Dialog */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <RotateCcw className="h-5 w-5" />
              {isRTL ? 'إعادة تعيين الصلاحيات' : 'Reset Permissions'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            {isRTL
              ? `سيتم إعادة تعيين جميع صلاحيات "${selectedDoctype}" إلى الإعدادات الافتراضية. لا يمكن التراجع.`
              : `This will reset all permissions for "${selectedDoctype}" to defaults. This cannot be undone.`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetConfirm(false)}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </Button>
            <Button
              onClick={handleReset}
              disabled={resetting}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {resetting && <Loader2 className="h-3.5 w-3.5 me-1.5 animate-spin" />}
              {isRTL ? 'إعادة تعيين' : 'Reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Users With Role Dialog */}
      <Dialog open={!!viewUsersRole} onOpenChange={() => setViewUsersRole(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-500" />
              {isRTL ? `المستخدمون بدور "${viewUsersRole}"` : `Users with role "${viewUsersRole}"`}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {loadingUsers ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
              </div>
            ) : roleUsers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                {isRTL ? 'لا يوجد مستخدمون بهذا الدور' : 'No users with this role'}
              </p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-auto">
                {roleUsers.map(u => (
                  <div key={u} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-sm">
                    <div className="h-6 w-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                      {u.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-gray-700">{u}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewUsersRole(null)}>
              {isRTL ? 'إغلاق' : 'Close'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
