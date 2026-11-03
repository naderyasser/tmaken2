'use client'

// Ported from egarsys src/components/sections/contracts.tsx.
// Scope of THIS port (per the section-by-section plan):
//   • LIST view — rendered 1:1, reading the Frappe mirror via lib/rentals/contracts-data.
//   • DETAIL / view dialog — rendered 1:1 (property · حركة العقار timeline · lessor ·
//     tenant · financial · contract info · colored installment schedule · notes ·
//     payment history), all from the mirror compat adapter.
//   • CREATE / EDIT / RENEW / TERMINATE / move-out / prepaid / paid-previously / link /
//     WhatsApp / issue-invoice / PDF are WRITE flows — STUBBED here (buttons kept, wired
//     to a «قريباً» toast). The طباعة (browser print of the on-screen list) is real.
// Mechanical changes vs the original: data fetches → adapter; zustand store →
// useRentalsShell(); @/components/ui/* → scoped ui; @/lib/* → scoped copies.

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import {
  Search, Plus, Wallet, Eye, XCircle, RefreshCw, FileText, Loader2, Printer,
  Link2, Pencil, Building2, MessageCircle, MoreHorizontal, Receipt, LogOut,
  Coins, CalendarClock, AlertTriangle, Calculator, CheckCircle, Trash2,
  Archive, ArchiveRestore, UserCog,
} from 'lucide-react'
import { toast } from 'sonner'

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from './ui/table'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { Separator } from './ui/separator'
import { DatePicker } from './ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { CompanyHeaderLogo } from './ui/company-header-logo'

import type { RentalContract, ContractTypeValue, Invoice, TenantPartyTypeValue } from './types'
import {
  ContractStatus, ContractStatusLabels, ContractTypeLabels, InvoiceStatusLabels,
  PaymentMethodLabels, PropertyType, PropertyTypeLabels,
  TenantPartyTypeLabels, TENANT_PARTY_TYPE_VALUES,
} from './types'
import type { PropertyTypeValue } from './types'
import {
  formatSAR, formatDate, formatDateDualCompact, installmentLabelAr, formatDurationAr, daysSince,
} from './format'
import { collectedAmount } from './engine/property-statement'
import type { InstallmentView } from './engine/installment-view'
import { ContractLifecycleTimeline } from './contract-lifecycle-timeline'
import { InstallmentScheduleTable, InstallmentLegend } from './installment-schedule-table'
import { useRentalsShell } from './store'
import {
  getContractsList, getContractDetail, getContractSchedule, getContractInvoices,
  getContractsForProperty,
} from '@/lib/rentals/contracts-data'
import {
  createContractDoc, updateContractDoc, renewContractDoc, setContractStatus, deleteContractDoc,
  changeContractTenant,
  getContractSeqContext, listLinkableProperties, getPropertyAutofill,
  listVacantUnitsForProperty, listContractUnits, saveContractUnitOccupancy,
  type ContractFormInput, type ContractSeqContext, type LinkableProperty,
  type VacantUnit, type ContractUnitRow, type ChangeTenantFormInput,
} from '@/lib/rentals/contract-write'
import { listLinkableOwners } from '@/lib/rentals/property-write'
import { frappeClient } from '@/lib/api-client'
import {
  OwnerAutocompleteInput, OwnerFillDialog, type OwnerData, type OwnerField,
} from './ui/owner-picker'

// ---------------------------------------------------------------------------
// Helpers (ported verbatim)
// ---------------------------------------------------------------------------

const DEFAULT_ROW_LINK = 'text-blue-700 hover:underline dark:text-blue-400'

function getContractAlertColor(status: string, endDate: string | Date): { badge: string; row: string; circle: string; link: string } {
  const now = new Date()
  const end = new Date(endDate)
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (status === 'moved_out') {
    return {
      badge: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40',
      row: 'border-r-4 border-red-600 text-red-700 dark:text-red-400 bg-red-50/50 dark:bg-red-950/30',
      circle: 'bg-red-600',
      link: 'text-red-700 dark:text-red-400 font-semibold hover:underline',
    }
  }
  if (status === 'expired' || status === 'terminated' || status === 'archived' || daysLeft < 0) {
    return {
      badge: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
      row: 'border-r-4 border-red-500',
      circle: 'bg-red-500',
      link: DEFAULT_ROW_LINK,
    }
  }
  if (status === 'active' && daysLeft <= 90) {
    return {
      badge: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30',
      row: 'border-r-4 border-yellow-500',
      circle: 'bg-yellow-500',
      link: DEFAULT_ROW_LINK,
    }
  }
  return {
    badge: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
    row: 'border-r-4 border-green-500',
    circle: 'bg-green-500',
    link: DEFAULT_ROW_LINK,
  }
}

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'active': return 'success' as const
    case 'pending_renewal': return 'warning' as const
    case 'expired': return 'danger' as const
    case 'moved_out': return 'danger' as const
    case 'terminated': return 'neutral' as const
    case 'draft': return 'info' as const
    default: return 'neutral' as const
  }
}

function getDaysUntilExpiryClasses(days: number | undefined): string {
  if (days === undefined) return ''
  if (days <= 0) return 'text-red-600 dark:text-red-400 font-bold'
  if (days <= 30) return 'text-amber-600 dark:text-amber-400 font-semibold'
  return 'text-green-600 dark:text-green-400'
}

// ---------------------------------------------------------------------------
// Create/Edit form state (ported from egarsys). The unit-occupancy multi-select,
// electric-meter and owner-autocomplete widgets are RESTORED (1:1 with egarsys):
// units link the contract to specific `Rental Unit` rows via `Rental Contract Unit`
// junctions, the meter is stamped on the chosen unit, and the lessor fields use the
// owner picker. File-upload/attachments remain out of this task's scope. Every other
// field maps 1:1 to a `Rental Contract` mirror column via lib/rentals/contract-write.ts.
// ---------------------------------------------------------------------------
interface CreateFormState extends ContractFormInput {
  rentalPropertyId: string
  electricMeter: string
  contractNumber: string
  internalId: string
  propertyType: string
  otherPropertyType: string
  propertyLocation: string
  propertyStreet: string
  propertyBuildingNumber: string
  propertyCity: string
  propertyDistrict: string
  propertyPostalCode: string
  propertyAddress: string
  tenantId: string
  contractType: ContractTypeValue
  registeredCalendar: '' | 'hijri' | 'gregorian'
  ejarContractNumber: string
  startDate: string
  endDate: string
  sealingLocation: string
  sealingDate: string
  vatNumber: string
  rentAmount: string
  installmentsPerYear: string
  taxRate: string
  lessorName: string
  lessorNationalId: string
  lessorPhone: string
  lessorVatRegistrationNumber: string
  lessorAddress: string
  lessorStreet: string
  lessorBuildingNumber: string
  lessorCity: string
  lessorDistrict: string
  lessorPostalCode: string
  lessorAdditionalNumber: string
  tenantPartyType: '' | TenantPartyTypeValue
  tenantName: string
  tenantCompanyName: string
  tenantCrNumber: string
  tenantUnifiedNumber: string
  tenantNationalId: string
  tenantPhone: string
  tenantEmail: string
  tenantVatRegistrationNumber: string
  tenantStreet: string
  tenantBuildingNumber: string
  tenantCity: string
  tenantDistrict: string
  tenantPostalCode: string
  tenantAdditionalNumber: string
  tenantRepresentativeName: string
  tenantRepresentativeMobile: string
  securityDeposit: string
  status: string
  notes: string
  terms: string
}

const emptyCreateForm: CreateFormState = {
  rentalPropertyId: '', electricMeter: '', contractNumber: '', internalId: '', propertyType: 'shop',
  otherPropertyType: '', propertyLocation: '', propertyStreet: '', propertyBuildingNumber: '',
  propertyCity: '', propertyDistrict: '', propertyPostalCode: '', propertyAddress: '',
  tenantId: '', contractType: 'new', registeredCalendar: '', ejarContractNumber: '',
  startDate: '', endDate: '', sealingLocation: '', sealingDate: '', vatNumber: '',
  rentAmount: '', installmentsPerYear: '4', taxRate: '15',
  lessorName: '', lessorNationalId: '', lessorPhone: '', lessorVatRegistrationNumber: '',
  lessorAddress: '', lessorStreet: '', lessorBuildingNumber: '', lessorCity: '', lessorDistrict: '',
  lessorPostalCode: '', lessorAdditionalNumber: '',
  tenantPartyType: '', tenantName: '', tenantCompanyName: '', tenantCrNumber: '',
  tenantUnifiedNumber: '', tenantNationalId: '', tenantPhone: '', tenantEmail: '',
  tenantVatRegistrationNumber: '', tenantStreet: '', tenantBuildingNumber: '', tenantCity: '',
  tenantDistrict: '', tenantPostalCode: '', tenantAdditionalNumber: '',
  tenantRepresentativeName: '', tenantRepresentativeMobile: '',
  securityDeposit: '', status: 'active', notes: '', terms: '',
}

// ---------------------------------------------------------------------------
// «تغيير المستأجر» form — the NEW tenant snapshot + the successor contract's
// number/period/rent. Everything else (property/unit links, lessor, meta, notes,
// terms) is copied from the old contract by changeContractTenant(). Reuses the same
// صفة-الطرف field set + party-type gating as the create form.
// ---------------------------------------------------------------------------
interface ChangeTenantFormState extends ChangeTenantFormInput {
  tenantPartyType: '' | TenantPartyTypeValue
  tenantName: string
  tenantCompanyName: string
  tenantCrNumber: string
  tenantUnifiedNumber: string
  tenantNationalId: string
  tenantVatRegistrationNumber: string
  tenantPhone: string
  tenantEmail: string
  tenantStreet: string
  tenantBuildingNumber: string
  tenantCity: string
  tenantDistrict: string
  tenantPostalCode: string
  tenantAdditionalNumber: string
  tenantRepresentativeName: string
  tenantRepresentativeMobile: string
  contractNumber: string
  startDate: string
  endDate: string
  rentAmount: string
  securityDeposit: string
}

const emptyChangeTenantForm: ChangeTenantFormState = {
  tenantPartyType: '', tenantName: '', tenantCompanyName: '', tenantCrNumber: '',
  tenantUnifiedNumber: '', tenantNationalId: '', tenantVatRegistrationNumber: '',
  tenantPhone: '', tenantEmail: '', tenantStreet: '', tenantBuildingNumber: '',
  tenantCity: '', tenantDistrict: '', tenantPostalCode: '', tenantAdditionalNumber: '',
  tenantRepresentativeName: '', tenantRepresentativeMobile: '',
  contractNumber: '', startDate: '', endDate: '', rentAmount: '', securityDeposit: '',
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ContractsSection({ ended = false }: { ended?: boolean } = {}) {
  const { setCurrentSection, setPendingFocus, pendingFocus } = useRentalsShell()

  // Out-of-scope flows still route here: issue-invoice, PDF/print-contract, WhatsApp,
  // كشف حساب مرجعي, ربط عقار (single + bulk), جميع الدفعات القادمة, مسدد مسبقاً, and the
  // القسط القادم / مستحقات click-to-issue (all separate/out-of-scope for this task).
  const comingSoon = useCallback(() => {
    toast('هذه الميزة قيد الإنشاء — (الفواتير/الطباعة/واتساب/الربط تأتي لاحقاً)')
  }, [])

  // Paid-previously management stays stubbed (feeds the installment schedule editor).
  const canEditContracts = false

  // Data state
  const [contracts, setContracts] = useState<RentalContract[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchTrigger, setFetchTrigger] = useState(0)

  // Filter state
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const pf = pendingFocus
    return pf?.section === 'contracts' && pf.contentType === 'filter-status' && pf.key ? pf.key : 'all'
  })
  const [frequencyFilter, setFrequencyFilter] = useState<string>('all')
  const [quickFilter, setQuickFilter] = useState<string | null>(null)
  const [quickFilterData, setQuickFilterData] = useState<Array<{
    contract: RentalContract
    paymentStatus: 'paid' | 'unpaid' | 'partial' | 'unknown'
  }> | null>(null)
  const [quickFilterLoading, setQuickFilterLoading] = useState(false)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Dialog states
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedContract, setSelectedContract] = useState<RentalContract | null>(null)
  const [contractInvoices, setContractInvoices] = useState<Invoice[]>([])

  const [lifecycleContracts, setLifecycleContracts] = useState<
    Awaited<ReturnType<typeof getContractsForProperty>>
  >([])
  const [lifecycleLoading, setLifecycleLoading] = useState(false)

  const [scheduleData, setScheduleData] = useState<{
    schedule: InstallmentView[]
    nextDueNo: number | null
    nextDueState?: 'due' | 'upcoming' | null
    nextDueReason?: 'fully_invoiced' | null
  } | null>(null)
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const scheduleReqRef = useRef<string | null>(null)

  const refetchContracts = useCallback(() => setFetchTrigger((t) => t + 1), [])

  // ---------------------------------------------------------------------------
  // WRITE-flow state (create · edit · renew · terminate · move-out · delete) —
  // all write straight to the `Rental Contract` mirror via lib/rentals/contract-write.
  // ---------------------------------------------------------------------------
  const [createOpen, setCreateOpen] = useState(false)
  const [editingContract, setEditingContract] = useState<RentalContract | null>(null)
  const [createForm, setCreateForm] = useState<CreateFormState>(emptyCreateForm)
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)

  const [renewOpen, setRenewOpen] = useState(false)
  const [renewForm, setRenewForm] = useState({
    startDate: '', endDate: '', rentAmount: '', securityDeposit: '', contractNumber: '', notes: '', terms: '',
  })
  const [renewing, setRenewing] = useState(false)

  const [terminateOpen, setTerminateOpen] = useState(false)
  const [terminating, setTerminating] = useState(false)
  const [moveOutOpen, setMoveOutOpen] = useState(false)
  const [movingOut, setMovingOut] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RentalContract | null>(null)
  const [deleting, setDeleting] = useState(false)

  // «تغيير المستأجر» — successor-contract flow on an ACTIVE contract (selectedContract = old).
  const [changeTenantOpen, setChangeTenantOpen] = useState(false)
  const [changeTenantForm, setChangeTenantForm] = useState<ChangeTenantFormState>(emptyChangeTenantForm)
  const [changingTenant, setChangingTenant] = useState(false)

  // Per-company internal_id sequence + the picker's list of existing properties.
  const [seqCtx, setSeqCtx] = useState<ContractSeqContext>({ companyId: null, nextInternalId: 1 })
  const [nextInternalId, setNextInternalId] = useState<number | null>(null)
  const [availableProperties, setAvailableProperties] = useState<LinkableProperty[]>([])
  const [autoFilledFromProperty, setAutoFilledFromProperty] = useState(false)

  // Unit-occupancy multi-select (create form): vacant units of the picked property +
  // the user's checkbox selection. On EDIT we instead show the contract's existing
  // Rental Contract Unit rows read-only (editUnits) — units aren't re-selectable there.
  const [availableUnits, setAvailableUnits] = useState<VacantUnit[]>([])
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([])
  const [loadingUnits, setLoadingUnits] = useState(false)
  const [editUnits, setEditUnits] = useState<ContractUnitRow[]>([])

  // Owner autocomplete (lessor fields) — existing Rental Owner docs feed the suggestions.
  const [owners, setOwners] = useState<OwnerData[]>([])
  const [pickedOwner, setPickedOwner] = useState<OwnerData | null>(null)
  const [pickedField, setPickedField] = useState<OwnerField | null>(null)

  // Pre-fetch the sequence context (companyId + next الرقم الداخلي), property list + owners.
  useEffect(() => {
    getContractSeqContext()
      .then((ctx) => { setSeqCtx(ctx); setNextInternalId(ctx.nextInternalId) })
      .catch(() => {})
    listLinkableProperties().then(setAvailableProperties).catch(() => {})
    listLinkableOwners().then(setOwners).catch(() => {})
  }, [fetchTrigger])

  // Maps a picked owner field → the createForm lessor key it fills (egarsys's lessorKey).
  const fillAllLessor = useCallback((owner: OwnerData) => {
    setCreateForm((prev) => ({
      ...prev,
      lessorName: owner.name || '',
      lessorNationalId: owner.nationalId || '',
      lessorPhone: owner.phone || '',
      lessorVatRegistrationNumber: owner.vatNumber || '',
    }))
    setPickedOwner(null); setPickedField(null)
  }, [])
  const fillLessorField = useCallback((owner: OwnerData, field: OwnerField) => {
    const keyMap: Partial<Record<OwnerField, keyof CreateFormState>> = {
      name: 'lessorName', nationalId: 'lessorNationalId', phone: 'lessorPhone',
      vatNumber: 'lessorVatRegistrationNumber', address: 'lessorAddress',
    }
    const key = keyMap[field]
    if (key) setCreateForm((prev) => ({ ...prev, [key]: (owner[field] ?? '') as string }))
    setPickedOwner(null); setPickedField(null)
  }, [])

  // On close: full reset.
  useEffect(() => {
    if (!createOpen) {
      setCreateForm(emptyCreateForm)
      setAutoFilledFromProperty(false)
      setEditingContract(null)
      setAvailableUnits([])
      setSelectedUnitIds([])
      setEditUnits([])
    }
  }, [createOpen])

  // صفة الطرف field visibility (identical to egarsys): '' shows the full field set.
  const tenantPartyUnset = createForm.tenantPartyType === ''
  const isOrgTenant = createForm.tenantPartyType === 'establishment' || createForm.tenantPartyType === 'company'
  const showTenantOrgFields = tenantPartyUnset || isOrgTenant
  const showTenantNationalId = tenantPartyUnset || createForm.tenantPartyType === 'individual'
  const showTenantEntityName = createForm.tenantPartyType === 'government'

  // Same صفة الطرف gating for the «تغيير المستأجر» dialog (its own form state).
  const ctPartyUnset = changeTenantForm.tenantPartyType === ''
  const ctIsOrgTenant = changeTenantForm.tenantPartyType === 'establishment' || changeTenantForm.tenantPartyType === 'company'
  const ctShowTenantOrgFields = ctPartyUnset || ctIsOrgTenant
  const ctShowTenantNationalId = ctPartyUnset || changeTenantForm.tenantPartyType === 'individual'
  const ctShowTenantEntityName = changeTenantForm.tenantPartyType === 'government'

  // Auto-calculated contract figures for the installment preview (ported verbatim).
  const autoCalcContract = useMemo(() => {
    const annualRent = Number(createForm.rentAmount) || 0
    const installmentsPerYear = Number(createForm.installmentsPerYear) || 4
    const zero = { annualRent: 0, annualRentWithTax: 0, perInstallment: 0, totalContractValue: 0, taxAmount: 0 }
    if (!annualRent || !createForm.startDate || !createForm.endDate) return zero
    const start = new Date(createForm.startDate)
    const end = new Date(createForm.endDate)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return zero
    const taxRatePercent = Number(createForm.taxRate) || 0
    const annualRentWithTax = Math.round(annualRent * (1 + taxRatePercent / 100))
    const perInstallment = Math.round(annualRentWithTax / installmentsPerYear)
    let totalMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    if (end.getDate() > start.getDate()) totalMonths++
    if (totalMonths < 1) totalMonths = 1
    const totalContractValue = Math.round(annualRentWithTax * (totalMonths / 12))
    const taxAmount = Math.round(annualRent * (taxRatePercent / 100))
    return { annualRent, annualRentWithTax, perInstallment, totalContractValue, taxAmount }
  }, [createForm.rentAmount, createForm.installmentsPerYear, createForm.taxRate, createForm.startDate, createForm.endDate])

  // Picking a property auto-fills its address + lessor (from the linked owner) AND loads
  // that property's vacant units into the multi-select (egarsys's handlePropertySelect).
  const handlePropertySelect = useCallback(async (propertyId: string) => {
    setCreateForm((prev) => ({ ...prev, rentalPropertyId: propertyId, electricMeter: '' }))
    setAvailableUnits([])
    setSelectedUnitIds([])
    if (!propertyId) { setAutoFilledFromProperty(false); return }
    setLoadingUnits(true)
    try {
      const [fill, units] = await Promise.all([
        getPropertyAutofill(propertyId),
        listVacantUnitsForProperty(propertyId).catch(() => [] as VacantUnit[]),
      ])
      if (fill) {
        setCreateForm((prev) => ({
          ...prev,
          propertyCity: fill.propertyCity || prev.propertyCity,
          propertyDistrict: fill.propertyDistrict || prev.propertyDistrict,
          propertyAddress: fill.propertyAddress || prev.propertyAddress,
          lessorName: fill.lessorName || prev.lessorName,
          lessorNationalId: fill.lessorNationalId || prev.lessorNationalId,
          lessorPhone: fill.lessorPhone || prev.lessorPhone,
          lessorAddress: fill.lessorAddress || prev.lessorAddress,
        }))
        if (fill.lessorName || fill.propertyCity) setAutoFilledFromProperty(true)
      }
      setAvailableUnits(units)
    } catch { /* keep manual entry */ }
    finally { setLoadingUnits(false) }
  }, [])

  const openCreateContract = useCallback(() => {
    setEditingContract(null)
    setCreateForm(emptyCreateForm)
    setAutoFilledFromProperty(false)
    setAvailableUnits([])
    setSelectedUnitIds([])
    setEditUnits([])
    setCreateOpen(true)
  }, [])

  // Open the full form in edit mode, pre-filled. contractNumber + property link are fixed.
  const openEditContract = useCallback((contract: RentalContract) => {
    const c = contract as Record<string, unknown>
    const s = (v: unknown) => (v === null || v === undefined ? '' : String(v))
    const toDateInput = (v: unknown) => {
      if (!v) return ''
      const d = new Date(v as string)
      return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
    }
    setEditingContract(contract)
    setCreateForm({
      ...emptyCreateForm,
      rentalPropertyId: '',
      contractNumber: s(c.contractNumber),
      internalId: c.internalId != null ? String(c.internalId) : '',
      propertyType: s(c.propertyType) || 'shop',
      otherPropertyType: s(c.otherPropertyType),
      propertyLocation: s(c.propertyLocation),
      propertyStreet: s(c.propertyStreet),
      propertyBuildingNumber: s(c.propertyBuildingNumber),
      propertyCity: s(c.propertyCity),
      propertyDistrict: s(c.propertyDistrict),
      propertyPostalCode: s(c.propertyPostalCode),
      propertyAddress: s(c.propertyAddress),
      tenantId: s(c.tenantId),
      contractType: (s(c.contractType) || 'new') as ContractTypeValue,
      registeredCalendar: (c.registeredCalendar === 'hijri' || c.registeredCalendar === 'gregorian' ? c.registeredCalendar : '') as '' | 'hijri' | 'gregorian',
      ejarContractNumber: s(c.ejarContractNumber),
      startDate: toDateInput(c.startDate),
      endDate: toDateInput(c.endDate),
      sealingLocation: s(c.sealingLocation),
      sealingDate: toDateInput(c.sealingDate),
      vatNumber: s(c.vatNumber),
      rentAmount: c.rentAmount != null ? String(c.rentAmount) : '',
      installmentsPerYear: c.installmentsPerYear != null ? String(c.installmentsPerYear) : '4',
      taxRate: c.taxRate != null ? String(c.taxRate) : '15',
      securityDeposit: c.securityDeposit != null ? String(c.securityDeposit) : '',
      status: s(c.status) || 'active',
      lessorName: s(c.lessorName),
      lessorNationalId: s(c.lessorNationalId),
      lessorPhone: s(c.lessorPhone),
      lessorVatRegistrationNumber: s(c.lessorVatRegistrationNumber),
      lessorAddress: s(c.lessorAddress),
      lessorStreet: s(c.lessorStreet),
      lessorBuildingNumber: s(c.lessorBuildingNumber),
      lessorCity: s(c.lessorCity),
      lessorDistrict: s(c.lessorDistrict),
      lessorPostalCode: s(c.lessorPostalCode),
      lessorAdditionalNumber: s(c.lessorAdditionalNumber),
      tenantPartyType: (TENANT_PARTY_TYPE_VALUES.includes(s(c.tenantPartyType)) ? s(c.tenantPartyType) : '') as '' | TenantPartyTypeValue,
      tenantName: s(c.tenantName),
      tenantCompanyName: s(c.tenantCompanyName),
      tenantCrNumber: s(c.tenantCrNumber),
      tenantUnifiedNumber: s(c.tenantUnifiedNumber),
      tenantNationalId: s(c.tenantNationalId),
      tenantPhone: s(c.tenantPhone),
      tenantEmail: s(c.tenantEmail),
      tenantVatRegistrationNumber: s(c.tenantVatRegistrationNumber),
      tenantStreet: s(c.tenantStreet),
      tenantBuildingNumber: s(c.tenantBuildingNumber),
      tenantCity: s(c.tenantCity),
      tenantDistrict: s(c.tenantDistrict),
      tenantPostalCode: s(c.tenantPostalCode),
      tenantAdditionalNumber: s(c.tenantAdditionalNumber),
      tenantRepresentativeName: s(c.tenantRepresentativeName),
      tenantRepresentativeMobile: s(c.tenantRepresentativeMobile),
      notes: s(c.notes),
      terms: s(c.terms),
    })
    // Units aren't re-selectable in edit mode — load the contract's existing junctions
    // to show them read-only (egarsys rendered contract.contractUnits the same way).
    setAvailableUnits([])
    setSelectedUnitIds([])
    setEditUnits([])
    listContractUnits(contract.id).then(setEditUnits).catch(() => setEditUnits([]))
    setCreateOpen(true)
  }, [])

  const handleCreateContract = useCallback(async () => {
    if (creatingRef.current) return
    if (createForm.startDate && createForm.endDate) {
      const sd = new Date(createForm.startDate); const ed = new Date(createForm.endDate)
      if (!isNaN(sd.getTime()) && !isNaN(ed.getTime()) && sd > ed) {
        toast.error('تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية'); return
      }
    }
    if (!editingContract && !createForm.contractNumber.trim()) { toast.error('رقم العقد مطلوب'); return }
    creatingRef.current = true
    setCreating(true)
    try {
      if (editingContract) {
        await updateContractDoc(editingContract.id, createForm)
        toast.success('تم تحديث العقد بنجاح')
      } else {
        // When units are chosen and no rent was typed, egarsys defaulted the annual rent
        // to the sum of the selected units' rentPrice — replicate that before creating.
        const autoTotalRent = selectedUnitIds.length > 0
          ? availableUnits.filter((u) => selectedUnitIds.includes(u.id)).reduce((s, u) => s + (u.rentPrice || 0), 0)
          : 0
        const formForCreate: CreateFormState = {
          ...createForm,
          rentAmount: createForm.rentAmount || (autoTotalRent > 0 ? String(autoTotalRent) : ''),
        }
        const newName = await createContractDoc(formForCreate, seqCtx)
        // Wire up the chosen units: junction docs + status→rented + meter on the first unit.
        await saveContractUnitOccupancy(newName, selectedUnitIds, createForm.electricMeter, createForm.rentalPropertyId)
        toast.success('تم إنشاء العقد بنجاح')
      }
      setCreateOpen(false)
      setEditingContract(null)
      refetchContracts()
    } catch (err) {
      toast.error((err as Error)?.message || (editingContract ? 'فشل في تحديث العقد' : 'فشل في إنشاء العقد'))
    } finally {
      setCreating(false)
      creatingRef.current = false
    }
  }, [createForm, editingContract, seqCtx, refetchContracts, selectedUnitIds, availableUnits])

  const openRenewDialog = useCallback((contract: RentalContract) => {
    setSelectedContract(contract)
    const oldEnd = new Date(contract.endDate)
    const newStart = isNaN(oldEnd.getTime()) ? '' : oldEnd.toISOString().slice(0, 10)
    const newEnd = new Date(oldEnd); newEnd.setFullYear(newEnd.getFullYear() + 1)
    setRenewForm({
      startDate: newStart,
      endDate: isNaN(newEnd.getTime()) ? '' : newEnd.toISOString().slice(0, 10),
      rentAmount: String(contract.rentAmount ?? ''),
      securityDeposit: String(contract.securityDeposit ?? ''),
      contractNumber: '',
      notes: '',
      terms: contract.terms || '',
    })
    setRenewOpen(true)
  }, [])

  const handleRenewContract = useCallback(async () => {
    if (!selectedContract || !renewForm.endDate) return
    setRenewing(true)
    try {
      await renewContractDoc(selectedContract.id, {
        startDate: renewForm.startDate,
        endDate: renewForm.endDate,
        rentAmount: renewForm.rentAmount,
        securityDeposit: renewForm.securityDeposit,
        contractNumber: renewForm.contractNumber,
        notes: renewForm.notes,
        terms: renewForm.terms,
      })
      setRenewOpen(false)
      setDetailOpen(false)
      refetchContracts()
      toast.success('تم تجديد العقد بنجاح')
    } catch (err) {
      toast.error((err as Error)?.message || 'فشل في تجديد العقد')
    } finally {
      setRenewing(false)
    }
  }, [selectedContract, renewForm, refetchContracts])

  const openTerminateDialog = useCallback((contract: RentalContract) => { setSelectedContract(contract); setTerminateOpen(true) }, [])
  const handleTerminateContract = useCallback(async () => {
    if (!selectedContract) return
    setTerminating(true)
    try {
      await setContractStatus(selectedContract.id, 'terminated')
      setTerminateOpen(false); setDetailOpen(false); refetchContracts()
      toast.success('تم إنهاء العقد بنجاح')
    } catch (err) {
      toast.error((err as Error)?.message || 'فشل في إنهاء العقد')
    } finally { setTerminating(false) }
  }, [selectedContract, refetchContracts])

  const openMoveOutDialog = useCallback((contract: RentalContract) => { setSelectedContract(contract); setMoveOutOpen(true) }, [])
  const handleMoveOutContract = useCallback(async () => {
    if (!selectedContract) return
    setMovingOut(true)
    try {
      await setContractStatus(selectedContract.id, 'moved_out')
      setMoveOutOpen(false); setDetailOpen(false); refetchContracts()
      toast.success('تم تعليم العقد كـ «خرج»')
    } catch (err) {
      toast.error((err as Error)?.message || 'فشل في تحديث حالة العقد')
    } finally { setMovingOut(false) }
  }, [selectedContract, refetchContracts])

  // «تغيير المستأجر» — open the dialog pre-filling the successor's period/rent/deposit
  // from the old contract (all editable); the new tenant section starts blank.
  const openChangeTenantDialog = useCallback((contract: RentalContract) => {
    setSelectedContract(contract)
    const toDateInput = (v: unknown) => {
      if (!v) return ''
      const d = new Date(v as string)
      return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
    }
    setChangeTenantForm({
      ...emptyChangeTenantForm,
      startDate: toDateInput(contract.startDate),
      endDate: toDateInput(contract.endDate),
      rentAmount: String(contract.rentAmount ?? ''),
      securityDeposit: String(contract.securityDeposit ?? ''),
    })
    setChangeTenantOpen(true)
  }, [])

  const handleChangeTenant = useCallback(async () => {
    if (!selectedContract) return
    if (!changeTenantForm.contractNumber.trim()) { toast.error('رقم العقد مطلوب'); return }
    if (!changeTenantForm.tenantName.trim()) { toast.error('اسم المستأجر مطلوب'); return }
    if (changeTenantForm.startDate && changeTenantForm.endDate) {
      const sd = new Date(changeTenantForm.startDate); const ed = new Date(changeTenantForm.endDate)
      if (!isNaN(sd.getTime()) && !isNaN(ed.getTime()) && sd > ed) {
        toast.error('تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية'); return
      }
    }
    setChangingTenant(true)
    try {
      await changeContractTenant(selectedContract.id, changeTenantForm)
      setChangeTenantOpen(false)
      setDetailOpen(false)
      refetchContracts()
      toast.success('تم تغيير المستأجر')
    } catch (err) {
      toast.error((err as Error)?.message || 'فشل في تغيير المستأجر')
    } finally {
      setChangingTenant(false)
    }
  }, [selectedContract, changeTenantForm, refetchContracts])

  // «نقل إلى أرشيف العقود» / «استعادة إلى النشطة» — a manual status-only toggle on the
  // mirror. SIDE-EFFECT-FREE: writes ONLY `status` (never touches units/invoices). Fully
  // reversible; nothing is deleted. Archived contracts drop out of the main list and appear
  // in «أرشيف العقود»; restoring puts them back to active.
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const setArchiveState = useCallback(async (contract: RentalContract, status: 'archived' | 'active') => {
    setArchivingId(contract.id)
    try {
      await frappeClient.put('Rental Contract', contract.id, { status })
      setDetailOpen(false)
      refetchContracts()
      toast.success(status === 'archived' ? 'تم نقل العقد إلى أرشيف العقود' : 'تمت استعادة العقد إلى النشطة')
    } catch (err) {
      toast.error((err as Error)?.message || (status === 'archived' ? 'فشل نقل العقد' : 'فشل استعادة العقد'))
    } finally {
      setArchivingId(null)
    }
  }, [refetchContracts])

  const handleDeleteContract = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteContractDoc(deleteTarget.id)
      setDeleteTarget(null); setDetailOpen(false); refetchContracts()
      toast.success('تم حذف العقد')
    } catch (err) {
      toast.error((err as Error)?.message || 'فشل في حذف العقد')
    } finally { setDeleting(false) }
  }, [deleteTarget, refetchContracts])

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const filters: { search?: string; status?: string; paymentFrequency?: string; mode?: 'main' | 'ended' | 'all' } = {
      mode: ended ? 'ended' : 'main',
    }
    if (search) filters.search = search
    if (statusFilter !== 'all') filters.status = statusFilter
    if (frequencyFilter !== 'all') filters.paymentFrequency = frequencyFilter
    getContractsList(filters)
      .then((data) => { if (!cancelled) setContracts(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [search, statusFilter, frequencyFilter, fetchTrigger, ended])

  const handleViewContract = useCallback(async (contract: RentalContract) => {
    setSelectedContract(contract)
    setDetailOpen(true)
    setScheduleData(null)
    setContractInvoices([])
    setScheduleLoading(true)
    scheduleReqRef.current = contract.id
    getContractSchedule(contract.id)
      .then((j) => {
        if (scheduleReqRef.current === contract.id && j?.success) {
          setScheduleData({ schedule: j.schedule, nextDueNo: j.nextDueNo, nextDueState: j.nextDueState, nextDueReason: j.nextDueReason })
        }
      })
      .catch(() => {})
      .finally(() => { if (scheduleReqRef.current === contract.id) setScheduleLoading(false) })
    try {
      const full = await getContractDetail(contract.id)
      if (full) setSelectedContract(full)
    } catch { /* keep the list-row data */ }
    try {
      const invs = await getContractInvoices(contract.id)
      setContractInvoices(invs)
    } catch { setContractInvoices([]) }
  }, [])

  // Deep-link: filter-status lands the list pre-filtered; a contract internalId opens
  // its detail dialog (dashboard passes pendingFocus — preserve that behavior).
  useEffect(() => {
    if (!pendingFocus || pendingFocus.section !== 'contracts') return
    if (pendingFocus.contentType === 'filter-status') {
      setSearchInput('')
      setSearch('')
      setFrequencyFilter('all')
      setQuickFilter(null)
      setQuickFilterData(null)
      setStatusFilter(pendingFocus.key || 'all')
      setPendingFocus(null)
      return
    }
    if (pendingFocus.contentType === 'upcoming-report') {
      comingSoon()
      setPendingFocus(null)
      return
    }
    if (contracts.length === 0) return
    const match = contracts.find((c) => String(c.internalId) === pendingFocus.key)
    if (match) {
      handleViewContract(match)
      setPendingFocus(null)
    }
  }, [pendingFocus, contracts, setPendingFocus, comingSoon, handleViewContract])

  // Load the property lifecycle whenever the detail dialog is open for a linked contract.
  useEffect(() => {
    const propertyId = selectedContract?.rentalPropertyId
    if (!detailOpen || !propertyId) {
      setLifecycleContracts([])
      return
    }
    let cancelled = false
    setLifecycleLoading(true)
    getContractsForProperty(propertyId)
      .then((d) => { if (!cancelled) setLifecycleContracts(d) })
      .catch(() => { if (!cancelled) setLifecycleContracts([]) })
      .finally(() => { if (!cancelled) setLifecycleLoading(false) })
    return () => { cancelled = true }
  }, [detailOpen, selectedContract?.rentalPropertyId])

  const handleQuickFilter = async (filter: string | null) => {
    if (quickFilter === filter) {
      setQuickFilter(null)
      setQuickFilterData(null)
      return
    }
    setQuickFilter(filter)
    setQuickFilterData(null)
    if (!filter) return

    setQuickFilterLoading(true)
    try {
      const now = new Date()
      const currentYear = now.getFullYear()
      let months: number[]
      if (filter === 'month11') months = [10]
      else if (filter === 'month12') months = [11]
      else months = Array.from({ length: 12 }, (_, i) => i)

      const filtered = contracts.filter((c) => {
        const start = new Date(c.startDate || '')
        const end = new Date(c.endDate)
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return false
        return months.some((m) => {
          const monthStart = new Date(currentYear, m, 1)
          const monthEnd = new Date(currentYear, m + 1, 0, 23, 59, 59)
          return start <= monthEnd && end >= monthStart
        })
      })
      const enriched = filtered.map((c) => {
        let paymentStatus: 'paid' | 'unpaid' | 'partial' | 'unknown' = 'unknown'
        if (c.hasOutstanding !== undefined) paymentStatus = c.hasOutstanding ? 'unpaid' : 'paid'
        return { contract: c, paymentStatus }
      })
      setQuickFilterData(enriched)
    } catch {
      toast.error('فشل في تحميل بيانات الدفع')
    } finally {
      setQuickFilterLoading(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="contracts-print-root space-y-4 p-4 md:p-6" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: `
@media print {
  body * { visibility: hidden; }
  #printable-contracts, #printable-contracts * { visibility: visible; }
  #printable-contracts { position: absolute; left: 0; top: 0; width: 100%; padding: 0; display: block; }
  .contracts-print-root > *:not(#printable-contracts) { display: none !important; }
  header, nav, aside, .no-print { display: none !important; }
  #printable-contracts thead { display: table-header-group; }
  #printable-contracts tr { page-break-inside: avoid; }
}
`}} />

      {/* ---- Page Title & Header ---- */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-gradient-to-r from-emerald-50/50 to-transparent dark:from-emerald-950/20 dark:border-emerald-800/30 p-6 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/40">
        <div>
          <div className="flex items-center gap-3"><CompanyHeaderLogo className="h-11" /><h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">{ended ? 'أرشيف العقود' : 'إدارة العقود'}</h1></div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 font-medium">
            {ended ? 'العقود المُلغاة أو التي خرج مستأجرها أو استُبدلت بعقد جديد أو نُقلت يدوياً' : 'تتبع وإدارة عقود الإيجار والتجديدات'}
          </p>
        </div>

        <Button
          onClick={() => setCurrentSection('dashboard')}
          variant="outline"
          className="gap-2 font-semibold whitespace-nowrap"
        >
          الرئيسية
        </Button>
        {!ended && (
        <Button
          onClick={openCreateContract}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 gap-2 font-semibold whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          إضافة عقد
        </Button>
        )}
        <Button
          onClick={comingSoon}
          variant="outline"
          className="gap-2 font-semibold whitespace-nowrap border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400"
          title="ربط العقود غير المرتبطة بعقاراتها"
        >
          <Building2 className="h-4 w-4" />
          ربط العقود بالعقارات
        </Button>
        <Button
          onClick={() => window.print()}
          variant="outline"
          className="gap-2 font-semibold whitespace-nowrap"
          title="طباعة قائمة العقود المعروضة"
        >
          <Printer className="h-4 w-4" />
          طباعة
        </Button>
      </div>

      {/* Printable contracts report — hidden on screen, shown only when printing. */}
      <div id="printable-contracts" className="hidden print:block" dir="rtl">
        {(() => {
          const rows = quickFilter && quickFilterData ? quickFilterData.map((d) => d.contract) : contracts
          const total = rows.reduce((s, c) => s + (c.rentAmount || 0), 0)
          const statusLabelAr = statusFilter !== 'all' ? ContractStatusLabels[statusFilter]?.ar : null
          return (
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  <th colSpan={11} className="border-b-2 border-slate-800 pb-3 pt-0 font-normal">
                    <h2 className="text-xl font-bold text-center">مختصر العقود{statusLabelAr ? ` — ${statusLabelAr}` : ''}</h2>
                    <p className="text-sm text-slate-500 text-center mt-1">
                      تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')} | عدد العقود: {rows.length} | إجمالي الإيجارات: {formatSAR(total)}
                    </p>
                  </th>
                </tr>
                <tr className="bg-slate-100">
                  <th className="text-right p-2 border-b font-bold">#</th>
                  <th className="text-right p-2 border-b font-bold">الاسم</th>
                  <th className="text-right p-2 border-b font-bold">المدينة</th>
                  <th className="text-right p-2 border-b font-bold">رقم العقد</th>
                  <th className="text-right p-2 border-b font-bold">رقم المنصة</th>
                  <th className="text-right p-2 border-b font-bold">الرقم الداخلي</th>
                  <th className="text-right p-2 border-b font-bold">الجوال</th>
                  <th className="text-right p-2 border-b font-bold">البداية</th>
                  <th className="text-right p-2 border-b font-bold">النهاية</th>
                  <th className="text-right p-2 border-b font-bold">الإيجار</th>
                  <th className="text-right p-2 border-b font-bold">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c, i) => (
                  <tr key={c.id} className="border-b border-slate-200">
                    <td className="p-2 text-xs">{i + 1}</td>
                    <td className="p-2">{c.tenantName || '—'}</td>
                    <td className="p-2 text-xs">{c.propertyCity || '—'}</td>
                    <td className="p-2 font-mono text-xs" dir="ltr">{c.contractNumber}</td>
                    <td className="p-2 font-mono text-xs" dir="ltr">{c.platformContractNumber || '—'}</td>
                    <td className="p-2 font-mono text-xs" dir="ltr">{c.internalId || '—'}</td>
                    <td className="p-2 text-xs" dir="ltr">{c.tenantPhone || '—'}</td>
                    <td className="p-2 text-xs">{formatDate(c.startDate)}</td>
                    <td className="p-2 text-xs">{formatDate(c.endDate)}</td>
                    <td className="p-2 text-xs font-bold">{formatSAR(c.rentAmount)}</td>
                    <td className="p-2 text-xs">{ContractStatusLabels[c.status]?.ar || c.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        })()}
      </div>

      {/* ---- Filters Bar ---- */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center bg-white dark:bg-slate-900/60 dark:border-slate-800/80 p-4 rounded-xl border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pr-9 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
            <SelectValue placeholder="جميع الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            {Object.values(ContractStatus).map((status) => (
              <SelectItem key={status} value={status}>
                {ContractStatusLabels[status].ar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
          <SelectTrigger className="w-full sm:w-[160px] bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800">
            <SelectValue placeholder="جميع الدفعات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الدفعات</SelectItem>
            <SelectItem value="monthly">شهري (12)</SelectItem>
            <SelectItem value="quarterly">ربع سنوي (4)</SelectItem>
            <SelectItem value="semi_annual">نصف سنوي (2)</SelectItem>
            <SelectItem value="annual">سنوي (1)</SelectItem>
          </SelectContent>
        </Select>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-auto gap-2 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            >
              <CalendarClock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              جميع الدفعات القادمة
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={comingSoon}>
              <Eye className="h-4 w-4 ml-2" /> مشاهدة
            </DropdownMenuItem>
            <DropdownMenuItem onClick={comingSoon}>
              <Printer className="h-4 w-4 ml-2" /> طباعة
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ---- Quick Filters ---- */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-600 ml-2">عرض سريع:</span>
        {[
          { key: 'month11', label: 'إيجارات شهر 11' },
          { key: 'month12', label: 'إيجارات شهر 12' },
          { key: 'year', label: 'إيجارات السنة' },
        ].map(({ key, label }) => (
          <Button
            key={key}
            variant={quickFilter === key ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleQuickFilter(key)}
            className={quickFilter === key ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
          >
            {label}
          </Button>
        ))}
        {quickFilter && (
          <Button variant="ghost" size="sm" onClick={() => handleQuickFilter(null)} className="text-muted-foreground">
            ✕ مسح
          </Button>
        )}
      </div>

      {/* ---- Simplified Table (Quick Filter Active) ---- */}
      {quickFilter && quickFilterData !== null && (
        <Card className="border-emerald-200 shadow-[0_4px_20px_rgba(16,185,129,0.08)] overflow-hidden rounded-xl border-2">
          <CardContent className="p-0">
            {quickFilterLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="mr-3 text-muted-foreground">جاري تحميل حالات الدفع...</span>
              </div>
            ) : quickFilterData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="mb-3 h-12 w-12" />
                <p>لا توجد عقود تطابق الفلتر</p>
              </div>
            ) : (
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right whitespace-nowrap">رقم العقد</TableHead>
                      <TableHead className="text-right whitespace-nowrap">رقم منصة العقار</TableHead>
                      <TableHead className="text-right whitespace-nowrap">مبلغ الإيجار</TableHead>
                      <TableHead className="text-right whitespace-nowrap">مدة الإيجار</TableHead>
                      <TableHead className="text-right whitespace-nowrap">حالة الدفع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quickFilterData.map(({ contract, paymentStatus }) => (
                      <TableRow key={contract.id}>
                        <TableCell className="font-medium">
                          {contract.ejarContractNumber || contract.contractNumber}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {contract.platformContractNumber || '—'}
                        </TableCell>
                        <TableCell className="font-bold">{formatSAR(contract.rentAmount)}</TableCell>
                        <TableCell className="text-xs">
                          {formatDate(contract.startDate)} — {formatDate(contract.endDate)}
                        </TableCell>
                        <TableCell>
                          {paymentStatus === 'paid' ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800">مدفوع — لا مستحقات</Badge>
                          ) : paymentStatus === 'partial' ? (
                            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800">مدفوع جزئياً</Badge>
                          ) : paymentStatus === 'unpaid' ? (
                            <Badge
                              className="bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                              title={contract.overdueInstallmentNos?.length ? contract.overdueInstallmentNos.map((n) => installmentLabelAr(n)).join('، ') : undefined}
                            >
                              عليه مستحقات{contract.outstandingTotal ? `: ${formatSAR(contract.outstandingTotal)}` : ''}
                              {(contract.overdueInstallmentNos?.length ?? 0) > 0 &&
                                ` — ${installmentLabelAr(contract.overdueInstallmentNos![0])}${contract.overdueInstallmentNos!.length > 1 ? ` +${contract.overdueInstallmentNos!.length - 1}` : ''}`}
                            </Badge>
                          ) : (
                            <Badge variant="outline">غير محدد</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---- Full Contracts Table (no quick filter) ---- */}
      {!quickFilter && (
      <Card className="border-slate-100 dark:border-slate-800/80 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.04)] overflow-hidden rounded-xl bg-white dark:bg-slate-900/60">
        <CardContent className="p-0">
          {!loading && contracts.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-slate-100 px-4 py-2 text-[10px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <span className="font-semibold text-slate-600 dark:text-slate-300">دليل الألوان:</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> منتهٍ / خرج</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-500" /> قارب الانتهاء</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> ساري</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> عليه مستحقات (إجمالي المتأخرات مع اسم القسط المتأخر — اضغط لإصدار فاتورة)</span>
              <span className="inline-flex items-center gap-1"><span className="font-bold text-orange-600 dark:text-orange-400">★</span> القسط القادم — كهرماني إذا حان موعده، اضغط عليه لإصدار فاتورته</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 ring-1 ring-blue-200 dark:bg-blue-400 dark:ring-blue-900" /><span className="inline-block h-[3px] w-5 rounded-full bg-blue-500/70 dark:bg-blue-400/60" /> عقد ساري عليه دفعة قادمة (نقطة زرقاء + حافة زرقاء)</span>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <span className="mr-3 text-muted-foreground">جاري تحميل العقود...</span>
            </div>
          ) : contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <FileText className="mb-3 h-12 w-12" />
              <p>لا توجد عقود</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full caption-bottom text-sm">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-slate-50 dark:bg-slate-900">
                    <TableHead className="text-right whitespace-nowrap">الرقم الداخلي</TableHead>
                    <TableHead className="text-right whitespace-nowrap">رقم عقد المنصة</TableHead>
                    <TableHead className="text-right whitespace-nowrap">العقار</TableHead>
                    <TableHead className="text-right whitespace-nowrap">المستأجر</TableHead>
                    <TableHead className="text-right whitespace-nowrap">تاريخ البداية</TableHead>
                    <TableHead className="text-right whitespace-nowrap">تاريخ النهاية</TableHead>
                    <TableHead className="text-right whitespace-nowrap">القسط القادم</TableHead>
                    <TableHead className="text-right whitespace-nowrap">الحالة</TableHead>
                    <TableHead className="text-right whitespace-nowrap">الإيجار السنوي</TableHead>
                    <TableHead className="text-right whitespace-nowrap">الدفعات</TableHead>
                    <TableHead className="text-right whitespace-nowrap">متبقي</TableHead>
                    <TableHead className="text-right whitespace-nowrap">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contracts.map((contract) => {
                    const alert = getContractAlertColor(contract.status, contract.endDate)
                    const hasUpcomingPayment =
                      !!contract.nextPaymentDate && (contract.status === 'active' || contract.status === 'pending_renewal')
                    const upcomingPaymentEdge = hasUpcomingPayment
                      ? ' shadow-[inset_0_-3px_0_0_rgba(59,130,246,0.75)] dark:shadow-[inset_0_-3px_0_0_rgba(96,165,250,0.65)]'
                      : ''
                    return (
                      <TableRow key={contract.id} className={`${alert.row}${upcomingPaymentEdge}`}>
                        <TableCell className="font-medium text-center">
                          <button
                            onClick={() => {
                              if (contract.rentalPropertyId) {
                                setPendingFocus({ section: 'properties', contentType: 'property', key: contract.rentalPropertyId })
                                setCurrentSection('properties')
                              } else {
                                handleViewContract(contract)
                              }
                            }}
                            className={contract.rentalPropertyId
                              ? 'font-bold text-blue-600 dark:text-blue-400 underline-offset-2 hover:underline cursor-pointer'
                              : `${alert.link} underline-offset-2 hover:underline`}
                            title={contract.rentalPropertyId ? 'فتح بيانات العقار المرتبط' : 'كشف حساب العقد — الرقم الآلي'}
                          >
                            {contract.internalId || '—'}
                          </button>
                        </TableCell>
                        <TableCell className="font-bold">
                          <button onClick={() => handleViewContract(contract)} className={`text-right ${alert.link}`} title="فتح تفاصيل العقد">
                            {contract.platformContractNumber || '—'}
                          </button>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{contract.notes || contract.propertyTitle || contract.rentalPropertyId}</TableCell>
                        <TableCell className="max-w-[180px]">
                          <button onClick={() => handleViewContract(contract)} className={`block max-w-full truncate text-right ${alert.link}`} title="فتح تفاصيل العقد">
                            {contract.tenantName || contract.tenantId}
                          </button>
                        </TableCell>
                        <TableCell>{formatDate(contract.startDate)}</TableCell>
                        <TableCell>{formatDate(contract.endDate)}</TableCell>
                        <TableCell>
                          {contract.nextPaymentDate ? (
                            <button
                              type="button"
                              onClick={comingSoon}
                              className={`flex flex-wrap items-center gap-x-1.5 text-right leading-tight underline-offset-2 hover:underline ${
                                contract.nextDueState === 'due'
                                  ? 'text-amber-700 dark:text-amber-300'
                                  : 'text-orange-700 dark:text-orange-300'
                              }`}
                              title={`${contract.nextDueNo ? installmentLabelAr(contract.nextDueNo) + ' — ' : ''}${contract.nextDueState === 'due'
                                ? 'القسط القادم للإصدار — حان موعده (قيمة قسط واحد فقط، وليست إجمالي المتأخرات). اضغط لإصدار فاتورته'
                                : 'القسط القادم للإصدار — لم يحن موعده بعد (قيمة قسط واحد). اضغط لإصدار فاتورته'}`}
                            >
                              <span className="whitespace-nowrap">
                                {contract.nextDueState !== 'due' && '★ '}
                                {formatDate(contract.nextPaymentDate)}
                              </span>
                              <span className="whitespace-nowrap font-semibold">
                                {formatSAR(contract.nextPaymentAmount || 0)}
                              </span>
                            </button>
                          ) : (
                            <span className="text-muted-foreground" title="تم إصدار فاتورة لكل الأقساط — لا يوجد قسط قادم">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className={`w-3 h-3 rounded-full inline-block shrink-0 ${alert.circle}`} />
                            <Badge className={`${alert.badge} hidden sm:inline-flex`}>
                              {ContractStatusLabels[contract.status].ar}
                            </Badge>
                            <span className="sm:hidden text-xs font-semibold">
                              {ContractStatusLabels[contract.status].ar}
                            </span>
                            {hasUpcomingPayment && (
                              <span
                                title={`عقد ساري وعليه دفعة قادمة${contract.nextPaymentDate ? ` — ${formatDate(contract.nextPaymentDate)}` : ''}`}
                                className="inline-flex shrink-0 items-center gap-1"
                              >
                                <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-blue-200 dark:bg-blue-400 dark:ring-blue-900" />
                                <span className="hidden sm:inline text-[11px] font-semibold text-blue-700 dark:text-blue-300">قادمة</span>
                              </span>
                            )}
                            {contract.hasOutstanding && (
                              <button
                                type="button"
                                onClick={comingSoon}
                                title={`إجمالي المتأخرات غير المحصَّلة${contract.overdueInstallmentNos?.length ? ` — ${contract.overdueInstallmentNos.map((n) => installmentLabelAr(n)).join('، ')}` : ' (مجموع أقساط فات موعدها)'} — يختلف عن القسط القادم. اضغط لإصدار فاتورة`}
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 transition-colors hover:border-amber-400 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25"
                              >
                                <Coins className="h-3 w-3 shrink-0" />
                                عليه: {formatSAR(contract.outstandingTotal || 0)}
                                {(contract.overdueInstallmentNos?.length ?? 0) > 0 && (
                                  <span className="font-extrabold text-red-700 dark:text-red-300">
                                    · {installmentLabelAr(contract.overdueInstallmentNos![0])}
                                    {contract.overdueInstallmentNos!.length > 1 && ` +${contract.overdueInstallmentNos!.length - 1}`}
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatSAR(contract.rentAmount)}</TableCell>
                        <TableCell>
                          {contract.installmentsPerYear === 12 ? 'شهري' :
                           contract.installmentsPerYear === 4 ? 'ربع سنوي' :
                           contract.installmentsPerYear === 2 ? 'نصف سنوي' :
                           contract.installmentsPerYear === 1 ? 'سنوي' :
                           `${contract.installmentsPerYear} دفعة`}
                        </TableCell>
                        <TableCell>
                          <span className={getDaysUntilExpiryClasses(contract.daysUntilExpiry)}>
                            {contract.daysUntilExpiry !== undefined
                              ? contract.daysUntilExpiry <= 0
                                ? 'منتهي'
                                : `${contract.daysUntilExpiry} يوم`
                              : '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="إجراءات">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <DropdownMenuItem onClick={() => handleViewContract(contract)}>
                                <Eye className="h-4 w-4 ml-2" /> عرض
                              </DropdownMenuItem>
                              {contract.internalId ? (
                                <DropdownMenuItem onClick={comingSoon}>
                                  <FileText className="h-4 w-4 ml-2" /> كشف حساب مرجعي
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuItem onClick={() => openEditContract(contract)}>
                                <Pencil className="h-4 w-4 ml-2" /> تعديل العقد
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={comingSoon}>
                                <Receipt className="h-4 w-4 ml-2" /> إصدار فاتورة
                              </DropdownMenuItem>
                              {(contract.status === 'active' || contract.status === 'expired' || contract.status === 'pending_renewal') && (
                                <DropdownMenuItem onClick={() => openRenewDialog(contract)}>
                                  <RefreshCw className="h-4 w-4 ml-2" /> تجديد
                                </DropdownMenuItem>
                              )}
                              {contract.status === 'active' && (
                                <DropdownMenuItem onClick={() => openTerminateDialog(contract)} className="text-red-600 focus:text-red-600">
                                  <XCircle className="h-4 w-4 ml-2" /> إنهاء
                                </DropdownMenuItem>
                              )}
                              {!ended && contract.status === 'active' && (
                                <DropdownMenuItem onClick={() => openChangeTenantDialog(contract)}>
                                  <UserCog className="h-4 w-4 ml-2" /> تغيير المستأجر
                                </DropdownMenuItem>
                              )}
                              {(contract.status === 'active' || contract.status === 'expired' || contract.status === 'pending_renewal') && (
                                <DropdownMenuItem onClick={() => openMoveOutDialog(contract)} className="text-red-600 focus:text-red-600">
                                  <LogOut className="h-4 w-4 ml-2" /> تعليم كـ «خرج»
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={comingSoon}>
                                <FileText className="h-4 w-4 ml-2" /> تنزيل PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={comingSoon}>
                                <Printer className="h-4 w-4 ml-2" /> طباعة
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={comingSoon}>
                                <MessageCircle className="h-4 w-4 ml-2" /> إرسال على واتساب
                              </DropdownMenuItem>
                              {ended ? (
                                <DropdownMenuItem onClick={() => setArchiveState(contract, 'active')} disabled={archivingId === contract.id} className="text-emerald-600 focus:text-emerald-600">
                                  <ArchiveRestore className="h-4 w-4 ml-2" /> استعادة إلى النشطة
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setArchiveState(contract, 'archived')} disabled={archivingId === contract.id}>
                                  <Archive className="h-4 w-4 ml-2" /> نقل إلى أرشيف العقود
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDeleteTarget(contract)} className="text-red-600 focus:text-red-600">
                                <Trash2 className="h-4 w-4 ml-2" /> حذف العقد
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* ---- Contract Detail Dialog ---- */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col overflow-hidden p-0">
          {selectedContract && (
            <>
              <div className="shrink-0 px-6 pt-6">
                <DialogHeader className="p-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <DialogTitle className="text-lg">
                          العقد رقم {selectedContract.contractNumber}
                        </DialogTitle>
                        <Badge variant={getStatusBadgeVariant(selectedContract.status)}>
                          {ContractStatusLabels[selectedContract.status].ar}
                        </Badge>
                        <Badge variant="teal" className="ml-1">
                          {ContractTypeLabels[selectedContract.contractType as ContractTypeValue]?.ar || selectedContract.contractType}
                        </Badge>
                        {selectedContract.ejarContractNumber && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200 cursor-pointer">
                            إيجار ({selectedContract.ejarContractNumber})
                          </Badge>
                        )}
                        {selectedContract.prepaidSettled && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200" title={selectedContract.prepaidNote || undefined}>
                            مسدد مسبقاً
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 text-right">
                        معاينة العقد — راجِع البيانات ثم اطبع العقد أو أرسله{' · '}
                        <span className="inline-block whitespace-nowrap">الرقم الداخلي: <span className="font-mono font-medium text-foreground">{selectedContract.internalId || '—'}</span></span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!selectedContract.rentalPropertyId && (
                        <Button variant="outline" size="sm" onClick={comingSoon} className="text-emerald-600" title="ربط هذا العقد بعقار من قائمة العقارات">
                          <Link2 className="h-4 w-4 ml-1" />
                          ربط عقار
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={comingSoon} className="text-blue-600">
                        <Printer className="h-4 w-4 ml-1" />
                        طباعة
                      </Button>
                      <Button variant="outline" size="sm" onClick={comingSoon} className="text-green-600">
                        <MessageCircle className="h-4 w-4 ml-1" />
                        واتساب
                      </Button>
                      <Button variant="outline" size="sm" onClick={comingSoon} className={selectedContract.prepaidSettled ? 'text-amber-700 border-amber-300' : 'text-amber-600'} title="تعليم العقد كـ «مسدد مسبقاً»">
                        <Wallet className="h-4 w-4 ml-1" />
                        {selectedContract.prepaidSettled ? 'مسدد مسبقاً ✓' : 'مسدد مسبقاً؟'}
                      </Button>
                    </div>
                  </div>
                  <DialogDescription>تفاصيل عقد الإيجار</DialogDescription>
                </DialogHeader>
              </div>

              {/* Scrollable detail body */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-4">
                <div className="space-y-5">
                  {/* Property Section */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">بيانات العقار</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">العقار:</span>
                        <span className="font-medium">
                          {selectedContract.propertyTitle || PropertyTypeLabels[selectedContract.propertyType as PropertyTypeValue]?.ar || '—'}
                          {selectedContract.otherPropertyType ? ` (${selectedContract.otherPropertyType})` : ''}
                        </span>
                      </div>
                      {(selectedContract.rentalProperty?.deedNumber || selectedContract.rentalProperty?.deedDate) && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">رقم الصك:</span>
                            <span className="font-medium" dir="ltr">{selectedContract.rentalProperty?.deedNumber || '—'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">تاريخ الصك:</span>
                            <span className="font-medium">{selectedContract.rentalProperty?.deedDate ? formatDate(selectedContract.rentalProperty.deedDate as string) : '—'}</span>
                          </div>
                        </>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">المدينة:</span>
                        <span className="font-medium">{selectedContract.propertyCity || selectedContract.rentalProperty?.city || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الحي:</span>
                        <span className="font-medium">{selectedContract.propertyDistrict || selectedContract.rentalProperty?.district || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الشارع:</span>
                        <span className="font-medium">{selectedContract.propertyStreet || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">رقم المبنى:</span>
                        <span className="font-medium">{selectedContract.propertyBuildingNumber || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الرمز البريدي:</span>
                        <span className="font-medium">{selectedContract.propertyPostalCode || '—'}</span>
                      </div>
                      {Array.isArray(selectedContract.contractUnits) && selectedContract.contractUnits.length > 0 ? (
                        <div className="pt-2 border-t">
                          <p className="text-muted-foreground mb-1">
                            الوحدات ({selectedContract.contractUnits.length}):
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedContract.contractUnits.map((cu: { id: string; unit: { unitNumber: string; floor: number | null } }) => (
                              <span key={cu.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 text-xs font-medium">
                                <Building2 className="h-3 w-3" />
                                وحدة {cu.unit.unitNumber}
                                {cu.unit.floor != null ? ` · الطابق ${cu.unit.floor}` : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>

                  {/* حركة العقار بين العقود */}
                  {selectedContract.rentalPropertyId && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">حركة العقار بين العقود</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {lifecycleLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> جاري تحميل السجل…
                          </div>
                        ) : (
                          <ContractLifecycleTimeline
                            contracts={lifecycleContracts}
                            onViewContract={(c) => {
                              if (c.id === selectedContract.id) return
                              handleViewContract({ id: c.id, rentalPropertyId: selectedContract.rentalPropertyId } as RentalContract)
                            }}
                          />
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Lessor Section */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">بيانات المؤجر</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الاسم:</span>
                        <span className="font-medium">{selectedContract.lessorName || selectedContract.rentalProperty?.owner?.name || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">رقم الهوية:</span>
                        <span className="font-medium" dir="ltr">{selectedContract.lessorNationalId || selectedContract.rentalProperty?.owner?.nationalId || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الهاتف:</span>
                        <span className="font-medium" dir="ltr">{selectedContract.lessorPhone || selectedContract.rentalProperty?.owner?.phone || '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">العنوان:</span>
                        <span className="font-medium">{selectedContract.lessorAddress || selectedContract.rentalProperty?.owner?.address || '—'}</span>
                      </div>
                      {selectedContract.lessorNationalAddress && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">العنوان الوطني:</span>
                          <span className="font-medium" dir="ltr">{selectedContract.lessorNationalAddress}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Tenant Section */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">بيانات المستأجر</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      {(() => {
                        const rows = scheduleData?.schedule
                        if (!rows?.length) return null
                        const late = rows.filter((r) => r.state === 'overdue' || r.state === 'invoiced_overdue' || (r.state === 'next' && scheduleData?.nextDueState === 'due'))
                        if (!late.length) return null
                        const oldest = late.reduce((min, r) => (r.dueDateAD && r.dueDateAD < min ? r.dueDateAD : min), late[0].dueDateAD)
                        const days = daysSince(oldest)
                        if (days == null || days <= 0) return null
                        return (
                          <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs dark:border-red-900/60 dark:bg-red-950/30">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
                            <span className="font-bold text-red-700 dark:text-red-300">يتأخر في السداد</span>
                            <span className="font-semibold text-red-600 dark:text-red-400">— تأخر {formatDurationAr(days)}</span>
                            <span className="text-red-600/80 dark:text-red-400/80">({late.map((r) => installmentLabelAr(r.installmentNo)).join('، ')})</span>
                          </div>
                        )
                      })()}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الاسم:</span>
                        <span className="font-medium">{selectedContract.tenantName || selectedContract.tenant?.name || '—'}</span>
                      </div>
                      {(selectedContract.tenantNationalId || selectedContract.tenant?.nationalId) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">رقم الهوية:</span>
                          <span className="font-medium" dir="ltr">{selectedContract.tenantNationalId || selectedContract.tenant?.nationalId || '—'}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الهاتف:</span>
                        <span className="font-medium" dir="ltr">{selectedContract.tenantPhone || selectedContract.tenant?.phone || '—'}</span>
                      </div>
                      {selectedContract.tenantEmail && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">البريد الإلكتروني:</span>
                          <span className="font-medium" dir="ltr">{selectedContract.tenantEmail}</span>
                        </div>
                      )}
                      {(selectedContract.tenantCompanyName || selectedContract.tenant?.companyName) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">المنشأة:</span>
                          <span className="font-medium">{selectedContract.tenantCompanyName || selectedContract.tenant?.companyName || '—'}</span>
                        </div>
                      )}
                      {(selectedContract.tenantCrNumber || selectedContract.tenant?.crNumber) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">السجل التجاري:</span>
                          <span className="font-medium" dir="ltr">{selectedContract.tenantCrNumber || selectedContract.tenant?.crNumber || '—'}</span>
                        </div>
                      )}
                      {(selectedContract.tenantUnifiedNumber || selectedContract.tenant?.unifiedNumber) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">الرقم الموحد:</span>
                          <span className="font-medium" dir="ltr">{selectedContract.tenantUnifiedNumber || selectedContract.tenant?.unifiedNumber || '—'}</span>
                        </div>
                      )}
                      {(selectedContract.tenantNationalAddress || selectedContract.tenant?.address) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">العنوان الوطني:</span>
                          <span className="font-medium" dir="ltr">{selectedContract.tenantNationalAddress || selectedContract.tenant?.address || '—'}</span>
                        </div>
                      )}
                      {selectedContract.tenantVatRegistrationNumber && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">الرقم الضريبي:</span>
                          <span className="font-medium font-mono" dir="ltr">{selectedContract.tenantVatRegistrationNumber}</span>
                        </div>
                      )}
                      {(selectedContract.tenantRepresentativeName || selectedContract.tenant?.representativeName) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">الممثل:</span>
                          <span className="font-medium">{selectedContract.tenantRepresentativeName || selectedContract.tenant?.representativeName || '—'}</span>
                        </div>
                      )}
                      {(selectedContract.tenantRepresentativeMobile || selectedContract.tenant?.representativeMobile) && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">جوال الممثل:</span>
                          <span className="font-medium" dir="ltr">{selectedContract.tenantRepresentativeMobile || selectedContract.tenant?.representativeMobile || '—'}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Financial Section */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">المعلومات المالية</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الإيجار السنوي:</span>
                        <span className="font-medium">{formatSAR(selectedContract.rentAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">قيمة القسط:</span>
                        <span className="font-medium">
                          {(selectedContract.installmentsPerYear ?? 0) > 0 ? formatSAR(Math.round(selectedContract.rentAmount / (selectedContract.installmentsPerYear as number))) : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">عدد الدفعات:</span>
                        <span className="font-medium">
                          {selectedContract.installmentsPerYear === 12 ? 'شهري (12)' :
                           selectedContract.installmentsPerYear === 4 ? 'ربع سنوي (4)' :
                           selectedContract.installmentsPerYear === 2 ? 'نصف سنوي (2)' :
                           selectedContract.installmentsPerYear === 1 ? 'سنوي (1)' :
                           `${selectedContract.installmentsPerYear} دفعة`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">نسبة الضريبة:</span>
                        <span className="font-medium">{(selectedContract.taxRate ?? 0) > 0 ? `${(selectedContract.taxRate as number).toFixed(0)}%` : '—'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">تاريخ البداية:</span>
                        <span className="font-medium">{formatDateDualCompact(selectedContract.startDate)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">تاريخ النهاية:</span>
                        <span className="font-medium">{formatDateDualCompact(selectedContract.endDate)}</span>
                      </div>
                      {selectedContract.nextPaymentDate !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">القسط القادم:</span>
                          {selectedContract.nextPaymentDate ? (
                            <span className={`font-medium ${selectedContract.nextDueState === 'due' ? 'text-amber-700 dark:text-amber-300' : 'text-orange-700 dark:text-orange-400'}`}>
                              {formatDateDualCompact(selectedContract.nextPaymentDate)} · {formatSAR(selectedContract.nextPaymentAmount || 0)}
                              {selectedContract.nextDueState === 'due' && <span className="mr-1 text-[11px]">(حان موعده)</span>}
                            </span>
                          ) : (
                            <span className="font-medium text-muted-foreground">مفوتر بالكامل — لا يوجد</span>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between border-t pt-2 mt-2">
                        <span className="text-muted-foreground font-semibold">الإجمالي:</span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">{selectedContract.totalContractValue ? formatSAR(selectedContract.totalContractValue) : '—'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Contract Info Section */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">بيانات العقد</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">نوع العقد:</span>
                        <span className="font-medium">{ContractTypeLabels[selectedContract.contractType as ContractTypeValue]?.ar || selectedContract.contractType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الأيام المتبقية:</span>
                        <span className={`font-medium ${getDaysUntilExpiryClasses(selectedContract.daysUntilExpiry)}`}>
                          {selectedContract.daysUntilExpiry !== undefined
                            ? selectedContract.daysUntilExpiry <= 0 ? 'منتهي' : `${selectedContract.daysUntilExpiry} يوم`
                            : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">التأمين:</span>
                        <span className="font-medium">{formatSAR(selectedContract.securityDeposit || 0)}</span>
                      </div>
                      {selectedContract.sealingLocation && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">مكان الإبرام:</span>
                          <span className="font-medium">{selectedContract.sealingLocation}</span>
                        </div>
                      )}
                      {selectedContract.sealingDate && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">تاريخ الإبرام:</span>
                          <span className="font-medium">{formatDateDualCompact(selectedContract.sealingDate)}</span>
                        </div>
                      )}
                      {selectedContract.vatNumber && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">الرقم الضريبي:</span>
                          <span className="font-medium font-mono" dir="ltr">{selectedContract.vatNumber}</span>
                        </div>
                      )}
                      {selectedContract.ejarContractNumber && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">رقم العقد في إيجار:</span>
                          <span className="font-medium font-mono" dir="ltr">{selectedContract.ejarContractNumber}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Installments — colored schedule (read-only) */}
                  {(scheduleLoading || (scheduleData?.schedule?.length ?? 0) > 0) && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">الأقساط — حالة السداد</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {scheduleLoading ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> جارٍ تحميل الأقساط…
                          </div>
                        ) : (
                          <>
                            <InstallmentLegend />
                            <InstallmentScheduleTable
                              schedule={scheduleData!.schedule}
                              nextDueNo={scheduleData!.nextDueNo}
                              nextDueState={scheduleData!.nextDueState}
                              nextDueReason={scheduleData!.nextDueReason}
                              canManagePaidPreviously={canEditContracts}
                            />
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Notes & Terms */}
                  {(selectedContract.notes || selectedContract.terms) && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">ملاحظات وشروط</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        {selectedContract.notes && (
                          <div>
                            <span className="text-muted-foreground">ملاحظات:</span>
                            <p className="mt-1 whitespace-pre-wrap">{selectedContract.notes}</p>
                          </div>
                        )}
                        {selectedContract.terms && (
                          <div>
                            <span className="text-muted-foreground">الشروط:</span>
                            <p className="mt-1 whitespace-pre-wrap">{selectedContract.terms}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {/* Payment history — the contract's VALID invoices */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">الدفعات — فواتير العقد ({contractInvoices.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {contractInvoices.length === 0 ? (
                        <p className="text-sm text-muted-foreground">لا توجد فواتير مُصدَرة لهذا العقد بعد</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-right">الفاتورة</TableHead>
                                <TableHead className="text-right">القسط</TableHead>
                                <TableHead className="text-right">المبلغ</TableHead>
                                <TableHead className="text-right">المحصَّل</TableHead>
                                <TableHead className="text-right">تاريخ الاستحقاق</TableHead>
                                <TableHead className="text-right">الحالة</TableHead>
                                <TableHead className="text-right">طريقة الدفع</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {contractInvoices.map((inv) => (
                                <TableRow key={inv.id}>
                                  <TableCell className="font-mono text-xs">{inv.invoiceNumber}</TableCell>
                                  <TableCell className="text-center">{inv.installmentNo}/{inv.totalInstallments}</TableCell>
                                  <TableCell>{formatSAR(inv.totalValue || 0)}</TableCell>
                                  <TableCell>{formatSAR(collectedAmount(inv))}</TableCell>
                                  <TableCell>{formatDate(inv.dueDate)}</TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${
                                        inv.status === 'paid'
                                          ? 'border-green-300 text-green-700 dark:border-green-800 dark:text-green-400'
                                          : inv.status === 'partial'
                                            ? 'border-yellow-300 text-yellow-700 dark:border-yellow-800 dark:text-yellow-400'
                                            : ''
                                      }`}
                                    >
                                      {InvoiceStatusLabels[inv.status as string]?.ar || inv.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    {inv.paymentMethod
                                      ? PaymentMethodLabels[inv.paymentMethod as string]?.ar || inv.paymentMethod
                                      : '—'}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="shrink-0 border-t px-6 py-4">
                <DialogFooter className="gap-2 sm:gap-0 p-0">
                  {ended ? (
                    <Button variant="outline" onClick={() => setArchiveState(selectedContract, 'active')} disabled={archivingId === selectedContract.id} className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950">
                      <ArchiveRestore className="ml-2 h-4 w-4" />
                      استعادة إلى النشطة
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setArchiveState(selectedContract, 'archived')} disabled={archivingId === selectedContract.id} className="border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                      <Archive className="ml-2 h-4 w-4" />
                      نقل إلى أرشيف العقود
                    </Button>
                  )}
                  {selectedContract.status === 'active' && (
                    <>
                      <Button variant="destructive" onClick={() => openTerminateDialog(selectedContract)}>
                        <XCircle className="ml-2 h-4 w-4" />
                        إنهاء العقد
                      </Button>
                      {!ended && (
                        <Button variant="outline" onClick={() => openChangeTenantDialog(selectedContract)} className="border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-400 dark:hover:bg-sky-950">
                          <UserCog className="ml-2 h-4 w-4" />
                          تغيير المستأجر
                        </Button>
                      )}
                      <Button variant="outline" onClick={() => openRenewDialog(selectedContract)} className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950">
                        <RefreshCw className="ml-2 h-4 w-4" />
                        تجديد العقد
                      </Button>
                    </>
                  )}
                  {(selectedContract.status === 'expired' || selectedContract.status === 'pending_renewal') && (
                    <Button variant="outline" onClick={() => openRenewDialog(selectedContract)} className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950">
                      <RefreshCw className="ml-2 h-4 w-4" />
                      تجديد العقد
                    </Button>
                  )}
                </DialogFooter>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Create / Edit Contract Dialog                                      */}
      {/* ================================================================== */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col overflow-hidden p-0">
          <div className="shrink-0 px-6 pt-6">
            <DialogHeader className="p-0">
              <DialogTitle>{editingContract ? 'تعديل العقد' : 'إضافة عقد جديد'}</DialogTitle>
              <DialogDescription>
                {editingContract ? 'عدّل بيانات العقد كاملةً ثم احفظ التعديلات' : 'أدخل جميع بيانات عقد الإيجار الجديد'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 space-y-6 pb-6">
            {/* الرقم الداخلي — auto on create (read-only), editable on edit */}
            <div className="space-y-2 p-4 rounded-lg border-2 border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <Label htmlFor="create-internal-id" className="text-emerald-800 dark:text-emerald-300 font-semibold">الرقم الداخلي</Label>
              <Input
                id="create-internal-id"
                inputMode="numeric"
                value={editingContract ? createForm.internalId : (nextInternalId !== null ? String(nextInternalId) : '...')}
                onChange={editingContract ? (e) => setCreateForm((prev) => ({ ...prev, internalId: e.target.value })) : undefined}
                readOnly={!editingContract}
                disabled={!editingContract}
                className={`bg-white dark:bg-slate-950 border-emerald-200 text-emerald-700 dark:text-emerald-300 font-bold text-lg font-mono${editingContract ? '' : ' cursor-not-allowed'}`}
                dir="ltr"
              />
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {editingContract ? 'يمكنك تعديله يدوياً ليطابق سجلاتك القديمة (خيار للمشرف).' : 'يتم توليده تلقائياً بالترتيب'}
              </p>
            </div>

            {/* رقم العقد (يدوي — مطلوب) */}
            <div className="space-y-2 p-4 rounded-lg border-2 border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <Label htmlFor="create-contract-number" className="text-emerald-800 dark:text-emerald-300 font-semibold">رقم العقد {editingContract ? '' : '*'}</Label>
              <Input
                id="create-contract-number"
                value={createForm.contractNumber}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, contractNumber: e.target.value }))}
                readOnly={!!editingContract}
                disabled={!!editingContract}
                className={`bg-white dark:bg-slate-950 border-emerald-200 focus-visible:ring-emerald-500${editingContract ? ' opacity-70 cursor-not-allowed' : ''}`}
                placeholder="أدخل رقم العقد كما هو لديك"
                dir="ltr"
              />
              <p className="text-xs text-emerald-600 dark:text-emerald-400">{editingContract ? 'رقم العقد ثابت ولا يمكن تعديله.' : 'أدخل رقم العقد الحقيقي ليطابق سجلاتك (مطلوب).'}</p>
            </div>

            {/* EDIT-ONLY: حالة العقد + مبلغ التأمين */}
            {editingContract && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg border-2 border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <div className="space-y-2">
                  <Label htmlFor="edit-status" className="text-indigo-800 dark:text-indigo-300 font-semibold">حالة العقد</Label>
                  <Select value={createForm.status || 'active'} onValueChange={(v) => setCreateForm((prev) => ({ ...prev, status: v }))}>
                    <SelectTrigger id="edit-status" className="w-full bg-white dark:bg-slate-950"><SelectValue placeholder="اختر الحالة" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ContractStatusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label.ar}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-security-deposit" className="text-indigo-800 dark:text-indigo-300 font-semibold">مبلغ التأمين</Label>
                  <Input id="edit-security-deposit" inputMode="numeric" value={createForm.securityDeposit} onChange={(e) => setCreateForm((prev) => ({ ...prev, securityDeposit: e.target.value }))} className="bg-white dark:bg-slate-950" dir="ltr" />
                </div>
              </div>
            )}

            {/* التقويم المُسجَّل به العقد */}
            <div className="space-y-2 p-4 rounded-lg border-2 border-sky-200 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/20">
              <Label htmlFor="create-registered-calendar" className="text-sky-800 dark:text-sky-300 font-semibold">التقويم المُسجَّل به العقد</Label>
              <Select value={createForm.registeredCalendar || 'auto'} onValueChange={(v) => setCreateForm((prev) => ({ ...prev, registeredCalendar: v === 'auto' ? '' : (v as 'hijri' | 'gregorian') }))}>
                <SelectTrigger id="create-registered-calendar" className="w-full bg-white dark:bg-slate-950 border-sky-200 focus-visible:ring-sky-500"><SelectValue placeholder="تلقائي (حسب إعداد العرض)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">تلقائي (حسب إعداد العرض)</SelectItem>
                  <SelectItem value="hijri">هجري</SelectItem>
                  <SelectItem value="gregorian">ميلادي</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-sky-600 dark:text-sky-400">يحدد التقويم الذي يظهر أولاً في فترة الفاتورة (من - إلى).</p>
            </div>

            {/* بيانات العقد */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-1 flex-1 bg-emerald-500 rounded-full" />
                <h3 className="text-base font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">بيانات العقد</h3>
                <div className="h-1 flex-1 bg-emerald-500 rounded-full" />
              </div>
              <Separator className="mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-sealing-date">تاريخ إبرام العقد</Label>
                  <DatePicker value={createForm.sealingDate} onChange={(date) => setCreateForm((prev) => ({ ...prev, sealingDate: date }))} showDualDate showCalendarToggle />
                  <p className="text-xs text-muted-foreground">اختياري</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-sealing-location">مكان إبرام العقد</Label>
                  <Input id="create-sealing-location" value={createForm.sealingLocation} onChange={(e) => setCreateForm((prev) => ({ ...prev, sealingLocation: e.target.value }))} />
                  <p className="text-xs text-muted-foreground">اختياري</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-start-date">تاريخ بداية الإيجار <span className="text-red-500">*</span></Label>
                  <DatePicker value={createForm.startDate} onChange={(date) => setCreateForm((prev) => ({ ...prev, startDate: date }))} showDualDate showCalendarToggle />
                  <p className="text-xs text-muted-foreground">تاريخ بداية العقد</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-end-date">تاريخ نهاية الإيجار <span className="text-red-500">*</span></Label>
                  <DatePicker value={createForm.endDate} onChange={(date) => setCreateForm((prev) => ({ ...prev, endDate: date }))} showDualDate showCalendarToggle />
                  <p className="text-xs text-muted-foreground">تاريخ نهاية العقد</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-rent">مبلغ الإيجار السنوي (ر.س) <span className="text-red-500">*</span></Label>
                  <Input id="create-rent" inputMode="numeric" value={createForm.rentAmount} onChange={(e) => setCreateForm((prev) => ({ ...prev, rentAmount: e.target.value }))} dir="ltr" />
                  <p className="text-xs text-muted-foreground">المبلغ الإجمالي للسنة الواحدة</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-installments">عدد الدفعات للسنة الواحدة <span className="text-red-500">*</span></Label>
                  <Select value={createForm.installmentsPerYear} onValueChange={(val) => setCreateForm((prev) => ({ ...prev, installmentsPerYear: val }))}>
                    <SelectTrigger id="create-installments" className="w-full"><SelectValue placeholder="اختر عدد الدفعات" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12">شهري (12 دفعة)</SelectItem>
                      <SelectItem value="4">ربع سنوي (4 دفعات)</SelectItem>
                      <SelectItem value="2">نصف سنوي (دفعتين)</SelectItem>
                      <SelectItem value="1">سنوي (دفعة واحدة)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">عدد الدفعات للسنة الواحدة فقط، وليس على الفترة كاملة</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-tax-rate">نسبة الضريبة (%)</Label>
                  <Input id="create-tax-rate" inputMode="numeric" value={createForm.taxRate} onChange={(e) => setCreateForm((prev) => ({ ...prev, taxRate: e.target.value }))} dir="ltr" />
                  <p className="text-xs text-muted-foreground">أدخل النسبة المئوية (مثال: 15)</p>
                </div>
              </div>
            </div>

            {/* العقار — property picker (existing Rental Property) */}
            <div>
              <h3 className="text-base font-semibold mb-3 text-emerald-700 dark:text-emerald-400">العقار</h3>
              <Separator className="mb-4" />
              {editingContract ? (
                <div className="p-3 rounded-lg border border-muted bg-muted/30 text-sm space-y-1">
                  <p className="font-medium text-foreground">العقار / الوحدة المؤجرة (غير قابلة للتعديل)</p>
                  <p className="text-muted-foreground">
                    {(editingContract as { propertyTitle?: string; rentalPropertyId?: string }).propertyTitle || (editingContract as { rentalPropertyId?: string }).rentalPropertyId || '—'}
                    {editUnits.length > 0 ? ` — ${editUnits.map((u) => `وحدة ${u.unitNumber}`).join('، ')}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">تغيير الوحدة المؤجرة يتم عبر عملية منفصلة.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="create-rental-property">ربط بعقار مسجل (اختياري)</Label>
                      <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs text-emerald-700 hover:text-emerald-800 dark:text-emerald-400" onClick={comingSoon}>
                        <Plus className="h-3.5 w-3.5" /> إضافة عقار جديد
                      </Button>
                    </div>
                    <Select value={createForm.rentalPropertyId || '__none__'} onValueChange={(v) => handlePropertySelect(v === '__none__' ? '' : v)}>
                      <SelectTrigger id="create-rental-property" className="w-full"><SelectValue placeholder="اختر عقاراً..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— بدون ربط —</SelectItem>
                        {availableProperties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.titleAr || p.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">عند الاختيار تُعبّأ بيانات العقار والمؤجر تلقائياً.</p>
                  </div>

                  {/* Multi-unit checkboxes — shown only once a property is selected */}
                  {createForm.rentalPropertyId && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>الوحدات (يمكن اختيار أكثر من وحدة)</Label>
                      {loadingUnits ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 border rounded-lg">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          جاري تحميل الوحدات...
                        </div>
                      ) : availableUnits.length === 0 ? (
                        <p className="text-sm text-muted-foreground p-3 border rounded-lg">لا توجد وحدات فارغة</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border rounded-lg max-h-48 overflow-y-auto">
                          {availableUnits.map((u) => (
                            <label key={u.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                className="accent-emerald-600"
                                checked={selectedUnitIds.includes(u.id)}
                                onChange={(e) => {
                                  setSelectedUnitIds((prev) => e.target.checked ? [...prev, u.id] : prev.filter((id) => id !== u.id))
                                }}
                              />
                              <span>وحدة {u.unitNumber}</span>
                              {u.floor != null && <span className="text-muted-foreground">(الطابق {u.floor})</span>}
                              {u.rentPrice ? (
                                <span className="text-emerald-600 font-medium mr-auto">{u.rentPrice.toLocaleString('ar-SA')} ﷼</span>
                              ) : null}
                            </label>
                          ))}
                        </div>
                      )}
                      {selectedUnitIds.length > 0 && (() => {
                        const total = availableUnits.filter((u) => selectedUnitIds.includes(u.id)).reduce((sum, u) => sum + (u.rentPrice || 0), 0)
                        return (
                          <div className="flex items-center gap-3 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-sm">
                            <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                            <span className="font-medium text-emerald-800 dark:text-emerald-300">
                              {selectedUnitIds.length} {selectedUnitIds.length === 1 ? 'وحدة محددة' : 'وحدات محددة'}
                            </span>
                            {total > 0 && (
                              <span className="text-emerald-700 dark:text-emerald-400">— إجمالي الإيجار: {total.toLocaleString('ar-SA')} ﷼</span>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Electric meter — captured at contract time, saved on the chosen unit */}
              {!editingContract && selectedUnitIds.length === 1 && (
                <div className="mt-3 space-y-1.5">
                  <Label htmlFor="create-electric-meter">رقم عداد الكهرباء</Label>
                  <Input
                    id="create-electric-meter"
                    placeholder="أدخل رقم عداد الكهرباء للوحدة"
                    value={createForm.electricMeter}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, electricMeter: e.target.value }))}
                    dir="ltr"
                  />
                  <p className="text-xs text-muted-foreground">رقم العداد يُسجَّل عند التأجير ويمكن تحديثه مع كل عقد جديد</p>
                </div>
              )}
            </div>

            {/* نوع العقار */}
            <div>
              <h3 className="text-base font-semibold mb-3 text-emerald-700 dark:text-emerald-400">نوع العقار</h3>
              <Separator className="mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-property-type">نوع العقار <span className="text-red-500">*</span></Label>
                  <Select value={createForm.propertyType} onValueChange={(val) => setCreateForm((prev) => ({ ...prev, propertyType: val, otherPropertyType: val === 'other' ? prev.otherPropertyType : '' }))}>
                    <SelectTrigger id="create-property-type" className="w-full"><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                    <SelectContent>
                      {Object.values(PropertyType).map((type) => (
                        <SelectItem key={type} value={type}>{PropertyTypeLabels[type]?.ar || type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {createForm.propertyType === 'other' && (
                  <div className="space-y-2">
                    <Label htmlFor="create-other-property-type">اكتب التصنيف <span className="text-red-500">*</span></Label>
                    <Input id="create-other-property-type" value={createForm.otherPropertyType} onChange={(e) => setCreateForm((prev) => ({ ...prev, otherPropertyType: e.target.value }))} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="create-property-location">مكان العقار</Label>
                  <Input id="create-property-location" value={createForm.propertyLocation} onChange={(e) => setCreateForm((prev) => ({ ...prev, propertyLocation: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* جدول الدفعات للسنة الواحدة */}
            {autoCalcContract.annualRent > 0 && (
              <div>
                <h3 className="text-base font-semibold mb-3 text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <Calculator className="h-4 w-4" /> جدول الدفعات للسنة الواحدة
                </h3>
                <Separator className="mb-4" />
                <p className="text-xs text-muted-foreground mb-3">
                  عدد الدفعات المختار حالياً: <span className="font-bold text-emerald-700 dark:text-emerald-400">{createForm.installmentsPerYear} دفعة</span>
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-emerald-50 dark:bg-emerald-950/40">
                        <TableHead className="text-right font-semibold">التكرار</TableHead>
                        <TableHead className="text-right font-semibold">عدد الدفعات</TableHead>
                        <TableHead className="text-right font-semibold">قيمة القسط (ر.س)</TableHead>
                        <TableHead className="text-right font-semibold">الضريبة السنوية ({createForm.taxRate || '0'}%)</TableHead>
                        <TableHead className="text-right font-semibold">الإجمالي السنوي (ر.س)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[{ label: 'شهري', count: 12 }, { label: '4 دفعات (ربع سنوي)', count: 4 }, { label: 'دفعتين (نصف سنوي)', count: 2 }, { label: 'دفعة واحدة (سنوي)', count: 1 }].map((row) => {
                        const installment = Math.round(autoCalcContract.annualRentWithTax / row.count)
                        const isSelected = Number(createForm.installmentsPerYear) === row.count
                        return (
                          <TableRow key={row.count} className={isSelected ? 'bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-l-emerald-500' : ''}>
                            <TableCell className="font-medium">{isSelected && <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 ml-2" />}{row.label}</TableCell>
                            <TableCell>{row.count}</TableCell>
                            <TableCell className="font-mono font-bold">{installment.toLocaleString('ar-SA')}</TableCell>
                            <TableCell className="font-mono">{autoCalcContract.taxAmount.toLocaleString('ar-SA')}</TableCell>
                            <TableCell className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{autoCalcContract.annualRentWithTax.toLocaleString('ar-SA')}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* بيانات المالك (المؤجر) */}
            <div>
              <h3 className="text-base font-semibold mb-3 text-emerald-700 dark:text-emerald-400">بيانات المالك</h3>
              {autoFilledFromProperty && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-400 mb-3">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0" /> تم تعبئة بيانات المؤجر تلقائياً من العقار المحدد
                </div>
              )}
              <Separator className="mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-lessor-name">اسم المالك <span className="text-red-500">*</span></Label>
                  <OwnerAutocompleteInput
                    field="name"
                    value={createForm.lessorName}
                    owners={owners}
                    onChange={(v) => setCreateForm((prev) => ({ ...prev, lessorName: v }))}
                    onPick={(o, f) => { setPickedOwner(o); setPickedField(f) }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-lessor-national-id">رقم الهوية <span className="text-red-500">*</span></Label>
                  <OwnerAutocompleteInput
                    field="nationalId"
                    value={createForm.lessorNationalId}
                    owners={owners}
                    onChange={(v) => setCreateForm((prev) => ({ ...prev, lessorNationalId: v }))}
                    onPick={(o, f) => { setPickedOwner(o); setPickedField(f) }}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-lessor-phone">رقم الجوال <span className="text-red-500">*</span></Label>
                  <OwnerAutocompleteInput
                    field="phone"
                    value={createForm.lessorPhone}
                    owners={owners}
                    onChange={(v) => setCreateForm((prev) => ({ ...prev, lessorPhone: v }))}
                    onPick={(o, f) => { setPickedOwner(o); setPickedField(f) }}
                    dir="ltr"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-lessor-vat">الرقم الضريبي</Label>
                  <Input id="create-lessor-vat" inputMode="numeric" value={createForm.lessorVatRegistrationNumber} onChange={(e) => setCreateForm((prev) => ({ ...prev, lessorVatRegistrationNumber: e.target.value }))} dir="ltr" />
                </div>
              </div>

              {/* Owner fill popup (lessor) — preview + «تعبئة كل البيانات» / field-only */}
              <OwnerFillDialog
                owner={pickedOwner}
                field={pickedField}
                onFillAll={fillAllLessor}
                onFieldOnly={fillLessorField}
                onCancel={() => { setPickedOwner(null); setPickedField(null) }}
              />
              <Separator className="my-4" />
              <p className="text-sm font-medium text-muted-foreground mb-3">العنوان الوطني</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2"><Label htmlFor="create-lessor-city">المدينة</Label><Input id="create-lessor-city" value={createForm.lessorCity} onChange={(e) => setCreateForm((prev) => ({ ...prev, lessorCity: e.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="create-lessor-district">الحي</Label><Input id="create-lessor-district" value={createForm.lessorDistrict} onChange={(e) => setCreateForm((prev) => ({ ...prev, lessorDistrict: e.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="create-lessor-street">الشارع</Label><Input id="create-lessor-street" value={createForm.lessorStreet} onChange={(e) => setCreateForm((prev) => ({ ...prev, lessorStreet: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label htmlFor="create-lessor-building">رقم المبنى</Label><Input id="create-lessor-building" inputMode="numeric" value={createForm.lessorBuildingNumber} onChange={(e) => setCreateForm((prev) => ({ ...prev, lessorBuildingNumber: e.target.value }))} dir="ltr" /></div>
                <div className="space-y-2"><Label htmlFor="create-lessor-postal">الرمز البريدي</Label><Input id="create-lessor-postal" inputMode="numeric" value={createForm.lessorPostalCode} onChange={(e) => setCreateForm((prev) => ({ ...prev, lessorPostalCode: e.target.value }))} dir="ltr" /></div>
                <div className="space-y-2"><Label htmlFor="create-lessor-additional">الرقم الإضافي</Label><Input id="create-lessor-additional" inputMode="numeric" value={createForm.lessorAdditionalNumber} onChange={(e) => setCreateForm((prev) => ({ ...prev, lessorAdditionalNumber: e.target.value }))} dir="ltr" /></div>
              </div>
            </div>

            {/* بيانات المستأجر */}
            <div>
              <h3 className="text-base font-semibold mb-3 text-emerald-700 dark:text-emerald-400">بيانات المستأجر</h3>
              <Separator className="mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="create-tenant-party-type">صفة الطرف <span className="text-red-500">*</span></Label>
                  <Select value={createForm.tenantPartyType || undefined} onValueChange={(v) => setCreateForm((prev) => ({ ...prev, tenantPartyType: v as TenantPartyTypeValue }))}>
                    <SelectTrigger id="create-tenant-party-type" className="w-full"><SelectValue placeholder="اختر صفة الطرف" /></SelectTrigger>
                    <SelectContent>
                      {TENANT_PARTY_TYPE_VALUES.map((v) => (
                        <SelectItem key={v} value={v}>{TenantPartyTypeLabels[v as TenantPartyTypeValue].ar}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-tenant-name">اسم المستأجر <span className="text-red-500">*</span></Label>
                  <Input id="create-tenant-name" value={createForm.tenantName} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantName: e.target.value }))} />
                </div>
                {showTenantEntityName && (
                  <div className="space-y-2">
                    <Label htmlFor="create-tenant-entity">اسم الجهة <span className="text-red-500">*</span></Label>
                    <Input id="create-tenant-entity" value={createForm.tenantCompanyName} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantCompanyName: e.target.value }))} />
                  </div>
                )}
                {showTenantOrgFields && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="create-tenant-company">{createForm.tenantPartyType === 'company' ? 'اسم الشركة' : 'اسم المنشأة'} {isOrgTenant && <span className="text-red-500">*</span>}</Label>
                      <Input id="create-tenant-company" value={createForm.tenantCompanyName} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantCompanyName: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-tenant-cr">السجل التجاري {isOrgTenant && <span className="text-red-500">*</span>}</Label>
                      <Input id="create-tenant-cr" inputMode="numeric" value={createForm.tenantCrNumber} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantCrNumber: e.target.value }))} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-tenant-unified">الرقم الموحد</Label>
                      <Input id="create-tenant-unified" inputMode="numeric" value={createForm.tenantUnifiedNumber} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantUnifiedNumber: e.target.value }))} dir="ltr" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-tenant-vat">الرقم الضريبي {isOrgTenant && <span className="text-red-500">*</span>}</Label>
                      <Input id="create-tenant-vat" inputMode="numeric" value={createForm.tenantVatRegistrationNumber} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantVatRegistrationNumber: e.target.value }))} dir="ltr" />
                    </div>
                  </>
                )}
                {showTenantNationalId && (
                  <div className="space-y-2">
                    <Label htmlFor="create-tenant-national-id">رقم الهوية {createForm.tenantPartyType === 'individual' && <span className="text-red-500">*</span>}</Label>
                    <Input id="create-tenant-national-id" inputMode="numeric" value={createForm.tenantNationalId} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantNationalId: e.target.value }))} dir="ltr" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="create-tenant-phone">رقم الجوال <span className="text-red-500">*</span></Label>
                  <Input id="create-tenant-phone" inputMode="numeric" value={createForm.tenantPhone} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantPhone: e.target.value }))} dir="ltr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-tenant-email">البريد الإلكتروني</Label>
                  <Input id="create-tenant-email" type="email" value={createForm.tenantEmail} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantEmail: e.target.value }))} dir="ltr" />
                </div>
              </div>
              <Separator className="my-4" />
              <p className="text-sm font-medium text-muted-foreground mb-3">العنوان الوطني</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="space-y-2"><Label htmlFor="create-tenant-city">المدينة</Label><Input id="create-tenant-city" value={createForm.tenantCity} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantCity: e.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="create-tenant-district">الحي</Label><Input id="create-tenant-district" value={createForm.tenantDistrict} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantDistrict: e.target.value }))} /></div>
                <div className="space-y-2"><Label htmlFor="create-tenant-street">الشارع</Label><Input id="create-tenant-street" value={createForm.tenantStreet} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantStreet: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label htmlFor="create-tenant-building">رقم المبنى</Label><Input id="create-tenant-building" inputMode="numeric" value={createForm.tenantBuildingNumber} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantBuildingNumber: e.target.value }))} dir="ltr" /></div>
                <div className="space-y-2"><Label htmlFor="create-tenant-postal">الرمز البريدي</Label><Input id="create-tenant-postal" inputMode="numeric" value={createForm.tenantPostalCode} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantPostalCode: e.target.value }))} dir="ltr" /></div>
                <div className="space-y-2"><Label htmlFor="create-tenant-additional">الرقم الإضافي</Label><Input id="create-tenant-additional" inputMode="numeric" value={createForm.tenantAdditionalNumber} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantAdditionalNumber: e.target.value }))} dir="ltr" /></div>
                {editingContract && (
                  <>
                    <div className="space-y-2"><Label htmlFor="create-tenant-rep-name">اسم ممثل المستأجر</Label><Input id="create-tenant-rep-name" value={createForm.tenantRepresentativeName} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantRepresentativeName: e.target.value }))} /></div>
                    <div className="space-y-2"><Label htmlFor="create-tenant-rep-mobile">جوال ممثل المستأجر</Label><Input id="create-tenant-rep-mobile" inputMode="numeric" value={createForm.tenantRepresentativeMobile} onChange={(e) => setCreateForm((prev) => ({ ...prev, tenantRepresentativeMobile: e.target.value }))} dir="ltr" /></div>
                  </>
                )}
              </div>
            </div>

            {/* ملاحظات وشروط */}
            <div className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/20">
              <h3 className="text-base font-semibold mb-3 text-blue-700 dark:text-blue-400 flex items-center gap-2">
                <FileText className="h-4 w-4" /> ملاحظات العقار والشروط
              </h3>
              <Separator className="mb-4" />
              <p className="text-xs text-blue-600 dark:text-blue-400 mb-4">ملاحظات العقار تظهر في عمود «العقار» في جدول العقود لتمييز الوحدة المؤجرة.</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="create-notes">ملاحظات العقار</Label>
                  <Textarea id="create-notes" value={createForm.notes} onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))} rows={3} className="bg-white dark:bg-slate-950 border-blue-200 focus-visible:ring-blue-500" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-terms">الشروط</Label>
                  <Textarea id="create-terms" value={createForm.terms} onChange={(e) => setCreateForm((prev) => ({ ...prev, terms: e.target.value }))} rows={3} className="bg-white dark:bg-slate-950" />
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t px-6 py-4">
            <DialogFooter className="gap-2 p-0 sm:gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>إلغاء</Button>
              <div className="flex-1" />
              <Button onClick={handleCreateContract} disabled={creating}>
                {creating && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                {editingContract ? 'حفظ التعديلات' : 'إنشاء العقد'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Renew Contract Dialog                                              */}
      {/* ================================================================== */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {selectedContract && (
            <>
              <DialogHeader>
                <DialogTitle>تجديد العقد</DialogTitle>
                <DialogDescription>تجديد عقد رقم {selectedContract.contractNumber}</DialogDescription>
              </DialogHeader>
              <Card>
                <CardContent className="pt-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">العقار:</span><span className="font-medium">{selectedContract.propertyTitle || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">المستأجر:</span><span className="font-medium">{selectedContract.tenantName || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">العقد الحالي:</span><span className="font-medium text-xs">{formatDateDualCompact(selectedContract.startDate)} — {formatDateDualCompact(selectedContract.endDate)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">الرقم الداخلي:</span><span className="font-mono font-medium">{selectedContract.internalId || '—'}{' '}<span className="text-xs text-muted-foreground">(يبقى كما هو)</span></span></div>
                </CardContent>
              </Card>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>تاريخ بداية التجديد</Label><DatePicker value={renewForm.startDate} onChange={(date) => setRenewForm((prev) => ({ ...prev, startDate: date }))} showDualDate /></div>
                  <div className="space-y-2"><Label>تاريخ نهاية التجديد</Label><DatePicker value={renewForm.endDate} onChange={(date) => setRenewForm((prev) => ({ ...prev, endDate: date }))} showDualDate /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2"><Label>مبلغ الإيجار (ر.س)</Label><Input inputMode="numeric" value={renewForm.rentAmount} onChange={(e) => setRenewForm((prev) => ({ ...prev, rentAmount: e.target.value }))} dir="ltr" /></div>
                  <div className="space-y-2"><Label>التأمين (ر.س)</Label><Input inputMode="numeric" value={renewForm.securityDeposit} onChange={(e) => setRenewForm((prev) => ({ ...prev, securityDeposit: e.target.value }))} dir="ltr" /></div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="renew-contract-number">رقم العقد (الجديد للتجديد)</Label>
                  <Input id="renew-contract-number" dir="ltr" value={renewForm.contractNumber} onChange={(e) => setRenewForm((prev) => ({ ...prev, contractNumber: e.target.value }))} placeholder="أدخل رقم العقد الجديد الصادر من منصة إيجار للتجديد" />
                  <p className="text-xs text-muted-foreground">اتركه فارغاً ليُولّد النظام رقماً تلقائياً.</p>
                </div>
                <div className="space-y-2"><Label>ملاحظات</Label><Textarea value={renewForm.notes} onChange={(e) => setRenewForm((prev) => ({ ...prev, notes: e.target.value }))} rows={2} /></div>
                <div className="space-y-2"><Label>الشروط</Label><Textarea value={renewForm.terms} onChange={(e) => setRenewForm((prev) => ({ ...prev, terms: e.target.value }))} rows={2} /></div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setRenewOpen(false)} disabled={renewing}>إلغاء</Button>
                <Button onClick={handleRenewContract} disabled={renewing || !renewForm.endDate} variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950">
                  {renewing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  <RefreshCw className="ml-2 h-4 w-4" /> تجديد العقد
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Change Tenant Dialog (تغيير المستأجر)                              */}
      {/* ================================================================== */}
      <Dialog open={changeTenantOpen} onOpenChange={setChangeTenantOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedContract && (
            <>
              <DialogHeader>
                <DialogTitle>تغيير المستأجر</DialogTitle>
                <DialogDescription>عقد رقم {selectedContract.contractNumber} — إنشاء عقد جديد لنفس العقار بمستأجر جديد</DialogDescription>
              </DialogHeader>

              {/* Read-only context (العقار + المستأجر الحالي + الرقم الداخلي) */}
              <Card>
                <CardContent className="pt-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">العقار:</span><span className="font-medium">{selectedContract.propertyTitle || selectedContract.propertyCity || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">المستأجر الحالي:</span><span className="font-medium">{selectedContract.tenantName || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">الرقم الداخلي:</span><span className="font-mono font-medium">{selectedContract.internalId || '—'}{' '}<span className="text-xs text-muted-foreground">(يبقى كما هو)</span></span></div>
                </CardContent>
              </Card>

              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                سيُنقل المستأجر السابق إلى أرشيف العقود تلقائياً.
              </div>

              {/* بيانات المستأجر الجديد */}
              <div>
                <h3 className="text-base font-semibold mb-3 text-emerald-700 dark:text-emerald-400">بيانات المستأجر الجديد</h3>
                <Separator className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ct-tenant-party-type">صفة الطرف <span className="text-red-500">*</span></Label>
                    <Select value={changeTenantForm.tenantPartyType || undefined} onValueChange={(v) => setChangeTenantForm((prev) => ({ ...prev, tenantPartyType: v as TenantPartyTypeValue }))}>
                      <SelectTrigger id="ct-tenant-party-type" className="w-full"><SelectValue placeholder="اختر صفة الطرف" /></SelectTrigger>
                      <SelectContent>
                        {TENANT_PARTY_TYPE_VALUES.map((v) => (
                          <SelectItem key={v} value={v}>{TenantPartyTypeLabels[v as TenantPartyTypeValue].ar}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ct-tenant-name">اسم المستأجر <span className="text-red-500">*</span></Label>
                    <Input id="ct-tenant-name" value={changeTenantForm.tenantName} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantName: e.target.value }))} />
                  </div>
                  {ctShowTenantEntityName && (
                    <div className="space-y-2">
                      <Label htmlFor="ct-tenant-entity">اسم الجهة <span className="text-red-500">*</span></Label>
                      <Input id="ct-tenant-entity" value={changeTenantForm.tenantCompanyName} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantCompanyName: e.target.value }))} />
                    </div>
                  )}
                  {ctShowTenantOrgFields && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="ct-tenant-company">{changeTenantForm.tenantPartyType === 'company' ? 'اسم الشركة' : 'اسم المنشأة'} {ctIsOrgTenant && <span className="text-red-500">*</span>}</Label>
                        <Input id="ct-tenant-company" value={changeTenantForm.tenantCompanyName} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantCompanyName: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ct-tenant-cr">السجل التجاري {ctIsOrgTenant && <span className="text-red-500">*</span>}</Label>
                        <Input id="ct-tenant-cr" inputMode="numeric" value={changeTenantForm.tenantCrNumber} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantCrNumber: e.target.value }))} dir="ltr" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ct-tenant-unified">الرقم الموحد</Label>
                        <Input id="ct-tenant-unified" inputMode="numeric" value={changeTenantForm.tenantUnifiedNumber} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantUnifiedNumber: e.target.value }))} dir="ltr" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ct-tenant-vat">الرقم الضريبي {ctIsOrgTenant && <span className="text-red-500">*</span>}</Label>
                        <Input id="ct-tenant-vat" inputMode="numeric" value={changeTenantForm.tenantVatRegistrationNumber} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantVatRegistrationNumber: e.target.value }))} dir="ltr" />
                      </div>
                    </>
                  )}
                  {ctShowTenantNationalId && (
                    <div className="space-y-2">
                      <Label htmlFor="ct-tenant-national-id">رقم الهوية {changeTenantForm.tenantPartyType === 'individual' && <span className="text-red-500">*</span>}</Label>
                      <Input id="ct-tenant-national-id" inputMode="numeric" value={changeTenantForm.tenantNationalId} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantNationalId: e.target.value }))} dir="ltr" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="ct-tenant-phone">رقم الجوال <span className="text-red-500">*</span></Label>
                    <Input id="ct-tenant-phone" inputMode="numeric" value={changeTenantForm.tenantPhone} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantPhone: e.target.value }))} dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ct-tenant-email">البريد الإلكتروني</Label>
                    <Input id="ct-tenant-email" type="email" value={changeTenantForm.tenantEmail} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantEmail: e.target.value }))} dir="ltr" />
                  </div>
                </div>
                <Separator className="my-4" />
                <p className="text-sm font-medium text-muted-foreground mb-3">العنوان الوطني</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="space-y-2"><Label htmlFor="ct-tenant-city">المدينة</Label><Input id="ct-tenant-city" value={changeTenantForm.tenantCity} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantCity: e.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="ct-tenant-district">الحي</Label><Input id="ct-tenant-district" value={changeTenantForm.tenantDistrict} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantDistrict: e.target.value }))} /></div>
                  <div className="space-y-2"><Label htmlFor="ct-tenant-street">الشارع</Label><Input id="ct-tenant-street" value={changeTenantForm.tenantStreet} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantStreet: e.target.value }))} /></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2"><Label htmlFor="ct-tenant-building">رقم المبنى</Label><Input id="ct-tenant-building" inputMode="numeric" value={changeTenantForm.tenantBuildingNumber} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantBuildingNumber: e.target.value }))} dir="ltr" /></div>
                  <div className="space-y-2"><Label htmlFor="ct-tenant-postal">الرمز البريدي</Label><Input id="ct-tenant-postal" inputMode="numeric" value={changeTenantForm.tenantPostalCode} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantPostalCode: e.target.value }))} dir="ltr" /></div>
                  <div className="space-y-2"><Label htmlFor="ct-tenant-additional">الرقم الإضافي</Label><Input id="ct-tenant-additional" inputMode="numeric" value={changeTenantForm.tenantAdditionalNumber} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, tenantAdditionalNumber: e.target.value }))} dir="ltr" /></div>
                </div>
              </div>

              {/* العقد الجديد */}
              <div>
                <h3 className="text-base font-semibold mb-3 text-sky-700 dark:text-sky-400">العقد الجديد</h3>
                <Separator className="mb-4" />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ct-contract-number">رقم العقد <span className="text-red-500">*</span></Label>
                    <Input id="ct-contract-number" dir="ltr" value={changeTenantForm.contractNumber} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, contractNumber: e.target.value }))} placeholder="رقم العقد الجديد الصادر من منصة إيجار للمستأجر الجديد" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>تاريخ البداية</Label><DatePicker value={changeTenantForm.startDate} onChange={(date) => setChangeTenantForm((prev) => ({ ...prev, startDate: date }))} showDualDate /></div>
                    <div className="space-y-2"><Label>تاريخ النهاية</Label><DatePicker value={changeTenantForm.endDate} onChange={(date) => setChangeTenantForm((prev) => ({ ...prev, endDate: date }))} showDualDate /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>مبلغ الإيجار (ر.س)</Label><Input inputMode="numeric" value={changeTenantForm.rentAmount} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, rentAmount: e.target.value }))} dir="ltr" /></div>
                    <div className="space-y-2"><Label>التأمين (ر.س)</Label><Input inputMode="numeric" value={changeTenantForm.securityDeposit} onChange={(e) => setChangeTenantForm((prev) => ({ ...prev, securityDeposit: e.target.value }))} dir="ltr" /></div>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setChangeTenantOpen(false)} disabled={changingTenant}>إلغاء</Button>
                <Button onClick={handleChangeTenant} disabled={changingTenant} className="bg-sky-600 hover:bg-sky-700 text-white">
                  {changingTenant && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  <UserCog className="ml-2 h-4 w-4" /> تغيير المستأجر
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================== */}
      {/* Terminate / Move-out / Delete confirmations                        */}
      {/* ================================================================== */}
      <AlertDialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>إنهاء العقد</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من إنهاء هذا العقد؟ هذا الإجراء يغيّر حالة العقد إلى «منتهي».</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleTerminateContract} className="bg-red-600 hover:bg-red-700" disabled={terminating}>
              {terminating && <Loader2 className="ml-2 h-4 w-4 animate-spin" />} إنهاء
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={moveOutOpen} onOpenChange={setMoveOutOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تعليم العقد كـ «خرج»</AlertDialogTitle>
            <AlertDialogDescription>هل تريد تعليم هذا العقد كـ «خرج» (مغادرة المستأجر للعقار)؟ يتغيّر وضع العقد فقط — لن يتم حذف أي فواتير.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleMoveOutContract} className="bg-red-600 hover:bg-red-700" disabled={movingOut}>
              {movingOut && <Loader2 className="ml-2 h-4 w-4 animate-spin" />} تأكيد الخروج
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العقد</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف العقد رقم {deleteTarget?.contractNumber || ''}؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteContract} className="bg-red-600 hover:bg-red-700" disabled={deleting}>
              {deleting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />} حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
