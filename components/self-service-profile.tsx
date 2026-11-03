'use client'

import React, { useState, useEffect, useRef } from "react"
import {
    User, Save, Loader2, CheckCircle, AlertCircle,
    Building2, Briefcase, MapPin, Calendar, Clock, Shield,
    Phone, Mail, CreditCard, Camera, ArrowLeft, ArrowRight, Pencil
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { frappeClient } from "@/lib/api-client"
import { frappeImageUrl } from "@/lib/utils"
import { updateDoc } from "@/lib/api"
import { useAuthSafe } from "@/lib/auth-context"
import { EmployeeDocuments } from "@/components/employee/employee-documents"
import { useI18n } from "@/lib/i18n"
import { dualDate } from "@/lib/format"
import { translateDepartment } from "@/lib/enums"

interface EmployeeData {
    name: string
    employee_name: string
    first_name: string
    middle_name?: string
    last_name?: string
    gender: string
    date_of_birth: string
    date_of_joining: string
    company: string
    department?: string
    designation?: string
    branch?: string
    status: string
    cell_number?: string
    personal_email?: string
    company_email?: string
    user_id?: string
    image?: string
    default_shift?: string
    employment_type?: string
    custom_national_id?: string
    custom_id_type?: string
}

interface SelfServiceProfileProps {
    onBack?: () => void
}

export function SelfServiceProfile({ onBack }: SelfServiceProfileProps) {
    const { user, refreshUser } = useAuthSafe()
    const { t, dir, isRTL } = useI18n()

    const [employee, setEmployee] = useState<EmployeeData | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)
    const [isEditing, setIsEditing] = useState(false)

    // Editable fields
    const [firstName, setFirstName] = useState('')
    const [lastName, setLastName] = useState('')
    const [cellNumber, setCellNumber] = useState('')
    const [personalEmail, setPersonalEmail] = useState('')
    const [nationalId, setNationalId] = useState('')
    const [idType, setIdType] = useState('')
    const [imageUrl, setImageUrl] = useState('')
    const [imagePreview, setImagePreview] = useState<string | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)

    // Load employee data
    useEffect(() => {
        if (!user?.email) return

        async function loadEmployee() {
            setLoading(true)
            setError(null)
            try {
                // Find employee by user_id
                const employees = await frappeClient.getList<EmployeeData>('Employee', {
                    filters: [['Employee', 'user_id', '=', user!.email]],
                    fields: [
                        'name', 'employee_name', 'first_name', 'middle_name', 'last_name',
                        'gender', 'date_of_birth', 'date_of_joining', 'company', 'department',
                        'designation', 'branch', 'status', 'cell_number', 'personal_email',
                        'company_email', 'user_id', 'image', 'default_shift',
                        'employment_type', 'custom_national_id', 'custom_id_type'
                    ],
                    limit_page_length: 1,
                })

                if (employees.length === 0) {
                    // Try company_email fallback
                    const employees2 = await frappeClient.getList<EmployeeData>('Employee', {
                        filters: [['Employee', 'company_email', '=', user!.email]],
                        fields: [
                            'name', 'employee_name', 'first_name', 'middle_name', 'last_name',
                            'gender', 'date_of_birth', 'date_of_joining', 'company', 'department',
                            'designation', 'branch', 'status', 'cell_number', 'personal_email',
                            'company_email', 'user_id', 'image', 'default_shift',
                            'employment_type', 'custom_national_id', 'custom_id_type'
                        ],
                        limit_page_length: 1,
                    })
                    if (employees2.length > 0) {
                        setEmployeeData(employees2[0])
                    }
                    // else: no Employee record is linked to this account (e.g. a
                    // Company Admin/operator who never onboarded). Leave `employee`
                    // null with no error — render() degrades to a read-only account
                    // view instead of a dead-end error screen (Ticket 1).
                } else {
                    setEmployeeData(employees[0])
                }
            } catch (err: any) {
                console.error('Failed to load employee:', err)
                setError(t('ssp.err_load'))
            } finally {
                setLoading(false)
            }
        }

        loadEmployee()
    }, [user?.email])

    function setEmployeeData(emp: EmployeeData) {
        setEmployee(emp)
        setFirstName(emp.first_name || '')
        setLastName(emp.last_name || '')
        setCellNumber(emp.cell_number || '')
        setPersonalEmail(emp.personal_email || '')
        setNationalId(emp.custom_national_id || '')
        setIdType(emp.custom_id_type || '')
        setImageUrl(emp.image || '')
    }

    function resetForm() {
        if (employee) {
            setFirstName(employee.first_name || '')
            setLastName(employee.last_name || '')
            setCellNumber(employee.cell_number || '')
            setPersonalEmail(employee.personal_email || '')
            setNationalId(employee.custom_national_id || '')
            setIdType(employee.custom_id_type || '')
            setImageUrl(employee.image || '')
            setImagePreview(null)
        }
        setIsEditing(false)
        setSaveResult(null)
    }

    function getCsrfToken(): string | null {
        const cookies = document.cookie.split(';').map(c => c.trim())
        const csrfCookie = cookies.find(c => c.startsWith('csrftoken='))
            || cookies.find(c => c.startsWith('csrf_token='))
        return csrfCookie ? decodeURIComponent(csrfCookie.split('=')[1]) : null
    }

    async function uploadToFrappe(formData: FormData): Promise<string | null> {
        const headers: Record<string, string> = {}
        const csrf = getCsrfToken()
        if (csrf) headers['X-Frappe-CSRF-Token'] = csrf

        const res = await fetch('/api/upload_file', {
            method: 'POST', credentials: 'include', headers, body: formData,
        })

        if (!res.ok) {
            let detail = ''
            try { detail = await res.text() } catch { }
            console.error('Upload failed:', res.status, detail)
            if (res.status === 403) throw new Error(t('ssp.err_auth'))
            if (res.status === 413) throw new Error(t('ssp.err_file_large'))
            throw new Error(t('ssp.err_upload'))
        }

        const data = await res.json()
        return data.message?.file_url || data.file_url || null
    }

    async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file || !employee) return

        if (file.size > 2 * 1024 * 1024) {
            setSaveResult({ success: false, message: t('ssp.err_img_size') })
            return
        }

        // Show preview immediately
        const reader = new FileReader()
        reader.onload = (ev) => setImagePreview(ev.target?.result as string)
        reader.readAsDataURL(file)

        setUploadingImage(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('doctype', 'Employee')
            formData.append('docname', employee.name)
            formData.append('is_private', '0')

            const fileUrl = await uploadToFrappe(formData)
            if (fileUrl) {
                setImageUrl(fileUrl)
                setIsEditing(true)
                setSaveResult({ success: true, message: t('ssp.img_uploaded') })
            } else {
                setSaveResult({ success: false, message: t('ssp.err_no_img_url') })
            }
        } catch (err: any) {
            console.error('Image upload failed:', err)
            setSaveResult({ success: false, message: err?.message || t('ssp.err_upload') })
        } finally {
            setUploadingImage(false)
        }
    }

    async function handleSave() {
        if (!employee) return
        setSaving(true)
        setSaveResult(null)

        try {
            // Only update the allowed fields
            const updates: Record<string, any> = {}

            if (firstName !== (employee.first_name || '')) updates.first_name = firstName
            if (lastName !== (employee.last_name || '')) updates.last_name = lastName
            if (cellNumber !== (employee.cell_number || '')) updates.cell_number = cellNumber
            if (personalEmail !== (employee.personal_email || '')) updates.personal_email = personalEmail
            if (nationalId !== (employee.custom_national_id || '')) updates.custom_national_id = nationalId
            if (idType !== (employee.custom_id_type || '')) updates.custom_id_type = idType
            if (imageUrl !== (employee.image || '')) updates.image = imageUrl

            if (Object.keys(updates).length === 0) {
                setSaveResult({ success: true, message: t('ssp.no_changes') })
                setIsEditing(false)
                return
            }

            const result = await frappeClient.updateEmployee(employee.name, updates)
            if (!result) throw new Error('Failed to update')

            // Sync image system-wide via dedicated API
            if (updates.image && employee.name) {
                try {
                    await frappeClient.call('base_meena.employee_documents_api.update_employee_image', {
                        employee: employee.name,
                        image_url: updates.image,
                    })
                } catch {
                    // Fallback: update User.user_image directly
                    if (employee.user_id) {
                        try { await updateDoc('User', employee.user_id, { user_image: updates.image }); } catch { /* ignore */ }
                    }
                }
            }

            // Sync other changes to User doctype
            const userUpdates: Record<string, any> = {}
            if (updates.first_name || updates.last_name) {
                const newFirst = updates.first_name || employee.first_name || ''
                const newLast = updates.last_name ?? employee.last_name ?? ''
                userUpdates.first_name = newFirst
                userUpdates.last_name = newLast
                userUpdates.full_name = [newFirst, newLast].filter(Boolean).join(' ')
            }
            if (Object.keys(userUpdates).length > 0 && employee.user_id) {
                try {
                    await updateDoc('User', employee.user_id, userUpdates)
                } catch { /* ignore */ }
            }
            await refreshUser()

            // Compute employee_name for local display
            const newEmployeeName = updates.first_name || updates.last_name
                ? [updates.first_name || employee.first_name, updates.last_name ?? employee.last_name].filter(Boolean).join(' ')
                : employee.employee_name

            // Update local state
            setEmployee({ ...employee, ...updates, employee_name: newEmployeeName })
            setSaveResult({ success: true, message: t('ssp.save_success') })
            setIsEditing(false)
        } catch (err: any) {
            console.error('Save error:', err)
            setSaveResult({ success: false, message: t('ssp.save_error') + (err.message || t('ssp.unknown_error')) })
        } finally {
            setSaving(false)
        }
    }

    // Format date for display — Hijri-first (Umm al-Qura) + Gregorian, via canonical util
    function formatDate(dateStr?: string) {
        if (!dateStr) return '—'
        try {
            return dualDate(dateStr) || '—'
        } catch {
            return dateStr
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/40">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">{t('ssp.loading')}</p>
                </div>
            </div>
        )
    }

    // A real load failure keeps the error screen. But merely having no linked
    // Employee record is NOT an error — degrade to a read-only account view so
    // Company Admins / operators don't hit a dead-end (Ticket 1).
    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
                <div className="text-center max-w-sm">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="h-8 w-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">{t('common.error')}</h2>
                    <p className="text-muted-foreground mb-4">{error}</p>
                    {onBack && (
                        <Button onClick={onBack} variant="outline">{t('common.back')}</Button>
                    )}
                </div>
            </div>
        )
    }

    if (!employee) {
        return <AccountOnlyView user={user} onBack={onBack} />
    }

    const displayImage = imagePreview || (imageUrl ? frappeImageUrl(imageUrl) : null)

    return (
        <div className="min-h-screen bg-muted/40" dir={dir}>
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-primary via-primary/95 to-primary/85 text-white">
                <div className="max-w-2xl mx-auto px-4 pt-6 pb-20">
                    <div className="flex items-center justify-between mb-6">
                        {onBack && (
                            <Button aria-label="رجوع" title="رجوع"
                                variant="ghost"
                                size="icon"
                                onClick={onBack}
                                className="text-white hover:bg-white/20"
                            >
                                {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
                            </Button>
                        )}
                        <h1 className="text-lg font-bold">{t('ssp.my_profile')}</h1>
                        <div className="w-10" />
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/30">
                                {displayImage ? (
                                    <img
                                        src={displayImage}
                                        alt={t('ssp.my_profile')}
                                        className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                    />
                                ) : (
                                    <User className="h-10 w-10 text-white/70" />
                                )}
                            </div>
                            {/* Camera overlay */}
                            <button aria-label="تغيير الصورة" title="تغيير الصورة"
                                onClick={() => fileInputRef.current?.click()}
                                className="absolute -bottom-1 -left-1 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-2 border-white shadow-lg hover:bg-primary/80 transition-colors"
                                disabled={uploadingImage}
                            >
                                {uploadingImage ? (
                                    <Loader2 className="h-3.5 w-3.5 text-white animate-spin" />
                                ) : (
                                    <Camera className="h-3.5 w-3.5 text-white" />
                                )}
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                className="hidden"
                            />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-xl font-bold truncate">{employee.employee_name}</h2>
                            <p className="text-primary-foreground/70 text-sm truncate">{employee.designation || employee.department || t('ssp.employee')}</p>
                            <p className="text-blue-200/70 text-xs font-mono mt-0.5" dir="ltr">{employee.name}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content - overlaps header */}
            <div className="max-w-2xl mx-auto px-4 -mt-12 pb-8 space-y-4">
                {/* Save Result */}
                {saveResult && (
                    <div className={`p-3 rounded-xl flex items-center gap-3 text-sm ${saveResult.success
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                        }`}>
                        {saveResult.success
                            ? <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                            : <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                        }
                        <p>{saveResult.message}</p>
                    </div>
                )}

                {/* Editable Fields Card */}
                <Card className="p-5 rounded-2xl border border-border shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-base flex items-center gap-2">
                            <Phone className="w-4 h-4 text-primary" />
                            {t('ssp.contact_info')}
                        </h3>
                        {!isEditing ? (
                            <Button aria-label="تعديل" title="تعديل"
                                variant="ghost"
                                size="sm"
                                onClick={() => { setIsEditing(true); setSaveResult(null) }}
                                className="text-primary hover:text-primary/80 hover:bg-accent gap-1.5"
                            >
                                <Pencil className="h-3.5 w-3.5" />
                                {t('common.edit')}
                            </Button>
                        ) : (
                            <div className="flex gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={resetForm}
                                    disabled={saving}
                                    className="text-muted-foreground"
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-primary hover:bg-primary/90 gap-1.5"
                                >
                                    {saving ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Save className="h-3.5 w-3.5" />
                                    )}
                                    {t('common.save')}
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {/* Name fields */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <User className="w-3 h-3" /> {t('ssp.first_name')}
                                </Label>
                                {isEditing ? (
                                    <Input
                                        placeholder={t('ssp.first_name')}
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                    />
                                ) : (
                                    <p className="text-sm font-medium">{firstName || <span className="text-muted-foreground/70">{t('common.not_specified')}</span>}</p>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                    <User className="w-3 h-3" /> {t('ssp.last_name')}
                                </Label>
                                {isEditing ? (
                                    <Input
                                        placeholder={t('ssp.last_name')}
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                    />
                                ) : (
                                    <p className="text-sm font-medium">{lastName || <span className="text-muted-foreground/70">{t('common.not_specified')}</span>}</p>
                                )}
                            </div>
                        </div>

                        <Separator />

                        {/* Mobile */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Phone className="w-3 h-3" /> {t('ssp.mobile')}
                            </Label>
                            {isEditing ? (
                                <Input
                                    type="tel"
                                    dir="ltr"
                                    placeholder="+966 5xx xxx xxxx"
                                    value={cellNumber}
                                    onChange={(e) => setCellNumber(e.target.value)}
                                    className="text-left"
                                />
                            ) : (
                                <p className="text-sm font-medium" dir="ltr">{cellNumber || <span className="text-muted-foreground/70">{t('common.not_specified')}</span>}</p>
                            )}
                        </div>

                        <Separator />

                        {/* Personal Email */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Mail className="w-3 h-3" /> {t('ssp.personal_email')}
                            </Label>
                            {isEditing ? (
                                <Input
                                    type="email"
                                    dir="ltr"
                                    placeholder="name@email.com"
                                    value={personalEmail}
                                    onChange={(e) => setPersonalEmail(e.target.value)}
                                    className="text-left"
                                />
                            ) : (
                                <p className="text-sm font-medium" dir="ltr">{personalEmail || <span className="text-muted-foreground/70">{t('common.not_specified')}</span>}</p>
                            )}
                        </div>

                        <Separator />

                        {/* ID Type */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <CreditCard className="w-3 h-3" /> {t('ssp.id_type')}
                            </Label>
                            {isEditing ? (
                                <select aria-label=""
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    value={idType}
                                    onChange={(e) => setIdType(e.target.value)}
                                >
                                    <option value="">{t('ssp.select_id_type')}</option>
                                    <option value="National ID">{t('ssp.national_id')}</option>
                                    <option value="Iqama">{t('ssp.iqama')}</option>
                                </select>
                            ) : (
                                <p className="text-sm font-medium">
                                    {idType === 'National ID' ? t('ssp.national_id') : idType === 'Iqama' ? t('ssp.iqama') : <span className="text-muted-foreground/70">{t('common.not_specified')}</span>}
                                </p>
                            )}
                        </div>

                        <Separator />

                        {/* National ID / Iqama Number */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Shield className="w-3 h-3" /> {idType === 'Iqama' ? t('ssp.iqama_number') : t('ssp.national_id_number')}
                            </Label>
                            {isEditing ? (
                                <div>
                                    <Input
                                        dir="ltr"
                                        placeholder={idType === 'Iqama' ? t('ssp.enter_iqama') : t('ssp.enter_national_id')}
                                        value={nationalId}
                                        onChange={(e) => setNationalId(e.target.value)}
                                        className="text-left"
                                    />
                                    {nationalId && !/^\d{10}$/.test(nationalId) && (
                                        <p className="text-xs text-amber-600 mt-1">{t('ssp.id_10_digits')}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm font-medium font-mono" dir="ltr">
                                    {nationalId || <span className="text-muted-foreground/70 font-sans">{t('common.not_specified')}</span>}
                                </p>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Read-only Company Info */}
                <Card className="p-5 rounded-2xl border border-border shadow-sm">
                    <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        {t('ssp.work_info')}
                    </h3>
                    <div className="space-y-3">
                        <InfoRow icon={<Building2 className="w-3.5 h-3.5" />} label={t('erp.company')} value={employee.company} />
                        <Separator />
                        <InfoRow icon={<Briefcase className="w-3.5 h-3.5" />} label={t('erp.department')} value={translateDepartment(employee.department, isRTL ? 'ar' : 'en')} />
                        <Separator />
                        <InfoRow icon={<User className="w-3.5 h-3.5" />} label={t('erp.designation')} value={employee.designation} />
                        <Separator />
                        <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label={t('erp.branch')} value={employee.branch} />
                        <Separator />
                        <InfoRow icon={<Clock className="w-3.5 h-3.5" />} label={t('ssp.employment_type')} value={employee.employment_type} />
                        <Separator />
                        <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label={t('ssp.joining_date')} value={formatDate(employee.date_of_joining)} />
                        <Separator />
                        <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label={t('ssp.birth_date')} value={formatDate(employee.date_of_birth)} />
                        <Separator />
                        <InfoRow
                            icon={<Clock className="w-3.5 h-3.5" />}
                            label={t('ssp.default_shift')}
                            value={employee.default_shift}
                        />
                    </div>
                </Card>

                {/* Account Info */}
                <Card className="p-5 rounded-2xl border border-border shadow-sm">
                    <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-primary" />
                        {t('ssp.account_info')}
                    </h3>
                    <div className="space-y-3">
                        <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label={t('ssp.official_email')} value={employee.company_email} />
                        <Separator />
                        <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label={t('ssp.system_account')} value={employee.user_id} />
                        <Separator />
                        <div className="flex items-center justify-between py-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5" /> {t('erp.status')}
                            </span>
                            <Badge variant={employee.status === 'Active' ? 'default' : 'secondary'} className={
                                employee.status === 'Active'
                                    ? 'bg-green-100 text-green-700 hover:bg-green-100'
                                    : 'bg-muted text-muted-foreground'
                            }>
                                {employee.status === 'Active' ? t('status.active') :
                                    employee.status === 'Inactive' ? t('status.inactive') :
                                        employee.status === 'Suspended' ? t('status.suspended') :
                                            employee.status === 'Left' ? t('status.left') :
                                                employee.status}
                            </Badge>
                        </div>
                    </div>
                </Card>

                {/* Employee Documents */}
                <Card className="p-5 rounded-2xl border border-border shadow-sm">
                    <EmployeeDocuments
                        employeeId={employee.name}
                        employeeName={employee.employee_name}
                        canDelete={false}
                        canUpload={true}
                        compact={false}
                        isRTL={true}
                    />
                </Card>
            </div>
        </div>
    )
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
    const { t } = useI18n()
    return (
        <div className="flex items-center justify-between py-1">
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                {icon} {label}
            </span>
            <span className="text-sm font-medium text-foreground">
                {value || <span className="text-muted-foreground/70">{t('common.not_specified')}</span>}
            </span>
        </div>
    )
}

/**
 * Read-only fallback for users with no linked Employee record (Company Admins,
 * operators, freshly-provisioned tenant admins). Shows account identity/roles
 * from the User doc instead of the old "no employee record" dead-end. Reachable
 * from every /profile entry point (rail, header, user-menu, direct URL).
 */
const ROLE_AR: Record<string, string> = {
    'HR Manager': 'مدير الموارد البشرية', 'HR User': 'موظف موارد بشرية', 'Company Admin': 'مدير الشركة',
    'Accounts Manager': 'مدير الحسابات', 'Accounts User': 'محاسب', 'Sales Manager': 'مدير المبيعات',
    'Sales User': 'مندوب مبيعات', 'Sales Master Manager': 'مدير المبيعات الأول', 'Purchase Manager': 'مدير المشتريات',
    'Purchase User': 'موظف مشتريات', 'Purchase Master Manager': 'مدير المشتريات الأول', 'Stock Manager': 'مدير المخزون',
    'Stock User': 'أمين مخزون', 'POS Cashier': 'كاشير', 'POS Shift Supervisor': 'مشرف وردية الكاشير',
    'POS Store Manager': 'مدير المتجر', 'Real Estate Manager': 'مدير العقارات', 'Real Estate User': 'موظف عقارات',
    'Real Estate Moderator': 'مشرف عقارات', 'Rentals Manager': 'مدير التأجير', 'Rentals User': 'موظف تأجير',
    'Desk User': 'مستخدم النظام', 'Guest': 'زائر', 'Employee': 'موظف', 'Employee Self Service': 'الخدمة الذاتية',
}

function AccountOnlyView({ user, onBack }: {
    user: { email?: string; full_name?: string; user_image?: string; roles?: string[]; company?: string } | null
    onBack?: () => void
}) {
    const { t, dir, isRTL } = useI18n()
    const roles = (user?.roles || []).filter((r) => r && r !== 'All')
    const avatar = user?.user_image ? frappeImageUrl(user.user_image) : null

    return (
        <div className="min-h-screen bg-muted/40" dir={dir}>
            <div className="bg-gradient-to-br from-primary via-primary/95 to-primary/85 text-white">
                <div className="max-w-2xl mx-auto px-4 pt-6 pb-20">
                    <div className="flex items-center justify-between mb-6">
                        {onBack && (
                            <Button aria-label="رجوع" title="رجوع" variant="ghost" size="icon" onClick={onBack} className="text-white hover:bg-white/20">
                                {isRTL ? <ArrowRight className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
                            </Button>
                        )}
                        <h1 className="text-lg font-bold">{t('ssp.my_profile')}</h1>
                        <div className="w-10" />
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/30">
                            {avatar ? (
                                <img
                                    src={avatar}
                                    alt={user?.full_name || ''}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                            ) : (
                                <User className="h-10 w-10 text-white/70" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-xl font-bold truncate">{user?.full_name || t('header.my_account')}</h2>
                            <p className="text-primary-foreground/70 text-sm truncate" dir="ltr">{user?.email}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 -mt-12 pb-8 space-y-4">
                {/* Explain why this is the account view, not the full profile */}
                <div className="p-3 rounded-xl flex items-center gap-3 text-sm bg-accent border border-primary/20 text-accent-foreground">
                    <AlertCircle className="h-4 w-4 text-primary flex-shrink-0" />
                    <p>{t('ssp.account_only_note')}</p>
                </div>

                <Card className="p-5 rounded-2xl border border-border shadow-sm">
                    <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-primary" />
                        {t('ssp.account_info')}
                    </h3>
                    <div className="space-y-3">
                        <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label={t('ssp.system_account')} value={user?.email} />
                        {user?.company && (
                            <>
                                <Separator />
                                <InfoRow icon={<Building2 className="w-3.5 h-3.5" />} label={t('erp.company')} value={user.company} />
                            </>
                        )}
                    </div>
                </Card>

                {roles.length > 0 && (
                    <Card className="p-5 rounded-2xl border border-border shadow-sm">
                        <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-primary" />
                            {t('ssp.roles')}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {roles.map((r) => (
                                <Badge key={r} variant="secondary" className="bg-accent text-primary hover:bg-accent">{isRTL ? (ROLE_AR[r] || r) : r}</Badge>
                            ))}
                        </div>
                    </Card>
                )}
            </div>
        </div>
    )
}
