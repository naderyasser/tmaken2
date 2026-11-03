/**
 * Sales Dashboard - Overview with KPI cards and quick actions
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '@/lib/i18n'
import { salesApi } from '@/lib/sales-api'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users, ShoppingCart, FileText, Receipt,
  TrendingUp, DollarSign, Clock, Package, Percent, Undo2,
  ArrowUpRight, RefreshCw, ChevronRight, ChevronLeft,
} from 'lucide-react'
import type { SalesSection } from '@/app/(erp)/(dashboard)/admin/sales/page'

interface SalesDashboardProps {
  onNavigate: (section: SalesSection) => void
}

interface DashboardStats {
  totalCustomers: number
  activeCustomers: number
  totalSalesOrders: number
  draftSalesOrders: number
  totalQuotations: number
  openQuotations: number
  totalInvoices: number
  unpaidInvoices: number
  pendingApprovals: number
  totalReturns: number
}

export function SalesDashboard({ onNavigate }: SalesDashboardProps) {
  const { t, isRTL } = useI18n()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadStats = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)

      const [customers, salesOrders, quotations, invoices, pendingApprovals, returns] = await Promise.all([
        salesApi.getCustomers({ limit_page_length: 0, fields: ['name', 'disabled'] }).catch(() => []),
        salesApi.getSalesOrders({ limit_page_length: 0, fields: ['name', 'status', 'docstatus'] }).catch(() => []),
        salesApi.getQuotations({ limit_page_length: 0, fields: ['name', 'status'] }).catch(() => []),
        salesApi.getSalesInvoices({ limit_page_length: 0, fields: ['name', 'status', 'outstanding_amount'] }).catch(() => []),
        salesApi.getPendingApprovals().catch(() => []),
        salesApi.getProductReturns({ limit_page_length: 0, fields: ['name', 'processed'] }).catch(() => []),
      ])

      setStats({
        totalCustomers: customers.length,
        activeCustomers: customers.filter((c: any) => !c.disabled).length,
        totalSalesOrders: salesOrders.length,
        draftSalesOrders: salesOrders.filter((o: any) => o.docstatus === 0).length,
        totalQuotations: quotations.length,
        openQuotations: quotations.filter((q: any) => q.status === 'Open' || q.status === 'Draft').length,
        totalInvoices: invoices.length,
        unpaidInvoices: invoices.filter((i: any) => i.status === 'Unpaid' || i.status === 'Overdue').length,
        pendingApprovals: Array.isArray(pendingApprovals) ? pendingApprovals.length : 0,
        totalReturns: returns.filter((r: any) => !r.processed).length,
      })
    } catch (error) {
      console.error('Failed to load dashboard stats:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadStats() }, [loadStats])

  const kpiCards = stats ? [
    { label: t('sr.admin.common.customers'), value: stats.activeCustomers, sub: `${stats.totalCustomers} ${t('sr.admin.dashboard.unit_total')}`, icon: Users, color: 'bg-emerald-500', section: 'customers' as SalesSection },
    { label: t('sr.admin.common.sales_orders'), value: stats.totalSalesOrders, sub: `${stats.draftSalesOrders} ${t('sr.admin.dashboard.unit_draft')}`, icon: ShoppingCart, color: 'bg-indigo-500', section: 'sales-orders' as SalesSection },
    { label: t('sr.admin.common.quotations'), value: stats.totalQuotations, sub: `${stats.openQuotations} ${t('sr.admin.dashboard.unit_open')}`, icon: FileText, color: 'bg-amber-500', section: 'quotations' as SalesSection },
    { label: t('sr.admin.common.invoices'), value: stats.totalInvoices, sub: `${stats.unpaidInvoices} ${t('sr.admin.dashboard.unit_unpaid')}`, icon: Receipt, color: 'bg-purple-500', section: 'invoices' as SalesSection },
  ] : []

  const quickActions = [
    { label: t('sr.admin.dashboard.pending_discounts'), count: stats?.pendingApprovals || 0, icon: Percent, color: 'text-pink-600 bg-pink-50', section: 'discounts' as SalesSection },
    { label: t('sr.admin.dashboard.unprocessed_returns'), count: stats?.totalReturns || 0, icon: Undo2, color: 'text-red-600 bg-red-50', section: 'returns' as SalesSection },
    { label: t('sr.admin.dashboard.draft_sales_orders'), count: stats?.draftSalesOrders || 0, icon: ShoppingCart, color: 'text-indigo-600 bg-indigo-50', section: 'sales-orders' as SalesSection },
    { label: t('sr.admin.dashboard.unpaid_invoices'), count: stats?.unpaidInvoices || 0, icon: Receipt, color: 'text-purple-600 bg-purple-50', section: 'invoices' as SalesSection },
  ]

  const ArrowIcon = isRTL ? ChevronLeft : ChevronRight

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.dashboard.title')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('sr.admin.dashboard.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadStats(true)} disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2', refreshing && 'animate-spin')} />
          {t('sr.admin.common.refresh')}
        </Button>
      </div>

      {/* KPI Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpiCards.map((card) => {
            const Icon = card.icon
            return (
              <Card
                key={card.section}
                className="cursor-pointer hover:shadow-md transition-shadow border-0 shadow-sm"
                onClick={() => onNavigate(card.section)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-500">{card.label}</p>
                      <p className="text-3xl font-bold text-gray-900 mt-1">{card.value.toLocaleString()}</p>
                      <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
                    </div>
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white', card.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('sr.admin.dashboard.quick_actions')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <button
                key={action.section}
                onClick={() => onNavigate(action.section)}
                className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:shadow-sm hover:border-gray-200 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', action.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className={cn('text-start', isRTL && 'text-right')}>
                    <p className="text-sm font-medium text-gray-700">{action.label}</p>
                    {action.count > 0 && (
                      <p className="text-xs text-gray-400">{action.count} {t('sr.admin.dashboard.unit_items')}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {action.count > 0 && (
                    <span className="text-xs font-bold text-white bg-red-500 rounded-full px-2 py-0.5">{action.count}</span>
                  )}
                  <ArrowIcon className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Navigation Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">{t('sr.admin.dashboard.sections')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { id: 'inventory' as SalesSection, label: t('sr.admin.dashboard.inventory'), icon: <Package className="h-5 w-5" />, color: 'text-teal-600 bg-teal-50' },
            { id: 'discounts' as SalesSection, label: t('sr.admin.dashboard.discounts'), icon: <Percent className="h-5 w-5" />, color: 'text-pink-600 bg-pink-50' },
            { id: 'returns' as SalesSection, label: t('sr.admin.common.returns'), icon: <Undo2 className="h-5 w-5" />, color: 'text-red-600 bg-red-50' },
          ].map((nav) => (
            <button
              key={nav.id}
              onClick={() => onNavigate(nav.id)}
              className="flex flex-col items-center gap-2 p-5 bg-white rounded-xl border border-gray-100 hover:shadow-sm hover:border-gray-200 transition-all"
            >
              <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', nav.color)}>
                {nav.icon}
              </div>
              <span className="text-sm font-medium text-gray-700">{nav.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
