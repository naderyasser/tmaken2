"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Wallet, ArrowUpCircle, ArrowDownCircle, RefreshCw, Loader2,
  TrendingUp, TrendingDown, Clock, ArrowRight,
} from "lucide-react"
import Link from "next/link"
import { useSalesRep } from "@/contexts/SalesRepContext"
import { walletApi, type Wallet as WalletType, type WalletTransaction } from "@/lib/wallet-api"
import { useI18n } from "@/lib/i18n"

function formatCurrency(v: number, locale = 'ar-SA'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'SAR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)
}

function formatDate(d: string, locale = 'ar-SA'): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch { return d }
}

const CREDIT_TYPES = new Set(['Top Up', 'Sales Credit', 'Refund', 'Adjustment In'])

export default function SalesRepWalletPage() {
  const { salesPerson } = useSalesRep()
  const { t, lang, dir } = useI18n()
  const locale = lang === 'ar' ? 'ar-SA' : lang === 'ur' ? 'ur-PK' : 'en-US'

  const TYPE_LABELS: Record<string, string> = {
    'Top Up': t('sr.wallet.type.top_up'),
    'Sales Credit': t('sr.wallet.type.sales_credit'),
    'Refund': t('sr.wallet.type.refund'),
    'Adjustment In': t('sr.wallet.type.adjustment_in'),
    'Purchase Payment': t('sr.wallet.type.purchase_payment'),
    'Deduction': t('sr.wallet.type.deduction'),
    'Withdrawal': t('sr.wallet.type.withdrawal'),
    'Adjustment Out': t('sr.wallet.type.adjustment_out'),
  }
  const [wallet, setWallet] = useState<WalletType | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const PAGE_SIZE = 20

  const loadWallet = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const w = await walletApi.getMyWallet()
      setWallet(w)
      if (w) {
        const result = await walletApi.getTransactions(w.name, PAGE_SIZE, 0)
        const txnList = result?.transactions || (Array.isArray(result) ? result : [])
        setTransactions(txnList)
        setHasMore(txnList.length >= PAGE_SIZE)
      }
    } catch {
      setLoadError(true)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadWallet() }, [loadWallet])

  const loadMore = async () => {
    if (!wallet || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const result = await walletApi.getTransactions(wallet.name, PAGE_SIZE, transactions.length)
      const txnList = result?.transactions || (Array.isArray(result) ? result : [])
      setTransactions(prev => [...prev, ...txnList])
      setHasMore(txnList.length >= PAGE_SIZE)
    } catch { /* */ }
    setLoadingMore(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1729]">
        {/* Skeleton header */}
        <div className="px-5 pt-10 pb-8 space-y-5">
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 bg-white/10 rounded-full animate-pulse" />
            <div className="h-8 w-8 bg-white/10 rounded-full animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-3 pt-4">
            <div className="h-16 w-16 bg-white/10 rounded-2xl animate-pulse" />
            <div className="h-3 w-24 bg-white/10 rounded-full animate-pulse" />
            <div className="h-10 w-48 bg-white/10 rounded-full animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="h-20 bg-white/10 rounded-2xl animate-pulse" />
            <div className="h-20 bg-white/10 rounded-2xl animate-pulse" />
          </div>
        </div>
        <div className="bg-white rounded-t-3xl px-4 pt-6 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="h-11 w-11 bg-gray-100 rounded-2xl animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 bg-gray-100 rounded-full animate-pulse" />
                <div className="h-2.5 w-20 bg-gray-100 rounded-full animate-pulse" />
              </div>
              <div className="space-y-2 items-end flex flex-col">
                <div className="h-3.5 w-20 bg-gray-100 rounded-full animate-pulse" />
                <div className="h-2.5 w-14 bg-gray-100 rounded-full animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!wallet) {
    return (
      <div className="min-h-screen bg-[#0f1729] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center mx-auto mb-5">
            <Wallet className="w-10 h-10 text-white/40" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            {loadError ? t('sr.wallet.load_failed') : t('sr.wallet.no_wallet')}
          </h2>
          <p className="text-white/50 text-sm mb-6 max-w-xs mx-auto leading-relaxed">
            {loadError
              ? t('sr.wallet.load_failed_desc')
              : t('sr.wallet.no_wallet_desc')}
          </p>
          <Link href="/sales-rep">
            <Button className="bg-white/10 hover:bg-white/20 text-white border-0 rounded-2xl h-11 px-6">
              <ArrowRight className="w-4 h-4 ml-2" />
              {t('sr.wallet.back_home')}
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const balancePct = wallet.total_credits
    ? Math.min(100, Math.round(((wallet.balance || 0) / wallet.total_credits) * 100))
    : 0

  return (
    <div className="min-h-screen bg-[#0f1729]" dir={dir}>

      {/* ── Dark Header ── */}
      <div className="px-5 pt-10 pb-6">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/sales-rep" className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors text-sm">
            <ArrowRight className="w-4 h-4" />
            <span>{t('sr.wallet.home')}</span>
          </Link>
          <button
            onClick={() => loadWallet()}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center"
          >
            <RefreshCw className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* Balance hero */}
        <div className="text-center mb-7">
          <div className="relative inline-flex">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center mx-auto mb-4">
              <Wallet className="w-8 h-8 text-emerald-400" />
            </div>
          </div>
          <p className="text-white/50 text-xs mb-2 tracking-wider uppercase">{t('sr.wallet.balance_label')}</p>
          <p className="text-5xl font-black text-white tracking-tight" dir="ltr">
            {formatCurrency(wallet.balance || 0, locale)}
          </p>
          <p className="text-white/40 text-xs mt-2">{wallet.wallet_name}</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-[10px] text-white/40 mb-1.5">
            <span>{t('sr.wallet.balance_pct')}</span>
            <span>{balancePct}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 rounded-full transition-all"
              style={{ width: `${balancePct}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/8 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-[11px] text-white/50">{t('sr.wallet.total_credits')}</span>
            </div>
            <p className="text-base font-bold text-white" dir="ltr">{formatCurrency(wallet.total_credits || 0, locale)}</p>
          </div>
          <div className="bg-white/8 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center">
                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              </div>
              <span className="text-[11px] text-white/50">{t('sr.wallet.total_debits')}</span>
            </div>
            <p className="text-base font-bold text-white" dir="ltr">{formatCurrency(wallet.total_debits || 0, locale)}</p>
          </div>
        </div>
      </div>

      {/* ── Transactions Sheet ── */}
      <div className="bg-white rounded-t-[2rem] min-h-[55vh] pt-1">
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-5" />

        <div className="px-4 pb-8">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-gray-900">{t('sr.wallet.txn_log')}</h2>
            <span className="text-[11px] font-semibold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
              {t('sr.wallet.txn_count').replace('{n}', String(transactions.length))}
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                <Clock className="w-7 h-7 text-gray-300" />
              </div>
              <p className="font-semibold text-gray-600">{t('sr.wallet.empty')}</p>
              <p className="text-xs text-gray-400 mt-1">{t('sr.wallet.empty_desc')}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {transactions.map((txn, idx) => {
                const isCredit = CREDIT_TYPES.has(txn.transaction_type)
                // Show date divider when date changes
                const currDate = formatDate(txn.posting_date, locale)
                const prevDate = idx > 0 ? formatDate(transactions[idx - 1].posting_date, locale) : null
                const showDate = currDate !== prevDate

                return (
                  <div key={txn.name}>
                    {showDate && (
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pt-4 pb-2 px-1">
                        {currDate}
                      </p>
                    )}
                    <div className="flex items-center gap-3 bg-gray-50 hover:bg-gray-100/80 transition-colors rounded-2xl p-3.5">
                      {/* Icon */}
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${isCredit ? 'bg-emerald-100' : 'bg-red-100'
                        }`}>
                        {isCredit
                          ? <ArrowDownCircle className="w-5 h-5 text-emerald-600" />
                          : <ArrowUpCircle className="w-5 h-5 text-red-500" />
                        }
                      </div>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-gray-800 truncate">
                          {TYPE_LABELS[txn.transaction_type] || txn.transaction_type}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {txn.remarks || txn.reference_name || formatDate(txn.posting_date, locale)}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="text-end flex-shrink-0">
                        <p className={`text-[13px] font-extrabold ${isCredit ? 'text-emerald-600' : 'text-red-500'}`} dir="ltr">
                          {isCredit ? '+' : '−'}{formatCurrency(txn.amount, locale)}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5" dir="ltr">
                          {formatCurrency(txn.balance_after, locale)}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })}

              {hasMore && (
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="w-full mt-3 py-3 rounded-2xl border border-dashed border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loadingMore
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {t('sr.common.loading')}</>
                    : t('sr.wallet.load_more')
                  }
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
