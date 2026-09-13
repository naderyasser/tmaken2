'use client'

import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '@/lib/i18n'
import { useCompany } from '@/hooks/use-company'
import { walletApi, walletDisplayName, type Wallet, type WalletTransaction, type WalletSummary } from '@/lib/wallet-api'
import { formatSAR, formatDateShort } from '@/lib/sales-format'
import {
  Wallet as WalletIcon, ArrowUpCircle, ArrowDownCircle, RefreshCw,
  Loader2, TrendingUp, TrendingDown, Plus, X, Users, Building2,
  DollarSign, Eye, ChevronDown, ChevronUp, Search, AlertCircle, ArrowRightLeft, Minus,
} from 'lucide-react'

// Shared sales formatters: Western digits + Gregorian dates in all languages.
const formatCurrency = formatSAR
const formatDate = formatDateShort

const CREDIT_TYPES = new Set(['Top Up', 'Sales Credit', 'Refund', 'Adjustment In'])

// Backend transaction_type → translation key (labels resolved via t() inside the component).
const TYPE_KEY: Record<string, string> = {
  'Top Up': 'sr.admin.wallets.type_top_up', 'Sales Credit': 'sr.admin.wallets.type_sales_credit',
  'Refund': 'sr.admin.wallets.type_refund', 'Adjustment In': 'sr.admin.wallets.type_adjustment_in',
  'Purchase Payment': 'sr.admin.wallets.type_purchase_payment', 'Deduction': 'sr.admin.wallets.type_deduction',
  'Withdrawal': 'sr.admin.wallets.type_withdrawal', 'Adjustment Out': 'sr.admin.wallets.type_adjustment_out',
}

export function WalletManagement() {
  const { t, lang } = useI18n()
  const txnTypeLabel = (ty: string) => TYPE_KEY[ty] ? t(TYPE_KEY[ty]) : ty
  const { company: activeCompany } = useCompany()

  const [wallets, setWallets] = useState<Wallet[]>([])
  const [summary, setSummary] = useState<WalletSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [txnLoading, setTxnLoading] = useState(false)
  const [showTopUp, setShowTopUp] = useState<Wallet | null>(null)
  const [topUpAmount, setTopUpAmount] = useState('')
  const [topUpRemarks, setTopUpRemarks] = useState('')
  const [topUpSaving, setTopUpSaving] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState<Wallet | null>(null)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawRemarks, setWithdrawRemarks] = useState('')
  const [withdrawSaving, setWithdrawSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'Company' | 'Sales Rep'>('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const companyFilter = activeCompany || undefined
      const [wList, sum] = await Promise.all([
        walletApi.getWallets({ company: companyFilter }),
        walletApi.getSummary(companyFilter),
      ])
      setWallets(wList)
      setSummary(sum)
    } catch { /* */ }
    setLoading(false)
  }, [activeCompany])

  // Reset selection & reload when company changes
  useEffect(() => {
    setSelectedWallet(null)
    setTransactions([])
    load()
  }, [load])

  const viewTransactions = async (w: Wallet) => {
    setSelectedWallet(w)
    setTxnLoading(true)
    try {
      const result = await walletApi.getTransactions(w.name, 50, 0)
      setTransactions(result?.transactions || (Array.isArray(result) ? result : []))
    } catch { setTransactions([]) }
    setTxnLoading(false)
  }

  const handleTopUp = async () => {
    const amt = parseFloat(topUpAmount)
    if (!amt || amt <= 0 || !showTopUp) return
    setTopUpSaving(true)
    try {
      await walletApi.topUp(showTopUp.name, amt, topUpRemarks || undefined)
      setShowTopUp(null)
      setTopUpAmount('')
      setTopUpRemarks('')
      load()
    } catch { /* */ }
    setTopUpSaving(false)
  }

  const handleSetup = async () => {
    try {
      await walletApi.setupWallets(activeCompany || undefined)
      load()
    } catch { /* */ }
  }

  const handleWithdraw = async () => {
    const amt = parseFloat(withdrawAmount)
    if (!amt || amt <= 0 || !showWithdraw) return
    setWithdrawSaving(true)
    try {
      await walletApi.transferFromRepToCompany(showWithdraw.name, amt, withdrawRemarks || undefined)
      setShowWithdraw(null)
      setWithdrawAmount('')
      setWithdrawRemarks('')
      load()
      if (selectedWallet?.name === showWithdraw.name) viewTransactions(showWithdraw)
    } catch { /* */ }
    setWithdrawSaving(false)
  }

  const filteredWallets = wallets.filter(w => {
    if (filter !== 'all' && w.wallet_type !== filter) return false
    if (search) {
      const q = search.toLowerCase()
      return (w.wallet_name || '').toLowerCase().includes(q) ||
        (w.linked_sales_person || '').toLowerCase().includes(q) ||
        (w.linked_user || '').toLowerCase().includes(q)
    }
    return true
  })

  const companyWallets = wallets.filter(w => w.wallet_type === 'Company')
  const salesRepWallets = wallets.filter(w => w.wallet_type === 'Sales Rep')

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <div className="p-6 space-y-5">
          <div className="h-10 w-64 bg-gray-200 rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />)}</div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">{[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-36 bg-gray-200 rounded-xl animate-pulse" />)}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              {t('sr.admin.wallets.title')}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('sr.admin.wallets.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleSetup}
              className="flex items-center gap-1.5 text-sm bg-emerald-600 text-white px-3 py-2 h-9 rounded-lg hover:bg-emerald-700 font-medium shadow-sm shadow-emerald-200"
            >
              <Plus className="w-4 h-4" />
              {t('sr.admin.wallets.setup_wallets')}
            </button>
            <button
              onClick={load}
              className="h-9 w-9 flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: t('sr.admin.wallets.company_balance'), value: formatCurrency(summary.total_company_balance, lang), dot: 'bg-emerald-500', bg: 'bg-emerald-50', Icon: Building2 },
              { label: t('sr.admin.wallets.total_rep_balance'), value: formatCurrency(summary.total_sales_balance, lang), dot: 'bg-blue-500', bg: 'bg-blue-50', Icon: Users },
              { label: t('sr.admin.wallets.total_rep_credits'), value: formatCurrency(summary.total_sales_credits, lang), dot: 'bg-green-500', bg: 'bg-green-50', Icon: TrendingUp },
              { label: t('sr.admin.wallets.total_wallets'), value: String(summary.total_wallets), dot: 'bg-purple-500', bg: 'bg-purple-50', Icon: WalletIcon },
            ].map((s, i) => (
              <div key={i} className={`rounded-xl border-0 shadow-sm p-4 ${s.bg}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                  <p className="text-[10px] font-semibold text-gray-500 truncate">{s.label}</p>
                </div>
                <p className="text-xl font-extrabold text-gray-900 truncate">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(['all', 'Company', 'Sales Rep'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                {f === 'all' ? t('sr.admin.common.all') : f === 'Company' ? t('sr.admin.wallets.company') : t('sr.admin.wallets.sales_reps')}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('sr.admin.common.search')}
              className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Wallet list */}
        {filteredWallets.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border-0 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <WalletIcon className="w-7 h-7 text-gray-400" />
            </div>
            <p className="font-semibold text-gray-700">{t('sr.admin.wallets.empty')}</p>
            <p className="text-sm text-gray-400 mt-1">{t('sr.admin.wallets.empty_hint')}</p>
            <button
              onClick={handleSetup}
              className="mt-4 text-sm text-emerald-600 hover:text-emerald-700 font-semibold"
            >
              {t('sr.admin.wallets.setup_now')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredWallets.map(w => (
              <div
                key={w.name}
                className={`bg-white rounded-xl border-0 shadow-sm p-4 hover:shadow-md transition-all duration-150 cursor-pointer ${selectedWallet?.name === w.name ? 'ring-2 ring-emerald-500 shadow-md' : ''
                  }`}
                onClick={() => viewTransactions(w)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${w.wallet_type === 'Company' ? 'bg-emerald-100' : 'bg-blue-100'
                      }`}>
                      {w.wallet_type === 'Company' ? (
                        <Building2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Users className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 truncate max-w-[160px]">{walletDisplayName(t, w)}</p>
                      <p className="text-[10px] text-gray-400">{w.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {w.wallet_type === 'Sales Rep' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowWithdraw(w) }}
                        className="p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 rounded-lg"
                        title={t('sr.admin.wallets.withdraw_to_company_icon')}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowTopUp(w) }}
                      className="p-1.5 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600 rounded-lg"
                      title={t('sr.admin.wallets.type_top_up')}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">{t('sr.admin.wallets.balance')}</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(w.balance || 0, lang)}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-[10px] text-green-600">↑ {formatCurrency(w.total_credits || 0, lang)}</p>
                    <p className="text-[10px] text-red-500">↓ {formatCurrency(w.total_debits || 0, lang)}</p>
                  </div>
                </div>
                {w.linked_sales_person && (
                  <p className="text-[10px] text-gray-400 mt-2 truncate">
                    {t('sr.admin.wallets.rep_colon')} {w.linked_sales_person}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Transactions panel */}
        {selectedWallet && (
          <div className="bg-white rounded-xl border">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold text-gray-800">
                  {t('sr.admin.wallets.transactions')}: {walletDisplayName(t, selectedWallet)}
                </h3>
                <p className="text-xs text-gray-400">{selectedWallet.name}</p>
              </div>
              <button onClick={() => { setSelectedWallet(null); setTransactions([]) }} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {txnLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                </div>
              ) : transactions.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">{t('sr.admin.wallets.no_transactions')}</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {transactions.map(txn => {
                    const isCredit = CREDIT_TYPES.has(txn.transaction_type)
                    return (
                      <div key={txn.name} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isCredit ? 'bg-green-100' : 'bg-red-100'
                          }`}>
                          {isCredit ? <ArrowDownCircle className="w-4 h-4 text-green-600" /> : <ArrowUpCircle className="w-4 h-4 text-red-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            {txnTypeLabel(txn.transaction_type)}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">
                            {formatDate(txn.posting_date, lang)} {txn.remarks && `— ${txn.remarks}`}
                          </p>
                        </div>
                        <div className="text-end flex-shrink-0">
                          <p className={`text-sm font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                            {isCredit ? '+' : '-'}{formatCurrency(txn.amount, lang)}
                          </p>
                          <p className="text-[10px] text-gray-400">{formatCurrency(txn.balance_after, lang)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top-up dialog */}
        {showTopUp && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50" onClick={() => setShowTopUp(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800">
                  {t('sr.admin.wallets.top_up_wallet')}
                </h3>
                <button onClick={() => setShowTopUp(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">{walletDisplayName(t, showTopUp)} ({showTopUp.name})</p>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">{t('sr.admin.common.amount')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={topUpAmount}
                    onChange={e => setTopUpAmount(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder="0.00"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">{t('sr.admin.wallets.remarks')}</label>
                  <input
                    type="text"
                    value={topUpRemarks}
                    onChange={e => setTopUpRemarks(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    placeholder={t('sr.admin.wallets.optional_remarks')}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowTopUp(null)} className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    {t('sr.admin.common.cancel')}
                  </button>
                  <button
                    onClick={handleTopUp}
                    disabled={topUpSaving || !topUpAmount || parseFloat(topUpAmount) <= 0}
                    className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {topUpSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t('sr.admin.wallets.type_top_up')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Withdraw / Transfer to Company dialog */}
        {showWithdraw && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50" onClick={() => setShowWithdraw(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-red-500" />
                  {t('sr.admin.wallets.withdraw_to_company')}
                </h3>
                <button onClick={() => setShowWithdraw(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{walletDisplayName(t, showWithdraw)}</p>
                    <p className="text-[10px] text-gray-400">{showWithdraw.name}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-xs text-gray-500">{t('sr.admin.wallets.current_balance')}</p>
                    <p className="text-lg font-bold text-gray-900">{formatCurrency(showWithdraw.balance || 0, lang)}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 mb-4 text-xs text-gray-500">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                <span>{t('sr.admin.wallets.rep_wallet')}</span>
                <ArrowRightLeft className="w-3.5 h-3.5 text-gray-400" />
                <Building2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>{t('sr.admin.wallets.company_wallet')}</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">{t('sr.admin.common.amount')}</label>
                  <input
                    type="number"
                    min="0"
                    max={showWithdraw.balance || 0}
                    step="0.01"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="0.00"
                    autoFocus
                  />
                  {withdrawAmount && parseFloat(withdrawAmount) > (showWithdraw.balance || 0) && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {t('sr.admin.wallets.exceeds_balance')}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    {[25, 50, 75, 100].map(pct => (
                      <button
                        key={pct}
                        onClick={() => setWithdrawAmount(String(parseFloat((((showWithdraw.balance || 0) * pct) / 100).toFixed(2))))}
                        className="flex-1 text-[10px] border rounded py-1 hover:bg-gray-50 text-gray-600 font-medium"
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">{t('sr.admin.wallets.remarks')}</label>
                  <input
                    type="text"
                    value={withdrawRemarks}
                    onChange={e => setWithdrawRemarks(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder={t('sr.admin.wallets.withdrawal_reason')}
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowWithdraw(null)} className="flex-1 border rounded-lg py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                    {t('sr.admin.common.cancel')}
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawSaving || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > (showWithdraw.balance || 0)}
                    className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {withdrawSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t('sr.admin.wallets.withdraw')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
