'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { RefreshCw, Settings, Building, Award, Briefcase, MapPin, Plus, Trash2, Save, Loader2, AlertCircle } from 'lucide-react'
import { csrfFetch } from '@/lib/csrf'
import { frappeClient, frappeApiUrl } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { useI18n } from '@/lib/i18n'
import { translateDepartment, translateEnum } from '@/lib/enums'
import { useCompany } from '@/hooks/use-company'

// ==================== Types ====================

interface Department {
    name: string
    department?: string
    company?: string
    is_group?: number
    parent_department?: string
    disabled?: number
}

interface Designation {
    name: string
    designation?: string
    description?: string
}

interface EmploymentType {
    name: string
}

interface Branch {
    name: string
}

interface HRSettingsData {
    emp_created_by: string
    retirement_age: number
    standard_working_hours: number
    allow_employee_checkin_from_mobile_app: number
    allow_geolocation_tracking: number
    allow_multiple_shift_assignments: number
    leave_approver_mandatory_in_leave_application: number
    prevent_self_leave_approval: number
    restrict_backdated_leave_application: number
    send_leave_notification: number
    send_birthday_reminders: number
    send_work_anniversary_reminders: number
    send_holiday_reminders: number
    frequency: string
    check_vacancies: number
    send_interview_reminder: number
    remind_before: string
    expense_approver_mandatory_in_expense_claim: number
    prevent_self_expense_approval: number
}

// ==================== HR Settings Form Component ====================

function HRSettingsForm() {
    const [settings, setSettings] = useState<HRSettingsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { toast } = useToast()
    const { t } = useI18n()

    useEffect(() => { loadSettings() }, [])

    const loadSettings = async () => {
        try {
            setLoading(true)
            setError(null)
            const response = await csrfFetch(frappeApiUrl('/api/resource/HR Settings/HR Settings'), {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
            })
            if (!response.ok) throw new Error(`API request failed: ${response.status}`)
            const result = await response.json()
            setSettings(result.data || result.message || result)
        } catch (err) {
            setError(err instanceof Error ? err.message : t('settings.loadFailed'))
            toast({ title: t('common.error'), description: t('settings.loadFailed'), variant: 'destructive' })
        } finally { setLoading(false) }
    }

    const handleSave = async () => {
        if (!settings) return
        try {
            setSaving(true)
            const response = await csrfFetch(frappeApiUrl('/api/resource/HR Settings/HR Settings'), {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            })
            if (!response.ok) throw new Error(`Save failed: ${response.status}`)
            toast({ title: t('common.success'), description: t('settings.saved') })
        } catch (err) {
            toast({ title: t('common.error'), description: t('settings.saveFailed'), variant: 'destructive' })
        } finally { setSaving(false) }
    }

    const updateSetting = (key: keyof HRSettingsData, value: string | number) => {
        if (!settings) return
        setSettings({ ...settings, [key]: value })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
                    <p className="text-sm text-muted-foreground/70">{t('settings.loading')}</p>
                </div>
            </div>
        )
    }

    if (error || !settings) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="text-center max-w-md">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="h-6 w-6 text-red-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">{t('settings.loadFailed')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{error || t('settings.checkConnection')}</p>
                    <Button onClick={loadSettings} variant="outline">{t('common.retry')}</Button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                        <Settings className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-foreground">{t('settings.hrTitle')}</h2>
                        <p className="text-sm text-muted-foreground">{t('settings.hrDesc')}</p>
                    </div>
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('common.saving')}</> : <><Save className="mr-2 h-4 w-4" />{t('settings.save')}</>}
                </Button>
            </div>

            {/* Main Settings Card */}
            <Card className="border-border shadow-sm">
                <CardContent className="p-6 bg-gradient-to-b from-gray-50/50 to-white">
                    <div className="space-y-8">
                        {/* Employee Settings Section */}
                        <div className="space-y-4">
                            <div className="pb-3 border-b-2 border-primary/15">
                                <h3 className="text-base font-bold text-foreground">{t('settings.employee.title')}</h3>
                                <p className="text-sm text-muted-foreground mt-1">{t('settings.employee.desc')}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-foreground/90">{t('settings.employee.namingBy')}</Label>
                                    <Select value={settings.emp_created_by || "Naming Series"} onValueChange={(value) => updateSetting("emp_created_by", value)}>
                                        <SelectTrigger className="w-full border-input"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Naming Series">{t('settings.employee.namingSeries')}</SelectItem>
                                            <SelectItem value="Employee Number">{t('settings.employee.empNumber')}</SelectItem>
                                            <SelectItem value="Full Name">{t('settings.employee.fullName')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-foreground/90">{t('settings.employee.retirementAge')}</Label>
                                    <Input type="number" className="border-input" value={settings.retirement_age || 60} onChange={(e) => updateSetting("retirement_age", parseInt(e.target.value) || 60)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-foreground/90">{t('settings.employee.workingHours')}</Label>
                                    <Input type="number" step="0.1" className="border-input" value={settings.standard_working_hours || 8} onChange={(e) => updateSetting("standard_working_hours", parseFloat(e.target.value) || 8)} />
                                </div>
                            </div>
                        </div>

                        {/* Attendance Settings Section */}
                        <div className="space-y-4">
                            <div className="pb-3 border-b-2 border-primary/15">
                                <h3 className="text-base font-bold text-foreground">{t('settings.attendance.title')}</h3>
                                <p className="text-sm text-muted-foreground mt-1">{t('settings.attendance.desc')}</p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-blue-50/30 transition-all">
                                    <div className="flex-1">
                                        <Label className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.attendance.mobileCheckin')}</Label>
                                        <p className="text-xs text-muted-foreground mt-0.5">{t('settings.attendance.mobileCheckinDesc')}</p>
                                    </div>
                                    <Switch checked={settings.allow_employee_checkin_from_mobile_app === 1} onCheckedChange={(checked) => updateSetting("allow_employee_checkin_from_mobile_app", checked ? 1 : 0)} />
                                </div>
                                <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-blue-50/30 transition-all">
                                    <div className="flex-1">
                                        <Label className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.attendance.geolocation')}</Label>
                                        <p className="text-xs text-muted-foreground mt-0.5">{t('settings.attendance.geolocationDesc')}</p>
                                    </div>
                                    <Switch checked={settings.allow_geolocation_tracking === 1} onCheckedChange={(checked) => updateSetting("allow_geolocation_tracking", checked ? 1 : 0)} />
                                </div>
                            </div>
                        </div>

                        {/* Shift & Leave Settings Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Shift Settings */}
                            <div className="space-y-4">
                                <div className="pb-3 border-b-2 border-primary/15">
                                    <h3 className="text-base font-bold text-foreground">{t('settings.shifts.title')}</h3>
                                    <p className="text-sm text-muted-foreground mt-1">{t('settings.shifts.desc')}</p>
                                </div>
                                <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-blue-50/30 transition-all">
                                    <div className="flex-1">
                                        <Label className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.shifts.multipleShifts')}</Label>
                                        <p className="text-xs text-muted-foreground mt-0.5">{t('settings.shifts.multipleShiftsDesc')}</p>
                                    </div>
                                    <Switch checked={settings.allow_multiple_shift_assignments === 1} onCheckedChange={(checked) => updateSetting("allow_multiple_shift_assignments", checked ? 1 : 0)} />
                                </div>
                            </div>

                            {/* Leave Settings */}
                            <div className="space-y-4">
                                <div className="pb-3 border-b-2 border-primary/15">
                                    <h3 className="text-base font-bold text-foreground">{t('settings.leaves.title')}</h3>
                                    <p className="text-sm text-muted-foreground mt-1">{t('settings.leaves.desc')}</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-blue-50/30 transition-all">
                                        <div className="flex-1">
                                            <Label className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.leaves.approverMandatory')}</Label>
                                            <p className="text-xs text-muted-foreground mt-0.5">{t('settings.leaves.approverMandatoryDesc')}</p>
                                        </div>
                                        <Switch checked={settings.leave_approver_mandatory_in_leave_application === 1} onCheckedChange={(checked) => updateSetting("leave_approver_mandatory_in_leave_application", checked ? 1 : 0)} />
                                    </div>
                                    <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-blue-50/30 transition-all">
                                        <div className="flex-1">
                                            <Label className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.leaves.preventSelfApproval')}</Label>
                                            <p className="text-xs text-muted-foreground mt-0.5">{t('settings.leaves.preventSelfApprovalDesc')}</p>
                                        </div>
                                        <Switch checked={settings.prevent_self_leave_approval === 1} onCheckedChange={(checked) => updateSetting("prevent_self_leave_approval", checked ? 1 : 0)} />
                                    </div>
                                    <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-blue-50/30 transition-all">
                                        <div className="flex-1">
                                            <Label className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.leaves.restrictBackdated')}</Label>
                                            <p className="text-xs text-muted-foreground mt-0.5">{t('settings.leaves.restrictBackdatedDesc')}</p>
                                        </div>
                                        <Switch checked={settings.restrict_backdated_leave_application === 1} onCheckedChange={(checked) => updateSetting("restrict_backdated_leave_application", checked ? 1 : 0)} />
                                    </div>
                                    <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-blue-50/30 transition-all">
                                        <div className="flex-1">
                                            <Label className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.leaves.sendNotifications')}</Label>
                                            <p className="text-xs text-muted-foreground mt-0.5">{t('settings.leaves.sendNotificationsDesc')}</p>
                                        </div>
                                        <Switch checked={settings.send_leave_notification === 1} onCheckedChange={(checked) => updateSetting("send_leave_notification", checked ? 1 : 0)} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Reminder Settings Section */}
                        <div className="space-y-4">
                            <div className="pb-3 border-b-2 border-primary/15">
                                <h3 className="text-base font-bold text-foreground">{t('settings.reminders.title')}</h3>
                                <p className="text-sm text-muted-foreground mt-1">{t('settings.reminders.desc')}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-blue-50/30 transition-all">
                                        <Label className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.reminders.birthday')}</Label>
                                        <Switch checked={settings.send_birthday_reminders === 1} onCheckedChange={(checked) => updateSetting("send_birthday_reminders", checked ? 1 : 0)} />
                                    </div>
                                    <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-blue-50/30 transition-all">
                                        <Label className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.reminders.anniversary')}</Label>
                                        <Switch checked={settings.send_work_anniversary_reminders === 1} onCheckedChange={(checked) => updateSetting("send_work_anniversary_reminders", checked ? 1 : 0)} />
                                    </div>
                                    <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-blue-50/30 transition-all">
                                        <Label className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.reminders.holidays')}</Label>
                                        <Switch checked={settings.send_holiday_reminders === 1} onCheckedChange={(checked) => updateSetting("send_holiday_reminders", checked ? 1 : 0)} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-semibold text-foreground/90">{t('settings.reminders.frequency')}</Label>
                                    <Select value={settings.frequency || "Weekly"} onValueChange={(value) => updateSetting("frequency", value)}>
                                        <SelectTrigger className="w-full border-input"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Weekly">{t('settings.reminders.weekly')}</SelectItem>
                                            <SelectItem value="Monthly">{t('settings.reminders.monthly')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Hiring & Expense Settings Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Hiring Settings */}
                            <div className="space-y-4">
                                <div className="pb-3 border-b-2 border-primary/15">
                                    <h3 className="text-base font-bold text-foreground">{t('settings.hiring.title')}</h3>
                                    <p className="text-sm text-muted-foreground mt-1">{t('settings.hiring.desc')}</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-blue-50/30 transition-all">
                                        <div className="flex-1">
                                            <Label className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.hiring.checkVacancies')}</Label>
                                            <p className="text-xs text-muted-foreground mt-0.5">{t('settings.hiring.checkVacanciesDesc')}</p>
                                        </div>
                                        <Switch checked={settings.check_vacancies === 1} onCheckedChange={(checked) => updateSetting("check_vacancies", checked ? 1 : 0)} />
                                    </div>
                                    <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-blue-50/30 transition-all">
                                        <div className="flex-1">
                                            <Label className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.hiring.interviewReminder')}</Label>
                                            <p className="text-xs text-muted-foreground mt-0.5">{t('settings.hiring.interviewReminderDesc')}</p>
                                        </div>
                                        <Switch checked={settings.send_interview_reminder === 1} onCheckedChange={(checked) => updateSetting("send_interview_reminder", checked ? 1 : 0)} />
                                    </div>
                                    {settings.send_interview_reminder === 1 && (
                                        <div className="space-y-2 px-4">
                                            <Label className="text-sm font-semibold text-foreground/90">{t('settings.hiring.remindBefore')}</Label>
                                            <Input className="border-input" value={settings.remind_before || ""} onChange={(e) => updateSetting("remind_before", e.target.value)} placeholder="00:15:00" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Expense Settings */}
                            <div className="space-y-4">
                                <div className="pb-3 border-b-2 border-primary/15">
                                    <h3 className="text-base font-bold text-foreground">{t('settings.expenses.title')}</h3>
                                    <p className="text-sm text-muted-foreground mt-1">{t('settings.expenses.desc')}</p>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-blue-50/30 transition-all">
                                        <div className="flex-1">
                                            <Label className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.expenses.approverMandatory')}</Label>
                                            <p className="text-xs text-muted-foreground mt-0.5">{t('settings.expenses.approverMandatoryDesc')}</p>
                                        </div>
                                        <Switch checked={settings.expense_approver_mandatory_in_expense_claim === 1} onCheckedChange={(checked) => updateSetting("expense_approver_mandatory_in_expense_claim", checked ? 1 : 0)} />
                                    </div>
                                    <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg hover:border-primary/30 hover:bg-blue-50/30 transition-all">
                                        <div className="flex-1">
                                            <Label className="text-sm font-semibold text-foreground cursor-pointer">{t('settings.expenses.preventSelfApproval')}</Label>
                                            <p className="text-xs text-muted-foreground mt-0.5">{t('settings.expenses.preventSelfApprovalDesc')}</p>
                                        </div>
                                        <Switch checked={settings.prevent_self_expense_approval === 1} onCheckedChange={(checked) => updateSetting("prevent_self_expense_approval", checked ? 1 : 0)} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

// ==================== Main Component ====================

interface HRSettingsListProps {
    initialTab?: string
}

export function HRSettingsList({ initialTab = 'departments' }: HRSettingsListProps) {
    const [activeTab, setActiveTab] = useState(initialTab)
    const [departments, setDepartments] = useState<Department[]>([])
    const [designations, setDesignations] = useState<Designation[]>([])
    const [employmentTypes, setEmploymentTypes] = useState<EmploymentType[]>([])
    const [branches, setBranches] = useState<Branch[]>([])
    const [loading, setLoading] = useState(true)
    const { toast } = useToast()
    const { t, lang } = useI18n()
    const locale = lang === 'en' ? 'en' : 'ar'
    const { company: userCompany } = useCompany()

    // ==================== Create Dialog States ====================
    const [createDialog, setCreateDialog] = useState<{ type: string; open: boolean }>({ type: '', open: false })
    const [saving, setSaving] = useState(false)

    const [deptForm, setDeptForm] = useState({ department: '', company: '', parent_department: '', is_group: 0 })
    const [desigForm, setDesigForm] = useState({ designation: '', description: '' })
    const [empTypeForm, setEmpTypeForm] = useState({ name: '' })
    const [branchForm, setBranchForm] = useState({ branch: '' })

    // ==================== Delete Confirmation State ====================
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; doctype: string; name: string; label: string }>({ open: false, doctype: '', name: '', label: '' })
    const [deleting, setDeleting] = useState(false)

    // ==================== Data Loading ====================

    const loadDepartments = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true)
            const response = await frappeClient.get<Department[]>('Department', undefined, {
                fields: ['name', 'company', 'is_group', 'parent_department', 'disabled'],
                filters: userCompany ? [['Department', 'company', '=', userCompany]] : undefined,
                order_by: 'name asc',
                limit_page_length: 100,
            })
            setDepartments(response.data || [])
        } catch (error) { console.error('Failed:', error) }
        finally { if (showLoading) setLoading(false) }
    }, [userCompany])

    const loadDesignations = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true)
            const response = await frappeClient.get<Designation[]>('Designation', undefined, {
                fields: ['name'],
                order_by: 'name asc',
                limit_page_length: 100,
            })
            setDesignations(response.data || [])
        } catch (error) { console.error('Failed:', error) }
        finally { if (showLoading) setLoading(false) }
    }, [])

    const loadEmploymentTypes = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true)
            const response = await frappeClient.get<EmploymentType[]>('Employment Type', undefined, {
                fields: ['name'],
                order_by: 'name asc',
                limit_page_length: 50,
            })
            setEmploymentTypes(response.data || [])
        } catch (error) { console.error('Failed:', error) }
        finally { if (showLoading) setLoading(false) }
    }, [])

    const loadBranches = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true)
            const response = await frappeClient.get<Branch[]>('Branch', undefined, {
                fields: ['name'],
                filters: userCompany ? [['Branch', 'company', '=', userCompany]] : undefined,
                order_by: 'name asc',
                limit_page_length: 50,
            })
            setBranches(response.data || [])
        } catch (error) { console.error('Failed:', error) }
        finally { if (showLoading) setLoading(false) }
    }, [userCompany])


    // Load ALL four lists (not only the active tab) so the summary counters
    // reflect real data regardless of which tab is open. Only the active tab
    // drives the visible loading spinner; the other three load silently in the
    // background. Re-runs when the loaders change (e.g. once userCompany
    // resolves) so branch/department counts stay company-filtered.
    useEffect(() => {
        loadDepartments(activeTab === 'departments')
        loadDesignations(activeTab === 'designations')
        loadEmploymentTypes(activeTab === 'employment-types')
        loadBranches(activeTab === 'branches')
    }, [activeTab, loadDepartments, loadDesignations, loadEmploymentTypes, loadBranches])

    // ==================== Generic Create Handler ====================

    const handleCreate = async () => {
        try {
            setSaving(true)
            const type = createDialog.type

            if (type === 'department') {
                if (!deptForm.department) { toast({ title: t('common.validation'), description: t('settings.dept.nameRequired'), variant: 'destructive' }); return }
                await frappeClient.post('Department', { department: deptForm.department, company: userCompany || undefined, parent_department: deptForm.parent_department || undefined, is_group: deptForm.is_group })
                toast({ title: t('common.success'), description: t('settings.dept.created') })
                setDeptForm({ department: '', company: '', parent_department: '', is_group: 0 })
                await loadDepartments()
            } else if (type === 'designation') {
                const designationName = desigForm.designation.trim()
                if (!designationName) { toast({ title: t('common.validation'), description: t('settings.desig.nameRequired'), variant: 'destructive' }); return }
                await frappeClient.post('Designation', { designation: designationName })
                toast({ title: t('common.success'), description: t('settings.desig.created') })
                setDesigForm({ designation: '', description: '' })
                await loadDesignations()
            } else if (type === 'employment-type') {
                if (!empTypeForm.name) { toast({ title: t('common.validation'), description: t('settings.empType.nameRequired'), variant: 'destructive' }); return }
                await frappeClient.post('Employment Type', { name: empTypeForm.name })
                toast({ title: t('common.success'), description: t('settings.empType.created') })
                setEmpTypeForm({ name: '' })
                await loadEmploymentTypes()
            } else if (type === 'branch') {
                if (!branchForm.branch) { toast({ title: t('common.validation'), description: t('settings.branch.nameRequired'), variant: 'destructive' }); return }
                await frappeClient.post('Branch', { branch: branchForm.branch, company: userCompany || undefined })
                toast({ title: t('common.success'), description: t('settings.branch.created') })
                setBranchForm({ branch: '' })
                await loadBranches()
            }

            setCreateDialog({ type: '', open: false })
        } catch (error) {
            console.error('Failed to create:', error)
            toast({ title: t('common.error'), description: t('common.createFailed'), variant: 'destructive' })
        } finally { setSaving(false) }
    }

    // ==================== Generic Delete Handler ====================

    const handleDelete = async () => {
        try {
            setDeleting(true)
            await frappeClient.delete(deleteConfirm.doctype, deleteConfirm.name)
            toast({ title: t('common.deleted'), description: `${deleteConfirm.label} ${t('common.hasBeenDeleted')}` })
            setDeleteConfirm({ open: false, doctype: '', name: '', label: '' })

            if (deleteConfirm.doctype === 'Department') await loadDepartments()
            else if (deleteConfirm.doctype === 'Designation') await loadDesignations()
            else if (deleteConfirm.doctype === 'Employment Type') await loadEmploymentTypes()
            else if (deleteConfirm.doctype === 'Branch') await loadBranches()
        } catch (error) {
            console.error('Failed to delete:', error)
            toast({ title: t('common.error'), description: t('common.deleteFailed'), variant: 'destructive' })
        } finally { setDeleting(false) }
    }

    const stats = useMemo(() => ({
        departments: departments.length,
        designations: designations.length,
        employmentTypes: employmentTypes.length,
        branches: branches.length,
    }), [departments, designations, employmentTypes, branches])

    // ==================== Render ====================

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-foreground">{t('settings.pageTitle')}</h1>
                    <p className="text-muted-foreground mt-1">{t('settings.pageDesc')}</p>
                </div>
                {userCompany && (
                    <div className="flex items-center gap-2 bg-accent border border-primary/20 rounded-lg px-3 py-2">
                        <Building className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-accent-foreground">{t('settings.company')}:</span>
                        <span className="text-sm text-primary">{userCompany}</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-accent rounded-lg"><Building className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">{t('settings.tabs.departments')}</p><p className="text-2xl font-bold">{stats.departments}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-green-50 rounded-lg"><Award className="h-5 w-5 text-green-600" /></div><div><p className="text-sm text-muted-foreground">{t('settings.tabs.designations')}</p><p className="text-2xl font-bold">{stats.designations}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-yellow-50 rounded-lg"><Briefcase className="h-5 w-5 text-yellow-600" /></div><div><p className="text-sm text-muted-foreground">{t('settings.tabs.empTypes')}</p><p className="text-2xl font-bold">{stats.employmentTypes}</p></div></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 bg-purple-50 rounded-lg"><MapPin className="h-5 w-5 text-purple-600" /></div><div><p className="text-sm text-muted-foreground">{t('settings.tabs.branches')}</p><p className="text-2xl font-bold">{stats.branches}</p></div></div></CardContent></Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-5 h-auto">
                    <TabsTrigger value="hr-settings" className="text-xs">{t('settings.tabs.hrSettings')}</TabsTrigger>
                    <TabsTrigger value="departments" className="text-xs">{t('settings.tabs.departments')}</TabsTrigger>
                    <TabsTrigger value="designations" className="text-xs">{t('settings.tabs.designations')}</TabsTrigger>
                    <TabsTrigger value="employment-types" className="text-xs">{t('settings.tabs.empTypes')}</TabsTrigger>
                    <TabsTrigger value="branches" className="text-xs">{t('settings.tabs.branches')}</TabsTrigger>
                </TabsList>

                {/* ==================== HR Settings Tab ==================== */}
                <TabsContent value="hr-settings" className="mt-4">
                    <HRSettingsForm />
                </TabsContent>

                {/* ==================== Departments Tab ==================== */}
                <TabsContent value="departments" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">{t('settings.tabs.departments')}</CardTitle>
                                <div className="flex gap-2">
                                    <Button aria-label="إضافة" title="إضافة" size="sm" onClick={() => setCreateDialog({ type: 'department', open: true })}>
                                        <Plus className="h-4 w-4 mr-1" /> {t('common.add')}
                                    </Button>
                                    <Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={() => loadDepartments()}><RefreshCw className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                                : departments.length === 0 ? (
                                    <div className="text-center py-12"><Building className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" /><h3 className="text-lg font-medium text-foreground">{t('settings.dept.empty')}</h3>
                                        <Button aria-label="إضافة" title="إضافة" size="sm" className="mt-3" onClick={() => setCreateDialog({ type: 'department', open: true })}><Plus className="h-4 w-4 mr-1" /> {t('settings.dept.create')}</Button>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader><TableRow><TableHead>{t('settings.dept.name')}</TableHead><TableHead>{t('settings.dept.parent')}</TableHead><TableHead>{t('settings.dept.type')}</TableHead><TableHead>{t('common.status')}</TableHead><TableHead className="w-[60px]">{t('common.actions')}</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {departments.map((d) => (
                                                <TableRow key={d.name}>
                                                    <TableCell className="font-medium">{translateDepartment(d.name, locale)}</TableCell>
                                                    <TableCell>{d.parent_department ? translateDepartment(d.parent_department, locale) : '-'}</TableCell>
                                                    <TableCell>{d.is_group ? <Badge className="bg-accent text-accent-foreground">{t('settings.dept.group')}</Badge> : <Badge variant="outline">{t('settings.dept.leaf')}</Badge>}</TableCell>
                                                    <TableCell>{d.disabled ? <Badge className="bg-red-100 text-red-800">{t('common.disabled')}</Badge> : <Badge className="bg-green-100 text-green-800">{t('common.active')}</Badge>}</TableCell>
                                                    <TableCell>
                                                        <Button aria-label="حذف" title="حذف" variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteConfirm({ open: true, doctype: 'Department', name: d.name, label: translateDepartment(d.name, locale) })}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ==================== Designations Tab ==================== */}
                <TabsContent value="designations" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">{t('settings.tabs.designations')}</CardTitle>
                                <div className="flex gap-2">
                                    <Button aria-label="إضافة" title="إضافة" size="sm" onClick={() => setCreateDialog({ type: 'designation', open: true })}>
                                        <Plus className="h-4 w-4 mr-1" /> {t('common.add')}
                                    </Button>
                                    <Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={() => loadDesignations()}><RefreshCw className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                                : designations.length === 0 ? (
                                    <div className="text-center py-12"><Award className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" /><h3 className="text-lg font-medium text-foreground">{t('settings.desig.empty')}</h3>
                                        <Button aria-label="إضافة" title="إضافة" size="sm" className="mt-3" onClick={() => setCreateDialog({ type: 'designation', open: true })}><Plus className="h-4 w-4 mr-1" /> {t('settings.desig.create')}</Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {designations.map((d) => (
                                            <Card key={d.name} className="border group relative">
                                                <CardContent className="p-3 flex items-center gap-2">
                                                    <Award className="h-4 w-4 text-green-600" />
                                                    <span className="font-medium text-sm flex-1">{translateEnum('designation', d.name, locale)}</span>
                                                    <Button aria-label="حذف" title="حذف" variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm({ open: true, doctype: 'Designation', name: d.name, label: d.name })}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ==================== Employment Types Tab ==================== */}
                <TabsContent value="employment-types" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">{t('settings.tabs.empTypes')}</CardTitle>
                                <div className="flex gap-2">
                                    <Button aria-label="إضافة" title="إضافة" size="sm" onClick={() => setCreateDialog({ type: 'employment-type', open: true })}>
                                        <Plus className="h-4 w-4 mr-1" /> {t('common.add')}
                                    </Button>
                                    <Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={() => loadEmploymentTypes()}><RefreshCw className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                                : employmentTypes.length === 0 ? (
                                    <div className="text-center py-12"><Briefcase className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" /><h3 className="text-lg font-medium text-foreground">{t('settings.empType.empty')}</h3><p className="text-muted-foreground mt-1">{t('settings.empType.emptyDesc')}</p>
                                        <Button aria-label="إضافة" title="إضافة" size="sm" className="mt-3" onClick={() => setCreateDialog({ type: 'employment-type', open: true })}><Plus className="h-4 w-4 mr-1" /> {t('settings.empType.create')}</Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {employmentTypes.map((et) => (
                                            <Card key={et.name} className="border group relative">
                                                <CardContent className="p-4 flex items-center gap-3">
                                                    <div className="p-2 bg-yellow-50 rounded-lg"><Briefcase className="h-5 w-5 text-yellow-600" /></div>
                                                    <span className="font-medium flex-1">{et.name}</span>
                                                    <Button aria-label="حذف" title="حذف" variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm({ open: true, doctype: 'Employment Type', name: et.name, label: et.name })}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ==================== Branches Tab ==================== */}
                <TabsContent value="branches" className="mt-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">{t('settings.tabs.branches')}</CardTitle>
                                <div className="flex gap-2">
                                    <Button aria-label="إضافة" title="إضافة" size="sm" onClick={() => setCreateDialog({ type: 'branch', open: true })}>
                                        <Plus className="h-4 w-4 mr-1" /> {t('common.add')}
                                    </Button>
                                    <Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={() => loadBranches()}><RefreshCw className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loading ? <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
                                : branches.length === 0 ? (
                                    <div className="text-center py-12"><MapPin className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" /><h3 className="text-lg font-medium text-foreground">{t('settings.branch.empty')}</h3><p className="text-muted-foreground mt-1">{t('settings.branch.emptyDesc')}</p>
                                        <Button aria-label="إضافة" title="إضافة" size="sm" className="mt-3" onClick={() => setCreateDialog({ type: 'branch', open: true })}><Plus className="h-4 w-4 mr-1" /> {t('settings.branch.create')}</Button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                        {branches.map((b) => (
                                            <Card key={b.name} className="border group relative">
                                                <CardContent className="p-4 flex items-center gap-3">
                                                    <div className="p-2 bg-accent rounded-lg"><MapPin className="h-5 w-5 text-primary" /></div>
                                                    <span className="font-medium flex-1">{b.name}</span>
                                                    <Button aria-label="حذف" title="حذف" variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm({ open: true, doctype: 'Branch', name: b.name, label: b.name })}>
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ==================== Create Dialogs ==================== */}
            <Dialog open={createDialog.open} onOpenChange={(open) => setCreateDialog({ ...createDialog, open })}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {createDialog.type === 'department' && t('settings.dept.createTitle')}
                            {createDialog.type === 'designation' && t('settings.desig.createTitle')}
                            {createDialog.type === 'employment-type' && t('settings.empType.createTitle')}
                            {createDialog.type === 'branch' && t('settings.branch.createTitle')}
                        </DialogTitle>
                        <DialogDescription>{t('settings.createDesc')}</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Department Form */}
                        {createDialog.type === 'department' && (
                            <>
                                <div className="space-y-2">
                                    <Label>{t('settings.dept.nameLabel')} *</Label>
                                    <Input value={deptForm.department} onChange={(e) => setDeptForm({ ...deptForm, department: e.target.value })} placeholder={t('settings.dept.namePlaceholder')} />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('settings.dept.parent')}</Label>
                                    <Select value={deptForm.parent_department} onValueChange={(v) => setDeptForm({ ...deptForm, parent_department: v })}>
                                        <SelectTrigger aria-label={t('settings.dept.parentPlaceholder')}><SelectValue placeholder={t('settings.dept.parentPlaceholder')} /></SelectTrigger>
                                        <SelectContent>
                                            {departments.filter(d => d.is_group).map((d) => <SelectItem key={d.name} value={d.name}>{translateDepartment(d.name, locale)}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Switch checked={!!deptForm.is_group} onCheckedChange={(v) => setDeptForm({ ...deptForm, is_group: v ? 1 : 0 })} />
                                    <Label>{t('settings.dept.isGroup')}</Label>
                                </div>
                            </>
                        )}

                        {/* Designation Form */}
                        {createDialog.type === 'designation' && (
                            <>
                                <div className="space-y-2">
                                    <Label>{t('settings.desig.nameLabel')} *</Label>
                                    <Input value={desigForm.designation} onChange={(e) => setDesigForm({ ...desigForm, designation: e.target.value })} placeholder={t('settings.desig.namePlaceholder')} />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('settings.desig.description')}</Label>
                                    <Input value={desigForm.description} onChange={(e) => setDesigForm({ ...desigForm, description: e.target.value })} placeholder={t('settings.desig.descPlaceholder')} />
                                </div>
                            </>
                        )}

                        {/* Employment Type Form */}
                        {createDialog.type === 'employment-type' && (
                            <div className="space-y-2">
                                <Label>{t('settings.empType.nameLabel')} *</Label>
                                <Input value={empTypeForm.name} onChange={(e) => setEmpTypeForm({ ...empTypeForm, name: e.target.value })} placeholder={t('settings.empType.namePlaceholder')} />
                            </div>
                        )}

                        {/* Branch Form */}
                        {createDialog.type === 'branch' && (
                            <div className="space-y-2">
                                <Label>{t('settings.branch.nameLabel')} *</Label>
                                <Input value={branchForm.branch} onChange={(e) => setBranchForm({ ...branchForm, branch: e.target.value })} placeholder={t('settings.branch.namePlaceholder')} />
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialog({ type: '', open: false })} disabled={saving}>{t('common.cancel')}</Button>
                        <Button onClick={handleCreate} disabled={saving}>
                            {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {t('common.creating')}</> : t('common.create')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ==================== Delete Confirmation ==================== */}
            <AlertDialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ ...deleteConfirm, open: false })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('common.delete')} {deleteConfirm.doctype}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('common.deleteConfirm')} <strong>{deleteConfirm.label}</strong>? {t('common.cannotUndo')}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
                            {deleting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {t('common.deleting')}</> : t('common.delete')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
