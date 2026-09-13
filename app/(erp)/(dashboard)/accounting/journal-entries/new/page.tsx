'use client'

import { useState, useEffect, useCallback, useId, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { accountingApi, type Account, type JournalEntry } from '@/lib/accounting-api'
import { frappeClient, type FrappeFilter } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Toaster } from '@/components/ui/toaster'
import {
  Plus, Trash2, ArrowLeft, Save,
  AlertCircle, CheckCircle2, Loader2,
  BookOpen, Info,
} from 'lucide-react'
import { cn, localToday } from '@/lib/utils'
import { validateJournalEntryLines } from '@/lib/accounting-logic'
import { useI18n } from '@/lib/i18n'

// ─── Types ────────────────────────────────────────────────────────────────────

type VoucherType = NonNullable<JournalEntry['voucher_type']>
type Locale = 'ar' | 'en'

interface LineItem {
  id: string
  account: string
  account_name: string
  party_type: string
  party: string
  debit: string
  credit: string
  cost_center: string
  user_remark: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const VOUCHER_TYPES: VoucherType[] = [
  'Journal Entry', 'Bank Entry', 'Cash Entry',
  'Credit Note', 'Debit Note', 'Opening Entry',
  'Contra Entry', 'Excise Entry', 'Write Off Entry',
  'Depreciation Entry', 'Exchange Rate Revaluation',
]

const VOUCHER_LABELS: Record<Locale, Record<VoucherType, string>> = {
  ar: {
    'Journal Entry': 'قيد يومية',
    'Bank Entry': 'قيد بنكي',
    'Cash Entry': 'قيد نقدي',
    'Credit Note': 'إشعار دائن',
    'Debit Note': 'إشعار مدين',
    'Opening Entry': 'قيد افتتاحي',
    'Contra Entry': 'قيد مقاصة',
    'Excise Entry': 'قيد ضريبة',
    'Write Off Entry': 'قيد شطب',
    'Depreciation Entry': 'قيد إهلاك',
    'Exchange Rate Revaluation': 'إعادة تقييم سعر الصرف',
  },
  en: {
    'Journal Entry': 'Journal Entry',
    'Bank Entry': 'Bank Entry',
    'Cash Entry': 'Cash Entry',
    'Credit Note': 'Credit Note',
    'Debit Note': 'Debit Note',
    'Opening Entry': 'Opening Entry',
    'Contra Entry': 'Contra Entry',
    'Excise Entry': 'Excise Entry',
    'Write Off Entry': 'Write Off Entry',
    'Depreciation Entry': 'Depreciation Entry',
    'Exchange Rate Revaluation': 'Exchange Rate Revaluation',
  },
}

const PARTY_TYPES = ['', 'Customer', 'Supplier', 'Employee', 'Shareholder', 'Student', 'Member']

// ERPNext enforces: Receivable account → Customer, Payable account → Supplier
const ACCOUNT_TYPE_TO_PARTY: Record<string, string> = {
  Receivable: 'Customer',
  Payable: 'Supplier',
}

const PARTY_LABELS: Record<Locale, Record<string, string>> = {
  ar: {
    '': 'لا يوجد',
    Customer: 'عميل',
    Supplier: 'مورد',
    Employee: 'موظف',
    Shareholder: 'مساهم',
    Student: 'طالب',
    Member: 'عضو',
  },
  en: {
    '': 'None',
    Customer: 'Customer',
    Supplier: 'Supplier',
    Employee: 'Employee',
    Shareholder: 'Shareholder',
    Student: 'Student',
    Member: 'Member',
  },
}

const L = {
  ar: {
    selectAccount: 'اختر الحساب...',
    searchAccount: 'ابحث عن حساب...',
    noResults: 'لا توجد نتائج',
    balanced: 'القيد متوازن ✓',
    unbalanced: 'القيد غير متوازن',
    totalDebit: 'إجمالي المدين',
    totalCredit: 'إجمالي الدائن',
    difference: 'الفرق',
    error: 'خطأ',
    loadAccountsError: 'فشل تحميل الحسابات',
    saveSuccessTitle: 'تم الحفظ',
    saveSuccessDesc: 'تم إنشاء القيد اليومي بنجاح',
    saveFailTitle: 'فشل الحفظ',
    unknownError: 'حدث خطأ',
    breadcrumbsEntries: 'القيود اليومية',
    breadcrumbsNewEntry: 'قيد يومية جديد',
    cancel: 'إلغاء',
    saving: 'جاري الحفظ...',
    saveEntry: 'حفظ القيد',
    entryInfo: 'معلومات القيد',
    voucherType: 'نوع القيد',
    postingDate: 'تاريخ الترحيل',
    company: 'الشركة',
    selectCompany: 'اختر الشركة...',
    companyName: 'اسم الشركة',
    remarkOptional: 'ملاحظة (اختياري)',
    remarkPlaceholder: 'ملاحظة على القيد...',
    lineItems: 'بنود القيد',
    line: 'سطر',
    accountRequired: 'الحساب *',
    partyType: 'نوع الطرف',
    party: 'الطرف',
    debit: 'مدين',
    credit: 'دائن',
    debitLong: 'مدين (Dr)',
    creditLong: 'دائن (Cr)',
    costCenter: 'مركز التكلفة',
    required: 'مطلوب',
    optional: 'اختياري',
    deleteLine: 'حذف السطر',
    addLine: 'إضافة سطر',
    addLineRequired: 'يجب إضافة سطر واحد على الأقل',
    oneSidedRequired: 'أدخل مبلغاً في جانب واحد على الأقل (مدين أو دائن)',
    singleSideOnly: 'كل سطر يجب أن يحتوي قيمة في جانب واحد فقط (مدين أو دائن)',
    accountRequiredAll: 'جميع الأسطر يجب أن تحتوي على حساب',
    companyRequiredBeforeSave: 'الشركة مطلوبة قبل حفظ القيد',
    mustBalance: 'يجب أن يكون القيد متوازناً (المدين = الدائن)',
    readyToSave: 'القيد جاهز للحفظ',
  },
  en: {
    selectAccount: 'Select account...',
    searchAccount: 'Search account...',
    noResults: 'No results found',
    balanced: 'Entry is balanced ✓',
    unbalanced: 'Entry is not balanced',
    totalDebit: 'Total Debit',
    totalCredit: 'Total Credit',
    difference: 'Difference',
    error: 'Error',
    loadAccountsError: 'Failed to load accounts',
    saveSuccessTitle: 'Saved',
    saveSuccessDesc: 'Journal entry created successfully',
    saveFailTitle: 'Save failed',
    unknownError: 'Something went wrong',
    breadcrumbsEntries: 'Journal Entries',
    breadcrumbsNewEntry: 'New Journal Entry',
    cancel: 'Cancel',
    saving: 'Saving...',
    saveEntry: 'Save Entry',
    entryInfo: 'Entry Information',
    voucherType: 'Voucher Type',
    postingDate: 'Posting Date',
    company: 'Company',
    selectCompany: 'Select company...',
    companyName: 'Company name',
    remarkOptional: 'Remark (optional)',
    remarkPlaceholder: 'Add a note to this entry...',
    lineItems: 'Entry Lines',
    line: 'line',
    accountRequired: 'Account *',
    partyType: 'Party Type',
    party: 'Party',
    debit: 'Debit',
    credit: 'Credit',
    debitLong: 'Debit (Dr)',
    creditLong: 'Credit (Cr)',
    costCenter: 'Cost Center',
    required: 'Required',
    optional: 'Optional',
    deleteLine: 'Delete line',
    addLine: 'Add Line',
    addLineRequired: 'At least one line is required',
    oneSidedRequired: 'Enter an amount on at least one side (debit or credit)',
    singleSideOnly: 'Each line must contain amount on one side only (debit or credit)',
    accountRequiredAll: 'All lines must have an account',
    companyRequiredBeforeSave: 'Company is required before saving the entry',
    mustBalance: 'Journal entry must be balanced (debit = credit)',
    readyToSave: 'Entry is ready to save',
  },
} as const

const parseNum = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n }
const newLine = (): LineItem => ({
  id: crypto.randomUUID(),
  account: '', account_name: '', party_type: '', party: '',
  debit: '', credit: '', cost_center: '', user_remark: '',
})

const fmt = (n: number, locale: Locale) =>
  n.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// ─── Account Combobox ─────────────────────────────────────────────────────────

function AccountCombobox({
  accounts, value, accountName, onChange, labels, disabled,
}: {
  accounts: Account[]
  value: string
  accountName: string
  onChange: (name: string, displayName: string) => void
  labels: {
    selectAccount: string
    searchAccount: string
    noResults: string
  }
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const uid = useId()

  const filtered = accounts
    .filter(a => !a.is_group && (
      a.account_name.toLowerCase().includes(search.toLowerCase()) ||
      a.name.toLowerCase().includes(search.toLowerCase())
    ))
    .slice(0, 30)

  return (
    <div className="relative">
      <button
        id={uid}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(p => !p)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border bg-white px-3 py-2 text-sm',
          'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400',
          'disabled:cursor-not-allowed disabled:opacity-50',
          !value ? 'border-gray-300 text-gray-400' : 'border-gray-300 text-gray-800'
        )}
      >
        <span className="truncate">{value ? accountName || value : labels.selectAccount}</span>
        <span className="text-gray-400 text-xs ms-1">▼</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[260px] rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <Input
              autoFocus
              placeholder={labels.searchAccount}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-sm border-gray-200"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400">{labels.noResults}</li>
            )}
            {filtered.map(acc => (
              <li
                key={acc.name}
                onClick={() => { onChange(acc.name, acc.account_name); setSearch(''); setOpen(false) }}
                className={cn(
                  'flex flex-col px-3 py-2 cursor-pointer hover:bg-indigo-50 text-sm',
                  value === acc.name && 'bg-indigo-50'
                )}
              >
                <span className="font-medium text-gray-800">{acc.account_name}</span>
                <span className="text-xs text-gray-400 font-mono">{acc.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Party Combobox ───────────────────────────────────────────────────────────

const PARTY_DOCTYPE: Record<string, string> = {
  Customer: 'Customer',
  Supplier: 'Supplier',
  Employee: 'Employee',
  Shareholder: 'Shareholder',
  Student: 'Student',
  Member: 'Member',
}

const PARTY_NAME_FIELD: Record<string, string> = {
  Customer: 'customer_name',
  Supplier: 'supplier_name',
  Employee: 'employee_name',
  Shareholder: 'shareholder_name',
  Student: 'student_name',
  Member: 'member_name',
}

function PartyCombobox({
  partyType,
  value,
  onChange,
  placeholder,
  noResults,
}: {
  partyType: string
  value: string
  onChange: (name: string) => void
  placeholder: string
  noResults: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<{ name: string; label: string }[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const uid = useId()

  useEffect(() => {
    if (!partyType || !open) return

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      const doctype = PARTY_DOCTYPE[partyType]
      if (!doctype) return
      setLoading(true)
      try {
        const nameField = PARTY_NAME_FIELD[partyType]
        const fields = nameField ? ['name', nameField] : ['name']
        const filters: FrappeFilter[] = search.trim()
          ? [[doctype, 'name', 'like', `%${search.trim()}%`]]
          : []
        const data = await frappeClient.getList<Record<string, string>>(doctype, {
          fields,
          filters,
          limit_page_length: 20,
        })
        setResults(
          data.map((row) => ({
            name: row.name,
            label: nameField && row[nameField] ? row[nameField] : row.name,
          }))
        )
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [partyType, search, open])

  // Reset when partyType changes
  useEffect(() => {
    setSearch('')
    setResults([])
  }, [partyType])

  if (!partyType) {
    return (
      <input
        disabled
        placeholder={placeholder}
        className="h-9 w-full rounded-md border border-gray-300 bg-gray-50 px-3 text-sm text-gray-400 cursor-not-allowed"
      />
    )
  }

  return (
    <div className="relative">
      <button
        id={uid}
        type="button"
        onClick={() => { setOpen(p => !p); if (!open) setSearch('') }}
        className="flex h-9 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
      >
        <span className={value ? 'text-gray-800 truncate' : 'text-gray-400 truncate'}>{value || placeholder}</span>
        <span className="text-gray-400 text-xs ms-1">▼</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <Input
              autoFocus
              placeholder={placeholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-8 text-sm border-gray-200"
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {loading && (
              <li className="px-3 py-2 text-sm text-gray-400">...</li>
            )}
            {!loading && results.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400">{noResults}</li>
            )}
            {!loading && results.map(r => (
              <li
                key={r.name}
                onClick={() => { onChange(r.name); setOpen(false); setSearch('') }}
                className="flex flex-col px-3 py-2 cursor-pointer hover:bg-indigo-50 text-sm"
              >
                <span className="font-medium text-gray-800">{r.label}</span>
                {r.label !== r.name && <span className="text-xs text-gray-400 font-mono">{r.name}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── Balance Bar ──────────────────────────────────────────────────────────────

function BalanceBar({
  totalDebit,
  totalCredit,
  locale,
  labels,
}: {
  totalDebit: number
  totalCredit: number
  locale: Locale
  labels: {
    balanced: string
    unbalanced: string
    totalDebit: string
    totalCredit: string
    difference: string
  }
}) {
  const diff = Math.abs(totalDebit - totalCredit)
  const balanced = diff < 0.001

  return (
    <div className={cn(
      'flex flex-wrap items-center gap-4 rounded-xl border px-5 py-3 text-sm transition-colors',
      balanced
        ? 'border-emerald-200 bg-emerald-50'
        : 'border-rose-200 bg-rose-50'
    )}>
      <div className="flex items-center gap-2">
        {balanced
          ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          : <AlertCircle className="h-4 w-4 text-rose-600" />
        }
        <span className={cn('font-semibold', balanced ? 'text-emerald-700' : 'text-rose-700')}>
          {balanced ? labels.balanced : labels.unbalanced}
        </span>
      </div>

      <div className="flex flex-wrap gap-5 ms-4 text-gray-700">
        <span>
          {labels.totalDebit}:{' '}
          <span className="font-mono font-bold text-gray-900">{fmt(totalDebit, locale)}</span>
        </span>
        <span>
          {labels.totalCredit}:{' '}
          <span className="font-mono font-bold text-gray-900">{fmt(totalCredit, locale)}</span>
        </span>
        {!balanced && (
          <span className="text-rose-600 font-semibold">
            {labels.difference}: <span className="font-mono">{fmt(diff, locale)}</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewJournalEntryPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { lang, isRTL } = useI18n()
  const locale: Locale = lang === 'ar' ? 'ar' : 'en'
  const t = L[locale]

  // Header
  const [voucherType, setVoucherType] = useState<VoucherType>('Journal Entry')
  const [postingDate, setPostingDate] = useState(localToday())
  const [company, setCompany] = useState('')
  const [userRemark, setUserRemark] = useState('')

  // Lines
  const [lines, setLines] = useState<LineItem[]>([newLine(), newLine()])

  // Accounts
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loadingAcc, setLoadingAcc] = useState(true)
  const [companies, setCompanies] = useState<string[]>([])

  // Submit
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    accountingApi.getAccounts()
      .then(data => {
        setAccounts(data)
        const coys = [...new Set(data.map(a => a.company).filter(Boolean))]
        setCompanies(coys)
        if (coys.length === 1) setCompany(coys[0])
      })
      .catch(() => toast({ title: t.error, description: t.loadAccountsError, variant: 'destructive' }))
      .finally(() => setLoadingAcc(false))
  }, [toast, t.error, t.loadAccountsError])

  // ── Line helpers ──────────────────────────────────────────────────
  const addLine = () => setLines(p => [...p, newLine()])
  const removeLine = (id: string) => setLines(p => p.filter(l => l.id !== id))
  const updateLine = (id: string, patch: Partial<LineItem>) =>
    setLines(p => p.map(l => l.id === id ? { ...l, ...patch } : l))

  // ── Validation ────────────────────────────────────────────────────
  const validation = validateJournalEntryLines(
    lines.map(line => ({
      account: line.account,
      debit: line.debit,
      credit: line.credit,
    }))
  )
  const effectiveLines = validation.effectiveLines.map(line => ({
    index: line.index,
    line: lines[line.index],
  }))
  const totalDebit = validation.totalDebit
  const totalCredit = validation.totalCredit
  const balanced = validation.balanced
  const allHaveAcct = validation.allHaveAccounts
  const amountsValid = validation.allSingleSided
  const hasValueLines = validation.hasValueLines
  const hasCompany = company.trim() !== ''
  const canSave = validation.isValid && hasCompany && !saving && !loadingAcc

  // ── Submit ────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!canSave) return
    try {
      setSaving(true)
      await accountingApi.createJournalEntry({
        company,
        posting_date: postingDate,
        voucher_type: voucherType,
        user_remark: userRemark || undefined,
        accounts: effectiveLines.map(({ line }) => ({
          account: line.account,
          debit_in_account_currency: parseNum(line.debit) || undefined,
          credit_in_account_currency: parseNum(line.credit) || undefined,
          party_type: line.party_type || undefined,
          party: line.party || undefined,
          cost_center: line.cost_center || undefined,
          user_remark: line.user_remark || undefined,
        })),
      })
      toast({ title: t.saveSuccessTitle, description: t.saveSuccessDesc })
      router.push('/accounting/journal-entries')
    } catch (err: any) {
      toast({ title: t.saveFailTitle, description: err?.message ?? t.unknownError, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }, [
    canSave,
    company,
    postingDate,
    voucherType,
    userRemark,
    effectiveLines,
    toast,
    router,
    t.saveSuccessTitle,
    t.saveSuccessDesc,
    t.saveFailTitle,
    t.unknownError,
  ])

  // ─────────────────────────────────────────────────────────────────
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} lang={locale} className="min-h-screen bg-gray-50">

      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <button
              onClick={() => router.push('/accounting/journal-entries')}
              className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t.breadcrumbsEntries}
            </button>
            <span>/</span>
            <span className="text-gray-800 font-semibold flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-indigo-600" />
              {t.breadcrumbsNewEntry}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/accounting/journal-entries')}
              className="border-gray-200 text-gray-600"
            >
              {t.cancel}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!canSave}
              className={cn(
                'min-w-[130px] font-semibold',
                canSave
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              )}
            >
              {saving
                ? <><Loader2 className="h-4 w-4 animate-spin me-2" />{t.saving}</>
                : <><Save className="h-4 w-4 me-2" />{t.saveEntry}</>
              }
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5 max-w-6xl mx-auto">

        {/* ── Header fields ── */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Info className="h-4 w-4 text-gray-400" />
            {t.entryInfo}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Voucher type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500">{t.voucherType}</Label>
              <select
                value={voucherType}
                onChange={e => setVoucherType(e.target.value as VoucherType)}
                className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                {VOUCHER_TYPES.map(vt => (
                  <option key={vt} value={vt}>{VOUCHER_LABELS[locale][vt]}</option>
                ))}
              </select>
            </div>

            {/* Posting date */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500">{t.postingDate}</Label>
              <Input
                type="date"
                value={postingDate}
                onChange={e => setPostingDate(e.target.value)}
                className="h-9 text-sm border-gray-300"
              />
            </div>

            {/* Company */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-500">{t.company}</Label>
              {companies.length > 1 ? (
                <select
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">{t.selectCompany}</option>
                  {companies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <Input
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder={t.companyName}
                  className="h-9 text-sm border-gray-300"
                />
              )}
            </div>

            {/* Remark */}
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label className="text-xs font-medium text-gray-500">{t.remarkOptional}</Label>
              <Textarea
                value={userRemark}
                onChange={e => setUserRemark(e.target.value)}
                placeholder={t.remarkPlaceholder}
                rows={2}
                className="text-sm resize-none border-gray-300"
              />
            </div>
          </div>
        </div>

        {/* ── Balance bar ── */}
        <BalanceBar
          totalDebit={totalDebit}
          totalCredit={totalCredit}
          locale={locale}
          labels={{
            balanced: t.balanced,
            unbalanced: t.unbalanced,
            totalDebit: t.totalDebit,
            totalCredit: t.totalCredit,
            difference: t.difference,
          }}
        />

        {/* ── Line items ── */}
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">{t.lineItems}</h2>
            <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 border-0">
              {lines.length} {t.line}
            </Badge>
          </div>

          {/* Column headers */}
          <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold uppercase tracking-wide text-gray-400">
            <span>{t.accountRequired}</span>
            <span>{t.partyType}</span>
            <span>{t.party}</span>
            <span className="text-end">{t.debitLong}</span>
            <span className="text-end">{t.creditLong}</span>
            <span>{t.costCenter}</span>
            <span></span>
          </div>

          {/* Loading placeholder */}
          {loadingAcc && (
            <div className="p-4 space-y-3">
              {[0, 1].map(i => (
                <div key={i} className="grid grid-cols-6 gap-2">
                  {[0, 1, 2, 3, 4, 5].map(j => <Skeleton key={j} className="h-9 rounded" />)}
                </div>
              ))}
            </div>
          )}

          {/* Lines */}
          {!loadingAcc && (
            <div className="divide-y divide-gray-50">
              {lines.map((line) => {
                const debitVal = parseNum(line.debit)
                const creditVal = parseNum(line.credit)

                return (
                  <div
                    key={line.id}
                    className="grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto] gap-2 items-start px-4 py-3"
                  >
                    {/* Account */}
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-400 lg:hidden">{t.accountRequired}</Label>
                      <AccountCombobox
                        accounts={accounts}
                        value={line.account}
                        accountName={line.account_name}
                        labels={{
                          selectAccount: t.selectAccount,
                          searchAccount: t.searchAccount,
                          noResults: t.noResults,
                        }}
                        onChange={(name, displayName) => {
                          const acct = accounts.find(a => a.name === name)
                          const forcedParty = acct?.account_type ? ACCOUNT_TYPE_TO_PARTY[acct.account_type] : undefined
                          updateLine(line.id, {
                            account: name,
                            account_name: displayName,
                            party_type: forcedParty ?? '',
                            party: forcedParty ? line.party : '',
                          })
                        }}
                      />
                      {!line.account && (
                        <p className="text-[10px] text-rose-500">{t.required}</p>
                      )}
                    </div>

                    {/* Party type */}
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-400 lg:hidden">{t.partyType}</Label>
                      {(() => {
                        const acct = accounts.find(a => a.name === line.account)
                        const lockedParty = acct?.account_type ? ACCOUNT_TYPE_TO_PARTY[acct.account_type] : undefined
                        return (
                          <select
                            value={line.party_type}
                            disabled={!!lockedParty}
                            onChange={e => updateLine(line.id, { party_type: e.target.value, party: '' })}
                            className={cn(
                              'h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400',
                              lockedParty && 'bg-gray-50 cursor-not-allowed opacity-70'
                            )}
                          >
                            {lockedParty ? (
                              <option value={lockedParty}>{PARTY_LABELS[locale][lockedParty] ?? lockedParty}</option>
                            ) : (
                              PARTY_TYPES.map(pt => (
                                <option key={pt} value={pt}>{PARTY_LABELS[locale][pt] ?? pt}</option>
                              ))
                            )}
                          </select>
                        )
                      })()}
                    </div>

                    {/* Party */}
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-400 lg:hidden">{t.party}</Label>
                      <PartyCombobox
                        partyType={line.party_type}
                        value={line.party}
                        onChange={(name) => updateLine(line.id, { party: name })}
                        placeholder={t.party}
                        noResults={t.noResults}
                      />
                    </div>

                    {/* Debit */}
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-400 lg:hidden">{t.debit}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.debit}
                        onChange={e => updateLine(line.id, { debit: e.target.value, credit: '' })}
                        placeholder="0.00"
                        className={cn(
                          'h-9 text-sm font-mono text-end border-gray-300',
                          debitVal > 0 && 'border-blue-300 ring-1 ring-blue-200'
                        )}
                      />
                    </div>

                    {/* Credit */}
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-400 lg:hidden">{t.credit}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.credit}
                        onChange={e => updateLine(line.id, { credit: e.target.value, debit: '' })}
                        placeholder="0.00"
                        className={cn(
                          'h-9 text-sm font-mono text-end border-gray-300',
                          creditVal > 0 && 'border-emerald-300 ring-1 ring-emerald-200'
                        )}
                      />
                    </div>

                    {/* Cost center */}
                    <div className="space-y-1">
                      <Label className="text-xs text-gray-400 lg:hidden">{t.costCenter}</Label>
                      <Input
                        value={line.cost_center}
                        onChange={e => updateLine(line.id, { cost_center: e.target.value })}
                        placeholder={t.optional}
                        className="h-9 text-sm border-gray-300"
                      />
                    </div>

                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => removeLine(line.id)}
                      disabled={lines.length <= 1}
                      title={t.deleteLine}
                      className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add line */}
          <div className="border-t border-gray-100 px-4 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addLine}
              className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
            >
              <Plus className="h-4 w-4 me-2" />
              {t.addLine}
            </Button>
          </div>
        </div>

        {/* ── Bottom save bar ── */}
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <ul className="text-sm space-y-0.5">
            {lines.length === 0 && (
              <li className="text-rose-500 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {t.addLineRequired}
              </li>
            )}
            {!hasValueLines && lines.length > 0 && (
              <li className="text-rose-500 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {t.oneSidedRequired}
              </li>
            )}
            {!amountsValid && hasValueLines && (
              <li className="text-rose-500 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {t.singleSideOnly}
              </li>
            )}
            {!allHaveAcct && lines.length > 0 && (
              <li className="text-rose-500 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {t.accountRequiredAll}
              </li>
            )}
            {!hasCompany && (
              <li className="text-rose-500 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {t.companyRequiredBeforeSave}
              </li>
            )}
            {!balanced && (
              <li className="text-rose-500 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {t.mustBalance}
              </li>
            )}
            {canSave && (
              <li className="text-emerald-600 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t.readyToSave}
              </li>
            )}
          </ul>

          <Button
            onClick={handleSave}
            disabled={!canSave}
            size="lg"
            className={cn(
              'min-w-[150px] font-bold',
              canSave
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed pointer-events-none'
            )}
          >
            {saving
              ? <><Loader2 className="h-5 w-5 animate-spin me-2" />{t.saving}</>
              : <><Save className="h-5 w-5 me-2" />{t.saveEntry}</>
            }
          </Button>
        </div>
      </div>

      <Toaster />
    </div>
  )
}
