// Ported subset of egarsys src/lib/types.ts — the pieces the dashboard AND the
// contracts section consume. Enums/labels are copied verbatim from egarsys so
// the Arabic copy and status semantics match 1:1.

// ── Property ──
export const PropertyType = {
  apartment: 'apartment',
  villa: 'villa',
  land: 'land',
  office: 'office',
  shop: 'shop',
  workshop: 'workshop',
  showroom: 'showroom',
  courtyard: 'courtyard',
  warehouse: 'warehouse',
  other: 'other',
} as const
export type PropertyTypeValue = (typeof PropertyType)[keyof typeof PropertyType]
export const PropertyTypeLabels: Record<PropertyTypeValue, { en: string; ar: string }> = {
  apartment: { en: 'Apartment', ar: 'شقة' },
  villa: { en: 'Villa', ar: 'فلة' },
  land: { en: 'Land', ar: 'أرض' },
  office: { en: 'Office', ar: 'مكتب' },
  shop: { en: 'Shop', ar: 'محل' },
  workshop: { en: 'Workshop', ar: 'ورشة' },
  showroom: { en: 'Showroom', ar: 'معرض' },
  courtyard: { en: 'Courtyard', ar: 'حوش' },
  warehouse: { en: 'Warehouse', ar: 'مستودع' },
  other: { en: 'Other', ar: 'أخرى' },
}

// ── Property status ── (copied verbatim from egarsys src/lib/types.ts)
export const PropertyStatus = {
  available: 'available',
  rented: 'rented',
  maintenance: 'maintenance',
  inactive: 'inactive',
} as const
export type PropertyStatusValue = (typeof PropertyStatus)[keyof typeof PropertyStatus]
export const PropertyStatusLabels: Record<PropertyStatusValue, { en: string; ar: string }> = {
  available: { en: 'Available', ar: 'متاح' },
  rented: { en: 'Rented', ar: 'مؤجر' },
  maintenance: { en: 'Under Maintenance', ar: 'صيانة' },
  inactive: { en: 'Inactive', ar: 'غير نشط' },
}

// ── Contract status ──
export const ContractStatus = {
  active: 'active',
  expired: 'expired',
  pending_renewal: 'pending_renewal',
  terminated: 'terminated',
  moved_out: 'moved_out',
  draft: 'draft',
} as const
export type ContractStatusValue = (typeof ContractStatus)[keyof typeof ContractStatus]
export const ContractStatusLabels: Record<string, { en: string; ar: string }> = {
  active: { en: 'Active', ar: 'نشط' },
  expired: { en: 'Expired', ar: 'منتهي' },
  pending_renewal: { en: 'Pending Renewal', ar: 'بانتظار التجديد' },
  terminated: { en: 'Terminated', ar: 'ملغى' },
  moved_out: { en: 'Moved Out', ar: 'خرج' },
  draft: { en: 'Draft', ar: 'مسودة' },
  // Manual «نقل إلى أرشيف العقود» archive state — kept OUT of the ContractStatus
  // enum (so it never appears in the main-list status filter), but labelled here so
  // the badge renders (list/detail read ContractStatusLabels[status].ar directly).
  archived: { en: 'Archived', ar: 'مؤرشف' },
}

// ── Contract type ──
export const ContractType = {
  new: 'new',
  renewal: 'renewal',
} as const
export type ContractTypeValue = (typeof ContractType)[keyof typeof ContractType]
export const ContractTypeLabels: Record<ContractTypeValue, { en: string; ar: string }> = {
  new: { en: 'New', ar: 'جديد' },
  renewal: { en: 'Renewal', ar: 'تجديد' },
}

// ── صفة الطرف (tenant party classification) ──
export const TenantPartyType = {
  individual: 'individual',
  establishment: 'establishment',
  company: 'company',
  government: 'government',
} as const
export type TenantPartyTypeValue = (typeof TenantPartyType)[keyof typeof TenantPartyType]
export const TenantPartyTypeLabels: Record<TenantPartyTypeValue, { en: string; ar: string }> = {
  individual: { en: 'Individual', ar: 'فرد' },
  establishment: { en: 'Establishment', ar: 'مؤسسة' },
  company: { en: 'Company', ar: 'شركة' },
  government: { en: 'Government Entity', ar: 'جهة حكومية' },
}
export const TENANT_PARTY_TYPE_VALUES: string[] = Object.values(TenantPartyType)

// ── Payment method ──
export const PaymentMethodLabels: Record<string, { en: string; ar: string }> = {
  bank_transfer: { en: 'Bank Transfer', ar: 'تحويل بنكي' },
  platform: { en: 'Platform', ar: 'منصة ايجار' },
  cash: { en: 'Cash', ar: 'نقدي' },
  deferred: { en: 'Deferred', ar: 'آجل' },
  other: { en: 'Other', ar: 'أخرى' },
}

// ── Invoice status ──
export const InvoiceStatusLabels: Record<string, { en: string; ar: string }> = {
  unpaid: { en: 'Unpaid', ar: 'غير مدفوعة' },
  paid: { en: 'Paid', ar: 'مدفوعة' },
  overdue: { en: 'Overdue', ar: 'متأخرة' },
  cancelled: { en: 'Cancelled', ar: 'ملغاة' },
  partial: { en: 'Partial', ar: 'مدفوعة جزئياً' },
}

// ── Payment status (dashboard) ──
export const PaymentStatusLabels: Record<string, { en: string; ar: string }> = {
  pending: { en: 'Pending', ar: 'قيد الانتظار' },
  paid: { en: 'Paid', ar: 'مدفوع' },
  overdue: { en: 'Overdue', ar: 'متأخر' },
  cancelled: { en: 'Cancelled', ar: 'ملغى' },
  partial: { en: 'Partial', ar: 'مدفوع جزئياً' },
}

export interface PaymentScheduleRow {
  contractNumber: string
  tenantName: string
  installmentNo: number
  dueDate: string
  dueDateAH: string
  amount: number
}

// The contract shape the list + detail dialog read. egarsys's own RentalContract
// is broad and the section accesses it dynamically in many spots, so the explicit
// fields below cover the common accesses and the index signature keeps the faithful
// port's looser reads type-clean.
export interface RentalContract {
  id: string
  contractNumber: string
  status: string
  endDate: string
  rentAmount: number
  // Common list/detail fields
  internalId?: number | null
  ejarContractNumber?: string | null
  /** Display-only «رقم عقد المنصة» with fallback: ejarContractNumber || contractNumber. */
  platformContractNumber?: string
  startDate?: string
  securityDeposit?: number
  taxRate?: number
  totalContractValue?: number | null
  installmentsPerYear?: number
  paymentFrequency?: string
  contractType?: string
  registeredCalendar?: string | null
  tenantId?: string | null
  tenantName?: string | null
  tenantPhone?: string | null
  propertyTitle?: string
  propertyAddress?: string | null
  propertyCity?: string | null
  propertyType?: string
  otherPropertyType?: string | null
  rentalPropertyId?: string | null
  notes?: string | null
  terms?: string | null
  daysUntilExpiry?: number
  // Live engine-derived
  nextPaymentDate?: string | null
  nextPaymentDateAH?: string | null
  nextPaymentAmount?: number | null
  nextDueNo?: number | null
  nextDueState?: 'due' | 'upcoming' | null
  nextDueReason?: 'fully_invoiced' | null
  hasOutstanding?: boolean
  outstandingTotal?: number
  overdueInstallmentNos?: number[]
  prepaidSettled?: boolean | null
  prepaidNote?: string | null
  paidPreviouslyInstallments?: unknown
  tenant?: { name?: string; phone?: string; email?: string; [k: string]: unknown } | null
  rentalProperty?: {
    title?: string
    titleAr?: string | null
    city?: string | null
    district?: string | null
    deedNumber?: string | null
    deedDate?: string | null
    owner?: { name?: string | null; nationalId?: string | null; phone?: string | null; address?: string | null } | null
    [k: string]: unknown
  } | null
  // The faithful port also reads many lessor_*/tenant_* snapshot fields directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface Invoice {
  id: string
  invoiceNumber?: string
  installmentNo?: number
  totalInstallments?: number
  totalValue?: number
  vatAmount?: number
  paidAmount?: number | null
  dueDate?: string
  status?: string
  paymentMethod?: string | null
  documentType?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

export interface DashboardStats {
  properties: { total: number; available: number; rented: number; maintenance: number }
  contracts: { active: number; expiringSoon: number; expired: number; draft: number }
  contractLifecycle: {
    active: number
    approaching: number
    expired: number
    pendingRenewal: number
  }
  payments: {
    thisMonthTotal: number
    thisMonthCollected: number
    thisMonthCount: number
    overdueTotal: number
    overdueCount: number
  }
  paymentBreakdown: { paid: number; dueInTwoMonths: number; overdue: number }
  settlement: {
    safe: number
    approaching: number
    overdue: number
    outstanding: number
    overdueCount: number
  }
  paymentsDue?: { count: number; amount: number; considered: number }
  paymentSchedule?: {
    overdue: PaymentScheduleRow[]
    upcoming: PaymentScheduleRow[]
    overdueCount: number
    upcomingCount: number
    overdueTotal: number
    upcomingTotal: number
  }
  approachingInvoices: Array<{
    contractNumber: string
    invoiceNumber: string
    dueDate: string
    remaining: number
  }>
  issuedInvoices?: { count: number; subtotal: number; tax: number; total: number }
  monthlyRevenue?: Array<{
    year: number
    month: number
    label: string
    due: number
    collected: number
  }>
  unreadNotifications: number
  income?: number
  expense?: number
}
