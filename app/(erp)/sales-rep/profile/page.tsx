"use client"

import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  User, Package, Warehouse, MapPin, LogOut,
  Loader2, RefreshCw, ChevronLeft, Phone, Mail,
  Clock, TrendingUp, FileText, CreditCard,
  ArrowLeftRight, Route, Pencil, Save, Camera,
  CheckCircle, AlertCircle, Shield, Globe,
} from "lucide-react"
import Link from "next/link"
import { useSalesRep } from "@/contexts/SalesRepContext"
import { useAuth } from "@/lib/auth-context"
import { salesApi, type SalesPersonVisit, localDateISO } from "@/lib/sales-api"
import { frappeClient } from "@/lib/api-client"
import { frappeImageUrl } from "@/lib/utils"
import { updateDoc } from "@/lib/api"
import { EmployeeDocuments } from "@/components/employee/employee-documents"
import { CustodyItems } from "@/components/custody/custody-items"
import { useI18n } from "@/lib/i18n"
import { SalesLangSwitcher } from "@/components/sales/lang-switcher"

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth()
  const { salesPerson, warehouse, customers, repStock, getSalesPersonName } = useSalesRep()
  const { t, isRTL } = useI18n()

  const [todayStats, setTodayStats] = useState({ visits: 0, completed: 0, orders: 0 })
  const [loadingStats, setLoadingStats] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null)
  const [employeeData, setEmployeeData] = useState<any>(null)
  const [loadingEmployee, setLoadingEmployee] = useState(true)

  // Editable fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [cellNumber, setCellNumber] = useState('')
  const [personalEmail, setPersonalEmail] = useState('')
  const [nationalId, setNationalId] = useState('')
  const [idType, setIdType] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const today = localDateISO()

  // Load employee data for editing
  useEffect(() => {
    if (!user?.email) {
      setLoadingEmployee(false)
      return
    }
    async function loadEmployee() {
      const empFields = ['name', 'employee_name', 'first_name', 'last_name', 'cell_number', 'personal_email', 'company_email', 'user_id', 'image', 'custom_national_id', 'custom_id_type']

      try {
        // Strategy 1: Find by user_id
        let employees = await frappeClient.getList<any>('Employee', {
          filters: [['Employee', 'user_id', '=', user!.email]],
          fields: empFields,
          limit_page_length: 1,
        })

        // Strategy 2: Find by company_email
        if (employees.length === 0) {
          employees = await frappeClient.getList<any>('Employee', {
            filters: [['Employee', 'company_email', '=', user!.email]],
            fields: empFields,
            limit_page_length: 1,
          })
        }

        // Strategy 3: Find via Sales Person → employee link
        if (employees.length === 0 && salesPerson?.employee) {
          employees = await frappeClient.getList<any>('Employee', {
            filters: [['Employee', 'name', '=', salesPerson.employee]],
            fields: empFields,
            limit_page_length: 1,
          })
        }

        if (employees.length > 0) {
          const emp = employees[0]
          setEmployeeData(emp)
          setFirstName(emp.first_name || '')
          setLastName(emp.last_name || '')
          setCellNumber(emp.cell_number || '')
          setPersonalEmail(emp.personal_email || '')
          setNationalId(emp.custom_national_id || '')
          setIdType(emp.custom_id_type || '')
          setImageUrl(emp.image || '')
        }
      } catch (err) {
        console.error('Failed to load employee data:', err)
      } finally {
        setLoadingEmployee(false)
      }
    }
    loadEmployee()
  }, [user?.email, salesPerson])

  useEffect(() => {
    if (!salesPerson) return

    async function loadStats() {
      setLoadingStats(true)
      try {
        const visits = await salesApi.getVisits({
          filters: [
            ["Sales Person Visit", "sales_person", "=", salesPerson!.name],
            ["Sales Person Visit", "visit_date", "=", today],
          ],
        })
        setTodayStats({
          visits: visits.length,
          completed: visits.filter((v) => v.visit_status === "Completed").length,
          orders: visits.filter((v) => v.has_order === 1).length,
        })
      } catch {
        // ignore
      } finally {
        setLoadingStats(false)
      }
    }

    loadStats()
  }, [salesPerson, today])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
    } catch {
      window.location.href = "/login"
    }
  }

  function resetForm() {
    if (employeeData) {
      setFirstName(employeeData.first_name || '')
      setLastName(employeeData.last_name || '')
      setCellNumber(employeeData.cell_number || '')
      setPersonalEmail(employeeData.personal_email || '')
      setNationalId(employeeData.custom_national_id || '')
      setIdType(employeeData.custom_id_type || '')
      setImageUrl(employeeData.image || '')
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
      if (res.status === 403) throw new Error(t('sr.profile.err_auth'))
      if (res.status === 413) throw new Error(t('sr.profile.err_file_too_large'))
      throw new Error(t('sr.profile.err_upload'))
    }

    const data = await res.json()
    return data.message?.file_url || data.file_url || null
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !employeeData) return
    if (file.size > 2 * 1024 * 1024) {
      setSaveResult({ success: false, message: t('sr.profile.err_image_size') })
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('doctype', 'Employee')
      formData.append('docname', employeeData.name)
      formData.append('is_private', '0')

      const fileUrl = await uploadToFrappe(formData)
      if (fileUrl) {
        setImageUrl(fileUrl)
        setIsEditing(true)
        setSaveResult({ success: true, message: t('sr.profile.image_uploaded') })
      } else {
        setSaveResult({ success: false, message: t('sr.profile.err_no_url') })
      }
    } catch (err: any) {
      console.error('Image upload failed:', err)
      setSaveResult({ success: false, message: err?.message || t('sr.profile.err_upload') })
    } finally { setUploadingImage(false) }
  }

  async function handleSave() {
    if (!employeeData) return
    setSaving(true)
    setSaveResult(null)
    try {
      const updates: Record<string, any> = {}
      if (firstName !== (employeeData.first_name || '')) updates.first_name = firstName
      if (lastName !== (employeeData.last_name || '')) updates.last_name = lastName
      if (cellNumber !== (employeeData.cell_number || '')) updates.cell_number = cellNumber
      if (personalEmail !== (employeeData.personal_email || '')) updates.personal_email = personalEmail
      if (nationalId !== (employeeData.custom_national_id || '')) updates.custom_national_id = nationalId
      if (idType !== (employeeData.custom_id_type || '')) updates.custom_id_type = idType
      if (imageUrl !== (employeeData.image || '')) updates.image = imageUrl

      if (Object.keys(updates).length === 0) {
        setSaveResult({ success: true, message: t('sr.profile.no_changes') })
        setIsEditing(false)
        return
      }

      const result = await frappeClient.updateEmployee(employeeData.name, updates)
      if (!result) throw new Error('Failed to update')

      // Sync changes to User doctype
      const userUpdates: Record<string, any> = {}
      if (updates.first_name || updates.last_name) {
        const newFirst = updates.first_name || employeeData.first_name || ''
        const newLast = updates.last_name ?? employeeData.last_name ?? ''
        userUpdates.first_name = newFirst
        userUpdates.last_name = newLast
        userUpdates.full_name = [newFirst, newLast].filter(Boolean).join(' ')
      }
      // Sync name to User if changed
      if (Object.keys(userUpdates).length > 0 && employeeData.user_id) {
        try { await updateDoc('User', employeeData.user_id, userUpdates); await refreshUser() } catch { /* ignore */ }
      }
      // Sync image system-wide via dedicated API
      if (updates.image && employeeData.name) {
        try {
          await frappeClient.call('base_meena.employee_documents_api.update_employee_image', {
            employee: employeeData.name,
            image_url: updates.image,
          })
          await refreshUser()
        } catch {
          // Fallback: direct User update
          if (employeeData.user_id) {
            try { await updateDoc('User', employeeData.user_id, { user_image: updates.image }); await refreshUser() } catch { /* ignore */ }
          }
        }
      }

      // Sync name to Sales Person if linked
      if ((updates.first_name || updates.last_name) && salesPerson?.name) {
        const newName = [updates.first_name || employeeData.first_name, updates.last_name ?? employeeData.last_name].filter(Boolean).join(' ')
        try { await frappeClient.put('Sales Person', salesPerson.name, { sales_person_name: newName }) } catch { /* ignore */ }
      }

      // Compute employee_name for local display
      const newEmployeeName = updates.first_name || updates.last_name
        ? [updates.first_name || employeeData.first_name, updates.last_name ?? employeeData.last_name].filter(Boolean).join(' ')
        : employeeData.employee_name
      setEmployeeData({ ...employeeData, ...updates, employee_name: newEmployeeName })
      setSaveResult({ success: true, message: t('sr.profile.save_success') })
      setIsEditing(false)
    } catch (err: any) {
      const detail = err?.message || ''
      const msg = detail.includes('403') || detail.includes('Forbidden')
        ? t('sr.profile.err_forbidden')
        : detail.includes('404')
          ? t('sr.profile.err_not_found')
          : detail.includes('CSRF')
            ? t('sr.profile.err_csrf')
            : t('sr.profile.err_save').replace('{detail}', detail)
      setSaveResult({ success: false, message: msg })
      console.error('Profile save error:', err)
    } finally { setSaving(false) }
  }

  const totalStock = repStock.reduce((sum, s) => sum + (Number(s.actual_qty) || 0), 0)
  const displayImage = imagePreview || (imageUrl ? frappeImageUrl(imageUrl) : null)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white pb-8 px-5 rounded-b-[2rem]">
        <div className="pt-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/30">
                {displayImage ? (
                  <img src={displayImage} alt={t('sr.profile.avatar_alt')} className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <User className="w-8 h-8 text-white" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -left-1 w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg hover:bg-blue-400 transition-colors"
                disabled={uploadingImage}
              >
                {uploadingImage ? (
                  <Loader2 className="h-3 w-3 text-white animate-spin" />
                ) : (
                  <Camera className="h-3 w-3 text-white" />
                )}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">
                {employeeData?.employee_name || getSalesPersonName()}
              </h1>
              <p className="text-blue-200 text-sm truncate">{user?.email}</p>
              {salesPerson && (
                <p className="text-blue-200/70 text-xs font-mono mt-0.5" dir="ltr">
                  {salesPerson.name}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Today's Stats */}
        <Card className="p-4 border border-slate-200 rounded-2xl">
          <h3 className="font-bold text-base mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            {t('sr.profile.today_stats')}
          </h3>
          {loadingStats ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-blue-50 rounded-xl">
                <div className="text-2xl font-bold text-blue-600">{todayStats.visits}</div>
                <div className="text-[10px] text-blue-500">{t('sr.common.visit_unit')}</div>
              </div>
              <div className="text-center p-3 bg-emerald-50 rounded-xl">
                <div className="text-2xl font-bold text-emerald-600">{todayStats.completed}</div>
                <div className="text-[10px] text-emerald-500">{t('sr.common.completed_fem')}</div>
              </div>
              <div className="text-center p-3 bg-amber-50 rounded-xl">
                <div className="text-2xl font-bold text-amber-600">{todayStats.orders}</div>
                <div className="text-[10px] text-amber-600">{t('sr.profile.stat_orders')}</div>
              </div>
            </div>
          )}
        </Card>

        {/* Language */}
        <Card className="p-4 border border-slate-200 rounded-2xl">
          <h3 className="font-bold text-base mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-blue-600" />
            {t('sr.common.language')}
          </h3>
          <SalesLangSwitcher className="w-full justify-between" />
        </Card>

        {/* Account Info */}
        <Card className="p-4 border border-slate-200 rounded-2xl">
          <h3 className="font-bold text-base mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />
            {t('sr.profile.account_info')}
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-500 flex items-center gap-2">
                <Warehouse className="w-4 h-4" />
                {t('sr.common.warehouse')}
              </span>
              <span className="text-sm font-medium">{warehouse || t('sr.common.not_set')}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-500 flex items-center gap-2">
                <User className="w-4 h-4" />
                {t('sr.profile.customers_count')}
              </span>
              <span className="text-sm font-bold text-blue-600">{customers.length}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-500 flex items-center gap-2">
                <Package className="w-4 h-4" />
                {t('sr.profile.total_stock')}
              </span>
              <span className="text-sm font-bold text-emerald-600">{t('sr.common.units_count').replace('{n}', String(totalStock))}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-slate-500 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {t('sr.profile.territory')}
              </span>
              <span className="text-sm font-medium">
                {(salesPerson as any)?.territory || t('sr.common.not_set')}
              </span>
            </div>
          </div>
        </Card>

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

        {/* Editable Contact Info */}
        {loadingEmployee ? (
          <Card className="p-4 border border-slate-200 rounded-2xl">
            <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">{t('sr.profile.loading_contact')}</span>
            </div>
          </Card>
        ) : employeeData ? (
          <Card className="p-4 border border-slate-200 rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600" />
                {t('sr.profile.contact_info')}
              </h3>
              {!isEditing ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setIsEditing(true); setSaveResult(null) }}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {t('sr.common.edit')}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={resetForm} disabled={saving} className="text-gray-500">{t('sr.common.cancel')}</Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700 gap-1.5">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    {t('sr.profile.save')}
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {/* Name fields */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 flex items-center gap-1.5"><User className="w-3 h-3" /> {t('sr.profile.first_name')}</Label>
                  {isEditing ? (
                    <Input placeholder={t('sr.profile.first_name')} value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-10" />
                  ) : (
                    <p className="text-sm font-medium py-1">{firstName || <span className="text-gray-400">{t('sr.common.not_set')}</span>}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500 flex items-center gap-1.5"><User className="w-3 h-3" /> {t('sr.profile.last_name')}</Label>
                  {isEditing ? (
                    <Input placeholder={t('sr.profile.last_name')} value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-10" />
                  ) : (
                    <p className="text-sm font-medium py-1">{lastName || <span className="text-gray-400">{t('sr.common.not_set')}</span>}</p>
                  )}
                </div>
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 flex items-center gap-1.5"><Phone className="w-3 h-3" /> {t('sr.profile.cell_number')}</Label>
                {isEditing ? (
                  <Input type="tel" dir="ltr" placeholder={t('sr.profile.phone_placeholder')} value={cellNumber} onChange={(e) => setCellNumber(e.target.value)} className="text-left h-10" />
                ) : (
                  <p className="text-sm font-medium py-1" dir="ltr">{cellNumber || <span className="text-gray-400">{t('sr.common.not_set')}</span>}</p>
                )}
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 flex items-center gap-1.5"><Mail className="w-3 h-3" /> {t('sr.profile.personal_email')}</Label>
                {isEditing ? (
                  <Input type="email" dir="ltr" placeholder={t('sr.profile.email_placeholder')} value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} className="text-left h-10" />
                ) : (
                  <p className="text-sm font-medium py-1" dir="ltr">{personalEmail || <span className="text-gray-400">{t('sr.common.not_set')}</span>}</p>
                )}
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 flex items-center gap-1.5"><Shield className="w-3 h-3" /> {t('sr.profile.id_type')}</Label>
                {isEditing ? (
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={idType} onChange={(e) => setIdType(e.target.value)}>
                    <option value="">{t('sr.profile.id_type_placeholder')}</option>
                    <option value="National ID">{t('sr.profile.id_type_national')}</option>
                    <option value="Iqama">{t('sr.profile.id_type_iqama')}</option>
                  </select>
                ) : (
                  <p className="text-sm font-medium py-1">{idType === 'National ID' ? t('sr.profile.id_type_national') : idType === 'Iqama' ? t('sr.profile.id_type_iqama') : <span className="text-gray-400">{t('sr.common.not_set')}</span>}</p>
                )}
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-500 flex items-center gap-1.5"><CreditCard className="w-3 h-3" /> {idType === 'Iqama' ? t('sr.profile.iqama_number') : t('sr.profile.national_id_number')}</Label>
                {isEditing ? (
                  <div>
                    <Input dir="ltr" placeholder={t('sr.profile.id_placeholder')} value={nationalId} onChange={(e) => setNationalId(e.target.value)} className="text-left h-10" />
                    {nationalId && !/^\d{10}$/.test(nationalId) && (
                      <p className="text-xs text-amber-600 mt-1">⚠️ {t('sr.profile.id_validation')}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-medium font-mono py-1" dir="ltr">{nationalId || <span className="text-gray-400 font-sans">{t('sr.common.not_set')}</span>}</p>
                )}
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-4 border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-3 text-amber-700 bg-amber-50 p-3 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p className="text-sm">{t('sr.profile.no_employee')}</p>
            </div>
          </Card>
        )}
        {/* Employee Documents */}
        {employeeData && (
          <Card className="p-4 border border-slate-200 rounded-2xl">
            <EmployeeDocuments
              employeeId={employeeData.name}
              employeeName={employeeData.employee_name}
              canDelete={false}
              canUpload={true}
              compact={true}
              isRTL={isRTL}
            />
          </Card>
        )}

        {/* Employee Custody Items */}
        {employeeData && (
          <Card className="p-4 border border-slate-200 rounded-2xl">
            <CustodyItems
              employeeId={employeeData.name}
              isRTL={isRTL}
            />
          </Card>
        )}

        {/* Quick Links */}
        <Card className="p-4 border border-slate-200 rounded-2xl">
          <h3 className="font-bold text-base mb-3">{t('sr.profile.quick_actions')}</h3>
          <div className="space-y-2">
            <Link href="/sales-rep/route-plan">
              <Button
                variant="outline"
                className="w-full justify-between h-12 rounded-xl bg-transparent"
              >
                <span className="flex items-center gap-2">
                  <Route className="w-4 h-4 text-cyan-600" />
                  {t('sr.profile.route_plan')}
                </span>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </Button>
            </Link>
            <Link href="/sales-rep/stock-requests">
              <Button
                variant="outline"
                className="w-full justify-between h-12 rounded-xl bg-transparent"
              >
                <span className="flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-blue-600" />
                  {t('sr.stockreq.title')}
                </span>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </Button>
            </Link>
            <Link href="/sales-rep/payments">
              <Button
                variant="outline"
                className="w-full justify-between h-12 rounded-xl bg-transparent"
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600" />
                  {t('sr.payments.title')}
                </span>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </Button>
            </Link>
            <Link href="/sales-rep/inventory-records">
              <Button
                variant="outline"
                className="w-full justify-between h-12 rounded-xl bg-transparent"
              >
                <span className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-600" />
                  {t('sr.invrec.title')}
                </span>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full h-14 rounded-2xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 bg-transparent"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <Loader2 className="w-5 h-5 animate-spin ml-2" />
          ) : (
            <LogOut className="w-5 h-5 ml-2" />
          )}
          {t('sr.profile.logout')}
        </Button>
      </div>
    </div>
  )
}
