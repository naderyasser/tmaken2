'use client'

// Ported from egarsys src/components/sections/properties.tsx.
// Scope of THIS port (per the section-by-section plan):
//   • LIST / grid view — rendered 1:1, reading the Frappe mirror via
//     lib/rentals/properties-data (cards · status widgets الفاضي/المؤجر ·
//     filters · طباعة of the filtered list).
//   • DETAIL dialog — rendered 1:1 (index-based image gallery · badges · info
//     grid · بيانات الصك · owner · الوحدات grid · عقود الإيجار table · سجل
//     التأجير timeline), plus the UNIT DETAIL side-sheet (unit data · rental
//     history · linked invoices) — all from the mirror compat adapter.
//   • CREATE / EDIT / DELETE + inline owner create/select — LIVE (Rental Property
//     / Rental Owner mirror via lib/rentals/property-write).
//   • image upload + gallery (cover/delete), the interactive map PICKER + keyless
//     geocoding, عمارة/دور unit GENERATION, and the كشف حساب / سجل الحركات dialogs
//     are now all LIVE too (mirror writes to Rental Property Image / Rental Unit;
//     statement+ledger read the mirror via lib/rentals/property-statement-data).
//   • Still «قريباً»: editing an EXISTING unit's data (a units-flow concern egarsys
//     also kept out of this screen).
// Mechanical changes vs the original: data fetches → adapter; zustand store →
// useRentalsShell(); @/components/ui/* → scoped ui; @/lib/* → scoped copies.

import { useEffect, useState, useCallback, useRef, lazy, Suspense } from 'react'
import {
  Building2, FileText, Search, Plus, MapPin, Phone, Mail, Pencil, Trash2,
  ChevronLeft, ChevronRight, X, Loader2, ImagePlus, Star, Printer, Eye,
  DoorOpen, KeyRound, Check, UserPlus, ScrollText,
} from 'lucide-react'
import { toast } from 'sonner'

// Vanilla-Leaflet map picker (lazy — Leaflet JS is bundled from the npm package
// only inside this chunk; CSS + marker glyphs load from the 1.9.4 CDN at runtime).
const MapPicker = lazy(() => import('./ui/map-picker'))
import type { GeocodeStatus } from './ui/map-picker'

import { Card, CardContent } from './ui/card'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { DatePicker } from './ui/date-picker'
import { Skeleton } from './ui/skeleton'
import { Separator } from './ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from './ui/sheet'
import { CompanyHeaderLogo } from './ui/company-header-logo'

import {
  PropertyTypeLabels, PropertyStatusLabels, ContractStatusLabels,
} from './types'
import type { PropertyTypeValue, PropertyStatusValue } from './types'
import { formatSAR, formatDate, formatHijri } from './format'
import { ContractLifecycleTimeline } from './contract-lifecycle-timeline'
import { useRentalsShell } from './store'
import {
  getPropertiesList, getPropertyStatusCounts, getPropertyDetail,
  getUnitsForProperty, getPropertyContracts, getUnitContracts, getUnitInvoices,
} from '@/lib/rentals/properties-data'
import type {
  PropertyView, UnitView, PropertyContractRow, UnitInvoiceRow, PropertyStatusCounts,
} from '@/lib/rentals/properties-data'
import {
  createPropertyDoc, updatePropertyDoc, deletePropertyDoc,
  getPropertySeqContext, listLinkableOwners,
  addPropertyImages, setPropertyImageCover, deletePropertyImage, generatePropertyUnits,
} from '@/lib/rentals/property-write'
import type {
  PropertyFormInput, PropertySeqContext, LinkableOwner,
} from '@/lib/rentals/property-write'
import { PropertyStatementDialog } from './property-statement-dialog'
import { PropertyLedgerDialog } from './property-ledger-dialog'

// ---------------------------------------------------------------------------
// Constants (ported verbatim)
// ---------------------------------------------------------------------------

const SAUDI_CITIES = [
  'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام',
  'الخبر', 'الظهران', 'أبها', 'تبوك', 'بريدة', 'نجران', 'الطائف',
  'حائل', 'ينبع', 'الجبيل', 'القطيف', 'خميس مشيط', 'الهفوف',
]

const PROPERTY_TYPES: PropertyTypeValue[] = [
  'apartment', 'villa', 'land', 'shop', 'workshop', 'showroom', 'courtyard', 'warehouse', 'other',
]

const PROPERTY_STATUSES: PropertyStatusValue[] = [
  'available', 'rented', 'maintenance', 'inactive',
]

// The create/edit form's property-type options — egarsys stores these ARABIC values
// verbatim in `property_type` (the mirror holds عمارة/دور/أرض/فيلا/محل مفرد alongside
// migrated english keys), so the write form uses them 1:1 (see egarsys NEW_PROPERTY_TYPES).
const NEW_PROPERTY_TYPES = [
  { value: 'عمارة', label: 'عمارة (مبنى بوحدات متعددة)' },
  { value: 'فيلا', label: 'فيلا' },
  { value: 'دور', label: 'دور (طابق واحد)' },
  { value: 'أرض', label: 'أرض' },
  { value: 'محل مفرد', label: 'محل مفرد' },
]

// ---------------------------------------------------------------------------
// Property write-form state (a focused subset of egarsys's emptyFormData — the
// image/unit-generation/map phantom fields stay stubbed, so they're omitted).
// ---------------------------------------------------------------------------

interface PropertyFormState {
  titleAr: string
  propertyType: string
  status: string
  address: string
  city: string
  district: string
  description: string
  area: string
  landType: string   // UI-only (not a mirror column) — egarsys never persisted it either
  bedrooms: string
  bathrooms: string
  shopNumber: string
  deedNumber: string
  deedDate: string
  // map pin (persisted to Rental Property latitude/longitude)
  latitude: number | null
  longitude: number | null
  // owner: a picked existing doc name (ownerId) OR the inline-create owner* fields
  ownerId: string
  ownerName: string
  ownerNationalId: string
  ownerPhone: string
  ownerEmail: string
  ownerAddress: string
  ownerVatNumber: string
  // ---- unit generation (create-mode only, عمارة/دور) — ports egarsys AutoGenerateUnits ----
  unitType: string
  customUnitType: string
  unitCount: string
  floorCount: number
  floorUnitsCount: number[]
  floorUnitTypes: string[]
  groundFloorShops: boolean
  unitArea: string
  unitRentPrice: string
}

const emptyPropertyForm: PropertyFormState = {
  titleAr: '', propertyType: 'عمارة', status: 'available',
  address: '', city: '', district: '', description: '',
  area: '', landType: '', bedrooms: '', bathrooms: '', shopNumber: '',
  deedNumber: '', deedDate: '',
  latitude: null, longitude: null,
  ownerId: '', ownerName: '', ownerNationalId: '', ownerPhone: '',
  ownerEmail: '', ownerAddress: '', ownerVatNumber: '',
  unitType: 'شقة', customUnitType: '', unitCount: '', floorCount: 0,
  floorUnitsCount: [], floorUnitTypes: [], groundFloorShops: false,
  unitArea: '', unitRentPrice: '',
}

const UNIT_TYPE_OPTIONS = ['شقة', 'محل', 'مكتب', 'استوديو', 'دور']

// ---------------------------------------------------------------------------
// Helpers (ported verbatim)
// ---------------------------------------------------------------------------

function getPropertyTitle(property: PropertyView): string {
  return property.titleAr || property.title
}

function getPropertyTypeBadgeColor(type: string): string {
  const colors: Record<string, string> = {
    apartment: 'info',
    villa: 'purple',
    land: 'lime',
    shop: 'orange',
    workshop: 'gold',
    showroom: 'teal',
    courtyard: 'stone',
    warehouse: 'indigo',
    other: 'neutral',
  }
  return colors[type] || colors.other
}

function getPropertyStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    available: 'success',
    rented: 'danger',
    maintenance: 'warning',
    inactive: 'neutral',
  }
  return colors[status] || 'neutral'
}

function getContractStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'success',
    expired: 'danger',
    pending_renewal: 'warning',
    terminated: 'neutral',
    draft: 'info',
  }
  return colors[status] || 'neutral'
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function PropertyCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-44 w-full" />
      <CardContent className="p-4 space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-3">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-5 w-24" />
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Image with graceful fallback (handles deleted/missing upload files → 404)
// ---------------------------------------------------------------------------

function ImageWithFallback({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string | null
  alt?: string
  className?: string
  fallback: React.ReactNode
}) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [src])
  if (!src || failed) return <>{fallback}</>
  return <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
}

// ---------------------------------------------------------------------------
// Property Card
// ---------------------------------------------------------------------------

interface PropertyCardProps {
  property: PropertyView
  onClick: () => void
  onStatement?: () => void
  onLedger?: () => void
  onEdit?: () => void
}

function PropertyCard({ property, onClick, onStatement, onLedger, onEdit }: PropertyCardProps) {
  const coverImage = property.images?.find((img) => img.isCover) || property.images?.[0]
  const imagePlaceholder = (
    <div className="flex items-center justify-center h-full bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20">
      <Building2 className="h-12 w-12 text-emerald-200 dark:text-emerald-800" />
    </div>
  )

  return (
    <Card
      className="group overflow-hidden cursor-pointer bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-100 dark:border-slate-800/80 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] transition-all duration-300 hover:-translate-y-1"
      onClick={onClick}
    >
      {/* Cover Image */}
      <div className="relative h-48 bg-slate-100 dark:bg-slate-950 overflow-hidden">
        {coverImage ? (
          <ImageWithFallback
            src={coverImage.image}
            alt={getPropertyTitle(property)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            fallback={imagePlaceholder}
          />
        ) : imagePlaceholder}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent pointer-events-none" />

        {/* Status badge */}
        <div className="absolute top-3 right-3">
          <Badge variant={getPropertyStatusBadgeColor(property.status) as never} className="shadow-sm backdrop-blur-md bg-white/90 dark:bg-slate-900/90 text-xs font-semibold">
            {PropertyStatusLabels[property.status as PropertyStatusValue]?.ar || property.status}
          </Badge>
        </div>
        {/* Type badge */}
        <div className="absolute top-3 left-3">
          <Badge variant={getPropertyTypeBadgeColor(property.propertyType) as never} className="shadow-sm backdrop-blur-md bg-white/90 dark:bg-slate-900/90 text-xs font-semibold">
            {PropertyTypeLabels[property.propertyType as PropertyTypeValue]?.ar || property.propertyType}
          </Badge>
        </div>

        {/* Quick edit (pencil) — opens the LIVE edit form */}
        {onEdit && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            className="absolute bottom-3 left-3 rounded-full border border-emerald-300 bg-white/90 dark:bg-slate-900/90 p-2 shadow-sm text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
            title="تعديل بيانات العقار"
            aria-label="تعديل العقار"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </div>

      <CardContent className="p-5 space-y-4">
        {/* Title & Location */}
        <div>
          <div className="flex items-center gap-2">
            {/* Property number → سجل حركات العقار */}
            {onLedger && (property.internalId ?? 0) > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onLedger() }}
                className="shrink-0 rounded-md border border-emerald-200 px-1.5 py-0.5 font-mono text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                title="فتح سجل حركات العقار"
                dir="ltr"
              >
                #{property.internalId}
              </button>
            )}
            <h3 className="flex-1 font-bold text-lg text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-emerald-600 transition-colors">
              {getPropertyTitle(property)}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 mt-1">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="line-clamp-1 font-medium">
              {property.city}{property.district ? `، ${property.district}` : ''}
            </span>
          </div>
        </div>

        {/* Units badge */}
        {(property.totalUnits ?? 0) > 0 && (
          <div>
            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              {property.totalUnits} وحدة
            </Badge>
          </div>
        )}

        {/* Owner */}
        {property.owner && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">المالك</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{property.owner.name}</p>
          </div>
        )}

        {/* Quick action: statement of account */}
        {onStatement && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onStatement() }}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
          >
            <FileText className="h-3.5 w-3.5" /> كشف حساب
          </button>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PropertiesSection() {
  const { setCurrentSection, setPendingFocus, pendingFocus, companyName } = useRentalsShell()

  // Everything in this section is LIVE against the mirror. The single remaining
  // «قريباً» is editing an EXISTING unit's data (a units-flow concern egarsys also
  // kept off this screen — unit GENERATION is wired below).
  const comingSoon = useCallback(() => {
    toast('تعديل بيانات الوحدة يتم من قسم الوحدات — قريباً')
  }, [])

  const canEdit = true
  const canDelete = true
  const [uploading, setUploading] = useState(false)

  // كشف حساب / سجل حركات dialogs (opened from cards + the detail footer).
  const [statementPropertyId, setStatementPropertyId] = useState<string | null>(null)
  const [statementOpen, setStatementOpen] = useState(false)
  const [ledgerPropertyId, setLedgerPropertyId] = useState<string | null>(null)
  const [ledgerOpen, setLedgerOpen] = useState(false)
  const openStatement = useCallback((id: string) => { setStatementPropertyId(id); setStatementOpen(true) }, [])
  const openLedger = useCallback((id: string) => { setLedgerPropertyId(id); setLedgerOpen(true) }, [])

  // Pending images picked in the create/edit FORM (uploaded after the property saves).
  const [pendingImages, setPendingImages] = useState<File[]>([])
  const formFileInputRef = useRef<HTMLInputElement>(null)
  const detailFileInputRef = useRef<HTMLInputElement>(null)
  // Live geocoding status surfaced by <MapPicker> (drives the inline address indicator).
  const [geoStatus, setGeoStatus] = useState<GeocodeStatus>('idle')

  // --- Filter State ---
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [filterCity, setFilterCity] = useState<string>('')

  // --- Detail gallery image index ---
  const [detailImageIndex, setDetailImageIndex] = useState(0)

  // --- Search Debounce ---
  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(timeout)
  }, [searchInput])

  // --- Dialog / selection State ---
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState<PropertyView | null>(null)

  // --- Data State ---
  const [properties, setProperties] = useState<PropertyView[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchTrigger, setFetchTrigger] = useState(0)
  const [statusCounts, setStatusCounts] = useState<PropertyStatusCounts | null>(null)
  const [printingList, setPrintingList] = useState(false)

  const [propertyContracts, setPropertyContracts] = useState<PropertyContractRow[]>([])
  const [detailUnits, setDetailUnits] = useState<UnitView[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)

  // --- Unit detail sheet ---
  const [selectedUnit, setSelectedUnit] = useState<UnitView | null>(null)
  const [unitSheetOpen, setUnitSheetOpen] = useState(false)
  const [unitContracts, setUnitContracts] = useState<PropertyContractRow[]>([])
  const [unitInvoices, setUnitInvoices] = useState<UnitInvoiceRow[]>([])
  const [loadingUnitDetails, setLoadingUnitDetails] = useState(false)

  const refetchProperties = useCallback(() => setFetchTrigger((t) => t + 1), [])

  // ---------------------------------------------------------------------------
  // WRITE-flow state (create · edit · delete + inline owner select/create) —
  // all write straight to the mirror via lib/rentals/property-write.
  // ---------------------------------------------------------------------------
  const [formOpen, setFormOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<PropertyView | null>(null)
  const [form, setForm] = useState<PropertyFormState>(emptyPropertyForm)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  const [deleteTarget, setDeleteTarget] = useState<PropertyView | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Per-company internal_id sequence + the owner picker's list of existing owners.
  const [seqCtx, setSeqCtx] = useState<PropertySeqContext>({ companyId: null, nextInternalId: 1 })
  const [availableOwners, setAvailableOwners] = useState<LinkableOwner[]>([])
  // Owner block mode: pick an existing Rental Owner, or inline-create a new one.
  const [ownerMode, setOwnerMode] = useState<'select' | 'new'>('select')

  const updateForm = useCallback((field: keyof PropertyFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }, [])
  // Widened setter for the unit-generation fields (arrays / numbers / booleans).
  const updateFormAny = useCallback((field: keyof PropertyFormState, value: unknown) => {
    setForm((prev) => ({ ...prev, [field]: value } as PropertyFormState))
  }, [])

  // Pre-fetch the sequence context (companyId + next الرقم الداخلي) and owner list.
  useEffect(() => {
    getPropertySeqContext().then(setSeqCtx).catch(() => {})
    listLinkableOwners().then(setAvailableOwners).catch(() => {})
  }, [fetchTrigger])

  // On close: full reset.
  useEffect(() => {
    if (!formOpen) {
      setForm(emptyPropertyForm)
      setFormErrors({})
      setEditingProperty(null)
      setOwnerMode('select')
      setPendingImages([])
      setGeoStatus('idle')
    }
  }, [formOpen])

  const openCreateForm = useCallback(() => {
    setEditingProperty(null)
    setForm(emptyPropertyForm)
    setFormErrors({})
    setOwnerMode('select')
    setPendingImages([])
    setFormOpen(true)
  }, [])

  // Open the form in edit mode, prefilled. Owner starts linked to the existing owner
  // (select mode); the type-specific measurements are prefilled so a save is loss-free.
  const openEditForm = useCallback((property: PropertyView) => {
    const o = property.owner
    setEditingProperty(property)
    setForm({
      titleAr: property.titleAr || property.title || '',
      propertyType: property.propertyType || 'عمارة',
      status: property.status || 'available',
      address: property.address || '',
      city: property.city || '',
      district: property.district || '',
      description: property.description || '',
      area: property.area != null ? String(property.area) : '',
      landType: '',
      bedrooms: property.bedrooms != null ? String(property.bedrooms) : '',
      bathrooms: property.bathrooms != null ? String(property.bathrooms) : '',
      shopNumber: property.shopNumber || '',
      deedNumber: property.deedNumber || '',
      deedDate: property.deedDate ? String(property.deedDate).slice(0, 10) : '',
      latitude: property.latitude ?? null,
      longitude: property.longitude ?? null,
      ownerId: property.ownerId || o?.id || '',
      ownerName: o?.name || '',
      ownerNationalId: o?.nationalId || '',
      ownerPhone: o?.phone || '',
      ownerEmail: o?.email || '',
      ownerAddress: o?.address || '',
      ownerVatNumber: o?.vatNumber || '',
      // unit generation is create-only; edit keeps these at defaults (never regenerates).
      unitType: 'شقة', customUnitType: '', unitCount: '', floorCount: 0,
      floorUnitsCount: [], floorUnitTypes: [], groundFloorShops: false,
      unitArea: '', unitRentPrice: '',
    })
    setFormErrors({})
    setPendingImages([])
    setOwnerMode((property.ownerId || o?.id) ? 'select' : 'new')
    setFormOpen(true)
  }, [])

  // Pick an existing owner from the list — fills the display fields + links ownerId.
  const handleOwnerSelect = useCallback((ownerId: string) => {
    const o = availableOwners.find((x) => x.id === ownerId)
    setForm((prev) => ({
      ...prev,
      ownerId,
      ownerName: o?.name || '',
      ownerNationalId: o?.nationalId || '',
      ownerPhone: o?.phone || '',
      ownerEmail: o?.email || '',
      ownerAddress: o?.address || '',
      ownerVatNumber: o?.vatNumber || '',
    }))
  }, [availableOwners])

  // Switch to inline «إضافة مالك جديد» — clear the existing link + owner fields.
  const startNewOwner = useCallback(() => {
    setOwnerMode('new')
    setForm((prev) => ({
      ...prev,
      ownerId: '', ownerName: '', ownerNationalId: '', ownerPhone: '',
      ownerEmail: '', ownerAddress: '', ownerVatNumber: '',
    }))
  }, [])

  const backToOwnerSelect = useCallback(() => {
    setOwnerMode('select')
    setForm((prev) => ({
      ...prev,
      ownerId: '', ownerName: '', ownerNationalId: '', ownerPhone: '',
      ownerEmail: '', ownerAddress: '', ownerVatNumber: '',
    }))
  }, [])

  const handleSubmitProperty = useCallback(async () => {
    if (submittingRef.current) return
    const errors: Record<string, string> = {}
    if (!form.titleAr.trim()) errors.titleAr = 'وصف العقار مطلوب'
    // owner: an existing pick (ownerId) OR a typed new name (ownerName).
    if (ownerMode === 'select' ? !form.ownerId : !form.ownerName.trim()) {
      errors.ownerName = 'اختر مالكاً موجوداً أو أضف مالكاً جديداً'
    }
    const showUnits = form.propertyType === 'عمارة' || form.propertyType === 'دور'
    // egarsys: a custom unit type name is required when «أخرى» is picked (create mode).
    if (!editingProperty && showUnits && form.unitType === 'أخرى' && !form.customUnitType.trim()) {
      errors.customUnitType = 'اكتب اسم الوحدة المخصصة'
    }
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return }

    submittingRef.current = true
    setSubmitting(true)
    // In new-owner mode ownerId must be blank so the writer auto-creates the owner.
    const payload: PropertyFormInput = {
      titleAr: form.titleAr,
      propertyType: form.propertyType,
      status: form.status,
      description: form.description,
      address: form.address,
      city: form.city,
      district: form.district,
      latitude: form.latitude,
      longitude: form.longitude,
      area: form.area,
      bedrooms: form.bedrooms,
      bathrooms: form.bathrooms,
      shopNumber: form.shopNumber,
      deedNumber: form.deedNumber,
      deedDate: form.deedDate,
      ownerId: ownerMode === 'select' ? form.ownerId : '',
      ownerName: ownerMode === 'new' ? form.ownerName : '',
      ownerNationalId: form.ownerNationalId,
      ownerPhone: form.ownerPhone,
      ownerEmail: form.ownerEmail,
      ownerAddress: form.ownerAddress,
      ownerVatNumber: form.ownerVatNumber,
    }
    try {
      if (editingProperty) {
        await updatePropertyDoc(editingProperty.id, payload, seqCtx.companyId)
        // upload any newly-picked images against the existing property
        if (pendingImages.length > 0) {
          try { await addPropertyImages(editingProperty.id, pendingImages) }
          catch (e) { toast.error((e as Error)?.message || 'تعذّر رفع بعض الصور') }
        }
        toast.success('تم تعديل العقار بنجاح')
      } else {
        const newId = await createPropertyDoc(payload, seqCtx)
        // عمارة/دور: generate the requested units (per-floor breakdown wins over the flat count).
        if (showUnits) {
          const effectiveUnitType = form.unitType === 'أخرى'
            ? (form.customUnitType.trim() || 'شقة')
            : (form.unitType || 'شقة')
          const floorUnits = Array.from({ length: form.floorCount }, (_, i) => ({
            floor: i + 1,
            count: form.floorUnitsCount[i] || 0,
            unitType: form.floorUnitTypes[i]
              || ((i === 0 && form.groundFloorShops) ? 'محل' : effectiveUnitType),
          })).filter((f) => f.count > 0)
          const flatUnitCount = Number(form.unitCount) || 0
          if (floorUnits.length > 0 || flatUnitCount > 0) {
            try {
              await generatePropertyUnits({
                companyId: seqCtx.companyId,
                propertyId: newId,
                floorUnits: floorUnits.length > 0 ? floorUnits : undefined,
                unitCount: floorUnits.length === 0 ? flatUnitCount : undefined,
                unitType: effectiveUnitType,
                groundFloorShops: form.propertyType === 'عمارة' && form.floorCount > 1 ? form.groundFloorShops : false,
                area: form.unitArea !== '' ? Number(form.unitArea) : null,
                rentPrice: form.unitRentPrice !== '' ? Number(form.unitRentPrice) : null,
              })
            } catch (e) { toast.error((e as Error)?.message || 'تعذّر توليد الوحدات') }
          }
        }
        // upload the images picked in the form against the fresh property
        if (pendingImages.length > 0) {
          try { await addPropertyImages(newId, pendingImages) }
          catch (e) { toast.error((e as Error)?.message || 'تعذّر رفع بعض الصور') }
        }
        toast.success('تم إضافة العقار بنجاح')
      }
      setFormOpen(false)
      setEditingProperty(null)
      setPendingImages([])
      refetchProperties()
    } catch (err) {
      toast.error((err as Error)?.message || (editingProperty ? 'فشل في تعديل العقار' : 'فشل في إضافة العقار'))
    } finally {
      setSubmitting(false)
      submittingRef.current = false
    }
  }, [form, ownerMode, editingProperty, seqCtx, refetchProperties, pendingImages])

  const handleDeleteProperty = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deletePropertyDoc(deleteTarget.id)
      setDeleteTarget(null)
      setDetailDialogOpen(false)
      refetchProperties()
      toast.success('تم حذف العقار')
    } catch (err) {
      // Frappe LinkExistsError (property has units/contracts) surfaces here — no crash.
      toast.error((err as Error)?.message || 'تعذّر حذف العقار — قد تكون له وحدات أو عقود مرتبطة')
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, refetchProperties])

  // --- Data Fetching: the filtered list ---
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const filters: { search?: string; propertyType?: string; status?: string; city?: string } = {}
    if (search) filters.search = search
    if (filterType) filters.propertyType = filterType
    if (filterStatus) filters.status = filterStatus
    if (filterCity) filters.city = filterCity
    getPropertiesList(filters)
      .then((data) => { if (!cancelled) setProperties(data) })
      .catch(() => { if (!cancelled) setProperties([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [search, filterType, filterStatus, filterCity, fetchTrigger])

  // --- Filter-independent status tallies (الفاضي / المؤجر) ---
  useEffect(() => {
    let cancelled = false
    getPropertyStatusCounts()
      .then((c) => { if (!cancelled) setStatusCounts(c) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [fetchTrigger])

  // --- Detail: units for the selected property ---
  useEffect(() => {
    if (!selectedProperty?.id) return
    let cancelled = false
    setLoadingUnits(true)
    getUnitsForProperty(selectedProperty.id)
      .then((u) => { if (!cancelled) setDetailUnits(u) })
      .catch(() => { if (!cancelled) setDetailUnits([]) })
      .finally(() => { if (!cancelled) setLoadingUnits(false) })
    return () => { cancelled = true }
  }, [selectedProperty?.id])

  // --- Detail: open a property + load its contracts ---
  const openPropertyDetail = useCallback(async (property: PropertyView) => {
    setSelectedProperty(property)
    setDetailImageIndex(0)
    setDetailDialogOpen(true)
    setPropertyContracts([])
    try {
      const contracts = await getPropertyContracts(property.id)
      setPropertyContracts(contracts)
    } catch {
      setPropertyContracts([])
    }
  }, [])

  // Refetch the open property's fresh doc after an image mutation.
  const reloadSelectedProperty = useCallback(async (id: string) => {
    try {
      const p = await getPropertyDetail(id)
      if (p) setSelectedProperty(p)
    } catch { /* keep current */ }
  }, [])

  // Detail-dialog gallery: upload files → Rental Property Image docs → refresh.
  const handleDetailImageUpload = useCallback(async (files: FileList | null) => {
    if (!selectedProperty || !files || files.length === 0) return
    setUploading(true)
    try {
      await addPropertyImages(selectedProperty.id, Array.from(files))
      await reloadSelectedProperty(selectedProperty.id)
      refetchProperties()
      toast.success('تم رفع الصور')
    } catch (e) {
      toast.error((e as Error)?.message || 'تعذّر رفع الصور')
    } finally {
      setUploading(false)
      if (detailFileInputRef.current) detailFileInputRef.current.value = ''
    }
  }, [selectedProperty, reloadSelectedProperty, refetchProperties])

  const handleSetCover = useCallback(async (imageId: string) => {
    if (!selectedProperty) return
    try {
      await setPropertyImageCover(selectedProperty.id, imageId)
      await reloadSelectedProperty(selectedProperty.id)
      refetchProperties()
    } catch (e) {
      toast.error((e as Error)?.message || 'تعذّر تعيين صورة الغلاف')
    }
  }, [selectedProperty, reloadSelectedProperty, refetchProperties])

  const handleDeleteImage = useCallback(async (imageId: string) => {
    if (!selectedProperty) return
    try {
      await deletePropertyImage(selectedProperty.id, imageId)
      setDetailImageIndex(0)
      await reloadSelectedProperty(selectedProperty.id)
      refetchProperties()
    } catch (e) {
      toast.error((e as Error)?.message || 'تعذّر حذف الصورة')
    }
  }, [selectedProperty, reloadSelectedProperty, refetchProperties])

  // Deep-link consumer: the contracts list's «الرقم الداخلي» click (or dashboard)
  // lands here with the linked propertyId → fetch fresh, then open its detail.
  useEffect(() => {
    if (pendingFocus?.section !== 'properties' || pendingFocus.contentType !== 'property' || !pendingFocus.key) return
    const propertyId = pendingFocus.key
    setPendingFocus(null)
    getPropertyDetail(propertyId)
      .then((p) => {
        if (p) openPropertyDetail(p)
        else toast.error('لم يتم العثور على العقار')
      })
      .catch(() => toast.error('فشلت العملية'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFocus])

  // --- Unit detail sheet ---
  const handleUnitClick = async (unit: UnitView) => {
    setSelectedUnit(unit)
    setUnitSheetOpen(true)
    setLoadingUnitDetails(true)
    setUnitContracts([])
    setUnitInvoices([])
    try {
      const [contracts, invoices] = await Promise.all([
        getUnitContracts(unit.id),
        getUnitInvoices(unit.id),
      ])
      setUnitContracts(contracts)
      setUnitInvoices(invoices)
    } catch {
      toast.error('فشلت العملية')
    } finally {
      setLoadingUnitDetails(false)
    }
  }

  // Print the currently-filtered property list as a clean, self-contained
  // document — re-fetches the FULL filtered set, then opens a print-ready window
  // built from inline HTML (no app CSS, immune to the grid's RTL/print quirks).
  const handlePrintList = async () => {
    setPrintingList(true)
    try {
      const filters: { search?: string; propertyType?: string; status?: string; city?: string } = {}
      if (search) filters.search = search
      if (filterType) filters.propertyType = filterType
      if (filterStatus) filters.status = filterStatus
      if (filterCity) filters.city = filterCity
      const list = await getPropertiesList(filters)

      const esc = (v: unknown) =>
        String(v ?? '')
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

      const statusLabel = filterStatus
        ? (PropertyStatusLabels[filterStatus as PropertyStatusValue]?.ar || filterStatus)
        : 'كل العقارات'
      const crumbs = [
        filterType ? `النوع: ${PropertyTypeLabels[filterType as PropertyTypeValue]?.ar || filterType}` : '',
        filterCity ? `المدينة: ${filterCity}` : '',
        search ? `بحث: ${search}` : '',
      ].filter(Boolean).join('  ·  ')

      const rows = list.map((p, i) => `
        <tr>
          <td class="c">${i + 1}</td>
          <td class="c">${esc(p.internalId ?? '—')}</td>
          <td>${esc(p.titleAr || p.title || '—')}</td>
          <td>${esc(PropertyTypeLabels[p.propertyType as PropertyTypeValue]?.ar || p.propertyType || '—')}</td>
          <td>${esc(p.city || '—')}</td>
          <td>${esc(p.district || '—')}</td>
          <td>${esc(p.owner?.name || p.ownerName || '—')}</td>
          <td class="c">${esc(PropertyStatusLabels[p.status as PropertyStatusValue]?.ar || p.status || '—')}</td>
        </tr>`).join('')

      const company = companyName || 'مِينا لإدارة الأملاك'
      const html = `<!doctype html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>قائمة العقارات — ${esc(statusLabel)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Tahoma, Arial, sans-serif; margin: 24px; color: #0f172a; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .sub { color: #475569; font-size: 13px; font-weight: 600; margin: 0; }
  .meta { color: #64748b; font-size: 12px; margin: 6px 0 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  thead th { background: #f1f5f9; text-align: right; padding: 8px; border: 1px solid #cbd5e1; font-weight: 700; }
  tbody td { padding: 7px 8px; border: 1px solid #e2e8f0; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  td.c { text-align: center; }
  .foot { margin-top: 16px; color: #94a3b8; font-size: 11px; display: flex; justify-content: space-between; }
  @media print { body { margin: 12mm; } thead { display: table-header-group; } }
</style></head>
<body>
  <h1>${esc(company)}</h1>
  <p class="sub">قائمة العقارات — ${esc(statusLabel)} (${list.length})</p>
  ${crumbs ? `<p class="meta">${esc(crumbs)}</p>` : '<div style="height:8px"></div>'}
  <table>
    <thead><tr>
      <th>#</th><th>الرقم</th><th>العقار</th><th>النوع</th><th>المدينة</th><th>الحي</th><th>المالك</th><th>الحالة</th>
    </tr></thead>
    <tbody>${rows || '<tr><td colspan="8" class="c">لا توجد عقارات</td></tr>'}</tbody>
  </table>
  <div class="foot"><span>${esc(company)}</span><span>إجمالي: ${list.length} عقار</span></div>
  <script>window.onload = function(){ window.focus(); window.print(); }</script>
</body></html>`

      const w = window.open('', '_blank')
      if (!w) {
        toast.error('يرجى السماح بالنوافذ المنبثقة للطباعة')
        return
      }
      w.document.open()
      w.document.write(html)
      w.document.close()
    } catch {
      toast.error('تعذّرت الطباعة')
    } finally {
      setPrintingList(false)
    }
  }

  // --- Unique cities from current properties (drop empty — city is optional) ---
  const availableCities = Array.from(new Set(properties.map((p) => p.city).filter(Boolean))).sort()

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-4 md:p-6" dir="rtl">
      {/* ---- Page Title & Header ---- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-950/20 p-6 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/40">
        <div className="flex items-center gap-4">
          <CompanyHeaderLogo className="h-14" />
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">إدارة العقارات</h1>
            <p className="text-slate-500 text-sm mt-1 font-medium">
              تصفح وإدارة المحفظة العقارية الخاصة بك
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* «الرئيسية» — jump back to the main dashboard */}
          <Button
            onClick={() => setCurrentSection('dashboard')}
            variant="outline"
            className="gap-2 font-semibold whitespace-nowrap"
          >
            الرئيسية
          </Button>
          {/* Add Property Button (LIVE) */}
          <Button onClick={openCreateForm} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 gap-2 font-semibold whitespace-nowrap">
            <Plus className="h-4 w-4" />
            إضافة عقار
          </Button>
        </div>
      </div>

      {/* ---- Status widgets (الفاضي / المؤجر) — click a card to filter the list ---- */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* الفاضي — vacant / available (RED) */}
        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'available' ? '' : 'available')}
          aria-pressed={filterStatus === 'available'}
          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 sm:p-5 text-right transition-all ${
            filterStatus === 'available'
              ? 'border-red-400 bg-red-50 ring-2 ring-red-300 dark:border-red-600 dark:bg-red-950/40 dark:ring-red-800'
              : 'border-red-200 bg-red-50/50 hover:border-red-300 hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 dark:hover:bg-red-950/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300">
              <DoorOpen className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-bold text-red-700 dark:text-red-300">الفاضي</p>
              <p className="text-xs text-red-500/80 dark:text-red-400/70">عقارات شاغرة</p>
            </div>
          </div>
          <span className="text-3xl sm:text-4xl font-extrabold text-red-600 dark:text-red-400 tabular-nums">
            {statusCounts ? statusCounts.available : '—'}
          </span>
        </button>

        {/* المؤجر — rented (GREEN) */}
        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'rented' ? '' : 'rented')}
          aria-pressed={filterStatus === 'rented'}
          className={`flex items-center justify-between gap-3 rounded-2xl border p-4 sm:p-5 text-right transition-all ${
            filterStatus === 'rented'
              ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300 dark:border-emerald-600 dark:bg-emerald-950/40 dark:ring-emerald-800'
              : 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300 hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300">
              <KeyRound className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">المؤجر</p>
              <p className="text-xs text-emerald-500/80 dark:text-emerald-400/70">عقارات مؤجرة</p>
            </div>
          </div>
          <span className="text-3xl sm:text-4xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {statusCounts ? statusCounts.rented : '—'}
          </span>
        </button>
      </div>

      {/* ---- Filters Bar ---- */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        {/* Search */}
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pr-9 bg-slate-50 border-slate-200 focus-visible:ring-emerald-500"
            placeholder="ابحث عن عقار..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        {/* Filter: Type */}
        <Select value={filterType} onValueChange={(v) => setFilterType(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-[140px] bg-slate-50 border-slate-200">
            <SelectValue placeholder="نوع العقار" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">الكل</SelectItem>
            {PROPERTY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {PropertyTypeLabels[type].ar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filter: Status */}
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-[140px] bg-slate-50 border-slate-200">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">الكل</SelectItem>
            {PROPERTY_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {PropertyStatusLabels[status].ar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filter: City */}
        <Select value={filterCity} onValueChange={(v) => setFilterCity(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-full sm:w-[140px] bg-slate-50 border-slate-200">
            <SelectValue placeholder="المدينة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">الكل</SelectItem>
            {availableCities.map((city) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear Filters */}
        {(search || filterType || filterStatus || filterCity) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 font-medium"
            onClick={() => {
              setSearchInput('')
              setSearch('')
              setFilterType('')
              setFilterStatus('')
              setFilterCity('')
            }}
          >
            <X className="h-4 w-4 ml-1" />
            مسح الفلاتر
          </Button>
        )}
      </div>

      {/* ---- Contextual actions for a status-filtered list (مشاهدة / طباعة) ---- */}
      {filterStatus && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 px-4 py-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            عرض قائمة:{' '}
            <span className="font-bold">{PropertyStatusLabels[filterStatus as PropertyStatusValue]?.ar || filterStatus}</span>
            <span className="text-muted-foreground"> — {properties.length} عقار</span>
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-default" aria-pressed>
              <Eye className="h-4 w-4" />
              مشاهدة
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handlePrintList}
              disabled={printingList || properties.length === 0}
            >
              {printingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              طباعة
            </Button>
          </div>
        </div>
      )}

      {/* ---- Properties Grid ---- */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <PropertyCardSkeleton key={i} />
          ))}
        </div>
      ) : properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground">لا توجد عقارات</h3>
          <p className="text-sm text-muted-foreground mt-1">ابدأ بإضافة عقار جديد</p>
          <Button onClick={openCreateForm} className="mt-4">
            <Plus className="h-4 w-4 ml-1" />
            إضافة عقار
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onClick={() => openPropertyDetail(property)}
              onEdit={canEdit ? () => openEditForm(property) : undefined}
              onStatement={() => openStatement(property.id)}
              onLedger={() => openLedger(property.id)}
            />
          ))}
        </div>
      )}

      {/* ---- Property Count ---- */}
      {!loading && properties.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          عرض {properties.length} عقار
        </p>
      )}

      {/* ================================================================ */}
      {/* PROPERTY DETAIL DIALOG */}
      {/* ================================================================ */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          {selectedProperty && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {getPropertyTitle(selectedProperty)}
                </DialogTitle>
                <DialogDescription>
                  {selectedProperty.titleAr ? selectedProperty.title : ''}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 max-h-[65vh] overflow-y-auto">
                {/* Images gallery (index-based viewer; upload is stubbed) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-muted-foreground">
                      الصور ({selectedProperty.images?.length || 0})
                    </h4>
                    <div className="flex items-center gap-2">
                      <input
                        ref={detailFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleDetailImageUpload(e.target.files)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploading}
                        onClick={() => detailFileInputRef.current?.click()}
                        className="gap-1.5"
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        إضافة صور
                      </Button>
                    </div>
                  </div>

                  {selectedProperty.images && selectedProperty.images.length > 0 ? (
                    (() => {
                      const imgs = selectedProperty.images
                      const idx = Math.min(detailImageIndex, imgs.length - 1)
                      const img = imgs[idx]
                      return (
                        <div className="space-y-2">
                          {/* Main image */}
                          <div className="relative h-56 sm:h-72 rounded-lg overflow-hidden bg-slate-100">
                            <ImageWithFallback
                              src={img.image}
                              alt={getPropertyTitle(selectedProperty)}
                              className="w-full h-full object-cover"
                              fallback={
                                <div className="flex items-center justify-center h-full text-slate-300 dark:text-slate-600">
                                  <Building2 className="h-12 w-12" />
                                </div>
                              }
                            />
                            {img.isCover && (
                              <Badge className="absolute top-3 right-3 bg-emerald-600 text-white">
                                صورة رئيسية
                              </Badge>
                            )}
                            {/* Action buttons (stubbed) */}
                            <div className="absolute top-3 left-3 flex gap-1.5">
                              {!img.isCover && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-7 px-2 bg-white/90 hover:bg-white text-amber-600 hover:text-amber-700 gap-1"
                                  onClick={() => handleSetCover(img.id)}
                                  title="تعيين كصورة رئيسية"
                                >
                                  <Star className="h-3.5 w-3.5" /> غلاف
                                </Button>
                              )}
                              {canEdit && (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="h-7 px-2 bg-white/90 hover:bg-white text-red-600 hover:text-red-700 gap-1"
                                  onClick={() => handleDeleteImage(img.id)}
                                  title="حذف الصورة"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> حذف
                                </Button>
                              )}
                            </div>
                            {/* Prev / Next (RTL: prev on right, next on left) */}
                            {imgs.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setDetailImageIndex((idx - 1 + imgs.length) % imgs.length)}
                                  className="absolute top-1/2 right-2 -translate-y-1/2 size-8 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center"
                                  title="السابق"
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDetailImageIndex((idx + 1) % imgs.length)}
                                  className="absolute top-1/2 left-2 -translate-y-1/2 size-8 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center"
                                  title="التالي"
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </button>
                                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                                  {idx + 1} / {imgs.length}
                                </div>
                              </>
                            )}
                          </div>
                          {/* Thumbnails */}
                          {imgs.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                              {imgs.map((thumb, i) => (
                                <button
                                  type="button"
                                  key={thumb.id}
                                  onClick={() => setDetailImageIndex(i)}
                                  className={`relative shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 transition-colors ${i === idx ? 'border-emerald-500' : 'border-transparent hover:border-slate-300'}`}
                                >
                                  <ImageWithFallback
                                    src={thumb.image}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    fallback={
                                      <div className="flex items-center justify-center h-full bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600">
                                        <Building2 className="h-5 w-5" />
                                      </div>
                                    }
                                  />
                                  {thumb.isCover && (
                                    <span className="absolute bottom-0 inset-x-0 bg-emerald-600/90 text-white text-[8px] text-center">غلاف</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })()
                  ) : (
                    <div className="flex flex-col items-center justify-center h-40 bg-muted rounded-lg">
                      <ImagePlus className="h-10 w-10 text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">لا توجد صور</p>
                    </div>
                  )}
                </div>

                {/* Badges Row */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant={getPropertyTypeBadgeColor(selectedProperty.propertyType) as never}>
                    {PropertyTypeLabels[selectedProperty.propertyType as PropertyTypeValue]?.ar || selectedProperty.propertyType}
                  </Badge>
                  <Badge variant={getPropertyStatusBadgeColor(selectedProperty.status) as never}>
                    {PropertyStatusLabels[selectedProperty.status as PropertyStatusValue]?.ar || selectedProperty.status}
                  </Badge>
                </div>

                {/* Property Info Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <InfoItem label="المدينة" value={selectedProperty.city || '—'} />
                  <InfoItem label="الحي" value={selectedProperty.district || '—'} />
                  <InfoItem label="العنوان" value={selectedProperty.address || '—'} />
                  {/* بيانات الصك — always shown for the office/owner */}
                  <InfoItem label="رقم الصك" value={selectedProperty.deedNumber || '—'} valueClass="font-mono" />
                  <InfoItem label="تاريخ الصك" value={selectedProperty.deedDate ? formatDate(selectedProperty.deedDate) : '—'} />
                  {selectedProperty.latitude != null && selectedProperty.longitude != null && (
                    <div className="sm:col-span-3 space-y-2">
                      <a
                        href={`https://www.google.com/maps?q=${selectedProperty.latitude},${selectedProperty.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-600 hover:underline flex items-center gap-1"
                      >
                        <MapPin className="h-3 w-3" />
                        فتح في خرائط جوجل ↗
                      </a>
                      {/* Read-only live map (vanilla Leaflet + OSM). */}
                      <Suspense fallback={
                        <div className="flex items-center justify-center h-[160px] rounded-md border border-dashed border-slate-300 dark:border-slate-700 bg-muted/40 text-xs text-muted-foreground gap-1.5">
                          <Loader2 className="h-4 w-4 animate-spin" /> تحميل الخريطة…
                        </div>
                      }>
                        <MapPicker
                          lat={selectedProperty.latitude}
                          lng={selectedProperty.longitude}
                          readonly
                          onChange={() => {}}
                        />
                      </Suspense>
                      <p className="text-[11px] font-mono text-slate-400" dir="ltr">
                        {Number(selectedProperty.latitude).toFixed(5)}, {Number(selectedProperty.longitude).toFixed(5)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Description */}
                {selectedProperty.description && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">الوصف</h4>
                    <p className="text-sm leading-relaxed">{selectedProperty.description}</p>
                  </div>
                )}

                <Separator />

                {/* Owner Info */}
                {selectedProperty.owner && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">بيانات المالك</h4>
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 shrink-0">
                        <Building2 className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-medium">{selectedProperty.owner.name}</p>
                        {selectedProperty.owner.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            <span dir="ltr">{selectedProperty.owner.phone}</span>
                          </div>
                        )}
                        {selectedProperty.owner.email && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <span dir="ltr">{selectedProperty.owner.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Units */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    الوحدات ({detailUnits.length})
                  </h4>
                  {loadingUnits ? (
                    <p className="text-sm text-muted-foreground">جاري التحميل...</p>
                  ) : detailUnits.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا توجد وحدات</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {detailUnits.map((unit) => {
                        const activeContract = unit.contractUnits?.[0]?.contract ?? null
                        return (
                          <div
                            key={unit.id}
                            className="rounded-lg border text-xs space-y-0 overflow-hidden cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors"
                            onClick={() => handleUnitClick(unit)}
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between px-3 py-2 bg-muted/40">
                              <span className="font-semibold text-sm">وحدة {unit.unitNumber}</span>
                              <span className={`px-2 py-0.5 rounded-full font-medium ${
                                unit.status === 'rented'
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              }`}>
                                {unit.status === 'rented' ? 'مؤجرة' : 'فارغة'}
                              </span>
                            </div>
                            {/* Static details */}
                            <div className="px-3 py-2 space-y-1 border-t">
                              {unit.floor != null && (
                                <div className="flex justify-between text-muted-foreground">
                                  <span>الطابق</span><span className="font-medium text-foreground">{unit.floor}</span>
                                </div>
                              )}
                              {unit.area != null && (
                                <div className="flex justify-between text-muted-foreground">
                                  <span>المساحة</span><span className="font-medium text-foreground">{unit.area} م²</span>
                                </div>
                              )}
                              {unit.rentPrice != null && (
                                <div className="flex justify-between text-muted-foreground">
                                  <span>الإيجار</span><span className="font-medium text-emerald-700 dark:text-emerald-400">{unit.rentPrice.toLocaleString('ar-SA')} ﷼/سنة</span>
                                </div>
                              )}
                              {unit.electricMeter && (
                                <div className="flex justify-between text-muted-foreground">
                                  <span>عداد الكهرباء</span><span className="font-medium text-foreground" dir="ltr">{unit.electricMeter}</span>
                                </div>
                              )}
                              {unit.notes && (
                                <p className="text-muted-foreground pt-0.5 line-clamp-2">{unit.notes}</p>
                              )}
                            </div>
                            {/* Active contract info */}
                            {activeContract && (
                              <div className="px-3 py-2 bg-amber-50/60 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-800 space-y-1">
                                {activeContract.tenantName && (
                                  <div className="flex justify-between text-muted-foreground">
                                    <span>المستأجر</span><span className="font-medium text-foreground">{activeContract.tenantName}</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-muted-foreground">
                                  <span>العقد</span><span className="font-mono font-medium text-foreground">{activeContract.contractNumber}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>ينتهي</span><span className="font-medium text-foreground">{formatDate(activeContract.endDate)}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                  <span>الإيجار</span><span className="font-medium text-foreground">{activeContract.rentAmount.toLocaleString('ar-SA')} ﷼</span>
                                </div>
                              </div>
                            )}
                            {/* Edit button (stubbed) */}
                            {canEdit && (
                              <div className="px-3 py-2 border-t">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-full text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                                  onClick={(e) => { e.stopPropagation(); comingSoon() }}
                                >
                                  <Pencil className="h-3 w-3" />
                                  تعديل
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <Separator />

                {/* Contracts Table */}
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">
                    عقود الإيجار ({propertyContracts.length})
                  </h4>
                  {propertyContracts.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>رقم العقد</TableHead>
                            <TableHead>المستأجر</TableHead>
                            <TableHead>المبلغ</TableHead>
                            <TableHead>الحالة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {propertyContracts.map((contract) => (
                            <TableRow key={contract.id}>
                              <TableCell className="font-mono text-xs">
                                {contract.contractNumber}
                              </TableCell>
                              <TableCell>
                                {contract.tenant?.name || contract.tenantName || '—'}
                              </TableCell>
                              <TableCell>{formatSAR(contract.rentAmount)}</TableCell>
                              <TableCell>
                                <Badge variant={getContractStatusBadgeColor(contract.status) as never}>
                                  {ContractStatusLabels[contract.status]?.ar || contract.status}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">لا توجد عقود لهذا العقار</p>
                  )}
                </div>

                {/* سجل التأجير وفترات الشغور — only when the property isn't split
                    into multiple units (each unit then has its own record). */}
                {propertyContracts.length > 0 && detailUnits.length <= 1 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">
                      سجل التأجير وفترات الشغور
                    </h4>
                    <ContractLifecycleTimeline
                      contracts={propertyContracts}
                      onViewContract={(contract) => {
                        setDetailDialogOpen(false)
                        setPendingFocus({ section: 'contracts', contentType: 'contract', key: String(contract.internalId ?? '') })
                        setCurrentSection('contracts')
                      }}
                    />
                  </div>
                )}
                {propertyContracts.length > 0 && detailUnits.length > 1 && (
                  <p className="text-[11px] text-muted-foreground">
                    سجل التأجير وفترات الشغور يظهر لكل وحدة على حدة — افتح بطاقة الوحدة لعرضه.
                  </p>
                )}
              </div>

              {/* Action footer — sticky, safe-area aware. */}
              <div
                className="sticky bottom-0 z-10 -mx-6 flex flex-col gap-3 border-t bg-background px-4 pt-3"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.25rem)' }}
              >
                {/* كشف حساب — opens the statement dialog for this property */}
                <Button
                  variant="outline"
                  className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                  onClick={() => openStatement(selectedProperty.id)}
                >
                  <FileText className="h-4 w-4 ml-1" />
                  كشف حساب
                </Button>

                {/* تعديل (primary, wide) · حذف (destructive, compact) — LIVE */}
                {(canEdit || canDelete) && (
                  <div className="flex items-center gap-3 w-full">
                    {canEdit && (
                      <Button
                        style={{ flex: 3 }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => { setDetailDialogOpen(false); openEditForm(selectedProperty) }}
                      >
                        <Pencil className="h-4 w-4 ml-1" />
                        تعديل
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="outline"
                        style={{ flex: 1 }}
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
                        onClick={() => setDeleteTarget(selectedProperty)}
                      >
                        <Trash2 className="h-4 w-4 ml-1" />
                        حذف
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* UNIT DETAIL SHEET                                                 */}
      {/* ================================================================ */}
      <Sheet open={unitSheetOpen} onOpenChange={setUnitSheetOpen}>
        <SheetContent side="left" dir="rtl" className="w-full sm:max-w-lg p-0 flex flex-col">
          {selectedUnit && (
            <>
              <SheetHeader className="border-b">
                <SheetTitle className="flex items-center justify-between gap-2 pl-6">
                  <span>
                    وحدة {selectedUnit.unitNumber}
                    {selectedProperty ? ` — ${getPropertyTitle(selectedProperty)}` : ''}
                  </span>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${
                    selectedUnit.status === 'rented'
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {selectedUnit.status === 'rented' ? 'مؤجرة' : 'فارغة'}
                  </span>
                </SheetTitle>
                <SheetDescription className="sr-only">تفاصيل الوحدة والعقود والفواتير المرتبطة</SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* ---- Section 1: Unit data ---- */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-foreground">بيانات الوحدة</h4>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={comingSoon}>
                      <Pencil className="h-3 w-3" />
                      تعديل البيانات
                    </Button>
                  </div>
                  <div className="rounded-lg border divide-y text-sm">
                    <UnitDetailRow label="الطابق" value={selectedUnit.floor != null ? String(selectedUnit.floor) : '—'} />
                    <UnitDetailRow label="المساحة م²" value={selectedUnit.area != null ? `${selectedUnit.area} م²` : '—'} />
                    <UnitDetailRow
                      label="سعر الإيجار السنوي"
                      value={selectedUnit.rentPrice != null ? `${selectedUnit.rentPrice.toLocaleString('ar-SA')} ﷼` : '—'}
                      valueClass="text-emerald-700 dark:text-emerald-400"
                    />
                    <UnitDetailRow label="رقم عداد الكهرباء" value={selectedUnit.electricMeter || '—'} dir="ltr" />
                    <UnitDetailRow label="ملاحظات" value={selectedUnit.notes || '—'} />
                  </div>
                </div>

                {/* ---- Section 2: سجل التأجير — chronological contracts + vacancy gaps ---- */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    سجل التأجير — العقود وفترات الشغور {!loadingUnitDetails && `(${unitContracts.length})`}
                  </h4>
                  {loadingUnitDetails ? (
                    <p className="text-sm text-muted-foreground">جاري التحميل...</p>
                  ) : unitContracts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا توجد عقود لهذه الوحدة</p>
                  ) : (
                    <ContractLifecycleTimeline
                      contracts={unitContracts}
                      onViewContract={(contract) => {
                        setUnitSheetOpen(false)
                        setPendingFocus({ section: 'contracts', contentType: 'contract', key: String(contract.internalId ?? '') })
                        setCurrentSection('contracts')
                      }}
                    />
                  )}
                </div>

                {/* ---- Section 3: Linked invoices ---- */}
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    الفواتير المرتبطة {!loadingUnitDetails && `(${unitInvoices.length})`}
                  </h4>
                  {loadingUnitDetails ? (
                    <p className="text-sm text-muted-foreground">جاري التحميل...</p>
                  ) : unitInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">لا توجد فواتير لهذه الوحدة</p>
                  ) : (
                    <div className="space-y-2">
                      {unitInvoices.map((invoice) => (
                        <div key={invoice.id} className="rounded-lg border px-3 py-2 flex items-center justify-between gap-2 text-xs">
                          <div className="space-y-0.5 min-w-0">
                            <p className="font-mono font-medium truncate">{invoice.invoiceNumber}</p>
                            <p className="text-muted-foreground">يستحق: {formatHijri(invoice.dueDate)}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-left">
                              <p className="font-semibold">{formatSAR(invoice.totalValue)}</p>
                              <Badge variant={invoice.status === 'paid' ? 'success' : 'danger'} className="text-[10px]">
                                {invoice.status === 'paid' ? 'مدفوعة' : 'غير مدفوعة'}
                              </Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => {
                                setUnitSheetOpen(false)
                                setPendingFocus({ section: 'invoices', contentType: 'invoice', key: String(parseInt(String(invoice.invoiceNumber).replace(/\D/g, ''), 10)) })
                                setCurrentSection('invoices')
                              }}
                            >
                              عرض
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ================================================================ */}
      {/* PROPERTY CREATE / EDIT FORM (LIVE → Rental Property mirror)       */}
      {/* ================================================================ */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editingProperty ? 'تعديل بيانات العقار' : 'إضافة عقار جديد'}</DialogTitle>
            <DialogDescription>
              {editingProperty ? 'عدّل بيانات العقار والمالك ثم احفظ.' : 'أدخل بيانات العقار واختر المالك أو أضف مالكاً جديداً.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-1" dir="rtl">
            {/* وصف العقار */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="prop-title">وصف العقار *</Label>
              <Input id="prop-title" value={form.titleAr} onChange={(e) => updateForm('titleAr', e.target.value)} dir="rtl" />
              {formErrors.titleAr && <p className="text-xs text-red-500">{formErrors.titleAr}</p>}
            </div>

            {/* ---- Owner block: pick existing OR inline-create ---- */}
            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">بيانات المالك *</h4>
                {form.ownerId
                  ? <span className="text-xs text-emerald-600 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> مالك موجود</span>
                  : form.ownerName ? <span className="text-xs text-amber-600">مالك جديد</span> : null}
              </div>
              <div className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-3 space-y-3">
                {ownerMode === 'select' ? (
                  <>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                      <div className="flex-1 space-y-1.5">
                        <Label htmlFor="owner-select">اختر مالكاً مسجّلاً</Label>
                        <Select value={form.ownerId || undefined} onValueChange={handleOwnerSelect}>
                          <SelectTrigger id="owner-select" className="w-full"><SelectValue placeholder="اختر المالك..." /></SelectTrigger>
                          <SelectContent>
                            {availableOwners.length === 0 && (
                              <div className="px-2 py-1.5 text-xs text-muted-foreground">لا يوجد ملاك مسجّلون — أضف مالكاً جديداً</div>
                            )}
                            {availableOwners.map((o) => (
                              <SelectItem key={o.id} value={o.id}>{o.name}{o.phone ? ` — ${o.phone}` : ''}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 whitespace-nowrap"
                        onClick={startNewOwner}
                      >
                        <UserPlus className="h-4 w-4" /> إضافة مالك جديد
                      </Button>
                    </div>
                    {form.ownerId && (form.ownerPhone || form.ownerNationalId) && (
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        {form.ownerPhone && <span>الجوال: <span dir="ltr">{form.ownerPhone}</span></span>}
                        {form.ownerNationalId && <span>الهوية: <span dir="ltr">{form.ownerNationalId}</span></span>}
                      </div>
                    )}
                    {formErrors.ownerName && <p className="text-xs text-red-500">{formErrors.ownerName}</p>}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-amber-600">بيانات مالك جديد</p>
                      {availableOwners.length > 0 && (
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={backToOwnerSelect}>
                          اختيار مالك موجود
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>الاسم *</Label>
                        <Input value={form.ownerName} onChange={(e) => updateForm('ownerName', e.target.value)} dir="rtl" />
                        {formErrors.ownerName && <p className="text-xs text-red-500">{formErrors.ownerName}</p>}
                      </div>
                      <div className="space-y-1.5"><Label>رقم الهوية</Label><Input value={form.ownerNationalId} onChange={(e) => updateForm('ownerNationalId', e.target.value)} dir="ltr" /></div>
                      <div className="space-y-1.5"><Label>الجوال</Label><Input value={form.ownerPhone} onChange={(e) => updateForm('ownerPhone', e.target.value)} dir="ltr" /></div>
                      <div className="space-y-1.5"><Label>البريد الإلكتروني</Label><Input value={form.ownerEmail} onChange={(e) => updateForm('ownerEmail', e.target.value)} dir="ltr" /></div>
                      <div className="space-y-1.5"><Label>الرقم الضريبي</Label><Input value={form.ownerVatNumber} onChange={(e) => updateForm('ownerVatNumber', e.target.value)} dir="ltr" /></div>
                      <div className="space-y-1.5"><Label>عنوان المالك</Label><Input value={form.ownerAddress} onChange={(e) => updateForm('ownerAddress', e.target.value)} dir="rtl" /></div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* نوع العقار */}
            <div className="space-y-1.5">
              <Label>نوع العقار *</Label>
              <Select
                value={form.propertyType}
                onValueChange={(v) => setForm((prev) => ({ ...prev, propertyType: v }))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                <SelectContent>
                  {NEW_PROPERTY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* الحالة */}
            <div className="space-y-1.5">
              <Label>الحالة</Label>
              <Select value={form.status} onValueChange={(v) => updateForm('status', v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="الحالة" /></SelectTrigger>
                <SelectContent>
                  {PROPERTY_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{PropertyStatusLabels[status].ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* العنوان التفصيلي */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="prop-address">العنوان التفصيلي</Label>
              <Input
                id="prop-address"
                value={form.address}
                onChange={(e) => updateForm('address', e.target.value)}
                placeholder="اكتب العنوان الوطني أو اسم الشارع"
                dir="rtl"
              />
            </div>

            {/* المدينة */}
            <div className="space-y-1.5">
              <Label>المدينة</Label>
              <Select value={form.city || undefined} onValueChange={(v) => updateForm('city', v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="اختر المدينة" /></SelectTrigger>
                <SelectContent>
                  {SAUDI_CITIES.map((city) => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* الحي */}
            <div className="space-y-1.5">
              <Label htmlFor="prop-district">الحي</Label>
              <Input id="prop-district" value={form.district} onChange={(e) => updateForm('district', e.target.value)} dir="rtl" />
            </div>

            {/* ---- Conditional sections based on property type (ported from egarsys) ---- */}
            {(() => {
              const pt = form.propertyType || ''
              const showUnits = pt === 'عمارة' || pt === 'دور'
              const showLand = pt === 'أرض'
              const showVilla = pt === 'فيلا'
              const showShop = pt === 'محل مفرد'
              // ---- unit-generation derived values (create mode only) ----
              const customUnitType = form.unitType === 'أخرى' ? form.customUnitType.trim() : ''
              const globalUnitType = customUnitType || (form.unitType && form.unitType !== 'أخرى' ? form.unitType : 'شقة')
              const perFloorOptions = customUnitType && !UNIT_TYPE_OPTIONS.includes(customUnitType)
                ? [...UNIT_TYPE_OPTIONS, customUnitType]
                : UNIT_TYPE_OPTIONS
              const floorsTotal = (form.floorUnitsCount || []).reduce((s, c) => s + (c || 0), 0)
              const flatUnitCount = Number(form.unitCount) || 0
              const typeForFloor = (i: number) =>
                form.floorUnitTypes[i] || (i === 0 && form.groundFloorShops ? 'محل' : globalUnitType)
              return (
                <>
                  {/* عمارة / دور: توليد الوحدات تلقائياً — create mode only (ports egarsys AutoGenerateUnits) */}
                  {!editingProperty && showUnits && (
                    <div className="sm:col-span-2 rounded-lg border-2 border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">🏢 توليد الوحدات تلقائياً</h4>

                      {/* Quick: unit type + total count */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>نوع الوحدة</Label>
                          <Select value={form.unitType || ''} onValueChange={(v) => updateForm('unitType', v)}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="اختر نوع الوحدة" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="شقة">شقة</SelectItem>
                              <SelectItem value="محل">محل</SelectItem>
                              <SelectItem value="مكتب">مكتب</SelectItem>
                              <SelectItem value="استوديو">استوديو</SelectItem>
                              <SelectItem value="دور">دور</SelectItem>
                              <SelectItem value="أخرى">أخرى</SelectItem>
                            </SelectContent>
                          </Select>
                          {form.unitType === 'أخرى' && (
                            <div className="space-y-1.5 pt-1">
                              <Label htmlFor="customUnitType">اسم الوحدة المخصصة *</Label>
                              <Input
                                id="customUnitType"
                                value={form.customUnitType}
                                onChange={(e) => updateForm('customUnitType', e.target.value)}
                                placeholder="مثال: شاليه، مستودع، عيادة…"
                                dir="rtl"
                              />
                              {formErrors.customUnitType && <p className="text-xs text-red-500">{formErrors.customUnitType}</p>}
                            </div>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="unitCount">عدد الوحدات الإجمالي</Label>
                          <Input
                            id="unitCount"
                            type="number"
                            min={0}
                            max={500}
                            placeholder="مثال: ١٠"
                            value={form.unitCount}
                            onChange={(e) => updateForm('unitCount', e.target.value)}
                            dir="ltr"
                          />
                          <p className="text-xs text-muted-foreground">
                            توليد سريع: ينشئ هذا العدد من الوحدات المرقّمة تلقائياً. للتفصيل حسب الأدوار استخدم القسم أدناه.
                          </p>
                        </div>
                      </div>

                      {/* Detailed: per-floor breakdown */}
                      <div className="border-t border-emerald-200 dark:border-emerald-800 pt-3 space-y-3">
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          تفصيل حسب الأدوار (اختياري)
                          {floorsTotal > 0 && flatUnitCount > 0 && (
                            <span className="font-normal text-muted-foreground"> — سيُستخدم التفصيل ويتجاوز «عدد الوحدات الإجمالي»</span>
                          )}
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>عدد الأدوار</Label>
                            <Input
                              type="number"
                              min={1}
                              max={50}
                              placeholder="كم عدد الأدوار؟"
                              value={form.floorCount || ''}
                              onChange={(e) => {
                                const n = e.target.value ? parseInt(e.target.value, 10) : 0
                                setForm((prev) => ({
                                  ...prev,
                                  floorCount: n,
                                  floorUnitsCount: n > 0 ? Array(n).fill(0) : [],
                                  floorUnitTypes: n > 0 ? Array(n).fill('') : [],
                                }))
                              }}
                              dir="ltr"
                            />
                          </div>

                          {form.floorCount > 0 && (
                            <div className="space-y-2 sm:col-span-2">
                              <Label>عدد الوحدات لكل دور</Label>
                              <div className="space-y-1.5">
                                {Array.from({ length: form.floorCount }, (_, i) => {
                                  const floorNum = i + 1
                                  const isGround = floorNum === 1
                                  return (
                                    <div key={floorNum} className="flex items-center gap-3 p-2 rounded-lg border bg-muted/30">
                                      <span className="text-sm font-medium w-24 shrink-0 text-right">
                                        {isGround ? 'الدور الأرضي' : `الدور ${floorNum}`}
                                      </span>
                                      <Select
                                        value={typeForFloor(i)}
                                        onValueChange={(v) => {
                                          const newTypes = [...(form.floorUnitTypes || [])]
                                          newTypes[i] = v
                                          setForm((prev) => ({
                                            ...prev,
                                            floorUnitTypes: newTypes,
                                            ...(isGround ? { groundFloorShops: v === 'محل' } : {}),
                                          }))
                                        }}
                                      >
                                        <SelectTrigger className="h-8 w-28 shrink-0 text-xs"><SelectValue placeholder="النوع" /></SelectTrigger>
                                        <SelectContent>
                                          {perFloorOptions.map((t) => (
                                            <SelectItem key={t} value={t}>{t}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Input
                                        type="number"
                                        min={0}
                                        max={50}
                                        placeholder="عدد الوحدات"
                                        className="h-8 text-sm"
                                        value={form.floorUnitsCount[i] || ''}
                                        onChange={(e) => {
                                          const newCounts = [...(form.floorUnitsCount || [])]
                                          newCounts[i] = Number(e.target.value)
                                          updateFormAny('floorUnitsCount', newCounts)
                                        }}
                                        dir="ltr"
                                      />
                                      <span className="text-xs text-muted-foreground shrink-0">وحدة</span>
                                    </div>
                                  )
                                })}
                              </div>
                              {form.floorUnitsCount.some((c) => c > 0) && (
                                <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                                  إجمالي الوحدات: {floorsTotal} وحدة
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Ground-floor shops — multi-floor عمارة only */}
                        {form.propertyType === 'عمارة' && form.floorCount > 1 && (
                          <label className="flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-white/60 dark:bg-card p-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={form.groundFloorShops}
                              onChange={(e) => {
                                const c = e.target.checked
                                const newTypes = [...(form.floorUnitTypes || [])]
                                newTypes[0] = c ? 'محل' : globalUnitType
                                setForm((prev) => ({ ...prev, groundFloorShops: c, floorUnitTypes: newTypes }))
                              }}
                              className="mt-0.5 h-4 w-4 accent-emerald-600"
                            />
                            <span className="text-sm font-medium select-none leading-snug">الدور الأرضي يحتوي على محلات تجارية</span>
                          </label>
                        )}

                        {/* Area + rent for the generated units */}
                        {form.floorCount > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="unitArea">مساحة الوحدة م² (اختياري)</Label>
                              <Input id="unitArea" type="number" min={0} value={form.unitArea} onChange={(e) => updateForm('unitArea', e.target.value)} placeholder="—" dir="ltr" />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="unitRentPrice">سعر الإيجار (اختياري)</Label>
                              <Input id="unitRentPrice" type="number" min={0} value={form.unitRentPrice} onChange={(e) => updateForm('unitRentPrice', e.target.value)} placeholder="—" dir="ltr" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* أرض: land-specific fields */}
                  {showLand && (
                    <div className="sm:col-span-2 rounded-lg border-2 border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400">بيانات الأرض</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>المساحة (م²)</Label>
                          <Input type="number" min={0} placeholder="أدخل المساحة" value={form.area} onChange={(e) => updateForm('area', e.target.value)} dir="ltr" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>نوع الأرض</Label>
                          <Select value={form.landType || undefined} onValueChange={(v) => updateForm('landType', v)}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="اختر نوع الأرض" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="سكني">سكني</SelectItem>
                              <SelectItem value="تجاري">تجاري</SelectItem>
                              <SelectItem value="زراعي">زراعي</SelectItem>
                              <SelectItem value="صناعي">صناعي</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* فيلا: area + bedrooms + bathrooms */}
                  {showVilla && (
                    <div className="sm:col-span-2 rounded-lg border-2 border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-purple-800 dark:text-purple-400">بيانات الفيلا</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1.5"><Label>المساحة (م²)</Label><Input type="number" min={0} value={form.area} onChange={(e) => updateForm('area', e.target.value)} dir="ltr" placeholder="—" /></div>
                        <div className="space-y-1.5"><Label>غرف النوم</Label><Input type="number" min={0} value={form.bedrooms} onChange={(e) => updateForm('bedrooms', e.target.value)} dir="ltr" placeholder="—" /></div>
                        <div className="space-y-1.5"><Label>دورات المياه</Label><Input type="number" min={0} value={form.bathrooms} onChange={(e) => updateForm('bathrooms', e.target.value)} dir="ltr" placeholder="—" /></div>
                      </div>
                    </div>
                  )}

                  {/* محل مفرد: area + shop number */}
                  {showShop && (
                    <div className="sm:col-span-2 rounded-lg border-2 border-orange-200 bg-orange-50/50 dark:bg-orange-950/20 p-3 space-y-3">
                      <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-400">بيانات المحل</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label>المساحة (م²)</Label><Input type="number" min={0} value={form.area} onChange={(e) => updateForm('area', e.target.value)} dir="ltr" placeholder="—" /></div>
                        <div className="space-y-1.5"><Label>رقم المحل (اختياري)</Label><Input value={form.shopNumber} onChange={(e) => updateForm('shopNumber', e.target.value)} dir="ltr" placeholder="—" /></div>
                      </div>
                    </div>
                  )}
                </>
              )
            })()}

            {/* بيانات الصك (رقم + تاريخ) — common to EVERY property type */}
            <div className="sm:col-span-2 rounded-lg border-2 border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20 p-3 space-y-3">
              <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">بيانات الصك</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>رقم الصك (اختياري)</Label>
                  <Input placeholder="رقم صك الملكية" value={form.deedNumber} onChange={(e) => updateForm('deedNumber', e.target.value)} dir="ltr" />
                </div>
                <div className="space-y-1.5">
                  <Label>تاريخ الصك (اختياري)</Label>
                  <DatePicker value={form.deedDate} onChange={(date) => updateForm('deedDate', date)} showDualDate dualDateCalendar="gregorian" />
                </div>
              </div>
            </div>

            {/* الموقع على الخريطة — interactive vanilla-Leaflet picker + keyless geocoding */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label>الموقع على الخريطة</Label>
                <span className="text-[11px] text-muted-foreground" dir="ltr">
                  {geoStatus === 'searching' ? 'جارٍ البحث عن العنوان…'
                    : geoStatus === 'found' ? 'تم تحديد الموقع من العنوان'
                    : geoStatus === 'city' ? 'تم التقريب إلى المدينة — اضبط الدبوس يدويًا'
                    : (form.latitude != null && form.longitude != null)
                      ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}` : ''}
                </span>
              </div>
              <Suspense fallback={
                <div className="flex items-center justify-center h-[280px] rounded-md border border-dashed border-slate-300 dark:border-slate-700 bg-muted/40 text-xs text-muted-foreground gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" /> تحميل الخريطة…
                </div>
              }>
                <MapPicker
                  lat={form.latitude}
                  lng={form.longitude}
                  centerCity={form.city}
                  geocodeQuery={[form.address, form.district, form.city].filter(Boolean).join('، ')}
                  onGeocodeStatusChange={setGeoStatus}
                  onChange={(lat, lng) => setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }))}
                />
              </Suspense>
            </div>

            {/* الوصف */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="prop-desc">الوصف</Label>
              <Textarea id="prop-desc" value={form.description} onChange={(e) => updateForm('description', e.target.value)} rows={3} dir="rtl" />
            </div>

            {/* الصور — picked here, uploaded to the mirror when the property is saved */}
            <div className="sm:col-span-2 space-y-2">
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-muted/30 p-3 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground flex items-center gap-1.5"><ImagePlus className="h-4 w-4" /> صور العقار</span>
                <input
                  ref={formFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files ? Array.from(e.target.files) : []
                    if (files.length) setPendingImages((prev) => [...prev, ...files])
                    if (formFileInputRef.current) formFileInputRef.current.value = ''
                  }}
                />
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => formFileInputRef.current?.click()}>
                  <ImagePlus className="h-4 w-4" /> إضافة صور
                </Button>
              </div>
              {pendingImages.length > 0 && (
                <>
                  <div className="flex flex-wrap gap-2">
                    {pendingImages.map((file, i) => (
                      <div key={`${file.name}-${i}`} className="relative w-20 h-20 rounded-md overflow-hidden border">
                        <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute top-0.5 left-0.5 rounded-full bg-black/60 text-white p-0.5"
                          title="إزالة"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {i === 0 && !(editingProperty?.images && editingProperty.images.length > 0) && (
                          <span className="absolute bottom-0 inset-x-0 bg-emerald-600/90 text-white text-[8px] text-center">غلاف</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {editingProperty ? 'ستُرفع الصور عند حفظ التعديلات.' : 'ستُرفع الصور بعد إضافة العقار (الأولى تصبح صورة الغلاف).'}
                  </p>
                </>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={submitting}>إلغاء</Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleSubmitProperty}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 ml-1 animate-spin" />}
              {editingProperty ? 'حفظ التعديلات' : 'إضافة العقار'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* PROPERTY DELETE CONFIRM (LIVE)                                    */}
      {/* ================================================================ */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العقار</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف «{deleteTarget ? getPropertyTitle(deleteTarget) : ''}»؟ لا يمكن التراجع عن هذا الإجراء.
              إذا كان للعقار وحدات أو عقود مرتبطة فلن يتم الحذف.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProperty} className="bg-red-600 hover:bg-red-700" disabled={deleting}>
              {deleting ? 'جارٍ الحذف…' : 'حذف'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ================================================================ */}
      {/* كشف حساب عقار / سجل حركات العقار (read the mirror, print-ready)     */}
      {/* ================================================================ */}
      <PropertyStatementDialog
        propertyId={statementPropertyId}
        open={statementOpen}
        onOpenChange={setStatementOpen}
        onOpenLedger={() => {
          setStatementOpen(false)
          if (statementPropertyId) openLedger(statementPropertyId)
        }}
      />
      <PropertyLedgerDialog
        propertyId={ledgerPropertyId}
        open={ledgerOpen}
        onOpenChange={setLedgerOpen}
        onOpenStatement={() => {
          setLedgerOpen(false)
          if (ledgerPropertyId) openStatement(ledgerPropertyId)
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Small Info Item Component
// ---------------------------------------------------------------------------

function InfoItem({
  label,
  value,
  valueClass = '',
}: {
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${valueClass}`}>{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Unit Detail Row (label / value pair inside the unit sheet)
// ---------------------------------------------------------------------------

function UnitDetailRow({
  label,
  value,
  valueClass = '',
  dir,
}: {
  label: string
  value: string
  valueClass?: string
  dir?: 'rtl' | 'ltr'
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`font-medium text-foreground text-left ${valueClass}`} dir={dir}>{value}</span>
    </div>
  )
}
