'use client'
import { csrfFetch } from '@/lib/csrf'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, X, FileText, Loader2, CheckCircle, AlertCircle, Info, Search, UserCheck, UserX } from 'lucide-react'
import { frappeClient, frappeApiUrl } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/lib/i18n'
import { translateEnum } from '@/lib/enums'

interface LeaveApplicationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

interface LeaveFormData {
    employee: string
    leave_type: string
    from_date: string
    to_date: string
    description: string
    half_day: boolean
    illnessType: string
}

interface UploadedFile {
    name: string
    file_url: string
    size: number
}

interface LeaveBalanceInfo {
    leave_type: string
    total_leaves: number
    leaves_taken: number
    leaves_pending: number
    remaining_leaves: number
    from_date?: string
    to_date?: string
}

export function LeaveApplicationDialog({ open, onOpenChange, onSuccess }: LeaveApplicationDialogProps) {
    const { t } = useI18n()
    const { toast } = useToast()

    // Bilingual labels
    const L = {
        en: {
            success: 'Success',
            error: 'Error',
            allocCreated: 'Leave allocation created for employee',
            allocFailed: 'Failed to create leave allocation',
            fillRequired: 'Please fill all required fields',
            allocRequired: 'Leave allocation required',
            allocRequiredDesc: 'Employee must have leave allocation before applying. Use the "Create Allocation" button below.',
            insufficientBalance: 'Insufficient balance',
            balanceRemaining: 'remaining',
            days: 'days',
            settingUpHoliday: 'Setting up holiday list',
            settingUpHolidayDesc: 'Creating official holiday list for the company...',
            holidaySetupDone: 'Holiday list setup completed',
            holidayRequired: 'Holiday list required',
            holidayRequiredDesc: 'Please set up the official holiday list for the company from HR Settings before creating leave applications.',
            holidayRequiredEmpDesc: 'Please set up the official holiday list for the employee or company before creating leave applications.',
            leaveCreated: 'Leave application created successfully',
            leaveFailed: 'Failed to create leave application',
            noAllocPeriod: 'No leave allocation for this employee in the specified period. Please create allocation first.',
            insufficientLeaveBalance: 'Insufficient leave balance for this leave type',
            overlapError: 'Leave period overlaps with another leave application',
            holidayListError: 'Please set up the official holiday list for the company first',
            noAllocation: 'No leave allocation',
            noAllocationDesc: 'This employee has no leave allocation for this year. You must create one before applying.',
            createAllocation: 'Create leave allocation automatically',
            creating: 'Creating...',
            leaveBalance: 'Leave Balance',
            total: 'Total',
            remaining: 'Remaining',
            used: 'Used',
            employee: 'Employee',
            selectEmployee: 'Select employee',
            leaveType: 'Leave Type',
            selectLeaveType: 'Select leave type',
            paidLeave: 'Paid leave',
            unpaidLeave: 'Unpaid leave',
            fromDate: 'From Date',
            toDate: 'To Date',
            reason: 'Reason / Description',
            reasonPlaceholder: 'Enter leave reason...',
            attachments: 'Attachments (e.g. medical certificate)',
            uploading: 'Uploading...',
            clickToUpload: 'Click to upload files',
            incompleteData: 'Incomplete data',
            newLeaveApplication: 'New Leave Application',
            cancel: 'Cancel',
            submit: 'Submit Leave Application',
            submitting: 'Submitting...',
            balanceLoadFail: 'Failed to load leave balance',
            nationalIdLabel: 'National ID / Iqama Number',
            nationalIdPlaceholder: 'Enter ID number and press Enter',
            employeeFound: 'Employee found',
            employeeNotFound: 'No active employee found with this ID',
            lookingUp: 'Looking up...',
            illnessType: 'Illness Type',
            illnessTypePlaceholder: 'Enter illness type as stated in hospital certificate',
            illnessTypeRequired: 'Illness type is required for Sick Leave',
            certificateRequired: 'Medical certificate is required for Sick Leave',
            medicalCertificate: 'Medical Certificate (required for Sick Leave)',
            loadFormDataFail: 'Failed to load form data',
            noCompanyAssigned: 'Employee has no company assigned. Please assign a company first.',
            filesUploaded: '{n} file(s) uploaded successfully',
            uploadFail: 'Failed to upload files',
            unpaidShort: 'Unpaid',
        },
        ar: {
            success: 'تم بنجاح',
            error: 'خطأ',
            allocCreated: 'تم إنشاء رصيد الإجازات للموظف',
            allocFailed: 'فشل إنشاء رصيد الإجازات',
            fillRequired: 'يرجى ملء جميع الحقول المطلوبة',
            allocRequired: 'رصيد إجازات مطلوب',
            allocRequiredDesc: 'يجب إنشاء رصيد إجازات للموظف قبل تقديم الطلب. استخدم زر "إنشاء رصيد إجازات" أدناه.',
            insufficientBalance: 'رصيد غير كافي',
            balanceRemaining: 'المتبقي',
            days: 'يوم',
            settingUpHoliday: 'جاري إعداد قائمة العطل',
            settingUpHolidayDesc: 'جاري إنشاء قائمة العطل الرسمية للشركة...',
            holidaySetupDone: 'تم إعداد قائمة العطل الرسمية للشركة',
            holidayRequired: 'قائمة العطل مطلوبة',
            holidayRequiredDesc: 'يرجى إعداد قائمة العطل الرسمية للشركة من إعدادات الموارد البشرية قبل إنشاء طلبات الإجازة.',
            holidayRequiredEmpDesc: 'يرجى إعداد قائمة العطل الرسمية للموظف أو الشركة قبل إنشاء طلبات الإجازة.',
            leaveCreated: 'تم إنشاء طلب الإجازة بنجاح',
            leaveFailed: 'فشل إنشاء طلب الإجازة',
            noAllocPeriod: 'لا يوجد رصيد إجازات لهذا الموظف في الفترة المحددة. يرجى إنشاء رصيد إجازات أولاً من خلال الزر أدناه أو من صفحة إعداد الإجازات.',
            insufficientLeaveBalance: 'رصيد الإجازات غير كافي لهذا النوع من الإجازات',
            overlapError: 'فترة الإجازة تتداخل مع طلب إجازة آخر',
            holidayListError: 'يرجى إعداد قائمة العطل الرسمية للشركة أولاً',
            noAllocation: 'لا يوجد رصيد إجازات',
            noAllocationDesc: 'هذا الموظف ليس لديه رصيد إجازات مخصص لهذه السنة. يجب إنشاء رصيد إجازات قبل تقديم طلب إجازة.',
            createAllocation: 'إنشاء رصيد إجازات تلقائياً',
            creating: 'جاري الإنشاء...',
            leaveBalance: 'رصيد الإجازات',
            total: 'الإجمالي',
            remaining: 'المتبقي',
            used: 'مستخدم',
            employee: 'الموظف',
            selectEmployee: 'اختر الموظف',
            leaveType: 'نوع الإجازة',
            selectLeaveType: 'اختر نوع الإجازة',
            paidLeave: 'إجازة مدفوعة',
            unpaidLeave: 'إجازة بدون راتب',
            fromDate: 'من تاريخ',
            toDate: 'إلى تاريخ',
            reason: 'السبب / الوصف',
            reasonPlaceholder: 'أدخل سبب الإجازة...',
            attachments: 'المرفقات (مثل شهادة طبية)',
            uploading: 'جاري الرفع...',
            clickToUpload: 'اضغط لرفع ملفات',
            incompleteData: 'بيانات ناقصة',
            newLeaveApplication: 'طلب إجازة جديد',
            cancel: 'إلغاء',
            submit: 'تقديم طلب الإجازة',
            submitting: 'جاري التقديم...',
            balanceLoadFail: 'فشل تحميل رصيد الإجازات',
            nationalIdLabel: 'رقم الهوية / الإقامة',
            nationalIdPlaceholder: 'أدخل الرقم واضغط Enter',
            employeeFound: 'تم العثور على الموظف',
            employeeNotFound: 'لا يوجد موظف نشط بهذا الرقم',
            lookingUp: 'جاري البحث...',
            illnessType: 'نوع المرض',
            illnessTypePlaceholder: 'أدخل نوع المرض كما هو مذكور في شهادة المستشفى',
            illnessTypeRequired: 'نوع المرض مطلوب للإجازة المرضية',
            certificateRequired: 'الشهادة الطبية مطلوبة للإجازة المرضية',
            medicalCertificate: 'الشهادة الطبية (مطلوبة للإجازة المرضية)',
            loadFormDataFail: 'فشل تحميل بيانات النموذج',
            noCompanyAssigned: 'لا توجد شركة مُسندة لهذا الموظف. يرجى إسناد شركة أولاً.',
            filesUploaded: 'تم رفع {n} ملف بنجاح',
            uploadFail: 'فشل رفع الملفات',
            unpaidShort: 'بدون راتب',
        },
    }
    const isRTL = t('dir') === 'rtl'
    const tr = isRTL ? L.ar : L.en
    const locale = isRTL ? 'ar' : 'en'
    const [form, setForm] = useState<LeaveFormData>({
        employee: '',
        leave_type: '',
        from_date: '',
        to_date: '',
        description: '',
        half_day: false,
        illnessType: '',
    })
    const [nationalId, setNationalId] = useState('')
    const [nationalIdStatus, setNationalIdStatus] = useState<'idle' | 'loading' | 'found' | 'not-found'>('idle')
    const [foundEmployeeName, setFoundEmployeeName] = useState('')
    const [employees, setEmployees] = useState<Array<{ name: string; employee_name: string }>>([])
    const [leaveTypes, setLeaveTypes] = useState<Array<{ name: string; is_lwp: boolean }>>([])
    const [files, setFiles] = useState<UploadedFile[]>([])
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceInfo[]>([])
    const [balanceLoading, setBalanceLoading] = useState(false)
    const [allocationMissing, setAllocationMissing] = useState(false)
    const [creatingAllocation, setCreatingAllocation] = useState(false)

    useEffect(() => {
        if (open) {
            loadDropdownData()
            setLeaveBalances([])
            setAllocationMissing(false)
        }
    }, [open])

    // Load leave balance whenever employee changes
    useEffect(() => {
        if (form.employee) {
            loadLeaveBalance(form.employee)
        } else {
            setLeaveBalances([])
            setAllocationMissing(false)
        }
    }, [form.employee])

    const loadDropdownData = async () => {
        try {
            const [empData, leaveTypeData] = await Promise.all([
                frappeClient.get('Employee', undefined, {
                    fields: ['name', 'employee_name'],
                    filters: [['Employee', 'status', '=', 'Active']],

                    limit_page_length: 100,
                }),
                frappeClient.get('Leave Type', undefined, {
                    fields: ['name', 'is_lwp'],
                    limit_page_length: 50,
                }),
            ])

            setEmployees((empData.data || []) as any)
            setLeaveTypes((leaveTypeData.data || []) as any)
        } catch (error) {
            console.error('Failed to load dropdown data:', error)
            toast({
                title: tr.error,
                description: tr.loadFormDataFail,
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const loadLeaveBalance = async (employeeId: string) => {
        setBalanceLoading(true)
        setAllocationMissing(false)
        try {
            // Get leave allocations for this employee in current year
            const year = new Date().getFullYear()
            const allocResponse = await frappeClient.get('Leave Allocation', undefined, {
                fields: ['name', 'leave_type', 'total_leaves_allocated', 'new_leaves_allocated', 'from_date', 'to_date'],
                filters: [
                    ['Leave Allocation', 'employee', '=', employeeId],
                    ['Leave Allocation', 'docstatus', '=', 1],
                    ['Leave Allocation', 'from_date', '>=', `${year}-01-01`],
                    ['Leave Allocation', 'to_date', '<=', `${year}-12-31`],
                ],
                limit_page_length: 50,
            })

            const allocations = (allocResponse.data || []) as any[]

            if (allocations.length === 0) {
                setAllocationMissing(true)
                setLeaveBalances([])
                return
            }

            // Get leave applications taken by employee this year
            const leaveAppResponse = await frappeClient.get('Leave Application', undefined, {
                fields: ['leave_type', 'total_leave_days', 'status'],
                filters: [
                    ['Leave Application', 'employee', '=', employeeId],
                    ['Leave Application', 'from_date', '>=', `${year}-01-01`],
                    ['Leave Application', 'to_date', '<=', `${year}-12-31`],
                    ['Leave Application', 'docstatus', '=', 1],
                ],
                limit_page_length: 200,
            })

            const leaveApps = (leaveAppResponse.data || []) as any[]

            // Calculate balances
            const balances: LeaveBalanceInfo[] = allocations.map((alloc: any) => {
                const taken = leaveApps
                    .filter((app: any) => app.leave_type === alloc.leave_type && app.status === 'Approved')
                    .reduce((sum: number, app: any) => sum + (app.total_leave_days || 0), 0)
                const pending = leaveApps
                    .filter((app: any) => app.leave_type === alloc.leave_type && app.status === 'Open')
                    .reduce((sum: number, app: any) => sum + (app.total_leave_days || 0), 0)

                return {
                    leave_type: alloc.leave_type,
                    total_leaves: alloc.total_leaves_allocated || alloc.new_leaves_allocated || 0,
                    leaves_taken: taken,
                    leaves_pending: pending,
                    remaining_leaves: (alloc.total_leaves_allocated || alloc.new_leaves_allocated || 0) - taken,
                    from_date: alloc.from_date,
                    to_date: alloc.to_date,
                }
            })

            setLeaveBalances(balances)
            setAllocationMissing(false)
        } catch (error) {
            console.error('Failed to load leave balance:', error)
            toast({
                title: tr.error,
                description: tr.balanceLoadFail,
                variant: 'destructive',
            })
            setLeaveBalances([])
        } finally {
            setBalanceLoading(false)
        }
    }

    /** Auto-create Leave Allocation for all leave types for the selected employee */
    const handleCreateAllocation = async () => {
        if (!form.employee) return
        setCreatingAllocation(true)
        try {
            // Get employee's company
            const empResponse = await frappeClient.get('Employee', form.employee)
            const company = (empResponse.data as any)?.company

            if (!company) {
                toast({ title: tr.error, description: tr.noCompanyAssigned, variant: 'destructive' })
                setCreatingAllocation(false)
                return
            }

            const year = new Date().getFullYear()
            const defaultAllocations: { leave_type: string; days: number }[] = [
                { leave_type: 'Casual Leave', days: 15 },
                { leave_type: 'Sick Leave', days: 10 },
                { leave_type: 'Privilege Leave', days: 21 },
            ]

            // Only allocate leave types that exist in the system
            const existingTypes = leaveTypes.map(lt => lt.name)
            const toCreate = defaultAllocations.filter(a => existingTypes.includes(a.leave_type))

            for (const alloc of toCreate) {
                try {
                    await frappeClient.call('frappe.client.insert', {
                        doc: {
                            doctype: 'Leave Allocation',
                            employee: form.employee,
                            leave_type: alloc.leave_type,
                            from_date: `${year}-01-01`,
                            to_date: `${year}-12-31`,
                            new_leaves_allocated: alloc.days,
                            company: company,
                            docstatus: 1,
                        }
                    })
                } catch (err: any) {
                    // If OverlapError, allocation already exists – skip
                    if (err?.message?.includes('OverlapError') || err?.message?.includes('Overlap')) {
                        continue
                    }
                    throw err
                }
            }

            toast({
                title: tr.success,
                description: tr.allocCreated,
            })

            // Reload balance
            await loadLeaveBalance(form.employee)
        } catch (error: any) {
            console.error('Failed to create leave allocation:', error)
            toast({
                title: tr.error,
                description: error?.message || tr.allocFailed,
                variant: 'destructive',
            })
        } finally {
            setCreatingAllocation(false)
        }
    }

    const lookupByNationalId = async (id: string) => {
        if (!id.trim()) return
        setNationalIdStatus('loading')
        try {
            const result = await frappeClient.call('base_meena.hr_management.leave_api.get_employee_by_national_id', {
                national_id: id.trim(),
            })
            const emp = (result.message || result.data) as any
            if (emp && emp.name) {
                setForm(prev => ({ ...prev, employee: emp.name, leave_type: '' }))
                setFoundEmployeeName(emp.employee_name)
                setNationalIdStatus('found')
            } else {
                setNationalIdStatus('not-found')
                setFoundEmployeeName('')
            }
        } catch {
            setNationalIdStatus('not-found')
            setFoundEmployeeName('')
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files
        if (!selectedFiles || selectedFiles.length === 0) return

        setUploading(true)
        try {
            const uploadPromises = Array.from(selectedFiles).map(async (file) => {
                const formData = new FormData()
                formData.append('file', file)
                formData.append('is_private', '0')
                formData.append('folder', 'Home/Attachments')

                const response = await csrfFetch(frappeApiUrl('/api/method/upload_file'), {
                    method: 'POST',
                    credentials: 'include',
                    body: formData,
                })

                if (!response.ok) throw new Error('Upload failed')

                const data = await response.json()
                return {
                    name: file.name,
                    file_url: data.message.file_url,
                    size: file.size,
                }
            })

            const uploadedFiles = await Promise.all(uploadPromises)
            setFiles((prev) => [...prev, ...uploadedFiles])
            toast({
                title: tr.success,
                description: tr.filesUploaded.replace('{n}', String(uploadedFiles.length)),
            })
        } catch (error) {
            console.error('File upload failed:', error)
            toast({
                title: tr.error,
                description: tr.uploadFail,
                variant: 'destructive',
            })
        } finally {
            setUploading(false)
        }
    }

    const removeFile = (index: number) => {
        setFiles((prev) => prev.filter((_, i) => i !== index))
    }

    const handleSubmit = async () => {
        if (!form.employee || !form.leave_type || !form.from_date || !form.to_date) {
            toast({
                title: tr.incompleteData,
                description: tr.fillRequired,
                variant: 'destructive',
            })
            return
        }

        // Sick leave requires illness type and medical certificate
        if (form.leave_type === 'Sick Leave') {
            if (!form.illnessType.trim()) {
                toast({ title: tr.incompleteData, description: tr.illnessTypeRequired, variant: 'destructive' })
                return
            }
            if (files.length === 0) {
                toast({ title: tr.incompleteData, description: tr.certificateRequired, variant: 'destructive' })
                return
            }
        }

        // Check if allocation exists for selected leave type
        if (allocationMissing) {
            toast({
                title: tr.allocRequired,
                description: tr.allocRequiredDesc,
                variant: 'destructive',
            })
            return
        }

        const selectedBalance = leaveBalances.find(b => b.leave_type === form.leave_type)
        if (selectedBalance && selectedBalance.remaining_leaves <= 0) {
            toast({
                title: tr.insufficientBalance,
                description: `${form.leave_type} ${tr.balanceRemaining}: ${selectedBalance.remaining_leaves} ${tr.days}`,
                variant: 'destructive',
            })
            return
        }

        setSaving(true)
        try {
            // Check if employee/company has holiday list
            const holidayCheck = await frappeClient.checkHolidayList(form.employee)

            if (!holidayCheck.hasHolidayList) {
                // Try to fix by creating/assigning holiday list to company
                if (holidayCheck.companyName) {
                    toast({
                        title: tr.settingUpHoliday,
                        description: tr.settingUpHolidayDesc,
                    })

                    try {
                        await frappeClient.ensureCompanyHolidayList(holidayCheck.companyName)
                        toast({
                            title: tr.success,
                            description: tr.holidaySetupDone,
                        })
                    } catch (error) {
                        toast({
                            title: tr.holidayRequired,
                            description: tr.holidayRequiredDesc,
                            variant: 'destructive',
                        })
                        setSaving(false)
                        return
                    }
                } else {
                    toast({
                        title: tr.holidayRequired,
                        description: tr.holidayRequiredEmpDesc,
                        variant: 'destructive',
                    })
                    setSaving(false)
                    return
                }
            }

            // Create leave application
            const leaveData: Record<string, any> = {
                doctype: 'Leave Application',
                employee: form.employee,
                leave_type: form.leave_type,
                from_date: form.from_date,
                to_date: form.to_date,
                description: form.description,
                half_day: form.half_day ? 1 : 0,
                status: 'Open',
            }
            if (form.leave_type === 'Sick Leave') {
                leaveData.custom_illness_type = form.illnessType
                if (files.length > 0) leaveData.custom_medical_certificate = files[0].file_url
            }

            const result = await frappeClient.call('frappe.client.insert', { doc: leaveData })
            const leaveName = (result.message as any)?.name || (result.data as any)?.name

            // Attach files if any
            if (files.length > 0) {
                for (const file of files) {
                    await frappeClient.call('frappe.client.insert', {
                        doc: {
                            doctype: 'File',
                            file_url: file.file_url,
                            attached_to_doctype: 'Leave Application',
                            attached_to_name: leaveName,
                        }
                    })
                }
            }

            toast({
                title: tr.success,
                description: tr.leaveCreated,
            })

            // Reset form
            setForm({
                employee: '',
                leave_type: '',
                from_date: '',
                to_date: '',
                description: '',
                half_day: false,
                illnessType: '',
            })
            setNationalId('')
            setNationalIdStatus('idle')
            setFoundEmployeeName('')
            setFiles([])
            onSuccess?.()
            onOpenChange(false)
        } catch (error: any) {
            console.error('Failed to create leave application:', error)
            const rawMsg = error?.message || ''

            // Map common Frappe errors to clear messages
            let userMessage = tr.leaveFailed
            if (rawMsg.includes('outside leave allocation period') || rawMsg.includes('خارج فترة')) {
                userMessage = tr.noAllocPeriod
                setAllocationMissing(true)
            } else if (rawMsg.includes('Insufficient Leave Balance') || rawMsg.includes('رصيد إجازات غير كافي')) {
                userMessage = tr.insufficientLeaveBalance
            } else if (rawMsg.includes('overlaps with') || rawMsg.includes('تتداخل مع')) {
                userMessage = tr.overlapError
            } else if (rawMsg.includes('Holiday List')) {
                userMessage = tr.holidayListError
            } else if (rawMsg) {
                // Strip HTML tags from Frappe error messages
                userMessage = rawMsg.replace(/<[^>]*>/g, '').substring(0, 200)
            }

            toast({
                title: tr.error,
                description: userMessage,
                variant: 'destructive',
            })
        } finally {
            setSaving(false)
        }
    }

    const selectedLeaveType = leaveTypes.find((lt) => lt.name === form.leave_type)
    const isPaid = selectedLeaveType ? !selectedLeaveType.is_lwp : true
    const selectedBalance = form.leave_type ? leaveBalances.find(b => b.leave_type === form.leave_type) : null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{tr.newLeaveApplication}</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/70" />
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        {/* Allocation Missing Warning */}
                        {allocationMissing && form.employee && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                                    <div className="flex-1">
                                        <h4 className="text-sm font-semibold text-amber-800">{tr.noAllocation}</h4>
                                        <p className="text-sm text-amber-700 mt-1">
                                            {tr.noAllocationDesc}
                                        </p>
                                        <Button
                                            size="sm"
                                            className="mt-2 bg-amber-600 hover:bg-amber-700"
                                            onClick={handleCreateAllocation}
                                            disabled={creatingAllocation}
                                        >
                                            {creatingAllocation ? (
                                                <>
                                                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                    {tr.creating}
                                                </>
                                            ) : (
                                                tr.createAllocation
                                            )}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Leave Balance Summary */}
                        {leaveBalances.length > 0 && form.employee && (
                            <div className="bg-accent border border-primary/20 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Info className="h-4 w-4 text-primary" />
                                    <span className="text-sm font-semibold text-accent-foreground">{tr.leaveBalance}</span>
                                    {balanceLoading && <Loader2 className="h-3 w-3 animate-spin text-primary/80" />}
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                    {leaveBalances.map((bal) => (
                                        <div
                                            key={bal.leave_type}
                                            className={`rounded-md px-3 py-2 text-xs border ${form.leave_type === bal.leave_type
                                                    ? 'bg-accent border-primary/40'
                                                    : 'bg-card border-border'
                                                }`}
                                        >
                                            <div className="font-medium text-foreground/90">{translateEnum('leaveType', bal.leave_type, locale)}</div>
                                            <div className="flex justify-between mt-1">
                                                <span className="text-muted-foreground">{tr.total}: {bal.total_leaves}</span>
                                                <span className={`font-bold ${bal.remaining_leaves > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {tr.remaining}: {bal.remaining_leaves}
                                                </span>
                                            </div>
                                            {bal.leaves_taken > 0 && (
                                                <div className="text-muted-foreground/70 mt-0.5">{tr.used}: {bal.leaves_taken}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* National ID Lookup */}
                        <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                                <Search className="h-4 w-4" />
                                {tr.nationalIdLabel} <span className="text-red-500">*</span>
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder={tr.nationalIdPlaceholder}
                                    value={nationalId}
                                    onChange={(e) => {
                                        setNationalId(e.target.value)
                                        setNationalIdStatus('idle')
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') lookupByNationalId(nationalId)
                                    }}
                                    disabled={nationalIdStatus === 'loading'}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => lookupByNationalId(nationalId)}
                                    disabled={nationalIdStatus === 'loading' || !nationalId.trim()}
                                >
                                    {nationalIdStatus === 'loading' ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Search className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
                            {nationalIdStatus === 'found' && (
                                <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded px-3 py-2">
                                    <UserCheck className="h-4 w-4 flex-shrink-0" />
                                    <span>{tr.employeeFound}: <strong>{foundEmployeeName}</strong></span>
                                </div>
                            )}
                            {nationalIdStatus === 'not-found' && (
                                <div className="flex items-center gap-2 text-red-700 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">
                                    <UserX className="h-4 w-4 flex-shrink-0" />
                                    <span>{tr.employeeNotFound}</span>
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{tr.employee} <span className="text-red-500">*</span></Label>
                                <Select value={form.employee} onValueChange={(v) => setForm({ ...form, employee: v, leave_type: '' })}>
                                    <SelectTrigger aria-label={tr.selectEmployee}>
                                        <SelectValue placeholder={tr.selectEmployee} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {employees.map((emp) => (
                                            <SelectItem key={emp.name} value={emp.name}>
                                                {emp.employee_name} ({emp.name})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>{tr.leaveType} <span className="text-red-500">*</span></Label>
                                <Select value={form.leave_type} onValueChange={(v) => {
                                    setForm({ ...form, leave_type: v, illnessType: '' })
                                    if (v !== 'Sick Leave') setFiles([])
                                }}>
                                    <SelectTrigger aria-label={tr.selectLeaveType}>
                                        <SelectValue placeholder={tr.selectLeaveType} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {leaveTypes.map((lt) => {
                                            const bal = leaveBalances.find(b => b.leave_type === lt.name)
                                            return (
                                                <SelectItem key={lt.name} value={lt.name}>
                                                    {translateEnum('leaveType', lt.name, locale)}
                                                    {bal && <span className="text-xs text-muted-foreground ml-2">({tr.remaining}: {bal.remaining_leaves})</span>}
                                                    {lt.is_lwp && <span className="text-xs text-orange-600 ml-1">({tr.unpaidShort})</span>}
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                                {selectedLeaveType && (
                                    <p className="text-xs text-muted-foreground">
                                        {isPaid ? (
                                            <span className="text-green-600 font-medium">✓ {tr.paidLeave}</span>
                                        ) : (
                                            <span className="text-orange-600 font-medium">! {tr.unpaidLeave}</span>
                                        )}
                                        {selectedBalance && (
                                            <span className={`mr-3 ${selectedBalance.remaining_leaves > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                | {tr.remaining}: {selectedBalance.remaining_leaves} {tr.days}
                                            </span>
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>{tr.fromDate} <span className="text-red-500">*</span></Label>
                                <Input
                                    type="date"
                                    value={form.from_date}
                                    onChange={(e) => setForm({ ...form, from_date: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>{tr.toDate} <span className="text-red-500">*</span></Label>
                                <Input
                                    type="date"
                                    value={form.to_date}
                                    onChange={(e) => setForm({ ...form, to_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>{tr.reason}</Label>
                            <Textarea
                                placeholder={tr.reasonPlaceholder}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                rows={3}
                            />
                        </div>

                        {/* Sick Leave Fields — only shown when Sick Leave is selected */}
                        {form.leave_type === 'Sick Leave' && (
                            <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-4">
                                <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                                    <AlertCircle className="h-4 w-4" />
                                    {tr.illnessType} <span className="text-red-500">*</span>
                                </div>
                                <Input
                                    placeholder={tr.illnessTypePlaceholder}
                                    value={form.illnessType}
                                    onChange={(e) => setForm({ ...form, illnessType: e.target.value })}
                                    className="bg-card"
                                />

                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2 text-amber-800">
                                        <FileText className="h-4 w-4" />
                                        {tr.medicalCertificate} <span className="text-red-500">*</span>
                                    </Label>
                                    <div className="border-2 border-dashed border-amber-300 rounded-lg p-4 bg-card">
                                        <input
                                            type="file"
                                            multiple
                                            onChange={handleFileUpload}
                                            className="hidden"
                                            id="file-upload"
                                            disabled={uploading}
                                        />
                                        <label
                                            htmlFor="file-upload"
                                            className="flex flex-col items-center justify-center cursor-pointer"
                                        >
                                            {uploading ? (
                                                <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
                                            ) : (
                                                <Upload className="h-8 w-8 text-amber-400" />
                                            )}
                                            <p className="text-sm text-amber-600 mt-2">
                                                {uploading ? tr.uploading : tr.clickToUpload}
                                            </p>
                                        </label>

                                        {files.length > 0 && (
                                            <div className="mt-4 space-y-2">
                                                {files.map((file, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center justify-between bg-muted/40 p-2 rounded"
                                                    >
                                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                                            <FileText className="h-4 w-4 text-primary/80 flex-shrink-0" />
                                                            <span className="text-sm truncate">{file.name}</span>
                                                            <span className="text-xs text-muted-foreground/70">
                                                                ({(file.size / 1024).toFixed(1)} KB)
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() => removeFile(index)}
                                                            className="text-red-500 hover:text-red-700"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        {tr.cancel}
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving || loading || allocationMissing}>
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {tr.submitting}
                            </>
                        ) : (
                            tr.submit
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
