'use client'

// Ported from egarsys src/components/sections/tenants.tsx.
// Scope of THIS port (per the section-by-section plan):
//   • LIST view — rendered 1:1, reading the Frappe mirror via
//     lib/rentals/tenants-data (desktop table + mobile cards · «سجل تأخير» /
//     «طوارئ» badges · search).
//   • DETAIL dialog — rendered 1:1 (the permanent «تقييم العميل» delay-rating
//     panel with its expandable history log · the tenant info grid · the linked
//     العقود list) — all from the mirror compat adapter.
//   • CREATE / EDIT / DELETE are WRITE flows — now LIVE against the Frappe mirror
//     doctype `Rental Tenant` via lib/rentals/tenant-write.ts. The «إضافة مستأجر»
//     button, the row/card pencil + trash, and the detail-footer تعديل/حذف all
//     open the ported create/edit form dialog (with its صفة الطرف selector driving
//     the dynamic identity fields) or the delete confirmation AlertDialog.
// Mechanical changes vs the original: data fetches → adapter; writes → tenant-write;
// useToast → sonner; @/components/ui/* → scoped ui; @/lib/* → scoped copies.
//
// NOTE (fidelity): the egarsys source detail dialog does NOT render the
// party-type-specific identity fields (اسم المنشأة/الشركة · السجل التجاري ·
// الرقم الضريبي · الرقم الموحّد · بيانات المفوّض) — those only appear in its
// create/edit FORM (a write flow, stubbed here). The adapter still EXPOSES every
// such field on TenantDetailView so a future 1:1 pass can surface them without
// re-touching the data layer. This port matches what egarsys renders today.

import * as React from 'react'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  User,
  ShieldAlert,
  FileText,
  ChevronDown,
  CheckCircle2,
  History,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'
import { Skeleton } from './ui/skeleton'
import { ScrollArea } from './ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { formatSAR, formatDate, formatDurationAr, installmentLabelAr, daysSince } from './format'
import { ContractStatusLabels, TenantPartyTypeLabels, TENANT_PARTY_TYPE_VALUES } from './types'
import type { ContractStatusValue, TenantPartyTypeValue } from './types'
import {
  getTenantsList,
  getTenantDetail,
} from '@/lib/rentals/tenants-data'
import type { TenantView, TenantDetailView } from '@/lib/rentals/tenants-data'
import {
  createTenantDoc,
  updateTenantDoc,
  deleteTenantDoc,
  getTenantCompanyContext,
  type TenantCompanyContext,
  type TenantFormInput,
} from '@/lib/rentals/tenant-write'

// ---------------------------------------------------------------------------
// Contract status badge variant
// ---------------------------------------------------------------------------

function getContractStatusBadge(status: string) {
  const label = ContractStatusLabels[status as ContractStatusValue]
  const map: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
    active: 'success',
    expired: 'neutral',
    pending_renewal: 'warning',
    terminated: 'danger',
    draft: 'neutral',
  }
  return (
    <Badge variant={map[status] ?? 'neutral'}>
      {label?.ar ?? status}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// Create / Edit form state (ported verbatim from egarsys tenants.tsx)
// ---------------------------------------------------------------------------

interface TenantForm {
  name: string
  partyType: '' | TenantPartyTypeValue
  nationalId: string
  companyName: string
  crNumber: string
  vatNumber: string
  phone: string
  email: string
  address: string
  emergencyContact: string
}

const emptyForm: TenantForm = {
  name: '',
  partyType: '',
  nationalId: '',
  companyName: '',
  crNumber: '',
  vatNumber: '',
  phone: '',
  email: '',
  address: '',
  emergencyContact: '',
}

// ===========================================================================
// TenantsSection Component
// ===========================================================================

export default function TenantsSection() {
  // Edit/delete affordances stay visible 1:1 (the platform tenant section has no
  // per-user permission gate here, same as the ported contracts section).
  const canEdit = true
  const canDelete = true

  // --- Data state ---
  const [tenants, setTenants] = React.useState<TenantView[]>([])
  const [loading, setLoading] = React.useState(true)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')

  // --- Dialog state ---
  const [detailOpen, setDetailOpen] = React.useState(false)
  const [formOpen, setFormOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)

  // --- Selection state ---
  const [selectedTenant, setSelectedTenant] = React.useState<TenantDetailView | null>(null)
  const [ratingOpen, setRatingOpen] = React.useState(false) // تقييم العميل history log toggle
  const [detailLoading, setDetailLoading] = React.useState(false)
  const [editingTenant, setEditingTenant] = React.useState<TenantView | null>(null)
  const [deletingTenant, setDeletingTenant] = React.useState<TenantView | null>(null)

  // --- Write-flow state — writes land on the `Rental Tenant` mirror via tenant-write. ---
  const [form, setForm] = React.useState<TenantForm>(emptyForm)
  const [formErrors, setFormErrors] = React.useState<Partial<Record<keyof TenantForm, string>>>({})
  const [submitting, setSubmitting] = React.useState(false)
  // The company_id every new tenant doc is stamped with (mirrors contract-write's seqCtx).
  const [companyCtx, setCompanyCtx] = React.useState<TenantCompanyContext>({ companyId: null })

  React.useEffect(() => {
    getTenantCompanyContext().then(setCompanyCtx).catch(() => {})
  }, [])

  // --- Debounce search ---
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 400)
    return () => clearTimeout(timer)
  }, [searchTerm])

  // --- Fetch tenants ---
  const fetchTenants = React.useCallback(async () => {
    try {
      setLoading(true)
      const data = await getTenantsList(debouncedSearch || undefined)
      setTenants(Array.isArray(data) ? data : [])
    } catch {
      toast.error('فشل في تحميل بيانات المستأجرين')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  React.useEffect(() => {
    fetchTenants()
  }, [fetchTenants])

  // --- View tenant detail ---
  const handleViewTenant = async (tenant: TenantView) => {
    try {
      setDetailLoading(true)
      setDetailOpen(true)
      setRatingOpen(false)
      const data = await getTenantDetail(tenant.id)
      setSelectedTenant(data)
    } catch {
      toast.error('فشل في تحميل تفاصيل المستأجر')
    } finally {
      setDetailLoading(false)
    }
  }

  // --- Open create form ---
  const handleCreate = () => {
    setEditingTenant(null)
    setForm(emptyForm)
    setFormErrors({})
    setFormOpen(true)
  }

  // --- Open edit form (prefilled from the mirror-backed row) ---
  const handleEdit = (tenant: TenantView) => {
    setEditingTenant(tenant)
    setForm({
      name: tenant.name,
      partyType: (TENANT_PARTY_TYPE_VALUES.includes(tenant.partyType ?? '') ? tenant.partyType : '') as '' | TenantPartyTypeValue,
      nationalId: tenant.nationalId ?? '',
      companyName: tenant.companyName ?? '',
      crNumber: tenant.crNumber ?? '',
      vatNumber: tenant.vatNumber ?? '',
      phone: tenant.phone,
      email: tenant.email ?? '',
      address: tenant.address ?? '',
      emergencyContact: tenant.emergencyContact ?? '',
    })
    setFormErrors({})
    setFormOpen(true)
  }

  const arabicOnly = /^[؀-ۿ\s0-9٠-٩\-_]+$/

  // --- Validate form (ported verbatim from egarsys) ---
  const validate = (): boolean => {
    const errors: Partial<Record<keyof TenantForm, string>> = {}
    if (!form.name.trim()) errors.name = 'الاسم مطلوب'
    else if (!arabicOnly.test(form.name.trim())) errors.name = 'الرجاء إدخال حروف عربية فقط'
    if (!form.phone.trim()) errors.phone = 'رقم الهاتف مطلوب'
    if (form.address.trim() && !arabicOnly.test(form.address.trim())) errors.address = 'الرجاء إدخال حروف عربية فقط'
    // صفة الطرف dictates the required identity fields (ZATCA B2B/B2C classification)
    if (!form.partyType) errors.partyType = 'صفة الطرف مطلوبة'
    else if (form.partyType === 'individual') {
      if (!form.nationalId.trim()) errors.nationalId = 'الهوية الوطنية مطلوبة'
    } else if (form.partyType === 'establishment' || form.partyType === 'company') {
      if (!form.companyName.trim()) errors.companyName = form.partyType === 'company' ? 'اسم الشركة مطلوب' : 'اسم المنشأة مطلوب'
      if (!form.crNumber.trim()) errors.crNumber = 'السجل التجاري مطلوب'
      if (!form.vatNumber.trim()) errors.vatNumber = 'الرقم الضريبي مطلوب'
    } else if (form.partyType === 'government') {
      if (!form.companyName.trim()) errors.companyName = 'اسم الجهة مطلوب'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // --- Submit form (create → post · edit → put; صفة الطرف gating lives in tenant-write) ---
  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const payload: TenantFormInput = {
        name: form.name.trim(),
        partyType: form.partyType || undefined,
        nationalId: form.nationalId,
        companyName: form.companyName,
        crNumber: form.crNumber,
        vatNumber: form.vatNumber,
        phone: form.phone.trim(),
        email: form.email,
        address: form.address,
        emergencyContact: form.emergencyContact,
      }
      if (editingTenant) {
        await updateTenantDoc(editingTenant.id, payload)
        toast.success('تم تحديث بيانات المستأجر بنجاح')
      } else {
        await createTenantDoc(payload, companyCtx)
        toast.success('تم إضافة المستأجر بنجاح')
      }
      setFormOpen(false)
      setEditingTenant(null)
      fetchTenants()
    } catch (err) {
      toast.error((err as Error)?.message || 'فشل في حفظ البيانات')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Open delete confirmation ---
  const openDelete = (tenant: TenantView) => {
    setDeletingTenant(tenant)
    setDeleteOpen(true)
  }

  // --- Delete tenant (surfaces Frappe FK/link-guard errors via toast) ---
  const handleDelete = async () => {
    if (!deletingTenant) return
    setSubmitting(true)
    try {
      await deleteTenantDoc(deletingTenant.id)
      toast.success('تم حذف المستأجر بنجاح')
      setDeleteOpen(false)
      setDeletingTenant(null)
      if (detailOpen && selectedTenant?.id === deletingTenant.id) {
        setDetailOpen(false)
        setSelectedTenant(null)
      }
      fetchTenants()
    } catch (err) {
      toast.error((err as Error)?.message || 'فشل في حذف المستأجر')
    } finally {
      setSubmitting(false)
    }
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* ---- Top Bar ---- */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-9"
          />
        </div>
        <Button onClick={handleCreate} className="gap-2 shrink-0">
          <Plus className="size-4" />
          إضافة مستأجر
        </Button>
      </div>

      {/* ---- Loading Skeleton ---- */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* ---- Empty State ---- */}
      {!loading && tenants.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <User className="size-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-muted-foreground">لا يوجد مستأجرين</p>
            <p className="text-sm text-muted-foreground mt-1">
              {debouncedSearch ? 'لا توجد نتائج مطابقة للبحث' : 'ابدأ بإضافة مستأجر جديد'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* ---- Desktop Table ---- */}
      {!loading && tenants.length > 0 && (
        <>
          <div className="hidden md:block">
            <Card className="py-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الهوية الوطنية</TableHead>
                    <TableHead className="text-right">الهاتف</TableHead>
                    <TableHead className="text-right">البريد الإلكتروني</TableHead>
                    <TableHead className="text-right">العنوان</TableHead>
                    <TableHead className="text-right">جهة الطوارئ</TableHead>
                    <TableHead className="text-right">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow
                      key={tenant.id}
                      className="cursor-pointer"
                      onClick={() => handleViewTenant(tenant)}
                    >
                      <TableCell className="font-medium">
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {tenant.name}
                          {(tenant._count?.delayRecords ?? 0) > 0 && (
                            <Badge variant="danger" className="gap-1 text-[10px]" title="سجل تأخير في السداد — افتح الملف لعرض التفاصيل">
                              <History className="size-3" />
                              سجل تأخير
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>{tenant.nationalId || '—'}</TableCell>
                      <TableCell dir="ltr" className="text-right">{tenant.phone}</TableCell>
                      <TableCell>{tenant.email || '—'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{tenant.address || '—'}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{tenant.emergencyContact || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleViewTenant(tenant)}
                            title="عرض"
                          >
                            <Eye className="size-4" />
                          </Button>
                          {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => handleEdit(tenant)}
                            title="تعديل"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          )}
                          {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive hover:text-destructive"
                            onClick={() => openDelete(tenant)}
                            title="حذف"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* ---- Mobile Cards ---- */}
          <div className="flex flex-col gap-3 md:hidden">
            {tenants.map((tenant) => (
              <Card
                key={tenant.id}
                className="cursor-pointer py-4 transition-shadow hover:shadow-md"
                onClick={() => handleViewTenant(tenant)}
              >
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="flex flex-wrap items-center gap-1.5 font-semibold text-base">
                        {tenant.name}
                        {(tenant._count?.delayRecords ?? 0) > 0 && (
                          <Badge variant="danger" className="gap-1 text-[10px]">
                            <History className="size-3" />
                            سجل تأخير
                          </Badge>
                        )}
                      </p>
                      {tenant.nationalId && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          هوية: {tenant.nationalId}
                        </p>
                      )}
                    </div>
                    {tenant.emergencyContact && (
                      <Badge variant="warning" className="gap-1">
                        <ShieldAlert className="size-3" />
                        طوارئ
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <Phone className="size-3.5" />
                      <span dir="ltr">{tenant.phone}</span>
                    </span>
                    {tenant.email && (
                      <span className="flex items-center gap-2">
                        <Mail className="size-3.5" />
                        {tenant.email}
                      </span>
                    )}
                    {tenant.address && (
                      <span className="flex items-center gap-2">
                        <MapPin className="size-3.5" />
                        <span className="truncate">{tenant.address}</span>
                      </span>
                    )}
                    {tenant.emergencyContact && (
                      <span className="flex items-center gap-2">
                        <ShieldAlert className="size-3.5" />
                        <span className="truncate">طوارئ: {tenant.emergencyContact}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleViewTenant(tenant)}
                    >
                      <Eye className="size-3.5" />
                      عرض
                    </Button>
                    {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => handleEdit(tenant)}
                    >
                      <Pencil className="size-3.5" />
                      تعديل
                    </Button>
                    )}
                    {canDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => openDelete(tenant)}
                    >
                      <Trash2 className="size-3.5" />
                      حذف
                    </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* ================================================================= */}
      {/* Tenant Detail Dialog                                               */}
      {/* ================================================================= */}
      <Dialog open={detailOpen} onOpenChange={(open) => {
        setDetailOpen(open)
        if (!open) setSelectedTenant(null)
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="size-5" />
              تفاصيل المستأجر
            </DialogTitle>
            <DialogDescription>معلومات المستأجر والعقود المرتبطة</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="space-y-4 py-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-56" />
              <Skeleton className="h-4 w-72" />
            </div>
          ) : selectedTenant ? (
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6 pb-4">
                {/* تقييم العميل — PERMANENT rating (client 2026-07-10, revised): delay
                    events are recorded forever; paying later closes an event but never
                    erases it. Click the header to expand the historical delay log. */}
                {(() => {
                  const history = [...(selectedTenant.delayHistory ?? [])].sort(
                    (a, b) => (a.resolvedAt ? 1 : 0) - (b.resolvedAt ? 1 : 0) || b.dueDate.localeCompare(a.dueDate),
                  )
                  const openEvents = history.filter((r) => !r.resolvedAt)
                  const isLateNow = openEvents.length > 0
                  const live = selectedTenant.latePayment
                  const tone = isLateNow
                    ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30'
                    : history.length
                      ? 'border-amber-200 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10'
                      : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/30'
                  return (
                    <div className={`rounded-lg border ${tone}`}>
                      <button
                        type="button"
                        onClick={() => history.length && setRatingOpen((v) => !v)}
                        className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-right text-sm"
                      >
                        {isLateNow ? (
                          <ShieldAlert className="size-4 shrink-0 text-red-600 dark:text-red-400" />
                        ) : history.length ? (
                          <History className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        )}
                        <span className="font-bold">تقييم العميل:</span>
                        {isLateNow ? (
                          <>
                            <span className="font-bold text-red-700 dark:text-red-300">يتأخر في السداد</span>
                            <span className="font-semibold text-red-600 dark:text-red-400">
                              — متأخر حالياً على {openEvents.length === 1 ? 'قسط واحد' : `${openEvents.length} أقساط`}
                              {live && live.delayDays > 0 ? ` (تأخر ${formatDurationAr(live.delayDays)})` : ''}
                            </span>
                            {live && live.totalOverdue > 0 && (
                              <span className="text-xs text-red-600/80 dark:text-red-400/80">{formatSAR(live.totalOverdue)}</span>
                            )}
                          </>
                        ) : history.length ? (
                          <span className="font-semibold text-amber-700 dark:text-amber-300">
                            سجل تأخير سابق — تأخر {history.length === 1 ? 'مرة واحدة' : `${history.length} مرات`} (سُدِّدت لاحقاً)
                          </span>
                        ) : (
                          <span className="font-semibold text-emerald-700 dark:text-emerald-300">منتظم — لا يوجد تأخير مسجّل</span>
                        )}
                        {history.length > 0 && (
                          <ChevronDown className={`mr-auto size-4 shrink-0 transition-transform ${ratingOpen ? 'rotate-180' : ''}`} />
                        )}
                      </button>
                      {ratingOpen && history.length > 0 && (
                        <div className="space-y-1.5 border-t border-black/5 px-3 py-2 dark:border-white/10">
                          {history.map((r) => {
                            const days = r.resolvedAt ? r.delayDays : (daysSince(r.dueDate) ?? r.delayDays)
                            return (
                              <div key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                                <span className="font-semibold">
                                  تأخر في سداد {installmentLabelAr(r.installmentNo)}
                                  {r.contractNumber ? <span className="font-mono" dir="ltr"> — {r.contractNumber}</span> : null}
                                </span>
                                <span className="text-muted-foreground">
                                  الاستحقاق {formatDate(r.dueDate)} · تأخر {formatDurationAr(days)}
                                </span>
                                {r.resolvedAt ? (
                                  <Badge variant="warning" className="text-[10px]">سُدِّد لاحقاً</Badge>
                                ) : (
                                  <Badge variant="danger" className="text-[10px]">ما زال متأخراً</Badge>
                                )}
                              </div>
                            )
                          })}
                          <p className="pt-1 text-[10px] text-muted-foreground">
                            سجل دائم — يبقى التأخير مسجّلاً حتى بعد السداد لتقييم تعامل العميل مستقبلاً.
                          </p>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Tenant info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                      <User className="size-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">الاسم</p>
                      <p className="font-medium">{selectedTenant.name}</p>
                    </div>
                  </div>
                  {selectedTenant.nationalId && (
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                        <CreditCard className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">الهوية الوطنية</p>
                        <p className="font-medium" dir="ltr">{selectedTenant.nationalId}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                      <Phone className="size-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">الهاتف</p>
                      <p className="font-medium" dir="ltr">{selectedTenant.phone}</p>
                    </div>
                  </div>
                  {selectedTenant.email && (
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                        <Mail className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">البريد الإلكتروني</p>
                        <p className="font-medium">{selectedTenant.email}</p>
                      </div>
                    </div>
                  )}
                  {selectedTenant.address && (
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                        <MapPin className="size-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">العنوان</p>
                        <p className="font-medium">{selectedTenant.address}</p>
                      </div>
                    </div>
                  )}
                  {selectedTenant.emergencyContact && (
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/10">
                        <ShieldAlert className="size-4 text-destructive" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">جهة اتصال الطوارئ</p>
                        <p className="font-medium">{selectedTenant.emergencyContact}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Contracts list */}
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="size-4" />
                    العقود ({selectedTenant._count?.contracts ?? selectedTenant.contracts?.length ?? 0})
                  </h3>
                  {selectedTenant.contracts && selectedTenant.contracts.length > 0 ? (
                    <div className="space-y-2">
                      {selectedTenant.contracts.map((contract) => (
                        <Card key={contract.id} className="py-3">
                          <CardContent className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium">
                                عقد #{contract.contractNumber}
                              </p>
                              <div className="flex items-center flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                                <span>{formatDate(contract.startDate)}</span>
                                <span>—</span>
                                <span>{formatDate(contract.endDate)}</span>
                                <span>•</span>
                                <span>{formatSAR(contract.rentAmount)}</span>
                              </div>
                            </div>
                            {getContractStatusBadge(contract.status)}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      لا توجد عقود مرتبطة بهذا المستأجر
                    </p>
                  )}
                </div>
              </div>
            </ScrollArea>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            {selectedTenant && (
              <>
                {canEdit && (
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setDetailOpen(false)
                    setSelectedTenant(null)
                    handleEdit(selectedTenant)
                  }}
                >
                  <Pencil className="size-4" />
                  تعديل
                </Button>
                )}
                {canDelete && (
                <Button
                  variant="destructive"
                  className="gap-1.5"
                  onClick={() => {
                    setDetailOpen(false)
                    openDelete(selectedTenant)
                  }}
                >
                  <Trash2 className="size-4" />
                  حذف
                </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Create / Edit Tenant Dialog (ported 1:1 from egarsys)              */}
      {/* ================================================================= */}
      <Dialog open={formOpen} onOpenChange={(open) => {
        setFormOpen(open)
        if (!open) {
          setEditingTenant(null)
          setFormErrors({})
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTenant ? 'تعديل بيانات المستأجر' : 'إضافة مستأجر جديد'}
            </DialogTitle>
            <DialogDescription>
              {editingTenant ? 'قم بتعديل بيانات المستأجر' : 'أدخل بيانات المستأجر الجديد'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="tenant-name">
                الاسم <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tenant-name"
                value={form.name}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                  if (formErrors.name) setFormErrors((prev) => ({ ...prev, name: undefined }))
                }}
                aria-invalid={!!formErrors.name}
              />
              {formErrors.name && (
                <p className="text-sm text-destructive">{formErrors.name}</p>
              )}
            </div>

            {/* صفة الطرف — dictates which identity fields apply (ZATCA) */}
            <div className="space-y-2">
              <Label htmlFor="tenant-party-type">
                صفة الطرف <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.partyType || undefined}
                onValueChange={(v) => {
                  setForm((prev) => ({ ...prev, partyType: v as TenantPartyTypeValue }))
                  if (formErrors.partyType) setFormErrors((prev) => ({ ...prev, partyType: undefined }))
                }}
              >
                <SelectTrigger id="tenant-party-type" className="w-full" aria-invalid={!!formErrors.partyType}>
                  <SelectValue placeholder="اختر صفة الطرف" />
                </SelectTrigger>
                <SelectContent>
                  {TENANT_PARTY_TYPE_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>{TenantPartyTypeLabels[v as TenantPartyTypeValue].ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.partyType && (
                <p className="text-sm text-destructive">{formErrors.partyType}</p>
              )}
            </div>

            {/* National ID — individuals (and legacy records with no صفة الطرف yet) */}
            {(form.partyType === '' || form.partyType === 'individual') && (
              <div className="space-y-2">
                <Label htmlFor="tenant-national-id">
                  الهوية الوطنية {form.partyType === 'individual' && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  inputMode="numeric"
                  id="tenant-national-id"
                  value={form.nationalId}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, nationalId: e.target.value }))
                    if (formErrors.nationalId) setFormErrors((prev) => ({ ...prev, nationalId: undefined }))
                  }}
                  dir="ltr"
                  aria-invalid={!!formErrors.nationalId}
                />
                {formErrors.nationalId && (
                  <p className="text-sm text-destructive">{formErrors.nationalId}</p>
                )}
              </div>
            )}

            {/* Government entity name */}
            {form.partyType === 'government' && (
              <div className="space-y-2">
                <Label htmlFor="tenant-company-name">
                  اسم الجهة <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="tenant-company-name"
                  value={form.companyName}
                  onChange={(e) => {
                    setForm((prev) => ({ ...prev, companyName: e.target.value }))
                    if (formErrors.companyName) setFormErrors((prev) => ({ ...prev, companyName: undefined }))
                  }}
                  aria-invalid={!!formErrors.companyName}
                />
                {formErrors.companyName && (
                  <p className="text-sm text-destructive">{formErrors.companyName}</p>
                )}
              </div>
            )}

            {/* CR + tax number — establishments and companies */}
            {(form.partyType === 'establishment' || form.partyType === 'company') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tenant-company-name">
                    {form.partyType === 'company' ? 'اسم الشركة' : 'اسم المنشأة'} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="tenant-company-name"
                    value={form.companyName}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, companyName: e.target.value }))
                      if (formErrors.companyName) setFormErrors((prev) => ({ ...prev, companyName: undefined }))
                    }}
                    aria-invalid={!!formErrors.companyName}
                  />
                  {formErrors.companyName && (
                    <p className="text-sm text-destructive">{formErrors.companyName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant-cr-number">
                    رقم السجل التجاري <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    inputMode="numeric"
                    id="tenant-cr-number"
                    value={form.crNumber}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, crNumber: e.target.value }))
                      if (formErrors.crNumber) setFormErrors((prev) => ({ ...prev, crNumber: undefined }))
                    }}
                    dir="ltr"
                    aria-invalid={!!formErrors.crNumber}
                  />
                  {formErrors.crNumber && (
                    <p className="text-sm text-destructive">{formErrors.crNumber}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant-vat-number">
                    الرقم الضريبي <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    inputMode="numeric"
                    id="tenant-vat-number"
                    value={form.vatNumber}
                    onChange={(e) => {
                      setForm((prev) => ({ ...prev, vatNumber: e.target.value }))
                      if (formErrors.vatNumber) setFormErrors((prev) => ({ ...prev, vatNumber: undefined }))
                    }}
                    dir="ltr"
                    aria-invalid={!!formErrors.vatNumber}
                  />
                  {formErrors.vatNumber && (
                    <p className="text-sm text-destructive">{formErrors.vatNumber}</p>
                  )}
                </div>
              </>
            )}

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="tenant-phone">
                رقم الهاتف <span className="text-destructive">*</span>
              </Label>
              <Input
                inputMode="numeric"
                id="tenant-phone"
                value={form.phone}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, phone: e.target.value }))
                  if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: undefined }))
                }}
                dir="ltr"
                aria-invalid={!!formErrors.phone}
              />
              {formErrors.phone && (
                <p className="text-sm text-destructive">{formErrors.phone}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="tenant-email">البريد الإلكتروني</Label>
              <Input
                id="tenant-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                dir="ltr"
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
               <Label htmlFor="tenant-address">العنوان</Label>
               <Input
                 id="tenant-address"
                 value={form.address}
                 onChange={(e) => {
                   setForm((prev) => ({ ...prev, address: e.target.value }))
                   if (formErrors.address) setFormErrors((prev) => ({ ...prev, address: undefined }))
                 }}
                 aria-invalid={!!formErrors.address}
               />
               {formErrors.address && (
                 <p className="text-sm text-destructive">{formErrors.address}</p>
               )}
            </div>

            {/* Emergency Contact */}
            <div className="space-y-2">
              <Label htmlFor="tenant-emergency">جهة اتصال الطوارئ</Label>
              <Input
                id="tenant-emergency"
                value={form.emergencyContact}
                onChange={(e) => setForm((prev) => ({ ...prev, emergencyContact: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {editingTenant ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Delete Confirmation AlertDialog                                    */}
      {/* ================================================================= */}
      <AlertDialog open={deleteOpen} onOpenChange={(open) => {
        setDeleteOpen(open)
        if (!open) setDeletingTenant(null)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المستأجر</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المستأجر &quot;{deletingTenant?.name}&quot;؟
              {(deletingTenant?._count?.contracts ?? 0) > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  تحذير: يملك هذا المستأجر {deletingTenant?._count?.contracts} عقد مرتبط. قد يؤثر الحذف على البيانات المرتبطة.
                </span>
              )}
              لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={submitting}
              className="bg-destructive text-white hover:bg-destructive/90 gap-2"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
