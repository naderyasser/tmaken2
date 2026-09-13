'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useI18n } from '@/lib/i18n'
import { formatDateShort, formatTime } from '@/lib/format'
import { translateDepartment } from '@/lib/enums'
import { frappeClient, type Employee } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Clock, Plus, Users, RefreshCw, Search, UserCheck, LogIn, LogOut, Calendar, Settings2, Save, Loader2, Pencil } from 'lucide-react'

// ==================== Types ====================

interface ShiftType {
  name: string
  start_time?: string
  end_time?: string
  holiday_list?: string
  color?: string
  enable_auto_attendance?: number
  determine_check_in_and_check_out?: string
  working_hours_calculation_based_on?: string
  begin_check_in_before_shift_start_time?: number
  allow_check_out_after_shift_end_time?: number
  mark_auto_attendance_on_holidays?: number
  working_hours_threshold_for_half_day?: number
  working_hours_threshold_for_absent?: number
  process_attendance_after?: string
  last_sync_of_checkin?: string
  auto_update_last_sync?: number
  enable_late_entry_marking?: number
  late_entry_grace_period?: number
  enable_early_exit_marking?: number
  early_exit_grace_period?: number
  allow_overtime?: number
  custom_enable_auto_checkout?: number
}

interface ShiftAssignment {
  name: string
  employee: string
  employee_name?: string
  department?: string
  shift_type?: string
  start_date?: string
  end_date?: string
  status?: string
  company?: string
}

interface EmployeeCheckin {
  name: string
  employee: string
  employee_name?: string
  time?: string
  log_type?: string
  device_id?: string
  shift?: string
}

interface ShiftRequest {
  name: string
  employee: string
  employee_name?: string
  department?: string
  shift_type?: string
  from_date?: string
  to_date?: string
  status?: string
  approver?: string
}

const SHIFT_ALL_FIELDS = [
  'name', 'start_time', 'end_time', 'holiday_list', 'color',
  'enable_auto_attendance', 'determine_check_in_and_check_out',
  'working_hours_calculation_based_on', 'begin_check_in_before_shift_start_time',
  'allow_check_out_after_shift_end_time', 'mark_auto_attendance_on_holidays',
  'working_hours_threshold_for_half_day', 'working_hours_threshold_for_absent',
  'process_attendance_after', 'last_sync_of_checkin', 'auto_update_last_sync',
  'enable_late_entry_marking', 'late_entry_grace_period',
  'enable_early_exit_marking', 'early_exit_grace_period', 'allow_overtime',
  'custom_enable_auto_checkout',
]

const DEFAULT_SHIFT: Partial<ShiftType> = {
  start_time: '08:00:00',
  end_time: '17:00:00',
  enable_auto_attendance: 1,
  determine_check_in_and_check_out: 'Alternating entries as IN and OUT during the same shift',
  working_hours_calculation_based_on: 'First Check-in and Last Check-out',
  begin_check_in_before_shift_start_time: 60,
  allow_check_out_after_shift_end_time: 60,
  mark_auto_attendance_on_holidays: 0,
  working_hours_threshold_for_half_day: 0,
  working_hours_threshold_for_absent: 0,
  enable_late_entry_marking: 0,
  late_entry_grace_period: 15,
  enable_early_exit_marking: 0,
  early_exit_grace_period: 15,
  allow_overtime: 0,
  custom_enable_auto_checkout: 0,
}

// ==================== Shift Edit Dialog ====================

function ShiftEditDialog({ shift, isNew, open, onClose, onSaved, t }: {
  shift: Partial<ShiftType>
  isNew: boolean
  open: boolean
  onClose: () => void
  onSaved: () => void
  t: (key: string) => string
}) {
  const [form, setForm] = useState<Partial<ShiftType>>(shift)
  const [saving, setSaving] = useState(false)
  const [dialogTab, setDialogTab] = useState('basic')
  const { toast } = useToast()

  useEffect(() => { setForm(shift) }, [shift])

  const update = (key: keyof ShiftType, value: string | number) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      if (isNew) {
        if (!form.name) {
          toast({ title: t('common.error'), description: t('shift.shift_name') + ' required', variant: 'destructive' })
          return
        }
        await frappeClient.post('Shift Type', form as any)
        toast({ title: t('common.success'), description: t('shift.created_success') })
      } else {
        await frappeClient.put('Shift Type', form.name!, form as any)
        toast({ title: t('common.success'), description: t('shift.saved_success') })
      }
      onSaved()
      onClose()
    } catch (err) {
      console.error('Save shift error:', err)
      toast({ title: t('common.error'), description: t('shift.save_failed'), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const SettingRow = ({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between py-3 px-4 bg-card border border-border rounded-lg">
      <div className="flex-1 min-w-0 mr-3">
        <Label className="text-sm font-semibold text-foreground">{label}</Label>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            {isNew ? t('shift.create_shift') : t('shift.edit_shift')}
            {!isNew && <Badge variant="outline" className="ml-2">{form.name}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={dialogTab} onValueChange={setDialogTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">{t('shift.basic_settings')}</TabsTrigger>
            <TabsTrigger value="auto">{t('shift.auto_settings')}</TabsTrigger>
            <TabsTrigger value="grace">{t('shift.grace_settings')}</TabsTrigger>
          </TabsList>

          {/* Basic Settings */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            {isNew && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/90">{t('shift.shift_name')}</Label>
                <Input value={form.name || ''} onChange={(e) => update('name', e.target.value)} placeholder={t('shift.shift_name')} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/90">{t('shift.start_time')}</Label>
                <Input type="time" step="1" value={(form.start_time || '08:00:00').substring(0, 8)} onChange={(e) => update('start_time', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/90">{t('shift.end_time')}</Label>
                <Input type="time" step="1" value={(form.end_time || '17:00:00').substring(0, 8)} onChange={(e) => update('end_time', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground/90">{t('shift.determine_checkin')}</Label>
              <Select value={form.determine_check_in_and_check_out || 'Alternating entries as IN and OUT during the same shift'} onValueChange={(v) => update('determine_check_in_and_check_out', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alternating entries as IN and OUT during the same shift">{t('shift.alternating')}</SelectItem>
                  <SelectItem value="Strictly based on Log Type in Employee Checkin">{t('shift.strictly_based')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground/90">{t('shift.working_hours_calc')}</Label>
              <Select value={form.working_hours_calculation_based_on || 'First Check-in and Last Check-out'} onValueChange={(v) => update('working_hours_calculation_based_on', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="First Check-in and Last Check-out">{t('shift.first_last')}</SelectItem>
                  <SelectItem value="Every Valid Check-in and Check-out">{t('shift.every_valid')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Auto Attendance Settings */}
          <TabsContent value="auto" className="space-y-3 mt-4">
            <SettingRow label={t('shift.enable_auto_attendance')} desc={t('shift.enable_auto_attendance_desc')}>
              <Switch checked={form.enable_auto_attendance === 1} onCheckedChange={(v) => update('enable_auto_attendance', v ? 1 : 0)} />
            </SettingRow>
            {form.enable_auto_attendance === 1 && (
              <>
                <SettingRow label={t('shift.auto_checkout')} desc={t('shift.auto_checkout_desc')}>
                  <Switch checked={form.custom_enable_auto_checkout === 1} onCheckedChange={(v) => update('custom_enable_auto_checkout', v ? 1 : 0)} />
                </SettingRow>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-foreground/90">{t('shift.begin_before')}</Label>
                    <Input type="number" value={form.begin_check_in_before_shift_start_time ?? 60} onChange={(e) => update('begin_check_in_before_shift_start_time', parseInt(e.target.value) || 0)} />
                    <p className="text-xs text-muted-foreground/70">{t('shift.begin_before_desc')}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-foreground/90">{t('shift.allow_after')}</Label>
                    <Input type="number" value={form.allow_check_out_after_shift_end_time ?? 60} onChange={(e) => update('allow_check_out_after_shift_end_time', parseInt(e.target.value) || 0)} />
                    <p className="text-xs text-muted-foreground/70">{t('shift.allow_after_desc')}</p>
                  </div>
                </div>
                <SettingRow label={t('shift.mark_holidays')} desc={t('shift.mark_holidays_desc')}>
                  <Switch checked={form.mark_auto_attendance_on_holidays === 1} onCheckedChange={(v) => update('mark_auto_attendance_on_holidays', v ? 1 : 0)} />
                </SettingRow>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-foreground/90">{t('shift.threshold_half')}</Label>
                    <Input type="number" step="0.5" value={form.working_hours_threshold_for_half_day ?? 0} onChange={(e) => update('working_hours_threshold_for_half_day', parseFloat(e.target.value) || 0)} />
                    <p className="text-xs text-muted-foreground/70">{t('shift.threshold_half_desc')}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-foreground/90">{t('shift.threshold_absent')}</Label>
                    <Input type="number" step="0.5" value={form.working_hours_threshold_for_absent ?? 0} onChange={(e) => update('working_hours_threshold_for_absent', parseFloat(e.target.value) || 0)} />
                    <p className="text-xs text-muted-foreground/70">{t('shift.threshold_absent_desc')}</p>
                  </div>
                </div>
                <SettingRow label={t('shift.allow_overtime')} desc={t('shift.allow_overtime_desc')}>
                  <Switch checked={form.allow_overtime === 1} onCheckedChange={(v) => update('allow_overtime', v ? 1 : 0)} />
                </SettingRow>
              </>
            )}
          </TabsContent>

          {/* Late Entry & Early Exit */}
          <TabsContent value="grace" className="space-y-3 mt-4">
            <SettingRow label={t('shift.late_entry')} desc={t('shift.late_entry_desc')}>
              <Switch checked={form.enable_late_entry_marking === 1} onCheckedChange={(v) => update('enable_late_entry_marking', v ? 1 : 0)} />
            </SettingRow>
            {form.enable_late_entry_marking === 1 && (
              <div className="space-y-2 pl-4">
                <Label className="text-xs font-semibold text-foreground/90">{t('shift.late_grace')}</Label>
                <Input type="number" value={form.late_entry_grace_period ?? 15} onChange={(e) => update('late_entry_grace_period', parseInt(e.target.value) || 0)} className="max-w-[200px]" />
              </div>
            )}
            <SettingRow label={t('shift.early_exit')} desc={t('shift.early_exit_desc')}>
              <Switch checked={form.enable_early_exit_marking === 1} onCheckedChange={(v) => update('enable_early_exit_marking', v ? 1 : 0)} />
            </SettingRow>
            {form.enable_early_exit_marking === 1 && (
              <div className="space-y-2 pl-4">
                <Label className="text-xs font-semibold text-foreground/90">{t('shift.early_grace')}</Label>
                <Input type="number" value={form.early_exit_grace_period ?? 15} onChange={(e) => update('early_exit_grace_period', parseInt(e.target.value) || 0)} className="max-w-[200px]" />
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('common.saving')}</> : <><Save className="mr-2 h-4 w-4" />{isNew ? t('shift.create') : t('shift.save')}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ==================== Inner Component ====================

function ShiftManagementContent() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState('shift-types')
  const [shiftTypes, setShiftTypes] = useState<ShiftType[]>([])
  const [shiftAssignments, setShiftAssignments] = useState<ShiftAssignment[]>([])
  const [checkins, setCheckins] = useState<EmployeeCheckin[]>([])
  const [shiftRequests, setShiftRequests] = useState<ShiftRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [editingShift, setEditingShift] = useState<Partial<ShiftType> | null>(null)
  const [isNewShift, setIsNewShift] = useState(false)

  // Create shift dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [shiftForm, setShiftForm] = useState({
    shift_type_name: '',
    start_time: '08:00:00',
    end_time: '16:00:00',
    enable_auto_attendance: 1,
    late_entry_grace_period: 15,
    early_exit_grace_period: 15,
  })

  // Employees list for autocomplete
  const [employees, setEmployees] = useState<Employee[]>([])

  // Assign shift dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [assignForm, setAssignForm] = useState({
    employee: '',
    shift_type: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    company: '',
  })

  // ==================== Data Loading ====================

  const loadEmployees = useCallback(async () => {
    try {
      const response = await frappeClient.get<Employee[]>('Employee', undefined, {
        fields: ['name', 'employee_name', 'department', 'status'],
        filters: [['Employee', 'status', '=', 'Active']],
        order_by: 'employee_name asc',
        limit_page_length: 500,
      })
      setEmployees(response.data || [])
    } catch (error) {
      console.error('Failed to load employees:', error)
    }
  }, [])

  // Load employees when assign dialog opens
  useEffect(() => {
    if (assignDialogOpen && employees.length === 0) {
      loadEmployees()
    }
  }, [assignDialogOpen, employees.length, loadEmployees])

  const loadShiftTypes = useCallback(async () => {
    try {
      setLoading(true)
      const response = await frappeClient.get<ShiftType[]>('Shift Type', undefined, {
        fields: SHIFT_ALL_FIELDS,
        order_by: 'name asc',
        limit_page_length: 50,
      })
      setShiftTypes(response.data || [])
    } catch (error) {
      console.error('Failed to load shift types:', error)
      toast({ title: t('error'), description: t('shift.no_types'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [t, toast])

  const loadShiftAssignments = useCallback(async () => {
    try {
      setLoading(true)
      const response = await frappeClient.get<ShiftAssignment[]>('Shift Assignment', undefined, {
        fields: ['name', 'employee', 'employee_name', 'department', 'shift_type', 'start_date', 'end_date', 'status', 'company'],
        order_by: 'start_date desc',
        limit_page_length: 100,
      })
      setShiftAssignments(response.data || [])
    } catch (error) {
      console.error('Failed to load shift assignments:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCheckins = useCallback(async () => {
    try {
      setLoading(true)
      const response = await frappeClient.get<EmployeeCheckin[]>('Employee Checkin', undefined, {
        fields: ['name', 'employee', 'employee_name', 'time', 'log_type', 'device_id', 'shift'],
        order_by: 'time desc',
        limit_page_length: 100,
      })
      setCheckins(response.data || [])
    } catch (error) {
      console.error('Failed to load checkins:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadShiftRequests = useCallback(async () => {
    try {
      setLoading(true)
      const response = await frappeClient.get<ShiftRequest[]>('Shift Request', undefined, {
        fields: ['name', 'employee', 'employee_name', 'department', 'shift_type', 'from_date', 'to_date', 'status', 'approver'],
        order_by: 'creation desc',
        limit_page_length: 100,
      })
      setShiftRequests(response.data || [])
    } catch (error) {
      console.error('Failed to load shift requests:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'shift-types') loadShiftTypes()
    else if (activeTab === 'assignments') loadShiftAssignments()
    else if (activeTab === 'checkins') loadCheckins()
    else if (activeTab === 'requests') loadShiftRequests()
  }, [activeTab, loadShiftTypes, loadShiftAssignments, loadCheckins, loadShiftRequests])

  // ==================== Actions ====================

  const handleCreateShift = async () => {
    if (!shiftForm.shift_type_name.trim()) {
      toast({ title: t('error'), description: 'Shift name is required', variant: 'destructive' })
      return
    }
    try {
      setCreating(true)
      await frappeClient.post('Shift Type', {
        name: shiftForm.shift_type_name,
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        enable_auto_attendance: shiftForm.enable_auto_attendance,
        late_entry_grace_period: shiftForm.late_entry_grace_period,
        early_exit_grace_period: shiftForm.early_exit_grace_period,
      })
      toast({ title: t('success'), description: 'Shift created successfully' })
      setCreateDialogOpen(false)
      setShiftForm({
        shift_type_name: '',
        start_time: '08:00:00',
        end_time: '16:00:00',
        enable_auto_attendance: 1,
        late_entry_grace_period: 15,
        early_exit_grace_period: 15,
      })
      loadShiftTypes()
    } catch (error) {
      console.error('Error creating shift:', error)
      toast({ title: t('error'), description: 'Failed to create shift', variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

  const handleAssignShift = async () => {
    if (!assignForm.employee.trim() || !assignForm.shift_type) {
      toast({ title: t('error'), description: 'Employee and shift type are required', variant: 'destructive' })
      return
    }
    try {
      setAssigning(true)
      const data: Record<string, string> = {
        employee: assignForm.employee,
        shift_type: assignForm.shift_type,
        start_date: assignForm.start_date,
      }
      if (assignForm.end_date) data.end_date = assignForm.end_date
      if (assignForm.company) data.company = assignForm.company

      await frappeClient.post('Shift Assignment', data)
      toast({ title: t('success'), description: 'Shift assigned successfully' })
      setAssignDialogOpen(false)
      setAssignForm({
        employee: '',
        shift_type: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        company: '',
      })
      if (activeTab === 'assignments') loadShiftAssignments()
    } catch (error) {
      console.error('Error assigning shift:', error)
      toast({ title: t('error'), description: 'Failed to assign shift', variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  // ==================== Helpers ====================

  // Filter employees to top 5 matches based on current input
  const filteredEmployees = useMemo(() => {
    const query = assignForm.employee.trim().toLowerCase()
    if (!query) return employees.slice(0, 5)
    return employees
      .filter(emp =>
        emp.name.toLowerCase().includes(query) ||
        emp.employee_name.toLowerCase().includes(query)
      )
      .slice(0, 5)
  }, [assignForm.employee, employees])

  const stats = {
    shiftTypes: shiftTypes.length,
    activeAssignments: shiftAssignments.filter(s => s.status === 'Active').length,
    todayCheckins: checkins.length,
    pendingRequests: shiftRequests.filter(s => s.status === 'Draft').length,
  }

  const statusBadge = (status: string | undefined) => {
    const map: Record<string, string> = {
      'Active': 'bg-green-100 text-green-800',
      'Inactive': 'bg-muted text-foreground',
      'Draft': 'bg-yellow-100 text-yellow-800',
      'Approved': 'bg-green-100 text-green-800',
      'Rejected': 'bg-red-100 text-red-800',
    }
    const label: Record<string, string> = { Active: 'نشط', Inactive: 'غير نشط', Draft: 'مسودة', Approved: 'معتمد', Rejected: 'مرفوض' }
    return <Badge className={map[status || ''] || 'bg-muted text-foreground'}>{t('dir') === 'rtl' ? (label[status || ''] || status || '-') : (status || '-')}</Badge>
  }

  // ==================== Render ====================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('shift.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('shift.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                {t('shift.assignments')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('shift.shift_assignments')}</DialogTitle>
                <DialogDescription>{t('shift.no_assignments_sub')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('employee')}</Label>
                  <Input
                    list="employees_list"
                    placeholder={t('shift.emp_select_ph')}
                    value={assignForm.employee}
                    onChange={(e) => setAssignForm({ ...assignForm, employee: e.target.value })}
                  />
                  <datalist id="employees_list">
                    {filteredEmployees.map((emp) => (
                      <option key={emp.name} value={emp.name}>
                        {emp.employee_name} — {translateDepartment(emp.department, t('dir') === 'rtl' ? 'ar' : 'en')}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label>{t('att.shift')}</Label>
                  <Select
                    value={assignForm.shift_type}
                    onValueChange={(value) => setAssignForm({ ...assignForm, shift_type: value })}
                  >
                    <SelectTrigger aria-label={t('shift.types')}>
                      <SelectValue placeholder={t('shift.types')} />
                    </SelectTrigger>
                    <SelectContent>
                      {shiftTypes.map((shift) => (
                        <SelectItem key={shift.name} value={shift.name}>
                          {shift.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t('shift.start')}</Label>
                    <Input
                      type="date"
                      value={assignForm.start_date}
                      onChange={(e) => setAssignForm({ ...assignForm, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('shift.end')}</Label>
                    <Input
                      type="date"
                      value={assignForm.end_date}
                      onChange={(e) => setAssignForm({ ...assignForm, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <Button aria-label="تحديث" title="تحديث" onClick={handleAssignShift} className="w-full" disabled={assigning}>
                  {assigning ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t('shift.assignments')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button aria-label="إضافة" title="إضافة" onClick={() => { setEditingShift({ ...DEFAULT_SHIFT, name: '' }); setIsNewShift(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            {t('shift.create_shift')}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg"><Clock className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{t('shift.types')}</p>
                <p className="text-2xl font-bold">{stats.shiftTypes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg"><UserCheck className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{t('shift.active_assignments')}</p>
                <p className="text-2xl font-bold">{stats.activeAssignments}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg"><LogIn className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{t('shift.checkins')}</p>
                <p className="text-2xl font-bold">{stats.todayCheckins}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg"><Calendar className="h-5 w-5 text-yellow-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">{t('shift.pending_requests')}</p>
                <p className="text-2xl font-bold">{stats.pendingRequests}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="shift-types">{t('shift.types')}</TabsTrigger>
          <TabsTrigger value="assignments">{t('shift.assignments')}</TabsTrigger>
          <TabsTrigger value="checkins">{t('shift.checkins')}</TabsTrigger>
          <TabsTrigger value="requests">{t('shift.requests')}</TabsTrigger>
        </TabsList>

        {/* Shift Types Tab */}
        <TabsContent value="shift-types" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t('shift.types')}</CardTitle>
                <Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={loadShiftTypes}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : shiftTypes.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-foreground">{t('shift.no_types')}</h3>
                  <p className="text-muted-foreground mt-1">{t('shift.no_types_sub')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {shiftTypes.map((st) => (
                    <Card key={st.name} className="border cursor-pointer hover:border-primary/30 hover:shadow-md transition-all" onClick={() => { setEditingShift(st); setIsNewShift(false) }}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent rounded-lg"><Clock className="h-5 w-5 text-primary" /></div>
                            <div>
                              <h3 className="font-medium">{st.name}</h3>
                              <p className="text-sm text-muted-foreground">{st.start_time?.substring(0, 5)} - {st.end_time?.substring(0, 5)}</p>
                            </div>
                          </div>
                          <Pencil className="h-4 w-4 text-muted-foreground/70" />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {st.enable_auto_attendance ? <Badge className="bg-green-100 text-green-800">{t('shift.auto_attendance')}</Badge> : <Badge className="bg-muted text-muted-foreground">{t('shift.manual')}</Badge>}
                          {st.enable_late_entry_marking ? <Badge className="bg-orange-100 text-orange-800">{t('shift.late_entry')}</Badge> : null}
                          {st.enable_early_exit_marking ? <Badge className="bg-yellow-100 text-yellow-800">{t('shift.early_exit')}</Badge> : null}
                          {st.allow_overtime ? <Badge className="bg-purple-100 text-purple-800">{t('shift.allow_overtime')}</Badge> : null}
                          {st.holiday_list ? <Badge variant="outline">{st.holiday_list}</Badge> : null}
                        </div>
                        {st.enable_auto_attendance ? (
                          <div className="mt-3 pt-3 border-t border-border/60 text-xs text-muted-foreground space-y-1">
                            <div className="flex justify-between"><span>{t('shift.begin_before')}</span><span className="font-medium">{st.begin_check_in_before_shift_start_time ?? 60} min</span></div>
                            <div className="flex justify-between"><span>{t('shift.allow_after')}</span><span className="font-medium">{st.allow_check_out_after_shift_end_time ?? 60} min</span></div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t('shift.shift_assignments')}</CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                    <Input
                      placeholder={t('search')}
                      className="pl-9 w-64"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={loadShiftAssignments}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : shiftAssignments.length === 0 ? (
                <div className="text-center py-12">
                  <UserCheck className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-foreground">{t('shift.no_assignments')}</h3>
                  <p className="text-muted-foreground mt-1">{t('shift.no_assignments_sub')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('employee')}</TableHead>
                      <TableHead>{t('department')}</TableHead>
                      <TableHead>{t('att.shift')}</TableHead>
                      <TableHead>{t('shift.start')}</TableHead>
                      <TableHead>{t('shift.end')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shiftAssignments
                      .filter(s => !searchQuery || s.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((sa) => (
                        <TableRow key={sa.name}>
                          <TableCell className="font-medium">{sa.employee_name || sa.employee}</TableCell>
                          <TableCell>{sa.department ? translateDepartment(sa.department, t('dir') === 'rtl' ? 'ar' : 'en') : '-'}</TableCell>
                          <TableCell>{sa.shift_type || '-'}</TableCell>
                          <TableCell className="tabular-nums">{formatDateShort(sa.start_date) || '-'}</TableCell>
                          <TableCell className="tabular-nums">{formatDateShort(sa.end_date) || '-'}</TableCell>
                          <TableCell>{statusBadge(sa.status)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Checkins Tab */}
        <TabsContent value="checkins" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t('shift.emp_checkins')}</CardTitle>
                <Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={loadCheckins}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : checkins.length === 0 ? (
                <div className="text-center py-12">
                  <LogIn className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-foreground">{t('shift.no_checkins')}</h3>
                  <p className="text-muted-foreground mt-1">{t('shift.no_checkins_sub')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('employee')}</TableHead>
                      <TableHead>{t('rec.time')}</TableHead>
                      <TableHead>{t('life.type')}</TableHead>
                      <TableHead>{t('att.shift')}</TableHead>
                      <TableHead>{t('shift.device')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkins.map((ci) => (
                      <TableRow key={ci.name}>
                        <TableCell className="font-medium">{ci.employee_name || ci.employee}</TableCell>
                        <TableCell className="tabular-nums">{ci.time ? `${formatDateShort(ci.time)} ${formatTime(ci.time)}` : '-'}</TableCell>
                        <TableCell>
                          {ci.log_type === 'IN' ? (
                            <Badge className="bg-green-100 text-green-800"><LogIn className="h-3 w-3 mr-1" />{t('shift.in')}</Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800"><LogOut className="h-3 w-3 mr-1" />{t('shift.out')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{ci.shift || '-'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{ci.device_id || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{t('shift.shift_requests')}</CardTitle>
                <Button aria-label="تحديث" title="تحديث" variant="outline" size="icon" onClick={loadShiftRequests}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : shiftRequests.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-foreground">{t('shift.no_requests')}</h3>
                  <p className="text-muted-foreground mt-1">{t('shift.no_requests_sub')}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('employee')}</TableHead>
                      <TableHead>{t('department')}</TableHead>
                      <TableHead>{t('att.shift')}</TableHead>
                      <TableHead>{t('leave.from')}</TableHead>
                      <TableHead>{t('leave.to')}</TableHead>
                      <TableHead>{t('shift.approver')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {shiftRequests.map((sr) => (
                      <TableRow key={sr.name}>
                        <TableCell className="font-medium">{sr.employee_name || sr.employee}</TableCell>
                        <TableCell>{sr.department ? translateDepartment(sr.department, t('dir') === 'rtl' ? 'ar' : 'en') : '-'}</TableCell>
                        <TableCell>{sr.shift_type || '-'}</TableCell>
                        <TableCell>{sr.from_date || '-'}</TableCell>
                        <TableCell>{sr.to_date || '-'}</TableCell>
                        <TableCell>{sr.approver || '-'}</TableCell>
                        <TableCell>{statusBadge(sr.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Shift Edit/Create Dialog */}
      {editingShift && (
        <ShiftEditDialog
          shift={editingShift}
          isNew={isNewShift}
          open={!!editingShift}
          onClose={() => setEditingShift(null)}
          onSaved={loadShiftTypes}
          t={t}
        />
      )}
    </div>
  )
}

// ==================== Page Wrapper ====================

export default function ShiftManagementPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <ShiftManagementContent />
      </div>
    </div>
  )
}
