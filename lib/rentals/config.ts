// Native rentals vertical (egarsys mirror) — entity registry + Arabic labels.
// Field lists come from lib/rentals/spec.json, which the migration exporter
// derives from egarsys's OWN Prisma schema; this file only adds presentation:
// which entities appear in the nav, their key list columns and Arabic labels.
// Unlabelled fields fall back to a prettified English name — full editing is
// available for every field regardless.

import spec from './spec.json'

export interface SpecField {
    prisma: string
    fieldname: string
    type: 'String' | 'Int' | 'Float' | 'Boolean' | 'DateTime' | 'Json'
    required: boolean
    link: string | null
}

export interface EntityConfig {
    key: string
    model: keyof typeof spec
    doctype: string
    labelAr: string
    singularAr: string
    icon: string // lucide icon name resolved by the pages
    listColumns: string[] // fieldnames
    searchFields: string[] // fieldnames used for server-side or_filters
    titleField: string
}

export const ENTITIES: EntityConfig[] = [
    {
        key: 'owners', model: 'Owner', doctype: 'Rental Owner', labelAr: 'الملاك', singularAr: 'مالك', icon: 'UserSquare',
        listColumns: ['name_val', 'phone', 'email', 'national_id'], searchFields: ['name_val', 'phone', 'national_id'], titleField: 'name_val',
    },
    {
        key: 'properties', model: 'Property', doctype: 'Rental Property', labelAr: 'العقارات', singularAr: 'عقار', icon: 'Building2',
        listColumns: ['title', 'property_type', 'city', 'district', 'status'], searchFields: ['title', 'title_ar', 'city', 'district'], titleField: 'title',
    },
    {
        key: 'units', model: 'Unit', doctype: 'Rental Unit', labelAr: 'الوحدات', singularAr: 'وحدة', icon: 'DoorOpen',
        listColumns: ['unit_number', 'property_id', 'unit_type', 'status'], searchFields: ['unit_number'], titleField: 'unit_number',
    },
    {
        key: 'tenants', model: 'TenantProfile', doctype: 'Rental Tenant', labelAr: 'المستأجرون', singularAr: 'مستأجر', icon: 'Users',
        listColumns: ['name_val', 'phone', 'national_id', 'party_type'], searchFields: ['name_val', 'phone', 'national_id'], titleField: 'name_val',
    },
    {
        key: 'contracts', model: 'RentalContract', doctype: 'Rental Contract', labelAr: 'العقود', singularAr: 'عقد', icon: 'FileSignature',
        listColumns: ['contract_number', 'tenant_name', 'start_date', 'end_date', 'rent_amount', 'status'],
        searchFields: ['contract_number', 'tenant_name'], titleField: 'contract_number',
    },
    {
        key: 'invoices', model: 'Invoice', doctype: 'Rental Invoice', labelAr: 'الفواتير', singularAr: 'فاتورة', icon: 'Receipt',
        listColumns: ['invoice_number', 'zatca_document_type', 'issue_date', 'total_value', 'vat_amount', 'status'],
        searchFields: ['invoice_number'], titleField: 'invoice_number',
    },
    {
        key: 'payments', model: 'Payment', doctype: 'Rental Payment', labelAr: 'الدفعات', singularAr: 'دفعة', icon: 'Wallet',
        listColumns: ['contract_id', 'amount', 'due_date', 'status'], searchFields: [], titleField: 'due_date',
    },
    {
        key: 'transactions', model: 'Transaction', doctype: 'Rental Transaction', labelAr: 'السندات', singularAr: 'سند', icon: 'ArrowLeftRight',
        listColumns: ['type', 'amount', 'date', 'description'], searchFields: ['description'], titleField: 'description',
    },
]

export const entityByKey = (key: string) => ENTITIES.find((e) => e.key === key)

export function specFields(model: keyof typeof spec): SpecField[] {
    return (spec[model] as { fields: SpecField[] }).fields
}

// Arabic labels for the frequent fields; anything missing falls back to a
// prettified fieldname (still fully editable).
export const FIELD_LABELS_AR: Record<string, string> = {
    name_val: 'الاسم', display_name: 'الاسم', phone: 'الجوال', email: 'البريد', national_id: 'رقم الهوية',
    company_id: 'معرف الشركة (المصدر)', created_at: 'أنشئ في', updated_at: 'عُدل في', notes: 'ملاحظات', status: 'الحالة',
    type: 'النوع', city: 'المدينة', district: 'الحي', address: 'العنوان', description: 'الوصف',
    deed_number: 'رقم الصك', deed_date: 'تاريخ الصك', owner_id: 'المالك', property_id: 'العقار', unit_id: 'الوحدة',
    unit_number: 'رقم الوحدة', tenant_id: 'المستأجر', contract_id: 'العقد', party_type: 'صفة الطرف',
    contract_number: 'رقم العقد', tenant_name: 'اسم المستأجر', tenant_phone: 'جوال المستأجر',
    start_date: 'تاريخ البداية', end_date: 'تاريخ النهاية', sealing_date: 'تاريخ الإبرام',
    annual_rent: 'الإيجار السنوي', rent_value: 'قيمة الإيجار', security_deposit: 'التأمين',
    total_contract_value: 'قيمة العقد الإجمالية', payment_frequency: 'دورية السداد',
    invoice_number: 'رقم الفاتورة', zatca_document_type: 'نوع المستند', issue_date: 'تاريخ الإصدار',
    due_date: 'تاريخ الاستحقاق', supply_date: 'تاريخ التوريد', paid_date: 'تاريخ السداد',
    total_value: 'الإجمالي', vat_amount: 'الضريبة', services_amount: 'الخدمات',
    installment_no: 'رقم القسط', total_installments: 'عدد الأقساط', payment_method: 'طريقة الدفع',
    period_start: 'بداية الفترة', period_end: 'نهاية الفترة', note_reason: 'سبب الإشعار',
    original_invoice_number: 'الفاتورة الأصلية', zatca_status: 'حالة زاتكا', icv: 'العداد التسلسلي (ICV)',
    amount: 'المبلغ', date: 'التاريخ', category: 'التصنيف', attachment: 'مرفق', image_url: 'رابط الصورة',
    parent_contract_id: 'العقد الأصل', rental_property_id: 'العقار المؤجر',
    title: 'الاسم', title_ar: 'الاسم بالعربية', property_type: 'نوع العقار', unit_type: 'نوع الوحدة',
    rent_amount: 'قيمة الإيجار', rent_price: 'سعر الإيجار', area: 'المساحة', floor: 'الدور',
    internal_id: 'الرقم الداخلي', ejar_contract_number: 'رقم عقد إيجار (المنصة الحكومية)',
    contract_attachment: 'مرفق العقد', paid_amount: 'المبلغ المسدد', amount_paid: 'المبلغ المسدد',
    lessor_name: 'اسم المؤجر', total_units: 'عدد الوحدات', zatca_uuid: 'زاتكا UUID', zatca_icv: 'زاتكا ICV',
}

export const fieldLabel = (fieldname: string) =>
    FIELD_LABELS_AR[fieldname] ?? fieldname.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

// egarsys attachment paths (/api/uploads/…) — files are mirrored under the
// platform's shared assets; absolute URLs keep working via the source system.
export function fileHref(value: string): string | null {
    if (!value) return null
    if (/^https?:\/\//.test(value)) return value
    if (value.startsWith('/api/uploads/')) return `/assets/rentals-uploads/${value.slice('/api/uploads/'.length)}`
    if (value.startsWith('/uploads/')) return `/assets/rentals-uploads/${value.slice('/uploads/'.length)}`
    return null
}

// New docs need explicit names (autoname=prompt; migrated docs use egarsys cuids).
export const newDocName = () =>
    'rn' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
