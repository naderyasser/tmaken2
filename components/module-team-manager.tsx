'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useI18n } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { csrfFetch } from '@/lib/csrf'
import { frappeApiUrl } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    Search, Plus, RefreshCw, UserPlus, UserMinus, Shield, ShieldCheck,
    Users, Loader2, ChevronDown, Check, AlertCircle,
} from 'lucide-react'

// ═══════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════

export interface ModuleRoleConfig {
    /** Module identifier for display and theming */
    moduleId: 'hr' | 'inventory' | 'admin' | 'sales'
    /** Module display names */
    moduleNameEn: string
    moduleNameAr: string
    /** Accent color class (e.g., 'blue', 'orange', 'indigo') */
    accentColor: string
    /** Available roles the user can choose from when adding someone */
    roles: Array<{
        role: string
        labelEn: string
        labelAr: string
        description?: string
        descriptionAr?: string
        /** Is this a manager-level role? Affects badge coloring */
        isManager?: boolean
    }>
    /** Roles that are always added alongside the selected role (e.g., Employee for HR) */
    alwaysIncludeRoles?: string[]
    /** Roles that should be removed when unlinking (all roles from this module) */
    allModuleRoles: string[]
}

interface TeamMember {
    email: string
    full_name: string
    user_image?: string
    enabled: boolean
    roles: string[]
    employee?: string
    employee_name?: string
}

// ═══════════════════════════════════════════════
// PREDEFINED MODULE CONFIGS
// ═══════════════════════════════════════════════

export const HR_TEAM_CONFIG: ModuleRoleConfig = {
    moduleId: 'hr',
    moduleNameEn: 'HR Team',
    moduleNameAr: 'فريق الموارد البشرية',
    accentColor: 'blue',
    roles: [
        {
            role: 'HR User',
            labelEn: 'HR User',
            labelAr: 'مستخدم موارد بشرية',
            description: 'Can view employees, attendance, leaves. Limited edit access.',
            descriptionAr: 'يمكنه عرض الموظفين والحضور والإجازات. صلاحيات تعديل محدودة.',
        },
        {
            role: 'HR Manager',
            labelEn: 'HR Manager',
            labelAr: 'مدير موارد بشرية',
            description: 'Full HR access: manage employees, payroll, settings.',
            descriptionAr: 'صلاحيات كاملة: إدارة الموظفين، الرواتب، الإعدادات.',
            isManager: true,
        },
    ],
    alwaysIncludeRoles: ['Employee'],
    allModuleRoles: ['HR User', 'HR Manager'],
}

export const INVENTORY_TEAM_CONFIG: ModuleRoleConfig = {
    moduleId: 'inventory',
    moduleNameEn: 'Inventory Team',
    moduleNameAr: 'فريق المخزون',
    accentColor: 'orange',
    roles: [
        {
            role: 'Stock User',
            labelEn: 'Stock User',
            labelAr: 'مستخدم مخزون',
            description: 'Can view stock levels, create stock entries and transfers.',
            descriptionAr: 'يمكنه عرض المخزون وإنشاء حركات المخزون والتحويلات.',
        },
        {
            role: 'Stock Manager',
            labelEn: 'Stock Manager',
            labelAr: 'مدير مخزون',
            description: 'Full inventory access: manage warehouses, reconciliation, settings.',
            descriptionAr: 'صلاحيات كاملة: إدارة المستودعات، التسوية، الإعدادات.',
            isManager: true,
        },
    ],
    allModuleRoles: ['Stock User', 'Stock Manager'],
}

export const ADMIN_TEAM_CONFIG: ModuleRoleConfig = {
    moduleId: 'admin',
    moduleNameEn: 'System Administrators',
    moduleNameAr: 'مديرو النظام',
    accentColor: 'indigo',
    roles: [
        {
            role: 'System Manager',
            labelEn: 'System Manager',
            labelAr: 'مدير النظام',
            description: 'Full system access: settings, users, modules, domains.',
            descriptionAr: 'صلاحيات كاملة: الإعدادات، المستخدمين، الموديولات.',
            isManager: true,
        },
    ],
    allModuleRoles: ['System Manager'],
}

// ═══════════════════════════════════════════════
// HELPER: Role assignment via proxy (same pattern as employee-profile.tsx)
// ═══════════════════════════════════════════════

async function getUserWithRoles(email: string): Promise<{ roles: Array<{ role: string }>, full_name?: string, user_image?: string, enabled?: number } | null> {
    const res = await csrfFetch(frappeApiUrl(`/api/resource/User/${email}?fields=["name","full_name","user_image","enabled","roles"]`), {
        credentials: 'include',
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data || null
}

async function addRolesToUser(email: string, rolesToAdd: string[]): Promise<boolean> {
    const userData = await getUserWithRoles(email)
    if (!userData) return false

    const existingRoles: Array<{ role: string }> = (userData.roles || []).map((r: any) => ({ role: r.role }))
    const existingRoleNames = existingRoles.map(r => r.role)
    const newRoles = rolesToAdd.filter(r => !existingRoleNames.includes(r))

    if (newRoles.length === 0) return true // Already has all roles

    const allRoles = [...existingRoles, ...newRoles.map(r => ({ role: r }))]
    const res = await csrfFetch(frappeApiUrl(`/api/resource/User/${email}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ roles: allRoles }),
    })
    return res.ok
}

async function removeRolesFromUser(email: string, rolesToRemove: string[]): Promise<boolean> {
    const userData = await getUserWithRoles(email)
    if (!userData) return false

    const existingRoles: Array<{ role: string }> = (userData.roles || []).map((r: any) => ({ role: r.role }))
    const filteredRoles = existingRoles.filter(r => !rolesToRemove.includes(r.role))

    // Nothing to remove
    if (filteredRoles.length === existingRoles.length) return true

    const res = await csrfFetch(frappeApiUrl(`/api/resource/User/${email}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ roles: filteredRoles }),
    })
    return res.ok
}

async function fetchAllSystemUsers(): Promise<Array<{ name: string, full_name: string, user_image?: string, enabled: number, roles: Array<{ role: string }> }>> {
    // Get all system users (not Guest, not Administrator superuser)
    const res = await csrfFetch(frappeApiUrl(
        `/api/resource/User?filters=[["user_type","=","System User"],["name","not in",["Guest","Administrator"]]]&fields=["name","full_name","user_image","enabled"]&limit_page_length=500&order_by=full_name asc`
    ), { credentials: 'include' })
    if (!res.ok) return []
    const data = await res.json()
    const users = data.data || []

    // Fetch roles for each user
    const withRoles = await Promise.all(users.map(async (u: any) => {
        const detail = await getUserWithRoles(u.name)
        return {
            ...u,
            roles: detail?.roles?.map((r: any) => ({ role: r.role })) || [],
        }
    }))
    return withRoles
}

async function fetchEmployeesWithUsers(): Promise<Array<{ name: string, employee_name: string, user_id: string, company?: string }>> {
    const res = await csrfFetch(frappeApiUrl(
        `/api/resource/Employee?filters=[["status","=","Active"],["user_id","is","set"]]&fields=["name","employee_name","user_id","company"]&limit_page_length=500&order_by=employee_name asc`
    ), { credentials: 'include' })
    if (!res.ok) return []
    const data = await res.json()
    return data.data || []
}

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════

interface ModuleTeamManagerProps {
    config: ModuleRoleConfig
}

export function ModuleTeamManager({ config }: ModuleTeamManagerProps) {
    const { isRTL } = useI18n()
    const { toast } = useToast()

    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [search, setSearch] = useState('')

    // Add dialog
    const [showAddDialog, setShowAddDialog] = useState(false)
    const [employees, setEmployees] = useState<Array<{ name: string, employee_name: string, user_id: string, company?: string }>>([])
    const [loadingEmployees, setLoadingEmployees] = useState(false)
    const [employeeSearch, setEmployeeSearch] = useState('')
    const [selectedEmployee, setSelectedEmployee] = useState<{ name: string, employee_name: string, user_id: string } | null>(null)
    const [selectedRole, setSelectedRole] = useState(config.roles[0]?.role || '')
    const [saving, setSaving] = useState(false)

    // Remove dialog
    const [removeConfirm, setRemoveConfirm] = useState<{ open: boolean, member: TeamMember | null }>({ open: false, member: null })
    const [removing, setRemoving] = useState(false)

    const accentBg = `bg-${config.accentColor}-50`
    const accentText = `text-${config.accentColor}-700`
    const accentBorder = `border-${config.accentColor}-200`
    const accentBgSolid = `bg-${config.accentColor}-600`
    const accentBgSolidHover = `hover:bg-${config.accentColor}-700`

    // Load team members
    const loadTeam = useCallback(async (refresh = false) => {
        try {
            if (refresh) setRefreshing(true); else setLoading(true)
            const allUsers = await fetchAllSystemUsers()

            // Filter to users who have at least one of this module's roles
            const moduleRoleSet = new Set(config.allModuleRoles)
            const members: TeamMember[] = allUsers
                .filter(u => u.roles.some(r => moduleRoleSet.has(r.role)))
                .map(u => ({
                    email: u.name,
                    full_name: u.full_name || u.name,
                    user_image: u.user_image,
                    enabled: !!u.enabled,
                    roles: u.roles.map(r => r.role).filter(r => moduleRoleSet.has(r)),
                }))

            // Try to match employees
            const emps = await fetchEmployeesWithUsers()
            for (const m of members) {
                const emp = emps.find(e => e.user_id === m.email)
                if (emp) {
                    m.employee = emp.name
                    m.employee_name = emp.employee_name
                }
            }

            setTeamMembers(members)
        } catch (e) {
            toast({ title: 'Error', description: String(e), variant: 'destructive' })
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [config.allModuleRoles, toast])

    useEffect(() => { loadTeam() }, [loadTeam])

    // Filtered members
    const filtered = useMemo(() => {
        if (!search) return teamMembers
        const q = search.toLowerCase()
        return teamMembers.filter(m =>
            m.full_name.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q) ||
            m.employee?.toLowerCase().includes(q) ||
            m.employee_name?.toLowerCase().includes(q)
        )
    }, [teamMembers, search])

    // Stats
    const managerRoles = config.roles.filter(r => r.isManager).map(r => r.role)
    const managerCount = teamMembers.filter(m => m.roles.some(r => managerRoles.includes(r))).length
    const userCount = teamMembers.length - managerCount

    // Open add dialog
    const openAdd = async () => {
        setSelectedEmployee(null)
        setSelectedRole(config.roles[0]?.role || '')
        setEmployeeSearch('')
        setShowAddDialog(true)
        setLoadingEmployees(true)
        try {
            const emps = await fetchEmployeesWithUsers()
            // Filter out employees who already have all this module's roles
            const existingEmails = new Set(teamMembers.map(m => m.email))
            setEmployees(emps.filter(e => !existingEmails.has(e.user_id)))
        } catch { setEmployees([]) }
        finally { setLoadingEmployees(false) }
    }

    // Filtered employees in dialog
    const filteredEmployees = useMemo(() => {
        if (!employeeSearch) return employees
        const q = employeeSearch.toLowerCase()
        return employees.filter(e =>
            e.name.toLowerCase().includes(q) ||
            e.employee_name.toLowerCase().includes(q) ||
            e.user_id.toLowerCase().includes(q)
        )
    }, [employees, employeeSearch])

    // Handle add
    const handleAdd = async () => {
        if (!selectedEmployee) {
            toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'اختر موظف أولاً' : 'Please select an employee first', variant: 'destructive' })
            return
        }
        setSaving(true)
        try {
            const rolesToAdd = [selectedRole, ...(config.alwaysIncludeRoles || [])]
            const ok = await addRolesToUser(selectedEmployee.user_id, rolesToAdd)
            if (ok) {
                const roleName = config.roles.find(r => r.role === selectedRole)
                toast({
                    title: isRTL ? 'تم' : 'Added',
                    description: isRTL
                        ? `تم إضافة ${selectedEmployee.employee_name} كـ ${roleName?.labelAr || selectedRole}`
                        : `${selectedEmployee.employee_name} added as ${roleName?.labelEn || selectedRole}`,
                })
                setShowAddDialog(false)
                loadTeam(true)
            } else {
                toast({
                    title: isRTL ? 'خطأ' : 'Error',
                    description: isRTL ? 'فشل تعيين الصلاحيات. تأكد أن لديك صلاحية كافية.' : 'Failed to assign roles. Check your permissions.',
                    variant: 'destructive',
                })
            }
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' })
        } finally { setSaving(false) }
    }

    // Handle remove
    const handleRemove = async () => {
        const member = removeConfirm.member
        if (!member) return
        setRemoving(true)
        try {
            const ok = await removeRolesFromUser(member.email, config.allModuleRoles)
            if (ok) {
                toast({
                    title: isRTL ? 'تم' : 'Removed',
                    description: isRTL
                        ? `تم إزالة صلاحيات ${config.moduleNameAr} من ${member.full_name}`
                        : `${config.moduleNameEn} roles removed from ${member.full_name}`,
                })
                setRemoveConfirm({ open: false, member: null })
                loadTeam(true)
            } else {
                toast({ title: isRTL ? 'خطأ' : 'Error', description: isRTL ? 'فشل إزالة الصلاحيات' : 'Failed to remove roles', variant: 'destructive' })
            }
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' })
        } finally { setRemoving(false) }
    }

    // Loading state
    if (loading) return (
        <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-64" />
            <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
    )

    return (
        <div className="p-6 space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        {isRTL ? config.moduleNameAr : config.moduleNameEn}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {isRTL
                            ? `${teamMembers.length} عضو في الفريق`
                            : `${teamMembers.length} team member${teamMembers.length !== 1 ? 's' : ''}`}
                    </p>
                </div>
                <div className="flex items-center flex-wrap gap-2">
                    <Button aria-label="تحديث" title="تحديث" variant="outline" size="sm" onClick={() => loadTeam(true)} disabled={refreshing}>
                        <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                    </Button>
                    <Button aria-label="إضافة مستخدم" title="إضافة مستخدم" size="sm" onClick={openAdd} className={cn(accentBgSolid, accentBgSolidHover, 'text-white')}>
                        <UserPlus className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} />
                        {isRTL ? 'عضو جديد' : 'New Member'}
                    </Button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card className="border-0 shadow-sm">
                    <CardContent className="p-4">
                        <p className="text-xs text-muted-foreground">{isRTL ? 'إجمالي الأعضاء' : 'Total Members'}</p>
                        <p className="text-2xl font-bold text-foreground">{teamMembers.length}</p>
                    </CardContent>
                </Card>
                {managerRoles.length > 0 && (
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">{isRTL ? 'المديرون' : 'Managers'}</p>
                            <p className={cn('text-2xl font-bold', accentText)}>{managerCount}</p>
                        </CardContent>
                    </Card>
                )}
                {config.roles.length > 1 && (
                    <Card className="border-0 shadow-sm">
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground">{isRTL ? 'المستخدمون' : 'Users'}</p>
                            <p className="text-2xl font-bold text-emerald-600">{userCount}</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Search */}
            <Card className="border-0 shadow-sm">
                <CardContent className="p-3">
                    <div className="relative">
                        <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70', isRTL ? 'right-3' : 'left-3')} />
                        <Input
                            placeholder={isRTL ? 'بحث بالاسم أو البريد...' : 'Search by name or email...'}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Team Members List */}
            <Card className="border-0 shadow-sm overflow-hidden">
                <div className="divide-y divide-border">
                    {filtered.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground/70">
                            <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
                            <p className="text-sm">{isRTL ? 'لا يوجد أعضاء' : 'No team members found'}</p>
                        </div>
                    ) : filtered.map(member => (
                        <div key={member.email} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Avatar */}
                                <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0', accentBgSolid)}>
                                    {member.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{member.full_name}</p>
                                    <p className="text-[11px] text-muted-foreground/70 truncate">{member.email}</p>
                                    {member.employee && (
                                        <p className="text-[11px] text-muted-foreground/70 truncate">
                                            {isRTL ? 'موظف: ' : 'Employee: '}{member.employee_name || member.employee}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {/* Role badges */}
                                {member.roles.map(role => {
                                    const roleConfig = config.roles.find(r => r.role === role)
                                    return (
                                        <Badge
                                            key={role}
                                            variant="outline"
                                            className={cn(
                                                'text-[10px] px-2 py-0.5',
                                                roleConfig?.isManager
                                                    ? `bg-amber-50 text-amber-700 border-amber-200`
                                                    : `bg-emerald-50 text-emerald-700 border-emerald-200`
                                            )}
                                        >
                                            {roleConfig?.isManager && <ShieldCheck className="h-3 w-3 mr-0.5" />}
                                            {isRTL ? (roleConfig?.labelAr || role) : (roleConfig?.labelEn || role)}
                                        </Badge>
                                    )
                                })}
                                {/* Remove button */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 text-muted-foreground/70 hover:text-red-500 hover:bg-red-50"
                                    onClick={() => setRemoveConfirm({ open: true, member })}
                                    title={isRTL ? 'إزالة' : 'Remove'}
                                >
                                    <UserMinus className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            {/* ═══ ADD MEMBER DIALOG ═══ */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent className={cn('max-w-lg', isRTL && 'text-right')} dir={isRTL ? 'rtl' : 'ltr'}>
                    <DialogHeader>
                        <DialogTitle>{isRTL ? 'إضافة عضو جديد' : 'Add Team Member'}</DialogTitle>
                        <DialogDescription>
                            {isRTL
                                ? 'اختر موظف من قائمة الموظفين الذين لديهم حساب مستخدم'
                                : 'Select an employee who has a user account'}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Employee search */}
                    <div className="space-y-3">
                        <div className="relative">
                            <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70', isRTL ? 'right-3' : 'left-3')} />
                            <Input
                                placeholder={isRTL ? 'بحث بالاسم أو الكود...' : 'Search employees...'}
                                value={employeeSearch}
                                onChange={e => setEmployeeSearch(e.target.value)}
                                className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
                            />
                        </div>

                        {/* Employee list */}
                        <div className="max-h-48 overflow-y-auto border rounded-lg divide-y divide-border">
                            {loadingEmployees ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/70" />
                                </div>
                            ) : filteredEmployees.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground/70 text-sm">
                                    {employees.length === 0
                                        ? (isRTL ? 'لا يوجد موظفين متاحين — جميعهم مضافون بالفعل أو ليس لديهم حساب مستخدم' : 'No available employees — all are already added or have no user account')
                                        : (isRTL ? 'لا توجد نتائج' : 'No results')}
                                </div>
                            ) : filteredEmployees.map(emp => (
                                <button
                                    key={emp.name}
                                    onClick={() => setSelectedEmployee(emp)}
                                    className={cn(
                                        'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors',
                                        isRTL && 'text-right',
                                        selectedEmployee?.name === emp.name
                                            ? `${accentBg} ${accentText}`
                                            : 'hover:bg-accent/50'
                                    )}
                                >
                                    {selectedEmployee?.name === emp.name && (
                                        <Check className="h-4 w-4 flex-shrink-0" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium truncate">{emp.employee_name}</p>
                                        <p className="text-[11px] text-muted-foreground/70 truncate">{emp.user_id} · {emp.name}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Role selection */}
                        {config.roles.length > 1 && (
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-foreground/90">
                                    {isRTL ? 'مستوى الصلاحية' : 'Permission Level'}
                                </p>
                                <div className="grid grid-cols-1 gap-2">
                                    {config.roles.map(roleOption => (
                                        <button aria-label="الصلاحيات" title="الصلاحيات"
                                            key={roleOption.role}
                                            onClick={() => setSelectedRole(roleOption.role)}
                                            className={cn(
                                                'w-full flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left',
                                                isRTL && 'text-right',
                                                selectedRole === roleOption.role
                                                    ? `${accentBorder} ${accentBg}`
                                                    : 'border-border hover:border-input'
                                            )}
                                        >
                                            <div className={cn(
                                                'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5',
                                                selectedRole === roleOption.role
                                                    ? `border-${config.accentColor}-600 bg-${config.accentColor}-600`
                                                    : 'border-input'
                                            )}>
                                                {selectedRole === roleOption.role && (
                                                    <div className="w-2 h-2 bg-card rounded-full" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    {roleOption.isManager ? (
                                                        <ShieldCheck className="h-4 w-4 text-amber-600" />
                                                    ) : (
                                                        <Shield className="h-4 w-4 text-emerald-600" />
                                                    )}
                                                    <span className="text-sm font-semibold text-foreground">
                                                        {isRTL ? roleOption.labelAr : roleOption.labelEn}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                                    {isRTL ? (roleOption.descriptionAr || roleOption.description) : roleOption.description}
                                                </p>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Always-included roles info */}
                        {config.alwaysIncludeRoles && config.alwaysIncludeRoles.length > 0 && selectedEmployee && (
                            <div className="flex items-start gap-2 px-3 py-2 bg-accent rounded-lg text-xs text-primary">
                                <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                                <span>
                                    {isRTL
                                        ? `سيتم أيضاً إضافة: ${config.alwaysIncludeRoles.join(', ')}`
                                        : `Also includes: ${config.alwaysIncludeRoles.join(', ')}`}
                                </span>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDialog(false)} disabled={saving}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </Button>
                        <Button
                            onClick={handleAdd}
                            disabled={!selectedEmployee || saving}
                            className={cn(accentBgSolid, accentBgSolidHover, 'text-white')}
                        >
                            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                            {isRTL ? 'إضافة' : 'Add'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ═══ REMOVE CONFIRMATION ═══ */}
            <AlertDialog open={removeConfirm.open} onOpenChange={(open) => !open && setRemoveConfirm({ open: false, member: null })}>
                <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {isRTL ? 'إزالة عضو من الفريق' : 'Remove Team Member'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {isRTL
                                ? `سيتم إزالة صلاحيات ${config.moduleNameAr} (${config.allModuleRoles.join(', ')}) من ${removeConfirm.member?.full_name}. لن يتم حذف حساب المستخدم.`
                                : `This will remove ${config.moduleNameEn} roles (${config.allModuleRoles.join(', ')}) from ${removeConfirm.member?.full_name}. The user account will not be deleted.`}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={removing}>
                            {isRTL ? 'إلغاء' : 'Cancel'}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleRemove}
                            disabled={removing}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {removing && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                            {isRTL ? 'إزالة' : 'Remove'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
