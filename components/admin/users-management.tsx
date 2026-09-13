'use client'

import { useState, useEffect, useCallback } from 'react'
import { frappeClient, FrappeUser, SystemRoleGroup } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
    Users, Search, Loader2, UserCheck, UserX, Shield, ChevronDown,
    ChevronUp, RefreshCw, Mail, Clock, Calendar, X,
    Plus, Building2, KeyRound, Trash2, Eye, EyeOff, UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'

// System icons & colors
const SYSTEM_META: Record<string, { icon: string; color: string; bg: string; border: string }> = {
    hr: { icon: '👥', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    sales: { icon: '💰', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
    purchasing: { icon: '🛒', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    inventory: { icon: '📦', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
    accounting: { icon: '📊', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
    manufacturing: { icon: '🏭', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
    projects: { icon: '📋', color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-200' },
    support: { icon: '🎧', color: 'text-pink-700', bg: 'bg-pink-50', border: 'border-pink-200' },
    quality: { icon: '✅', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    website: { icon: '🌐', color: 'text-cyan-700', bg: 'bg-cyan-50', border: 'border-cyan-200' },
    admin: { icon: '⚙️', color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
    cashier: { icon: '🧾', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    none: { icon: '❓', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
}

export function AdminUsersManagement() {
    const { isRTL } = useI18n()
    const { toast } = useToast()
    const [loading, setLoading] = useState(true)
    const [apiError, setApiError] = useState(false)
    const [users, setUsers] = useState<FrappeUser[]>([])
    const [rolesMap, setRolesMap] = useState<Record<string, SystemRoleGroup>>({})
    const [search, setSearch] = useState('')
    const [filterSystem, setFilterSystem] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'disabled'>('all')
    const [expandedUser, setExpandedUser] = useState<string | null>(null)
    const [managingRoles, setManagingRoles] = useState<string | null>(null)
    const [collapsedSystems, setCollapsedSystems] = useState<Set<string>>(new Set())

    // Create user
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [createForm, setCreateForm] = useState({ email: '', full_name: '', password: '' })
    const [createRoles, setCreateRoles] = useState<string[]>(['HR User', 'Employee'])
    const [creating, setCreating] = useState(false)
    const [showCreatePassword, setShowCreatePassword] = useState(false)

    // Change password
    const [passwordDialog, setPasswordDialog] = useState<string | null>(null)
    const [newPassword, setNewPassword] = useState('')
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [changingPassword, setChangingPassword] = useState(false)

    // Delete user
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
    const [deleting, setDeleting] = useState(false)

    const loadUsers = useCallback(async () => {
        setLoading(true)
        setApiError(false)
        try {
            const [usersData, rolesMapData] = await Promise.all([
                frappeClient.getUsers(),
                frappeClient.getSystemRolesMap(),
            ])
            setUsers(usersData)
            setRolesMap(rolesMapData)
        } catch (error) {
            console.error('Error loading users:', error)
            setApiError(true)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadUsers() }, [loadUsers])

    const handleToggleUser = async (user: string, currentEnabled: number) => {
        const result = await frappeClient.toggleUser(user, !currentEnabled)
        if (result.success) {
            setUsers(prev => prev.map(u => u.name === user ? { ...u, enabled: currentEnabled ? 0 : 1 } : u))
            toast({ title: currentEnabled ? (isRTL ? 'تم تعطيل المستخدم' : 'User Disabled') : (isRTL ? 'تم تفعيل المستخدم' : 'User Enabled') })
        }
    }

    const handleAddRole = async (user: string, role: string) => {
        const result = await frappeClient.addUserRole(user, role)
        if (result.success) {
            setUsers(prev => prev.map(u => {
                if (u.name !== user) return u
                const newRoles = [...(u.roles || []), role]
                return { ...u, roles: newRoles, systems: getSystemsForRoles(newRoles) }
            }))
            toast({ title: isRTL ? 'تمت إضافة الدور' : 'Role added' })
        }
    }

    const handleRemoveRole = async (user: string, role: string) => {
        const result = await frappeClient.removeUserRole(user, role)
        if (result.success) {
            setUsers(prev => prev.map(u => {
                if (u.name !== user) return u
                const newRoles = (u.roles || []).filter(r => r !== role)
                return { ...u, roles: newRoles, systems: getSystemsForRoles(newRoles) }
            }))
            toast({ title: isRTL ? 'تم إزالة الدور' : 'Role removed' })
        }
    }

    const handleCreateUser = async () => {
        if (!createForm.email || !createForm.full_name || !createForm.password) {
            toast({ title: isRTL ? 'أكمل جميع الحقول المطلوبة' : 'Fill all required fields', variant: 'destructive' })
            return
        }
        setCreating(true)
        try {
            const result = await frappeClient.createUser(createForm.email, createForm.full_name, createForm.password, createRoles)
            if (result.success) {
                toast({ title: isRTL ? 'تم إنشاء المستخدم بنجاح' : 'User created successfully' })
                setShowCreateDialog(false)
                setCreateForm({ email: '', full_name: '', password: '' })
                setCreateRoles(['HR User', 'Employee'])
                loadUsers()
            } else {
                toast({ title: isRTL ? 'فشل إنشاء المستخدم' : 'Failed to create user', variant: 'destructive' })
            }
        } catch (error) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: String(error), variant: 'destructive' })
        } finally {
            setCreating(false)
        }
    }

    const handleChangePassword = async () => {
        if (!passwordDialog || !newPassword) return
        setChangingPassword(true)
        try {
            const result = await frappeClient.changeUserPassword(passwordDialog, newPassword)
            if (result.success) {
                toast({ title: isRTL ? 'تم تغيير كلمة المرور' : 'Password changed successfully' })
                setPasswordDialog(null)
                setNewPassword('')
            } else {
                toast({ title: isRTL ? 'فشل تغيير كلمة المرور' : 'Failed to change password', variant: 'destructive' })
            }
        } catch (error) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: String(error), variant: 'destructive' })
        } finally {
            setChangingPassword(false)
        }
    }

    const handleDeleteUser = async () => {
        if (!deleteConfirm) return
        setDeleting(true)
        try {
            const result = await frappeClient.deleteUser(deleteConfirm)
            if (result.success) {
                setUsers(prev => prev.filter(u => u.name !== deleteConfirm))
                toast({ title: isRTL ? 'تم حذف المستخدم' : 'User deleted' })
                setDeleteConfirm(null)
            } else {
                toast({ title: isRTL ? 'فشل حذف المستخدم' : 'Failed to delete user', variant: 'destructive' })
            }
        } catch (error) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: String(error), variant: 'destructive' })
        } finally {
            setDeleting(false)
        }
    }

    const getSystemsForRoles = (userRoles: string[]): string[] => {
        const systems: string[] = []
        for (const [sysId, sysData] of Object.entries(rolesMap)) {
            if (sysData.roles.some(r => userRoles.includes(r))) systems.push(sysId)
        }
        return systems.length > 0 ? systems : ['none']
    }

    // Build system-based user groups (deduplicated)
    const systemGroups = (() => {
        const groups: Record<string, FrappeUser[]> = {}
        const allSystems = Object.keys(rolesMap)
        allSystems.forEach(s => { groups[s] = [] })
        groups['none'] = []

        users.forEach(user => {
            const systems = user.systems || ['none']
            // Get the primary system (first one)
            const primarySystem = systems[0] || 'none'
            if (!groups[primarySystem]) groups[primarySystem] = []
            groups[primarySystem].push(user)
        })
        return groups
    })()

    // Filter users within each system group
    const getFilteredUsersForSystem = (systemUsers: FrappeUser[]) => {
        return systemUsers.filter(user => {
            const matchSearch = !search || user.full_name?.toLowerCase().includes(search.toLowerCase()) || user.email?.toLowerCase().includes(search.toLowerCase())
            const matchStatus = filterStatus === 'all' || (filterStatus === 'active' && user.enabled) || (filterStatus === 'disabled' && !user.enabled)
            return matchSearch && matchStatus
        })
    }

    const toggleSystemCollapse = (systemId: string) => {
        setCollapsedSystems(prev => {
            const next = new Set(prev)
            if (next.has(systemId)) {
                next.delete(systemId)
            } else {
                next.add(systemId)
            }
            return next
        })
    }

    const activeCount = users.filter(u => u.enabled).length
    const disabledCount = users.filter(u => !u.enabled).length

    const formatDate = (date?: string) => {
        if (!date) return '-'
        try { return new Date(date).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
        catch { return date }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">{isRTL ? 'جاري تحميل المستخدمين...' : 'Loading users...'}</p>
                </div>
            </div>
        )
    }

    if (apiError) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                    <Shield className="h-10 w-10 text-red-300 mx-auto mb-3" />
                    <h3 className="text-sm font-semibold text-red-800 mb-1">{isRTL ? 'صلاحية غير كافية' : 'Insufficient Permissions'}</h3>
                    <p className="text-xs text-red-600 mb-3">{isRTL ? 'تحتاج دور System Manager أو HR Manager' : 'You need System Manager or HR Manager role'}</p>
                    <Button variant="outline" size="sm" onClick={loadUsers} className="gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" />
                        {isRTL ? 'إعادة المحاولة' : 'Retry'}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-600" />
                        {isRTL ? 'إدارة المستخدمين' : 'Users Management'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">{isRTL ? 'إدارة المستخدمين حسب النظام والأدوار' : 'Manage users by system and roles'}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadUsers} className="gap-1.5">
                        <RefreshCw className="h-3.5 w-3.5" />
                        {isRTL ? 'تحديث' : 'Refresh'}
                    </Button>
                    <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
                        <UserPlus className="h-3.5 w-3.5" />
                        {isRTL ? 'مستخدم جديد' : 'New User'}
                    </Button>
                </div>
            </div>

            {/* System Filter Pills */}
            <div className="space-y-2">
                <p className="text-[10px] font-medium text-gray-400 uppercase">{isRTL ? 'عرض سريع' : 'Quick view'}</p>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setFilterSystem(null)}
                        className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all',
                            !filterSystem ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
                        <Users className="h-3 w-3" />
                        {isRTL ? 'جميع الأنظمة' : 'All Systems'} ({users.length})
                    </button>
                    {Object.entries(rolesMap).map(([sysId, sysData]) => {
                        const meta = SYSTEM_META[sysId] || SYSTEM_META.none
                        const count = systemGroups[sysId]?.length || 0
                        if (count === 0) return null
                        return (
                            <button key={sysId} onClick={() => setFilterSystem(filterSystem === sysId ? null : sysId)}
                                className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all',
                                    filterSystem === sysId
                                        ? `${meta.bg} ${meta.color} ${meta.border}`
                                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300')}>
                                <span>{meta.icon}</span>
                                {isRTL ? sysData.label_ar : sysData.label} ({count})
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Stats + Search Bar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder={isRTL ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
                        className="w-full text-sm border border-gray-200 rounded-lg pl-10 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                            <X className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600" />
                        </button>
                    )}
                </div>
                <div className="flex gap-1 bg-gray-100 p-0.5 rounded-lg">
                    {(['all', 'active', 'disabled'] as const).map(status => (
                        <button key={status} onClick={() => setFilterStatus(status)}
                            className={cn('text-xs font-medium px-2.5 py-1.5 rounded-md transition-all',
                                filterStatus === status ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                            {status === 'all' ? (isRTL ? `الكل (${users.length})` : `All (${users.length})`) :
                                status === 'active' ? (isRTL ? `مفعّل (${activeCount})` : `Active (${activeCount})`) :
                                    (isRTL ? `معطّل (${disabledCount})` : `Disabled (${disabledCount})`)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Users List - Grouped by System */}
            <div className="space-y-4">
                {filterSystem ? (
                    // Show only selected system
                    (() => {
                        const systemUsers = getFilteredUsersForSystem(systemGroups[filterSystem] || [])
                        const meta = SYSTEM_META[filterSystem] || SYSTEM_META.none
                        const sysData = rolesMap[filterSystem]

                        return (
                            <div className="space-y-2">
                                <div className={cn('flex items-center justify-between p-3 rounded-lg border', meta.bg, meta.border)}>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">{meta.icon}</span>
                                        <div>
                                            <p className={cn('text-sm font-semibold', meta.color)}>
                                                {isRTL ? sysData?.label_ar : sysData?.label}
                                            </p>
                                            <p className="text-[10px] text-gray-500">
                                                {systemUsers.length} {isRTL ? 'مستخدم' : 'users'}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => setFilterSystem(null)} className="text-gray-400 hover:text-gray-600">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                {systemUsers.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Users className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                        <p className="text-sm text-gray-400">{isRTL ? 'لا يوجد مستخدمين' : 'No users found'}</p>
                                    </div>
                                ) : (
                                    systemUsers.map(user => renderUserRow(user))
                                )}
                            </div>
                        )
                    })()
                ) : (
                    // Show all systems with their users
                    (() => {
                        const systemsToShow = Object.entries(rolesMap)
                            .map(([sysId, sysData]) => ({
                                id: sysId,
                                data: sysData,
                                users: getFilteredUsersForSystem(systemGroups[sysId] || [])
                            }))
                            .filter(sys => sys.users.length > 0)

                        // Add "none" system if it has users
                        const noneUsers = getFilteredUsersForSystem(systemGroups['none'] || [])
                        if (noneUsers.length > 0) {
                            systemsToShow.push({
                                id: 'none',
                                data: { label: 'No System', label_ar: 'بدون نظام', roles: [], color: '#6B7280' },
                                users: noneUsers
                            })
                        }

                        if (systemsToShow.length === 0) {
                            return (
                                <div className="text-center py-12">
                                    <Users className="h-10 w-10 text-gray-200 mx-auto mb-2" />
                                    <p className="text-sm text-gray-400">{isRTL ? 'لا يوجد مستخدمين' : 'No users found'}</p>
                                </div>
                            )
                        }

                        return systemsToShow.map(({ id: sysId, data: sysData, users: systemUsers }) => {
                            const meta = SYSTEM_META[sysId] || SYSTEM_META.none
                            const isCollapsed = collapsedSystems.has(sysId)

                            return (
                                <div key={sysId} className={cn('rounded-xl border-2 overflow-hidden transition-all', meta.border, meta.bg)}>
                                    {/* System Header */}
                                    <button
                                        onClick={() => toggleSystemCollapse(sysId)}
                                        className="w-full flex items-center justify-between p-4 hover:opacity-80 transition-opacity"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{meta.icon}</span>
                                            <div className="text-left">
                                                <p className={cn('text-base font-bold', meta.color)}>
                                                    {isRTL ? sysData.label_ar : sysData.label}
                                                </p>
                                                <p className="text-[11px] text-gray-500">
                                                    {systemUsers.length} {isRTL ? 'مستخدم' : 'users'} • {sysData.roles.length} {isRTL ? 'دور' : 'roles'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={cn('text-xs font-bold px-2 py-1 rounded-full', meta.color, 'bg-white')}>
                                                {systemUsers.length}
                                            </span>
                                            {isCollapsed ? (
                                                <ChevronDown className={cn('h-5 w-5', meta.color)} />
                                            ) : (
                                                <ChevronUp className={cn('h-5 w-5', meta.color)} />
                                            )}
                                        </div>
                                    </button>

                                    {/* System Users */}
                                    {!isCollapsed && (
                                        <div className="bg-white px-3 pb-3 space-y-2">
                                            {systemUsers.map(user => renderUserRow(user))}
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    })()
                )}
            </div>

            {/* Dialogs */}
            <CreateUserDialog
                open={showCreateDialog}
                onClose={() => { setShowCreateDialog(false); setCreateForm({ email: '', full_name: '', password: '' }); setCreateRoles(['HR User', 'Employee']) }}
                isRTL={isRTL} rolesMap={rolesMap}
                createForm={createForm} setCreateForm={setCreateForm}
                createRoles={createRoles} setCreateRoles={setCreateRoles}
                creating={creating} showPassword={showCreatePassword} setShowPassword={setShowCreatePassword}
                onSubmit={handleCreateUser}
            />
            <ChangePasswordDialog
                user={passwordDialog}
                onClose={() => { setPasswordDialog(null); setNewPassword('') }}
                isRTL={isRTL} newPassword={newPassword} setNewPassword={setNewPassword}
                showPassword={showNewPassword} setShowPassword={setShowNewPassword}
                changing={changingPassword} onSubmit={handleChangePassword}
            />
            <DeleteUserDialog
                user={deleteConfirm}
                users={users}
                onClose={() => setDeleteConfirm(null)}
                isRTL={isRTL} deleting={deleting} onSubmit={handleDeleteUser}
            />
        </div>
    )

    // Helper function to render a user row
    function renderUserRow(user: FrappeUser) {
        return (
            <div key={user.name} className={cn('bg-white rounded-xl border transition-all', !user.enabled ? 'border-red-100 bg-red-50/30' : 'border-gray-200')}>
                {/* User Row */}
                <div className="flex items-center gap-3 p-3">
                    {/* Avatar */}
                    <div className={cn('h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0', user.enabled ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-400')}>
                        {user.user_image ? (
                            <img src={user.user_image.startsWith('http') ? user.user_image : `${process.env.NEXT_PUBLIC_FRAPPE_URL}${user.user_image}`} alt="" className="h-9 w-9 rounded-full object-cover" />
                        ) : (
                            (user.full_name || 'U').charAt(0).toUpperCase()
                        )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className={cn('text-sm font-semibold truncate', !user.enabled && 'text-gray-400 line-through')}>{user.full_name || user.name}</p>
                            {!user.enabled && <span className="text-[9px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">{isRTL ? 'معطّل' : 'DISABLED'}</span>}
                        </div>
                        <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
                    </div>

                    {/* System Tags */}
                    <div className="hidden sm:flex items-center gap-1 flex-wrap justify-end max-w-[200px]">
                        {(user.systems || []).slice(0, 3).map(sys => {
                            const meta = SYSTEM_META[sys] || SYSTEM_META.none
                            const sysData = rolesMap[sys]
                            return (
                                <span key={sys} className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded-full border', meta.bg, meta.color, meta.border)}>
                                    {meta.icon} {isRTL ? sysData?.label_ar : sysData?.label || sys}
                                </span>
                            )
                        })}
                        {(user.systems || []).length > 3 && (
                            <span className="text-[9px] text-gray-400">+{(user.systems || []).length - 3}</span>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => { setPasswordDialog(user.name); setNewPassword(''); setShowNewPassword(false) }}
                            className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-400 hover:text-amber-600 transition-colors"
                            title={isRTL ? 'تغيير كلمة المرور' : 'Change Password'}>
                            <KeyRound className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleToggleUser(user.name, user.enabled)}
                            className={cn('p-1.5 rounded-lg transition-colors', user.enabled ? 'hover:bg-red-50 text-red-400 hover:text-red-600' : 'hover:bg-green-50 text-green-400 hover:text-green-600')}
                            title={user.enabled ? (isRTL ? 'تعطيل' : 'Disable') : (isRTL ? 'تفعيل' : 'Enable')}>
                            {user.enabled ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                        </button>
                        <button onClick={() => setDeleteConfirm(user.name)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                            title={isRTL ? 'حذف المستخدم' : 'Delete User'}>
                            <Trash2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => { setExpandedUser(expandedUser === user.name ? null : user.name); setManagingRoles(null) }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
                            {expandedUser === user.name ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                {/* Expanded Details */}
                {expandedUser === user.name && (
                    <div className="border-t border-gray-100 p-3 space-y-3">
                        {/* Meta Info */}
                        <div className="flex flex-wrap gap-4 text-[11px] text-gray-500">
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {user.email}</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {isRTL ? 'إنشاء:' : 'Created:'} {formatDate(user.creation)}</span>
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {isRTL ? 'آخر نشاط:' : 'Last active:'} {formatDate(user.last_active)}</span>
                            <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {user.user_type}</span>
                        </div>

                        {/* Systems this user belongs to */}
                        <div>
                            <p className="text-[10px] font-medium text-gray-400 uppercase mb-1.5">{isRTL ? 'الأنظمة' : 'Systems'}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {(user.systems || []).map(sys => {
                                    const meta = SYSTEM_META[sys] || SYSTEM_META.none
                                    const sysData = rolesMap[sys]
                                    return (
                                        <span key={sys} className={cn('text-[10px] font-medium px-2 py-1 rounded-lg border', meta.bg, meta.color, meta.border)}>
                                            {meta.icon} {isRTL ? sysData?.label_ar : sysData?.label || sys}
                                        </span>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Roles grouped by system */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[10px] font-medium text-gray-400 uppercase">{isRTL ? 'الأدوار' : 'Roles'} ({(user.roles || []).length})</p>
                                <button onClick={() => setManagingRoles(managingRoles === user.name ? null : user.name)}
                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                                    <Shield className="h-3 w-3" />
                                    {managingRoles === user.name ? (isRTL ? 'إغلاق' : 'Close') : (isRTL ? 'إدارة الأدوار' : 'Manage Roles')}
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {(user.roles || []).filter(r => !['All', 'Guest', 'Desk User'].includes(r)).map(role => {
                                    // Find which system this role belongs to
                                    let roleSys = 'none'
                                    for (const [sysId, sysData] of Object.entries(rolesMap)) {
                                        if (sysData.roles.includes(role)) { roleSys = sysId; break }
                                    }
                                    const meta = SYSTEM_META[roleSys] || SYSTEM_META.none
                                    return (
                                        <span key={role} className={cn('text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1', meta.bg, meta.color, meta.border)}>
                                            {role}
                                            {managingRoles === user.name && (
                                                <button onClick={() => handleRemoveRole(user.name, role)} className="hover:text-red-600 ml-0.5">
                                                    <X className="h-2.5 w-2.5" />
                                                </button>
                                            )}
                                        </span>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Role Manager */}
                        {managingRoles === user.name && (
                            <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-3">
                                <p className="text-[10px] font-medium text-indigo-600 uppercase mb-2">{isRTL ? 'إضافة دور جديد' : 'Add a role'}</p>
                                <div className="space-y-2">
                                    {Object.entries(rolesMap).map(([sysId, sysData]) => {
                                        const availableRoles = sysData.roles.filter(r => !(user.roles || []).includes(r))
                                        if (availableRoles.length === 0) return null
                                        const meta = SYSTEM_META[sysId] || SYSTEM_META.none
                                        return (
                                            <div key={sysId}>
                                                <p className={cn('text-[10px] font-medium mb-1', meta.color)}>
                                                    {meta.icon} {isRTL ? sysData.label_ar : sysData.label}
                                                </p>
                                                <div className="flex flex-wrap gap-1">
                                                    {availableRoles.map(role => (
                                                        <button key={role} onClick={() => handleAddRole(user.name, role)}
                                                            className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center gap-1 transition-colors">
                                                            <Plus className="h-2.5 w-2.5" /> {role}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }
}

function CreateUserDialog({
    open, onClose, isRTL, rolesMap, createForm, setCreateForm,
    createRoles, setCreateRoles, creating, showPassword, setShowPassword, onSubmit
}: {
    open: boolean; onClose: () => void; isRTL: boolean
    rolesMap: Record<string, SystemRoleGroup>
    createForm: { email: string; full_name: string; password: string }
    setCreateForm: (f: any) => void
    createRoles: string[]; setCreateRoles: (r: string[]) => void
    creating: boolean; showPassword: boolean; setShowPassword: (v: boolean) => void
    onSubmit: () => void
}) {
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-indigo-600" />
                        {isRTL ? 'مستخدم جديد' : 'New User'}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'الاسم الكامل *' : 'Full Name *'}</label>
                        <input type="text" value={createForm.full_name}
                            onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                            placeholder={isRTL ? 'محمد أحمد' : 'John Doe'} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'البريد الإلكتروني *' : 'Email *'}</label>
                        <input type="email" value={createForm.email}
                            onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                            placeholder="user@example.com" dir="ltr" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'كلمة المرور *' : 'Password *'}</label>
                        <div className="relative">
                            <input type={showPassword ? 'text' : 'password'} value={createForm.password}
                                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                dir="ltr" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-2 block">{isRTL ? 'الأدوار (اختياري)' : 'Roles (optional)'}</label>
                        <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-100 rounded-lg p-2">
                            {Object.entries(rolesMap).map(([sysId, sysData]) => {
                                const meta = SYSTEM_META[sysId] || SYSTEM_META.none
                                return (
                                    <div key={sysId}>
                                        <p className={cn('text-[10px] font-medium mb-1', meta.color)}>
                                            {meta.icon} {isRTL ? sysData.label_ar : sysData.label}
                                        </p>
                                        <div className="flex flex-wrap gap-1">
                                            {sysData.roles.map(role => {
                                                const selected = createRoles.includes(role)
                                                return (
                                                    <button key={role} type="button"
                                                        onClick={() => setCreateRoles(selected ? createRoles.filter(r => r !== role) : [...createRoles, role])}
                                                        className={cn('text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                                                            selected ? `${meta.bg} ${meta.color} ${meta.border}` : 'border-dashed border-gray-300 text-gray-500 hover:border-indigo-400 hover:text-indigo-600')}>
                                                        {selected ? '✓ ' : ''}{role}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                    <Button onClick={onSubmit} disabled={creating} className="gap-1.5 bg-indigo-600 hover:bg-indigo-700">
                        {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                        {isRTL ? 'إنشاء' : 'Create'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function ChangePasswordDialog({
    user, onClose, isRTL, newPassword, setNewPassword,
    showPassword, setShowPassword, changing, onSubmit
}: {
    user: string | null; onClose: () => void; isRTL: boolean
    newPassword: string; setNewPassword: (v: string) => void
    showPassword: boolean; setShowPassword: (v: boolean) => void
    changing: boolean; onSubmit: () => void
}) {
    return (
        <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5 text-amber-600" />
                        {isRTL ? 'تغيير كلمة المرور' : 'Change Password'}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 font-mono" dir="ltr">{user}</p>
                    <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">{isRTL ? 'كلمة المرور الجديدة' : 'New Password'}</label>
                        <div className="relative">
                            <input type={showPassword ? 'text' : 'password'} value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && newPassword && onSubmit()}
                                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                                dir="ltr" autoFocus />
                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                    <Button onClick={onSubmit} disabled={changing || !newPassword} className="gap-1.5 bg-amber-600 hover:bg-amber-700">
                        {changing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                        {isRTL ? 'تغيير' : 'Change'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function DeleteUserDialog({
    user, users, onClose, isRTL, deleting, onSubmit
}: {
    user: string | null; users: FrappeUser[]; onClose: () => void
    isRTL: boolean; deleting: boolean; onSubmit: () => void
}) {
    const userData = users.find(u => u.name === user)
    return (
        <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-red-600">
                        <Trash2 className="h-5 w-5" />
                        {isRTL ? 'حذف المستخدم' : 'Delete User'}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-xs text-red-700 font-medium mb-1">
                            {isRTL ? 'هل أنت متأكد من حذف هذا المستخدم نهائياً؟' : 'Are you sure you want to permanently delete this user?'}
                        </p>
                        <p className="text-[11px] text-red-500">
                            {isRTL ? 'لا يمكن التراجع عن هذا الإجراء.' : 'This action cannot be undone.'}
                        </p>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                        <div className="h-9 w-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-sm font-bold">
                            {(userData?.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-800">{userData?.full_name || user}</p>
                            <p className="text-[11px] text-gray-400">{userData?.email || user}</p>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>{isRTL ? 'إلغاء' : 'Cancel'}</Button>
                    <Button onClick={onSubmit} disabled={deleting} variant="destructive" className="gap-1.5">
                        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        {isRTL ? 'حذف نهائي' : 'Delete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}