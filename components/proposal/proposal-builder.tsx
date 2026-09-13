'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Plus, Trash2, Loader2, Link2, Download, ArrowRightLeft, Tag,
} from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/lib/i18n'
import { formatCurrency } from '@/lib/format'
import { LocalizedDateInput } from '@/components/ui/localized-date-input'
import { type ProjectionRow } from './projection-chart'
import { proposalPdfUrl } from './proposal-list'

// ---------------------------------------------------------------------------
// Constants — backend values stay English; Arabic is display-only
// ---------------------------------------------------------------------------

const PROPOSAL_TO = ['Customer', 'Lead', 'Prospect']
const PROPOSAL_TO_AR: Record<string, string> = {
    'Customer': 'عميل', 'Lead': 'عميل محتمل', 'Prospect': 'مرتقب',
}
const STATUSES = ['Draft', 'Sent', 'Open', 'Accepted', 'Rejected', 'Expired']
const STATUS_AR: Record<string, string> = {
    'Draft': 'مسودة', 'Sent': 'مُرسل', 'Open': 'مفتوح',
    'Accepted': 'مقبول', 'Rejected': 'مرفوض', 'Expired': 'منتهي',
}
const LANGUAGES = ['ar', 'en']
const VAT_RATE = 15

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ItemRow {
    item_code?: string
    item_name?: string
    description?: string
    qty?: number | string
    uom?: string
    rate?: number | string
    discount_percentage?: number | string
}

interface PartyOption { name: string; label: string }

interface TemplateOption { name: string; template_name: string }

interface BuilderForm {
    title: string
    proposal_to: string
    party_name: string
    party_display_name: string
    company: string
    currency: string
    transaction_date: string
    valid_till: string
    language: string
    status: string
    executive_summary: string
    scope_of_work: string
    contract_terms: string
    additional_discount: string
    vat_rate: string
    requires_signature: boolean
    // savings / ROI
    client_current_cost: string
    proposed_cost: string
    roi_duration_months: string
    items: ItemRow[]
    projection_rows: ProjectionRow[]
}

const emptyForm = (): BuilderForm => ({
    title: '',
    proposal_to: 'Customer',
    party_name: '',
    party_display_name: '',
    company: '',
    currency: 'SAR',
    transaction_date: new Date().toISOString().split('T')[0],
    valid_till: '',
    language: 'ar',
    status: 'Draft',
    executive_summary: '',
    scope_of_work: '',
    contract_terms: '',
    additional_discount: '',
    vat_rate: String(VAT_RATE),
    requires_signature: false,
    client_current_cost: '',
    proposed_cost: '',
    roi_duration_months: '',
    items: [{ item_name: '', qty: 1, rate: 0, discount_percentage: 0 }],
    projection_rows: [{ period_label: '', client_savings: 0, provider_revenue: 0, provider_cost: 0 }],
})

const num = (v: any) => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v))

// ---------------------------------------------------------------------------
// Line-item catalog picker — searches the ERPNext Item master and inserts the
// chosen item (code, name, description, rate) as a new proposal line.
// ---------------------------------------------------------------------------

interface CatalogItem {
    item_code: string
    item_name?: string
    standard_rate?: number
    description?: string
    stock_uom?: string
}

function CatalogPicker({ onPick, isRTL }: { onPick: (item: CatalogItem) => void; isRTL: boolean }) {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState('')
    const [results, setResults] = useState<CatalogItem[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!open) return
        let cancelled = false
        setLoading(true)
        const run = async () => {
            try {
                const filters = q ? [['item_name', 'like', `%${q}%`]] : []
                const data = await frappeClient.getList<CatalogItem>('Item', {
                    fields: ['item_code', 'item_name', 'standard_rate', 'description', 'stock_uom'],
                    filters: filters as any,
                    limit_page_length: 20,
                    order_by: 'modified desc',
                })
                if (!cancelled) setResults(data)
            } catch {
                if (!cancelled) setResults([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        const t = setTimeout(run, 250)
        return () => { cancelled = true; clearTimeout(t) }
    }, [q, open])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                    <Tag className="h-3.5 w-3.5 mr-1" /> {isRTL ? 'من الكتالوج' : 'From catalog'}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-2" align={isRTL ? 'start' : 'end'} dir={isRTL ? 'rtl' : 'ltr'}>
                <Input
                    autoFocus
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={isRTL ? 'ابحث عن صنف...' : 'Search item…'}
                    className="mb-2 h-8"
                />
                <div className="max-h-64 overflow-y-auto">
                    {loading ? (
                        <div className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto text-gray-400" /></div>
                    ) : results.length === 0 ? (
                        <div className="py-4 text-center text-xs text-gray-400">{isRTL ? 'لا توجد أصناف' : 'No items'}</div>
                    ) : results.map((it) => (
                        <button
                            key={it.item_code}
                            type="button"
                            className="w-full rounded px-2 py-1.5 text-start text-sm hover:bg-accent"
                            onClick={() => { onPick(it); setOpen(false); setQ('') }}
                        >
                            <div className="font-medium">{it.item_name || it.item_code}</div>
                            <div className="flex justify-between text-[11px] text-gray-500">
                                <span className="font-mono">{it.item_code}</span>
                                <span>{num(it.standard_rate).toLocaleString()}</span>
                            </div>
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    editingName: string | null
    onSaved: () => void
}

export function ProposalBuilder({ open, onOpenChange, editingName, onSaved }: Props) {
    const { isRTL, lang } = useI18n()
    const { toast } = useToast()
    const msg = (en: string, ar: string) => (isRTL ? ar : en)

    const [form, setForm] = useState<BuilderForm>(emptyForm())
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [parties, setParties] = useState<PartyOption[]>([])
    const [savedName, setSavedName] = useState<string | null>(null)
    const [templates, setTemplates] = useState<TemplateOption[]>([])
    const [applyingTemplate, setApplyingTemplate] = useState(false)

    // ---------------------------------------------------------------------------
    // Load party options for the selected proposal_to
    // ---------------------------------------------------------------------------

    const loadParties = useCallback(async (proposalTo: string) => {
        try {
            // Only Customer / Lead support getList here; Prospect falls back to plain list
            const doctype = proposalTo === 'Lead' ? 'Lead' : proposalTo === 'Prospect' ? 'Prospect' : 'Customer'
            const nameField = doctype === 'Customer' ? 'customer_name'
                : doctype === 'Lead' ? 'lead_name' : 'company_name'
            const data = await frappeClient.getList<any>(doctype, {
                fields: ['name', nameField],
                order_by: `${nameField} asc`,
                limit_page_length: 500,
            })
            setParties(data.map(d => ({ name: d.name, label: d[nameField] || d.name })))
        } catch (err) {
            console.error('Failed to load parties:', err)
            setParties([])
        }
    }, [])

    // ---------------------------------------------------------------------------
    // Load proposal templates (for the "Start from template" select)
    // ---------------------------------------------------------------------------

    const loadTemplates = useCallback(async () => {
        try {
            const res = await frappeClient.call<TemplateOption[]>(
                'base_meena.sales_proposal.api.get_proposal_templates'
            )
            setTemplates(res?.message || [])
        } catch (err) {
            console.error('Failed to load proposal templates:', err)
            setTemplates([])
        }
    }, [])

    // Apply a chosen template — prefills narrative, vat_rate and items.
    const applyTemplate = useCallback(async (templateName: string) => {
        if (!templateName) return
        // Confirm before overwriting if the form already has data.
        const hasData = !!(
            form.executive_summary || form.scope_of_work || form.contract_terms ||
            form.items.some(it => it.item_name || it.item_code)
        )
        if (hasData && typeof window !== 'undefined' &&
            !window.confirm(msg(
                'This will overwrite the current summary, scope, terms, VAT and items. Continue?',
                'سيؤدي هذا إلى استبدال الملخص والنطاق والشروط وضريبة القيمة المضافة والبنود الحالية. هل تريد المتابعة؟'
            ))) {
            return
        }
        setApplyingTemplate(true)
        try {
            const res = await frappeClient.call<any>(
                'base_meena.sales_proposal.api.get_proposal_template',
                { name: templateName }
            )
            const t = res?.message || {}
            const tplItems: ItemRow[] = (t.items && t.items.length)
                ? t.items.map((it: any) => ({
                    item_name: it.item_name || '',
                    description: it.description || undefined,
                    qty: it.qty != null ? it.qty : 1,
                    rate: it.rate != null ? it.rate : 0,
                    discount_percentage: it.discount_percentage != null ? it.discount_percentage : 0,
                }))
                : [{ item_name: '', qty: 1, rate: 0, discount_percentage: 0 }]
            setForm(f => ({
                ...f,
                executive_summary: t.executive_summary || '',
                scope_of_work: t.scope_of_work || '',
                contract_terms: t.contract_terms || '',
                vat_rate: t.vat_rate != null ? String(t.vat_rate) : f.vat_rate,
                items: tplItems,
            }))
            toast({
                title: msg('Template applied', 'تم تطبيق القالب'),
                description: t.template_name || templateName,
            })
        } catch (err: any) {
            toast({
                title: msg('Error', 'خطأ'),
                description: err?.message || msg('Failed to load template.', 'فشل تحميل القالب.'),
                variant: 'destructive',
            })
        } finally {
            setApplyingTemplate(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.executive_summary, form.scope_of_work, form.contract_terms, form.items, isRTL])

    // ---------------------------------------------------------------------------
    // Load existing proposal when editing / reset when creating
    // ---------------------------------------------------------------------------

    useEffect(() => {
        if (!open) return
        setSavedName(editingName)
        loadTemplates()

        const init = async () => {
            if (!editingName) {
                const f = emptyForm()
                setForm(f)
                await loadParties(f.proposal_to)
                return
            }
            setLoading(true)
            try {
                const res = await frappeClient.call<any>(
                    'base_meena.sales_proposal.api.get_proposal',
                    { name: editingName }
                )
                const d = res?.message || {}
                const f: BuilderForm = {
                    title: d.title || '',
                    proposal_to: d.proposal_to || 'Customer',
                    party_name: d.party_name || '',
                    party_display_name: d.party_display_name || '',
                    company: d.company || '',
                    currency: d.currency || 'SAR',
                    transaction_date: d.transaction_date || new Date().toISOString().split('T')[0],
                    valid_till: d.valid_till || '',
                    language: d.language || 'ar',
                    status: d.status || 'Draft',
                    executive_summary: d.executive_summary || '',
                    scope_of_work: d.scope_of_work || '',
                    contract_terms: d.contract_terms || '',
                    additional_discount: d.additional_discount != null ? String(d.additional_discount) : '',
                    vat_rate: d.vat_rate != null ? String(d.vat_rate) : String(VAT_RATE),
                    requires_signature: !!d.requires_signature,
                    client_current_cost: d.client_current_cost != null ? String(d.client_current_cost) : '',
                    proposed_cost: d.proposed_cost != null ? String(d.proposed_cost) : '',
                    roi_duration_months: d.roi_duration_months != null ? String(d.roi_duration_months) : '',
                    items: (d.items && d.items.length ? d.items : [{ item_name: '', qty: 1, rate: 0, discount_percentage: 0 }]),
                    projection_rows: (d.projection_rows && d.projection_rows.length
                        ? d.projection_rows
                        : [{ period_label: '', client_savings: 0, provider_revenue: 0, provider_cost: 0 }]),
                }
                setForm(f)
                await loadParties(f.proposal_to)
            } catch (err: any) {
                toast({
                    title: msg('Error', 'خطأ'),
                    description: err?.message || msg('Failed to load proposal.', 'فشل تحميل العرض.'),
                    variant: 'destructive',
                })
            } finally {
                setLoading(false)
            }
        }
        init()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editingName])

    // ---------------------------------------------------------------------------
    // Live computed totals
    // ---------------------------------------------------------------------------

    const computed = useMemo(() => {
        const lineAmounts = form.items.map(it => {
            const qty = num(it.qty)
            const rate = num(it.rate)
            const disc = num(it.discount_percentage)
            const gross = qty * rate
            return gross - (gross * disc) / 100
        })
        const total = lineAmounts.reduce((a, b) => a + b, 0)
        const addDisc = num(form.additional_discount)
        const netBeforeVat = Math.max(0, total - addDisc)
        const vatRate = num(form.vat_rate)
        const vatAmount = (netBeforeVat * vatRate) / 100
        const grandTotal = netBeforeVat + vatAmount
        return { lineAmounts, total, vatAmount, grandTotal }
    }, [form.items, form.additional_discount, form.vat_rate])

    // Live computed savings / ROI
    const savings = useMemo(() => {
        const current = num(form.client_current_cost)
        const proposed = num(form.proposed_cost)
        const months = num(form.roi_duration_months)
        const estimatedSavings = Math.max(0, current - proposed) * (months > 0 ? months : 1)
        const savingsPercentage = current > 0 ? ((current - proposed) / current) * 100 : 0
        const monthlySaving = Math.max(0, current - proposed)
        const paybackPeriodMonths = monthlySaving > 0 ? proposed / monthlySaving : 0
        return { estimatedSavings, savingsPercentage, paybackPeriodMonths }
    }, [form.client_current_cost, form.proposed_cost, form.roi_duration_months])

    const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 })
    // Currency display in the active locale for this proposal's chosen currency.
    const money = (v: number) => formatCurrency(v, { locale: lang, currency: form.currency || 'SAR', decimals: 2 })

    // ---------------------------------------------------------------------------
    // Item helpers
    // ---------------------------------------------------------------------------

    const updateItem = (idx: number, field: keyof ItemRow, value: any) =>
        setForm(f => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, [field]: value } : it)) }))
    const addItem = () =>
        setForm(f => ({ ...f, items: [...f.items, { item_name: '', qty: 1, rate: 0, discount_percentage: 0 }] }))
    const removeItem = (idx: number) =>
        setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))

    // Append an item chosen from the ERPNext Item catalog (replaces the lone
    // empty default row if that's all there is).
    const addCatalogItem = (it: CatalogItem) =>
        setForm(f => {
            const onlyEmpty = f.items.length === 1 && !f.items[0].item_name && !f.items[0].item_code && !num(f.items[0].rate)
            const base = onlyEmpty ? [] : f.items
            return {
                ...f,
                items: [...base, {
                    item_code: it.item_code,
                    item_name: it.item_name || it.item_code,
                    description: it.description || undefined,
                    qty: 1,
                    uom: it.stock_uom || undefined,
                    rate: num(it.standard_rate),
                    discount_percentage: 0,
                }],
            }
        })

    // Projection helpers removed with the hidden Projections UI (2026-07-04).
    // `projection_rows` still lives in form state and round-trips through buildPayload.

    // ---------------------------------------------------------------------------
    // Save
    // ---------------------------------------------------------------------------

    const buildPayload = () => {
        const items = form.items
            .filter(it => (it.item_name || it.item_code))
            .map(it => {
                const qty = num(it.qty)
                const rate = num(it.rate)
                const disc = num(it.discount_percentage)
                const gross = qty * rate
                const amount = gross - (gross * disc) / 100
                return {
                    item_code: it.item_code || undefined,
                    item_name: it.item_name || undefined,
                    description: it.description || undefined,
                    qty,
                    uom: it.uom || undefined,
                    rate,
                    discount_percentage: disc,
                    amount,
                }
            })
        const projection_rows = form.projection_rows
            .filter(r => r.period_label || r.client_savings || r.provider_revenue || r.provider_cost)
            .map(r => ({
                period_label: r.period_label || undefined,
                client_savings: num(r.client_savings),
                provider_revenue: num(r.provider_revenue),
                provider_cost: num(r.provider_cost),
                net_cashflow: num(r.provider_revenue) - num(r.provider_cost),
                notes: r.notes || undefined,
            }))

        return {
            title: form.title || undefined,
            proposal_to: form.proposal_to,
            party_name: form.party_name || undefined,
            party_display_name: form.party_display_name || undefined,
            company: form.company || undefined,
            currency: form.currency || 'SAR',
            transaction_date: form.transaction_date || undefined,
            valid_till: form.valid_till || undefined,
            language: form.language || 'ar',
            status: form.status || 'Draft',
            executive_summary: form.executive_summary || undefined,
            scope_of_work: form.scope_of_work || undefined,
            contract_terms: form.contract_terms || undefined,
            additional_discount: num(form.additional_discount),
            vat_rate: num(form.vat_rate),
            vat_amount: computed.vatAmount,
            total: computed.total,
            grand_total: computed.grandTotal,
            requires_signature: form.requires_signature ? 1 : 0,
            client_current_cost: num(form.client_current_cost),
            proposed_cost: num(form.proposed_cost),
            roi_duration_months: num(form.roi_duration_months),
            estimated_savings: savings.estimatedSavings,
            savings_percentage: savings.savingsPercentage,
            payback_period_months: savings.paybackPeriodMonths,
            items,
            projection_rows,
        }
    }

    const handleSave = async () => {
        if (!form.title) {
            toast({ title: msg('Validation', 'تحقق'), description: msg('Title is required.', 'العنوان مطلوب.'), variant: 'destructive' })
            return
        }
        if (!form.party_name) {
            toast({ title: msg('Validation', 'تحقق'), description: msg('Client / party is required.', 'العميل مطلوب.'), variant: 'destructive' })
            return
        }
        setSaving(true)
        try {
            const payload = buildPayload()
            let resultName = savedName
            if (savedName) {
                await frappeClient.call('base_meena.sales_proposal.api.update_proposal', { name: savedName, payload })
            } else {
                const res = await frappeClient.call<any>('base_meena.sales_proposal.api.create_proposal', { payload })
                resultName = res?.message?.name || res?.message || null
                setSavedName(resultName)
            }
            toast({
                title: msg('Success', 'تم'),
                description: savedName ? msg('Proposal updated.', 'تم تحديث العرض.') : msg('Proposal created.', 'تم إنشاء العرض.'),
            })
            onSaved()

            // Status automation: when accepted (for a Customer party), offer to
            // create the invoice right away.
            if (form.status === 'Accepted' && form.proposal_to === 'Customer' && resultName && typeof window !== 'undefined') {
                if (window.confirm(msg(
                    'This proposal is accepted. Create its invoice now?',
                    'هذا العرض مقبول. هل تريد إنشاء فاتورته الآن؟',
                ))) {
                    try {
                        const inv = (await frappeClient.call<{ invoice?: string }>(
                            'base_meena.sales_proposal.api.convert_to_invoice', { name: resultName },
                        ))?.message
                        toast({ title: msg('Invoice created', 'تم إنشاء الفاتورة'), description: inv?.invoice || '' })
                    } catch (e: any) {
                        toast({
                            title: msg('Error', 'خطأ'),
                            description: e?.message || msg('Failed to create invoice.', 'فشل إنشاء الفاتورة.'),
                            variant: 'destructive',
                        })
                    }
                }
            }
        } catch (err: any) {
            toast({ title: msg('Error', 'خطأ'), description: err?.message || msg('Failed to save proposal.', 'فشل حفظ العرض.'), variant: 'destructive' })
        } finally {
            setSaving(false)
        }
    }

    // ---------------------------------------------------------------------------
    // Post-save actions
    // ---------------------------------------------------------------------------

    const handleCopyLink = async () => {
        if (!savedName) return
        try {
            const res = await frappeClient.call<{ token: string; path: string }>(
                'base_meena.sales_proposal.api.generate_public_link', { name: savedName }
            )
            const path = res?.message?.path
            if (!path) throw new Error(msg('No link returned.', 'لم يتم إرجاع رابط.'))
            const fullUrl = window.location.origin + path
            await navigator.clipboard.writeText(fullUrl)
            toast({ title: msg('Link copied', 'تم نسخ الرابط'), description: fullUrl })
        } catch (err: any) {
            toast({ title: msg('Error', 'خطأ'), description: err?.message || msg('Failed.', 'فشل.'), variant: 'destructive' })
        }
    }

    const handleDownloadPdf = () => {
        if (!savedName) return
        window.open(proposalPdfUrl(savedName), '_blank', 'noopener,noreferrer')
    }

    const handleConvert = async () => {
        if (!savedName) return
        try {
            const res = await frappeClient.call<{ quotation: string }>(
                'base_meena.sales_proposal.api.convert_to_quotation', { name: savedName }
            )
            toast({
                title: msg('Converted', 'تم التحويل'),
                description: res?.message?.quotation
                    ? `${savedName} → ${res.message.quotation}`
                    : msg('Quotation created.', 'تم إنشاء عرض السعر.'),
            })
            onSaved()
        } catch (err: any) {
            toast({ title: msg('Error', 'خطأ'), description: err?.message || msg('Failed to convert.', 'فشل التحويل.'), variant: 'destructive' })
        }
    }

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    const sectionTitle = (en: string, ar: string) => (
        <h3 className="text-sm font-semibold text-gray-800 border-b pb-1.5">{isRTL ? ar : en}</h3>
    )

    // The party picker IS the client selector — label/placeholder track the
    // chosen "Proposal To" so it reads as the actual entity (Client for the
    // default Customer case). Backend stays party_name/party_display_name.
    const partyLabel = form.proposal_to === 'Lead' ? msg('Lead', 'العميل المحتمل')
        : form.proposal_to === 'Prospect' ? msg('Prospect', 'المرتقب')
        : msg('Client', 'العميل')
    const partyPlaceholder = form.proposal_to === 'Lead' ? msg('Select lead', 'اختر العميل المحتمل')
        : form.proposal_to === 'Prospect' ? msg('Select prospect', 'اختر المرتقب')
        : msg('Select client', 'اختر العميل')

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
                <DialogHeader>
                    <DialogTitle>
                        {savedName
                            ? (isRTL ? 'تعديل العرض' : 'Edit Proposal')
                            : (isRTL ? 'عرض مبيعات جديد' : 'New Sales Proposal')}
                    </DialogTitle>
                    <DialogDescription>
                        {isRTL ? 'أنشئ عرض مبيعات شامل مع العائد على الاستثمار والإسقاطات' : 'Build a complete sales proposal with ROI and projections'}
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="py-16 flex items-center justify-center text-gray-500">
                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                        {isRTL ? 'جاري التحميل...' : 'Loading...'}
                    </div>
                ) : (
                    <div className="space-y-6 pt-2">
                        {/* ============ START FROM TEMPLATE ============ */}
                        {templates.length > 0 && (
                            <div className="rounded-lg border border-dashed border-primary/40 bg-primary/[0.04] p-3 space-y-1.5">
                                <Label className="text-primary">
                                    {isRTL ? 'ابدأ من قالب' : 'Start from template'}
                                </Label>
                                <Select value="" disabled={applyingTemplate} onValueChange={applyTemplate}>
                                    <SelectTrigger>
                                        <SelectValue placeholder={
                                            applyingTemplate
                                                ? (isRTL ? 'جاري التطبيق...' : 'Applying...')
                                                : (isRTL ? 'اختر قالباً للتعبئة المسبقة' : 'Choose a template to prefill')
                                        } />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {templates.map(tpl => (
                                            <SelectItem key={tpl.name} value={tpl.name}>
                                                {tpl.template_name || tpl.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500">
                                    {isRTL
                                        ? 'يملأ الملخص والنطاق والشروط وضريبة القيمة المضافة والبنود.'
                                        : 'Prefills summary, scope, terms, VAT and items.'}
                                </p>
                            </div>
                        )}

                        {/* ============ CLIENT SECTION ============ */}
                        {sectionTitle('Client', 'العميل')}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* Client/party picker LEADS the section (it's the actual
                                "client"); reorder + dynamic relabel are display-only —
                                state field stays party_name/party_display_name. */}
                            <div className="space-y-1.5">
                                <Label>{partyLabel} *</Label>
                                <Select value={form.party_name}
                                    onValueChange={(v) => {
                                        const p = parties.find(x => x.name === v)
                                        setForm(f => ({ ...f, party_name: v, party_display_name: p?.label || v }))
                                    }}>
                                    <SelectTrigger><SelectValue placeholder={partyPlaceholder} /></SelectTrigger>
                                    <SelectContent>
                                        {parties.length === 0 ? (
                                            <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                                                {isRTL
                                                    ? 'لا يوجد عملاء بعد — أضِف عميلاً من صفحة "العملاء"'
                                                    : 'No clients yet — add one from the Clients page'}
                                            </div>
                                        ) : (
                                            parties.map(p => <SelectItem key={p.name} value={p.name}>{p.label}</SelectItem>)
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'العرض موجّه إلى' : 'Proposal To'}</Label>
                                <Select value={form.proposal_to}
                                    onValueChange={(v) => { setForm(f => ({ ...f, proposal_to: v, party_name: '', party_display_name: '' })); loadParties(v) }}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {PROPOSAL_TO.map(p => <SelectItem key={p} value={p}>{isRTL ? (PROPOSAL_TO_AR[p] || p) : p}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5 md:col-span-2">
                                <Label>{isRTL ? 'عنوان العرض *' : 'Proposal Title *'}</Label>
                                <Input value={form.title}
                                    placeholder={isRTL ? 'مثال: عرض خدمات إدارة الأسطول' : 'e.g. Fleet management services offer'}
                                    onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'الشركة' : 'Company'}</Label>
                                <Input value={form.company}
                                    placeholder={isRTL ? 'اختياري' : 'Optional'}
                                    onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'لغة العرض' : 'Language'}</Label>
                                <Select value={form.language} onValueChange={(v) => setForm(f => ({ ...f, language: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {LANGUAGES.map(l => <SelectItem key={l} value={l}>{l === 'ar' ? (isRTL ? 'العربية' : 'Arabic') : (isRTL ? 'الإنجليزية' : 'English')}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'تاريخ العرض' : 'Transaction Date'}</Label>
                                <LocalizedDateInput locale={lang} value={form.transaction_date}
                                    onChange={(iso) => setForm(f => ({ ...f, transaction_date: iso }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'صالح حتى' : 'Valid Till'}</Label>
                                <LocalizedDateInput locale={lang} value={form.valid_till}
                                    onChange={(iso) => setForm(f => ({ ...f, valid_till: iso }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'الحالة' : 'Status'}</Label>
                                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {STATUSES.map(s => <SelectItem key={s} value={s}>{isRTL ? (STATUS_AR[s] || s) : s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* ============ OFFER ITEMS SECTION ============ */}
                        <div className="flex items-center justify-between">
                            {sectionTitle('Offer Items', 'بنود العرض')}
                            <div className="flex gap-2">
                                <CatalogPicker onPick={addCatalogItem} isRTL={isRTL} />
                                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                                    <Plus className="h-3.5 w-3.5 mr-1" /> {isRTL ? 'إضافة بند' : 'Add item'}
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
                                <div className="col-span-4">{isRTL ? 'اسم الصنف' : 'Item Name'}</div>
                                <div className="col-span-2">{isRTL ? 'الكمية' : 'Qty'}</div>
                                <div className="col-span-2">{isRTL ? 'السعر' : 'Rate'}</div>
                                <div className="col-span-2">{isRTL ? 'الخصم %' : 'Disc %'}</div>
                                <div className="col-span-2 text-right">{isRTL ? 'المبلغ' : 'Amount'}</div>
                            </div>
                            {form.items.map((it, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                                    <Input className="col-span-12 md:col-span-4" placeholder={isRTL ? 'اسم الصنف' : 'Item name'}
                                        value={it.item_name || ''} onChange={(e) => updateItem(idx, 'item_name', e.target.value)} />
                                    <Input className="col-span-3 md:col-span-2" type="number" placeholder="1"
                                        value={it.qty as any} onChange={(e) => updateItem(idx, 'qty', e.target.value)} />
                                    <Input className="col-span-3 md:col-span-2" type="number" placeholder="0"
                                        value={it.rate as any} onChange={(e) => updateItem(idx, 'rate', e.target.value)} />
                                    <Input className="col-span-3 md:col-span-2" type="number" placeholder="0"
                                        value={it.discount_percentage as any} onChange={(e) => updateItem(idx, 'discount_percentage', e.target.value)} />
                                    <div className="col-span-2 md:col-span-1 text-right text-sm font-semibold">
                                        {fmt(computed.lineAmounts[idx] || 0)}
                                    </div>
                                    <div className="col-span-1 flex justify-end">
                                        {form.items.length > 1 && (
                                            <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => removeItem(idx)}>
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Totals summary card removed from DISPLAY (2026-07-02),
                            incl. the Additional Discount input it contained. The
                            `computed` memo stays untouched: it still fills
                            buildPayload (total / vat_amount / grand_total) on save
                            and the per-row Amount column above. Existing
                            additional_discount values are preserved on edit via
                            form state. */}

                        {/* ============ NARRATIVE SECTION ============ */}
                        {sectionTitle('Executive Summary & Scope', 'الملخص التنفيذي والنطاق')}
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'الملخص التنفيذي' : 'Executive Summary'}</Label>
                                <Textarea rows={4} value={form.executive_summary}
                                    placeholder={isRTL ? 'اكتب ملخصاً تنفيذياً...' : 'Write an executive summary...'}
                                    onChange={(e) => setForm(f => ({ ...f, executive_summary: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'نطاق العمل' : 'Scope of Work'}</Label>
                                <Textarea rows={4} value={form.scope_of_work}
                                    placeholder={isRTL ? 'حدد نطاق العمل...' : 'Define the scope of work...'}
                                    onChange={(e) => setForm(f => ({ ...f, scope_of_work: e.target.value }))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>{isRTL ? 'شروط العقد' : 'Contract Terms'}</Label>
                                <Textarea rows={4} value={form.contract_terms}
                                    placeholder={isRTL ? 'اكتب شروط العقد...' : 'Enter the contract terms...'}
                                    onChange={(e) => setForm(f => ({ ...f, contract_terms: e.target.value }))} />
                            </div>
                        </div>

                        {/* Savings/ROI section removed from DISPLAY (2026-07-02).
                            The `savings` memo + form fields stay: they still feed
                            buildPayload (estimated_savings / savings_percentage /
                            payback_period_months) so saved records, the public
                            page and the PDF keep their values. */}

                        {/* Projections section fully hidden (2026-07-04) at client request:
                            it wasn't shown on the PDF or the public page, so the editable
                            table was pure clutter. `form.projection_rows` state + buildPayload
                            are left intact (buildPayload filters out empty rows), so nothing
                            breaks and any pre-existing projection data on a saved proposal is
                            preserved on round-trip. Re-add the table here to bring it back. */}

                        {/* ============ SUBMIT ============ */}
                        <div className="flex flex-wrap gap-3 pt-2 border-t">
                            <Button className="flex-1 min-w-[140px]" onClick={handleSave} disabled={saving}>
                                {saving
                                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{isRTL ? 'جاري الحفظ...' : 'Saving...'}</>
                                    : (isRTL ? 'حفظ' : 'Save')}
                            </Button>
                            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                                {isRTL ? 'إغلاق' : 'Close'}
                            </Button>
                        </div>

                        {/* ============ POST-SAVE ACTIONS ============ */}
                        {savedName && (
                            <div className="flex flex-wrap gap-2 pt-1">
                                <Button variant="outline" size="sm" onClick={handleCopyLink}>
                                    <Link2 className="h-4 w-4 mr-1.5" />{isRTL ? 'نسخ الرابط العام' : 'Copy public link'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                                    <Download className="h-4 w-4 mr-1.5" />{isRTL ? 'تنزيل PDF' : 'Download PDF'}
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleConvert}>
                                    <ArrowRightLeft className="h-4 w-4 mr-1.5" />{isRTL ? 'تحويل إلى عرض سعر' : 'Convert to Quotation'}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
