'use client'

import { useState, useEffect, useMemo, useCallback, type ElementType, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { accountingApi, type Account, type AccountRootType, type AccountType } from '@/lib/accounting-api'
import { useI18n } from '@/lib/i18n'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import {
    AlertCircle,
    AlertTriangle,
    BookOpen,
    Building2,
    ChevronDown,
    ChevronLeft,
    ChevronsDownUp,
    ChevronsUpDown,
    Edit2,
    FileText,
    Folder,
    Info,
    MoreHorizontal,
    Plus,
    RefreshCw,
    Scale,
    Search,
    Trash2,
    TrendingDown,
    TrendingUp,
    Banknote,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRegisterStore } from '@/lib/register-store'

type Locale = 'ar' | 'en'
type EditorMode = 'add-child' | 'edit'

interface AccountNode extends Account {
    children: AccountNode[]
}

interface EditorFormState {
    accountName: string
    accountCode: string
    parentAccount: string
    company: string
    rootType: AccountRootType
    accountType: string
    isGroup: boolean
}

const ROOT_TYPES: AccountRootType[] = ['Asset', 'Liability', 'Equity', 'Income', 'Expense']

const L = {
    en: {
        title: 'Chart of Accounts',
        subtitle: 'A clean hierarchical view to understand and manage your financial structure.',
        refresh: 'Refresh',
        searchPlaceholder: 'Search by account name, code, or type...',
        allCompanies: 'All Companies',
        expandAll: 'Expand all',
        collapseAll: 'Collapse all',
        totalAccounts: 'Total Accounts',
        totalGroups: 'Group Accounts',
        totalLedgers: 'Ledger Accounts',
        searchResults: 'Search Results',
        guidance:
            'This tree gives you a clear financial structure. Use groups for reporting and ledgers for journal entries. You can add accounts or open the general ledger directly from each account actions menu.',
        loadErrorTitle: 'Failed to load chart of accounts',
        retry: 'Retry',
        noSearchResults: 'No matching accounts found',
        noAccounts: 'No accounts available',
        clearSearch: 'Clear search',
        showing: 'Showing',
        ofTotal: 'of',
        groupBadge: 'Group',
        ledgerBadge: 'Ledger',
        actions: 'Actions',
        addChildAction: 'Add Child Account',
        generalLedgerAction: 'General Ledger',
        viewGLPageAction: 'View in GL Page',
        editAction: 'Edit',
        treeExpand: 'Expand node',
        treeCollapse: 'Collapse node',
        editorAddTitle: 'Add Child Account',
        editorEditTitle: 'Edit Account',
        editorAddDesc: 'Create a new account under the selected parent account.',
        editorEditDesc: 'Update account details for the selected account.',
        fieldParentAccount: 'Parent Account',
        fieldAccountName: 'Account Name',
        fieldAccountCode: 'Account Code',
        fieldCompany: 'Company',
        fieldRootType: 'Root Type',
        fieldAccountType: 'Account Type',
        fieldAccountNature: 'Account Nature',
        groupOption: 'Group',
        ledgerOption: 'Ledger',
        cancel: 'Cancel',
        save: 'Save',
        saveLoading: 'Saving',
        saveAddTitle: 'Child account created',
        saveEditTitle: 'Account updated',
        saveAddDescription: 'The account has been created successfully.',
        saveEditDescription: 'The account has been updated successfully.',
        saveFailedTitle: 'Save failed',
        requiredName: 'Account name is required',
        requiredCompany: 'Company is required',
        rootAsset: 'Assets',
        rootLiability: 'Liabilities',
        rootEquity: 'Equity',
        rootIncome: 'Income',
        rootExpense: 'Expenses',
        archiveAction: 'Archive Account',
        archiveDialogTitle: 'Archive this account?',
        archiveDialogWarning: 'This is a permanent action. Archiving will disable this account and hide it from all transaction forms and reports. This cannot be easily undone.',
        archiveConfirmLabel: 'To confirm, type the account name below:',
        archiveConfirmPlaceholder: 'Type account name to confirm',
        archiveConfirmButton: 'Archive Account',
        archiveLoading: 'Archiving',
        archiveSuccess: 'Account archived',
        archiveSuccessDesc: 'The account has been disabled and will no longer appear in transaction forms.',
        archiveFailedTitle: 'Archive failed',
        archiveMismatch: 'Account name does not match',
    },
    ar: {
        title: 'دليل الحسابات',
        subtitle: 'عرض هرمي واضح ومنظم لفهم وإدارة الهيكل المالي.',
        refresh: 'تحديث',
        searchPlaceholder: 'ابحث باسم الحساب أو الرمز أو النوع...',
        allCompanies: 'كل الشركات',
        expandAll: 'توسيع الكل',
        collapseAll: 'طي الكل',
        totalAccounts: 'إجمالي الحسابات',
        totalGroups: 'حسابات مجموعة',
        totalLedgers: 'حسابات دفتر',
        searchResults: 'نتائج البحث',
        guidance:
            'تتيح لك هذه الشجرة رؤية الهيكل المالي بوضوح. استخدم الحسابات الرئيسية (المجموعات) للتقارير، والحسابات الفرعية (الدفاتر) لإنشاء قيود اليومية. يمكنك إضافة حسابات جديدة أو استعراض دفتر الأستاذ مباشرة من القائمة الجانبية لكل حساب.',
        loadErrorTitle: 'حدث خطأ أثناء تحميل دليل الحسابات',
        retry: 'إعادة المحاولة',
        noSearchResults: 'لا توجد نتائج مطابقة للبحث',
        noAccounts: 'لا توجد حسابات متاحة',
        clearSearch: 'مسح البحث',
        showing: 'عرض',
        ofTotal: 'من أصل',
        groupBadge: 'مجموعة',
        ledgerBadge: 'دفتر',
        actions: 'الإجراءات',
        addChildAction: 'إضافة حساب فرعي',
        generalLedgerAction: 'دفتر الأستاذ',
        viewGLPageAction: 'عرض في صفحة الأستاذ',
        editAction: 'تعديل',
        treeExpand: 'توسيع العقدة',
        treeCollapse: 'طي العقدة',
        editorAddTitle: 'إضافة حساب فرعي',
        editorEditTitle: 'تعديل الحساب',
        editorAddDesc: 'إنشاء حساب جديد تحت الحساب الرئيسي المحدد.',
        editorEditDesc: 'تحديث تفاصيل الحساب المحدد.',
        fieldParentAccount: 'الحساب الأب',
        fieldAccountName: 'اسم الحساب',
        fieldAccountCode: 'رمز الحساب',
        fieldCompany: 'الشركة',
        fieldRootType: 'التصنيف الجذري',
        fieldAccountType: 'نوع الحساب',
        fieldAccountNature: 'طبيعة الحساب',
        groupOption: 'مجموعة',
        ledgerOption: 'دفتر',
        cancel: 'إلغاء',
        save: 'حفظ',
        saveLoading: 'جاري الحفظ',
        saveAddTitle: 'تم إنشاء الحساب الفرعي',
        saveEditTitle: 'تم تحديث الحساب',
        saveAddDescription: 'تم إنشاء الحساب بنجاح.',
        saveEditDescription: 'تم تحديث الحساب بنجاح.',
        saveFailedTitle: 'فشل الحفظ',
        requiredName: 'اسم الحساب مطلوب',
        requiredCompany: 'الشركة مطلوبة',
        rootAsset: 'أصول',
        rootLiability: 'التزامات',
        rootEquity: 'حقوق ملكية',
        rootIncome: 'إيرادات',
        rootExpense: 'مصروفات',
        archiveAction: 'أرشفة الحساب',
        archiveDialogTitle: 'أرشفة هذا الحساب؟',
        archiveDialogWarning: 'هذا إجراء دائم. ستؤدي الأرشفة إلى تعطيل هذا الحساب وإخفائه من جميع نماذج المعاملات والتقارير. لا يمكن التراجع عن هذا بسهولة.',
        archiveConfirmLabel: 'للتأكيد، اكتب اسم الحساب أدناه:',
        archiveConfirmPlaceholder: 'اكتب اسم الحساب للتأكيد',
        archiveConfirmButton: 'أرشفة الحساب',
        archiveLoading: 'جارٍ الأرشفة',
        archiveSuccess: 'تمت أرشفة الحساب',
        archiveSuccessDesc: 'تم تعطيل الحساب ولن يظهر بعد الآن في نماذج المعاملات.',
        archiveFailedTitle: 'فشلت الأرشفة',
        archiveMismatch: 'اسم الحساب غير متطابق',
    },
} as const

const ROOT_TYPE_ORDER: Record<AccountRootType, number> = {
    Asset: 0,
    Liability: 1,
    Equity: 2,
    Income: 3,
    Expense: 4,
}

function buildTree(accounts: Account[], locale: Locale): AccountNode[] {
    const map = new Map<string, AccountNode>()

    for (const acc of accounts) {
        map.set(acc.name, { ...acc, children: [] })
    }

    const roots: AccountNode[] = []

    for (const node of map.values()) {
        if (node.parent_account && map.has(node.parent_account)) {
            map.get(node.parent_account)!.children.push(node)
        } else {
            roots.push(node)
        }
    }

    const sortNodes = (nodes: AccountNode[], isRoot = false) => {
        nodes.sort((a, b) => {
            if (isRoot && a.root_type && b.root_type) {
                const orderDiff = (ROOT_TYPE_ORDER[a.root_type] ?? 99) - (ROOT_TYPE_ORDER[b.root_type] ?? 99)
                if (orderDiff !== 0) return orderDiff
            }
            const left = `${a.account_name} ${a.name}`.trim()
            const right = `${b.account_name} ${b.name}`.trim()
            return left.localeCompare(right, locale)
        })

        for (const node of nodes) {
            sortNodes(node.children)
        }
    }

    sortNodes(roots, true)
    return roots
}

function filterTreeByQuery(nodes: AccountNode[], query: string): AccountNode[] {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return nodes

    const walk = (list: AccountNode[]): AccountNode[] => {
        const result: AccountNode[] = []

        for (const node of list) {
            const childMatches = walk(node.children)
            const selfMatches =
                node.account_name.toLowerCase().includes(trimmed) ||
                node.name.toLowerCase().includes(trimmed) ||
                (node.account_type ?? '').toLowerCase().includes(trimmed)

            if (selfMatches || childMatches.length > 0) {
                result.push({ ...node, children: childMatches })
            }
        }

        return result
    }

    return walk(nodes)
}

function countNodes(nodes: AccountNode[]): number {
    return nodes.reduce((count, node) => count + 1 + countNodes(node.children), 0)
}

function getGroupNames(nodes: AccountNode[]): string[] {
    const names: string[] = []

    const walk = (list: AccountNode[]) => {
        for (const node of list) {
            if (node.is_group) {
                names.push(node.name)
            }
            walk(node.children)
        }
    }

    walk(nodes)
    return names
}

function highlightMatch(text: string, query: string): ReactNode {
    if (!query.trim()) return text

    const lowerText = text.toLowerCase()
    const lowerQuery = query.trim().toLowerCase()
    const idx = lowerText.indexOf(lowerQuery)

    if (idx === -1) return text

    return (
        <>
            {text.slice(0, idx)}
            <mark className="rounded-sm bg-amber-100 px-1 text-slate-900">
                {text.slice(idx, idx + lowerQuery.length)}
            </mark>
            {text.slice(idx + lowerQuery.length)}
        </>
    )
}

const ROOT_TYPE_CONFIG: Record<AccountRootType, {
    badgeClass: string
    Icon: ElementType
    label: Record<Locale, string>
}> = {
    Asset: {
        badgeClass: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
        Icon: Building2,
        label: { ar: L.ar.rootAsset, en: L.en.rootAsset },
    },
    Liability: {
        badgeClass: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
        Icon: Scale,
        label: { ar: L.ar.rootLiability, en: L.en.rootLiability },
    },
    Equity: {
        badgeClass: 'bg-purple-50 text-purple-700 ring-1 ring-purple-100',
        Icon: Banknote,
        label: { ar: L.ar.rootEquity, en: L.en.rootEquity },
    },
    Income: {
        badgeClass: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
        Icon: TrendingUp,
        label: { ar: L.ar.rootIncome, en: L.en.rootIncome },
    },
    Expense: {
        badgeClass: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100',
        Icon: TrendingDown,
        label: { ar: L.ar.rootExpense, en: L.en.rootExpense },
    },
}

function TreeSkeleton() {
    const levels = [0, 1, 2, 1, 2, 3, 0, 1, 2, 2]

    return (
        <div className="space-y-1 p-3">
            {levels.map((level, i) => (
                <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg px-2.5 py-1.5"
                    style={{ paddingInlineStart: `${10 + level * 26}px` }}
                >
                    <Skeleton className="h-6 w-6 rounded-lg" />
                    <Skeleton className="h-4 w-52 rounded" />
                    <Skeleton className="ms-auto h-5 w-14 rounded-full" />
                </div>
            ))}
        </div>
    )
}

function formatBalance(value: number | undefined, locale: Locale): string {
    if (value == null) return '—'
    return new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-SA', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value)
}

interface TreeNodeProps {
    node: AccountNode
    collapsed: Set<string>
    onToggle: (name: string) => void
    query: string
    forceExpanded: boolean
    level: number
    locale: Locale
    onAction: (action: 'add-child' | 'general-ledger' | 'edit' | 'archive' | 'view-gl-page', node: AccountNode) => void
    onOpenRegister: (node: AccountNode) => void
    balanceMap: Map<string, number>
}

function TreeNode({
    node,
    collapsed,
    onToggle,
    query,
    forceExpanded,
    level,
    locale,
    onAction,
    onOpenRegister,
    balanceMap,
}: TreeNodeProps) {
    const t = L[locale]
    const isGroup = Boolean(node.is_group)
    const hasChildren = node.children.length > 0
    const isOpen = forceExpanded || !collapsed.has(node.name)
    const rootConf = node.root_type ? ROOT_TYPE_CONFIG[node.root_type] : null
    const RootIcon = rootConf?.Icon

    return (
        <div className="space-y-1">
            <div
                className={cn(
                    'group flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-slate-50',
                    isGroup && level === 0 && 'border border-slate-200 bg-gradient-to-b from-slate-50 to-white shadow-[0_1px_0_0_rgba(148,163,184,0.18)]',
                    isGroup && level > 0 && 'bg-slate-50/60',
                    !isGroup && 'bg-white'
                )}
            >
                {hasChildren ? (
                    <button
                        type="button"
                        onClick={() => onToggle(node.name)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        aria-label={isOpen ? t.treeCollapse : t.treeExpand}
                    >
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                    </button>
                ) : (
                    <span className="h-6 w-6" />
                )}

                <span
                    className={cn(
                        'inline-flex h-7 w-7 items-center justify-center rounded-lg',
                        isGroup ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'
                    )}
                >
                    {isGroup ? <Folder className="h-4 w-4" /> : <FileText className="h-3.5 w-3.5" />}
                </span>

                <div
                    className={cn('min-w-0 flex-1', !isGroup && 'cursor-pointer')}
                    onClick={!isGroup ? () => onOpenRegister(node) : undefined}
                    role={!isGroup ? 'button' : undefined}
                    tabIndex={!isGroup ? 0 : undefined}
                    onKeyDown={!isGroup ? (e) => { if (e.key === 'Enter') onOpenRegister(node) } : undefined}
                >
                    <p
                        className={cn(
                            'truncate leading-tight',
                            isGroup && level === 0 && 'text-[15px] font-bold text-slate-900',
                            isGroup && level > 0 && 'text-[14px] font-semibold text-slate-800',
                            !isGroup && 'text-[13px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline'
                        )}
                    >
                        {highlightMatch(node.account_name, query)}
                    </p>
                    <p className="truncate text-[11px] text-slate-400 font-mono">{node.name}</p>
                </div>

                {node.account_type && (
                    <Badge className="hidden md:inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {node.account_type}
                    </Badge>
                )}

                <Badge
                    className={cn(
                        'hidden sm:inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                        isGroup ? 'bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'
                    )}
                >
                    {isGroup ? t.groupBadge : t.ledgerBadge}
                </Badge>

                {rootConf && RootIcon && (
                    <span
                        className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            rootConf.badgeClass
                        )}
                    >
                        <RootIcon className="h-3 w-3" />
                        {rootConf.label[locale]}
                    </span>
                )}

                {!isGroup && (
                    <span className="hidden sm:inline-block min-w-[90px] text-end text-xs font-semibold tabular-nums font-mono text-slate-700">
                        {balanceMap.has(node.name) ? formatBalance(balanceMap.get(node.name), locale) : '—'}
                    </span>
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-500 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-700 focus:opacity-100 group-hover:opacity-100"
                            aria-label={t.actions}
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align={locale === 'ar' ? 'start' : 'end'} className="w-52">
                        {isGroup ? (
                            <DropdownMenuItem onClick={() => onAction('add-child', node)}>
                                <Plus className="h-3.5 w-3.5" />
                                {t.addChildAction}
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem onClick={() => onAction('general-ledger', node)}>
                                <BookOpen className="h-3.5 w-3.5" />
                                {t.generalLedgerAction}
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => onAction('view-gl-page', node)}>
                            <FileText className="h-3.5 w-3.5" />
                            {t.viewGLPageAction}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onAction('edit', node)}>
                            <Edit2 className="h-3.5 w-3.5" />
                            {t.editAction}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onAction('archive', node)}
                            className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            {t.archiveAction}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {hasChildren && (
                <div
                    className={cn(
                        'grid transition-all duration-300 ease-out',
                        isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    )}
                >
                    <div className="overflow-hidden">
                        <div className="ms-2 mt-1 border-s-2 border-gray-200 ps-8">
                            <div className="space-y-1">
                                {node.children.map((child) => (
                                    <TreeNode
                                        key={child.name}
                                        node={child}
                                        collapsed={collapsed}
                                        onToggle={onToggle}
                                        query={query}
                                        forceExpanded={forceExpanded}
                                        level={level + 1}
                                        locale={locale}
                                        onAction={onAction}
                                        onOpenRegister={onOpenRegister}
                                        balanceMap={balanceMap}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const defaultEditorState: EditorFormState = {
    accountName: '',
    accountCode: '',
    parentAccount: '',
    company: '',
    rootType: 'Asset',
    accountType: '',
    isGroup: false,
}

export default function ChartOfAccountsPage() {
    const router = useRouter()
    const { toast } = useToast()
    const { lang, isRTL } = useI18n()
    const { openTab } = useRegisterStore()

    const locale: Locale = lang === 'ar' ? 'ar' : 'en'
    const t = L[locale]

    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [query, setQuery] = useState('')
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
    const [company, setCompany] = useState('')
    const [companies, setCompanies] = useState<string[]>([])
    const [balanceMap, setBalanceMap] = useState<Map<string, number>>(new Map())

    const [editorOpen, setEditorOpen] = useState(false)
    const [editorMode, setEditorMode] = useState<EditorMode>('add-child')
    const [editorSaving, setEditorSaving] = useState(false)
    const [activeNode, setActiveNode] = useState<AccountNode | null>(null)
    const [editorForm, setEditorForm] = useState<EditorFormState>(defaultEditorState)

    const [archiveNode, setArchiveNode] = useState<AccountNode | null>(null)
    const [archiveOpen, setArchiveOpen] = useState(false)
    const [archiveInput, setArchiveInput] = useState('')
    const [archiveLoading, setArchiveLoading] = useState(false)

    const tree = useMemo(() => buildTree(accounts, locale), [accounts, locale])
    const filteredTree = useMemo(() => filterTreeByQuery(tree, query), [tree, query])
    const forceExpanded = query.trim().length > 0
    const visibleCount = useMemo(() => countNodes(filteredTree), [filteredTree])
    const allGroupNames = useMemo(() => getGroupNames(tree), [tree])

    const accountTypeOptions = useMemo(() => {
        return [...new Set(accounts.map((a) => a.account_type).filter(Boolean) as string[])].sort((a, b) =>
            a.localeCompare(b, locale)
        )
    }, [accounts, locale])

    const fetchAccounts = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)
            const data = await accountingApi.getAccounts({ company: company || undefined })
            setAccounts(data)
            const coys = [...new Set(data.map((a) => a.company).filter(Boolean))]
            setCompanies(coys)

            // Fetch balances for all ledger (non-group) accounts
            const ledgerNames = data.filter((a) => !a.is_group).map((a) => a.name)
            if (ledgerNames.length > 0) {
                try {
                    const balances = await accountingApi.getMultipleBalances(ledgerNames, undefined, company || undefined)
                    setBalanceMap(new Map(balances.map((b) => [b.account, b.balance])))
                } catch {
                    // non-critical — show tree without balances if this fails
                }
            }
        } catch (err: any) {
            setError(err?.message ?? t.loadErrorTitle)
        } finally {
            setLoading(false)
        }
    }, [company, t.loadErrorTitle])

    useEffect(() => {
        void fetchAccounts()
    }, [fetchAccounts])

    const toggle = useCallback((name: string) => {
        if (forceExpanded) return

        setCollapsed((prev) => {
            const next = new Set(prev)
            if (next.has(name)) next.delete(name)
            else next.add(name)
            return next
        })
    }, [forceExpanded])

    const collapseAll = () => setCollapsed(new Set(allGroupNames))
    const expandAll = () => setCollapsed(new Set())

    const openAddChildDialog = useCallback((node: AccountNode) => {
        setActiveNode(node)
        setEditorMode('add-child')
        setEditorForm({
            accountName: '',
            accountCode: '',
            parentAccount: node.name,
            company: node.company,
            rootType: node.root_type ?? 'Asset',
            accountType: '',
            isGroup: false,
        })
        setEditorOpen(true)
    }, [])

    const openEditDialog = useCallback((node: AccountNode) => {
        setActiveNode(node)
        setEditorMode('edit')
        setEditorForm({
            accountName: node.account_name,
            accountCode: node.account_number ?? '',
            parentAccount: node.parent_account ?? '',
            company: node.company,
            rootType: node.root_type ?? 'Asset',
            accountType: node.account_type ?? '',
            isGroup: Boolean(node.is_group),
        })
        setEditorOpen(true)
    }, [])

    const handleNodeAction = useCallback((action: 'add-child' | 'general-ledger' | 'view-gl-page' | 'edit' | 'archive', node: AccountNode) => {
        if (action === 'add-child') {
            openAddChildDialog(node)
            return
        }

        if (action === 'edit') {
            openEditDialog(node)
            return
        }

        if (action === 'archive') {
            setArchiveNode(node)
            setArchiveInput('')
            setArchiveOpen(true)
            return
        }

        if (action === 'view-gl-page') {
            router.push(`/accounting/general-ledger?account=${encodeURIComponent(node.name)}`)
            return
        }

        // general-ledger action → open register tab
        openTab({
            id: node.name,
            label: node.account_name,
            rootType: node.root_type,
            accountType: node.account_type,
            company: node.company,
        })
    }, [openAddChildDialog, openEditDialog, openTab, router])

    const handleOpenRegister = useCallback((node: AccountNode) => {
        openTab({
            id: node.name,
            label: node.account_name,
            rootType: node.root_type,
            accountType: node.account_type,
            company: node.company,
        })
    }, [openTab])

    const handleArchiveConfirm = async () => {
        if (!archiveNode) return

        if (archiveInput.trim() !== archiveNode.account_name.trim()) {
            toast({ title: t.archiveMismatch, variant: 'destructive' })
            return
        }

        try {
            setArchiveLoading(true)
            await accountingApi.updateAccount(archiveNode.name, { disabled: true })
            toast({ title: t.archiveSuccess, description: t.archiveSuccessDesc })
            setArchiveOpen(false)
            setArchiveNode(null)
            await fetchAccounts()
        } catch (err: any) {
            toast({ title: t.archiveFailedTitle, description: err?.message ?? '', variant: 'destructive' })
        } finally {
            setArchiveLoading(false)
        }
    }

    const handleEditorSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!editorForm.accountName.trim()) {
            toast({
                title: t.loadErrorTitle,
                description: t.requiredName,
                variant: 'destructive',
            })
            return
        }

        if (!editorForm.company.trim()) {
            toast({
                title: t.loadErrorTitle,
                description: t.requiredCompany,
                variant: 'destructive',
            })
            return
        }

        try {
            setEditorSaving(true)

            const payload = {
                account_name: editorForm.accountName.trim(),
                account_number: editorForm.accountCode.trim() || undefined,
                company: editorForm.company.trim(),
                parent_account: editorForm.parentAccount.trim() || undefined,
                root_type: editorForm.rootType,
                account_type: (editorForm.accountType.trim() || undefined) as AccountType | undefined,
                is_group: editorForm.isGroup,
            }

            if (editorMode === 'add-child') {
                await accountingApi.createAccount(payload)
                toast({ title: t.saveAddTitle, description: t.saveAddDescription })
            } else {
                if (!activeNode?.name) {
                    throw new Error(t.loadErrorTitle)
                }

                await accountingApi.updateAccount(activeNode.name, payload)
                toast({ title: t.saveEditTitle, description: t.saveEditDescription })
            }

            await fetchAccounts()
            setEditorOpen(false)
            setActiveNode(null)
        } catch (err: any) {
            toast({
                title: t.saveFailedTitle,
                description: err?.message ?? t.loadErrorTitle,
                variant: 'destructive',
            })
        } finally {
            setEditorSaving(false)
        }
    }

    const totalAccounts = accounts.length
    const totalGroups = accounts.filter((a) => a.is_group).length
    const totalLedgers = totalAccounts - totalGroups

    return (
        <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 text-slate-900">
            <div className="mx-auto w-full max-w-7xl p-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
                                <BookOpen className="h-6 w-6 text-indigo-600" />
                                {t.title}
                            </h1>
                            <p className="mt-1 text-sm text-slate-500">{t.subtitle}</p>
                        </div>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchAccounts}
                            disabled={loading}
                            className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        >
                            <RefreshCw className={cn('me-2 h-4 w-4', loading && 'animate-spin')} />
                            {t.refresh}
                        </Button>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto_auto]">
                        <div className="relative">
                            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                placeholder={t.searchPlaceholder}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="h-10 border-slate-200 bg-white ps-9 text-slate-700 placeholder:text-slate-400"
                            />
                        </div>

                        {companies.length > 1 && (
                            <select
                                value={company}
                                onChange={(e) => setCompany(e.target.value)}
                                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                            >
                                <option value="">{t.allCompanies}</option>
                                {companies.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        )}

                        <div className="flex gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={expandAll}
                                disabled={forceExpanded}
                                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                <ChevronsUpDown className="me-1 h-4 w-4" />
                                {t.expandAll}
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={collapseAll}
                                disabled={forceExpanded}
                                className="border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                <ChevronsDownUp className="me-1 h-4 w-4" />
                                {t.collapseAll}
                            </Button>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        {(Object.entries(ROOT_TYPE_CONFIG) as [AccountRootType, typeof ROOT_TYPE_CONFIG[AccountRootType]][]).map(
                            ([key, conf]) => (
                                <span
                                    key={key}
                                    className={cn(
                                        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold',
                                        conf.badgeClass
                                    )}
                                >
                                    <conf.Icon className="h-3 w-3" />
                                    {conf.label[locale]}
                                </span>
                            )
                        )}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2 py-1">{t.totalAccounts}: {totalAccounts}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1">{t.totalGroups}: {totalGroups}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1">{t.totalLedgers}: {totalLedgers}</span>
                        {query && (
                            <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">
                                {t.searchResults}: {visibleCount}
                            </span>
                        )}
                    </div>

                    <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2 text-xs leading-6 text-indigo-800">
                        <p className="inline-flex items-start gap-1.5">
                            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                            {t.guidance}
                        </p>
                    </div>
                </section>

                <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    {error && (
                        <div className="mb-3 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                            <div>
                                <p className="text-sm font-semibold">{t.loadErrorTitle}</p>
                                <p className="mt-1 text-xs opacity-90">{error}</p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-3 border-red-200 bg-white text-red-700 hover:bg-red-50"
                                    onClick={fetchAccounts}
                                >
                                    {t.retry}
                                </Button>
                            </div>
                        </div>
                    )}

                    {!error && loading && <TreeSkeleton />}

                    {!error && !loading && filteredTree.length === 0 && (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center">
                            <BookOpen className="mx-auto mb-3 h-10 w-10 text-slate-300" />
                            <p className="text-sm font-medium text-slate-600">
                                {query ? t.noSearchResults : t.noAccounts}
                            </p>
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    className="mt-2 text-xs font-medium text-indigo-600 underline"
                                >
                                    {t.clearSearch}
                                </button>
                            )}
                        </div>
                    )}

                    {!error && !loading && filteredTree.length > 0 && (
                        <div className="space-y-1">
                            {filteredTree.map((node) => (
                                <TreeNode
                                    key={node.name}
                                    node={node}
                                    collapsed={collapsed}
                                    onToggle={toggle}
                                    query={query}
                                    forceExpanded={forceExpanded}
                                    level={0}
                                    locale={locale}
                                    onAction={handleNodeAction}
                                    onOpenRegister={handleOpenRegister}
                                    balanceMap={balanceMap}
                                />
                            ))}
                        </div>
                    )}

                    {!error && !loading && filteredTree.length > 0 && (
                        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                            {t.showing} {visibleCount} {t.ofTotal} {totalAccounts}
                        </div>
                    )}
                </section>
            </div>

            {/* Archive confirmation dialog */}
            <Dialog open={archiveOpen} onOpenChange={(open) => { if (!archiveLoading) { setArchiveOpen(open); if (!open) setArchiveInput('') } }}>
                <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-rose-700">
                            <AlertTriangle className="h-5 w-5 text-rose-600" />
                            {t.archiveDialogTitle}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                            <p className="text-sm font-semibold text-rose-800">{t.archiveDialogWarning}</p>
                        </div>

                        {archiveNode && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                    {t.fieldAccountName}
                                </p>
                                <p className="mt-0.5 text-sm font-bold text-slate-900">{archiveNode.account_name}</p>
                                <p className="text-[11px] font-mono text-slate-400">{archiveNode.name}</p>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-slate-600">{t.archiveConfirmLabel}</label>
                            <Input
                                value={archiveInput}
                                onChange={(e) => setArchiveInput(e.target.value)}
                                placeholder={t.archiveConfirmPlaceholder}
                                className="border-rose-200 bg-white focus:border-rose-400 focus:ring-rose-100"
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => { setArchiveOpen(false); setArchiveInput('') }}
                            disabled={archiveLoading}
                            className="border-slate-200"
                        >
                            {t.cancel}
                        </Button>
                        <Button
                            type="button"
                            onClick={handleArchiveConfirm}
                            disabled={
                                archiveLoading ||
                                !archiveNode ||
                                archiveInput.trim() !== archiveNode.account_name.trim()
                            }
                            className="bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40"
                        >
                            <Trash2 className="me-1.5 h-4 w-4" />
                            {archiveLoading ? `${t.archiveLoading}...` : t.archiveConfirmButton}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
                <DialogContent dir={isRTL ? 'rtl' : 'ltr'} className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>{editorMode === 'add-child' ? t.editorAddTitle : t.editorEditTitle}</DialogTitle>
                        <DialogDescription>
                            {editorMode === 'add-child' ? t.editorAddDesc : t.editorEditDesc}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleEditorSubmit} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500">{t.fieldAccountName}</label>
                                <Input
                                    value={editorForm.accountName}
                                    onChange={(e) => setEditorForm((prev) => ({ ...prev, accountName: e.target.value }))}
                                    className="border-slate-200"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500">{t.fieldAccountCode}</label>
                                <Input
                                    value={editorForm.accountCode}
                                    onChange={(e) => setEditorForm((prev) => ({ ...prev, accountCode: e.target.value }))}
                                    className="border-slate-200"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500">{t.fieldCompany}</label>
                                <Input
                                    value={editorForm.company}
                                    onChange={(e) => setEditorForm((prev) => ({ ...prev, company: e.target.value }))}
                                    className="border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                                    disabled={editorMode === 'add-child'}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500">{t.fieldParentAccount}</label>
                                <Input
                                    value={editorForm.parentAccount}
                                    onChange={(e) => setEditorForm((prev) => ({ ...prev, parentAccount: e.target.value }))}
                                    className="border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                                    disabled={editorMode === 'add-child'}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500">{t.fieldRootType}</label>
                                <select
                                    value={editorForm.rootType}
                                    onChange={(e) => setEditorForm((prev) => ({ ...prev, rootType: e.target.value as AccountRootType }))}
                                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100 disabled:text-slate-500"
                                    disabled={editorMode === 'add-child'}
                                >
                                    {ROOT_TYPES.map((rootType) => (
                                        <option key={rootType} value={rootType}>{ROOT_TYPE_CONFIG[rootType].label[locale]}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-500">{t.fieldAccountNature}</label>
                                <select
                                    value={editorForm.isGroup ? 'group' : 'ledger'}
                                    onChange={(e) => setEditorForm((prev) => ({ ...prev, isGroup: e.target.value === 'group' }))}
                                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                                >
                                    <option value="group">{t.groupOption}</option>
                                    <option value="ledger">{t.ledgerOption}</option>
                                </select>
                            </div>

                            <div className="space-y-1.5 sm:col-span-2">
                                <label className="text-xs font-medium text-slate-500">{t.fieldAccountType}</label>
                                <input
                                    list="account-type-options"
                                    value={editorForm.accountType}
                                    onChange={(e) => setEditorForm((prev) => ({ ...prev, accountType: e.target.value }))}
                                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                                />
                                <datalist id="account-type-options">
                                    {accountTypeOptions.map((option) => (
                                        <option key={option} value={option} />
                                    ))}
                                </datalist>
                            </div>
                        </div>

                        {activeNode && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                {activeNode.account_name} ({activeNode.name})
                            </div>
                        )}

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button type="button" variant="outline" onClick={() => setEditorOpen(false)} className="border-slate-200">
                                {t.cancel}
                            </Button>
                            <Button type="submit" disabled={editorSaving} className="bg-indigo-600 text-white hover:bg-indigo-700">
                                {editorSaving ? `${t.saveLoading}...` : t.save}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
