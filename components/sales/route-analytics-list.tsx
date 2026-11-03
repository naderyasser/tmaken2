/**
 * Route Analytics List - View route efficiency scores and metrics
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { salesApi, type SalesRouteAnalytics } from '@/lib/sales-api'
import { useI18n } from '@/lib/i18n'
import { formatDateShort } from '@/lib/sales-format'
import { ValueUnit } from '@/components/sales/value-unit'
import { EmptyState } from '@/components/sales/empty-state'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Search, RefreshCw, BarChart3, TrendingUp, MapPin, Clock, Zap } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function RouteAnalyticsList() {
  const { isRTL, t, lang } = useI18n()
  const { toast } = useToast()
  const [analytics, setAnalytics] = useState<SalesRouteAnalytics[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const data = await salesApi.getRouteAnalytics()
      setAnalytics(data)
    } catch (e) { toast({ title: t('sr.admin.common.error_title'), description: String(e), variant: 'destructive' }) }
    finally { setLoading(false); setRefreshing(false) }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  const handleGenerateAnalytics = async () => {
    try {
      const res = await salesApi.createDailyAnalytics()
      toast({ title: t('sr.admin.routes.toast_generated_title'), description: res?.message || 'Analytics generated' })
      loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
  }

  const filtered = useMemo(() => {
    if (!search) return analytics
    const q = search.toLowerCase()
    return analytics.filter(a => a.sales_person?.toLowerCase().includes(q) || a.date?.includes(q))
  }, [analytics, search])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const avgScore = analytics.length > 0 ? (analytics.reduce((s, a) => s + (a.route_efficiency_score || 0), 0) / analytics.length).toFixed(1) : '0'
  const avgDistance = analytics.length > 0 ? (analytics.reduce((s, a) => s + (a.total_distance_km || 0), 0) / analytics.length).toFixed(1) : '0'

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-100'
    if (score >= 60) return 'text-amber-600 bg-amber-100'
    return 'text-red-600 bg-red-100'
  }

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-10 w-64" />{[1,2,3].map(i => <Skeleton key={i} className="h-14" />)}</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.nav.card_analytics')}</h1>
          <p className="text-sm text-gray-500">{t('sr.admin.routes.analytics_subtitle')}</p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /></Button>
          <Button size="sm" onClick={handleGenerateAnalytics} className="bg-orange-600 hover:bg-orange-700">
            <Zap className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} /> {t('sr.admin.routes.generate_analytics')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('sr.admin.routes.stat_total_records'), value: analytics.length, icon: BarChart3, color: 'text-gray-900' },
          { label: t('sr.admin.routes.stat_avg_efficiency'), value: `${avgScore}%`, icon: TrendingUp, color: 'text-emerald-600' },
          { label: t('sr.admin.routes.stat_avg_distance'), value: <ValueUnit value={avgDistance} unit={t('sr.admin.units.km')} />, icon: MapPin, color: 'text-blue-600' },
          { label: t('sr.admin.routes.stat_avg_speed'), value: <ValueUnit value={analytics.length > 0 ? (analytics.reduce((s, a) => s + (a.average_speed_kmh || 0), 0) / analytics.length).toFixed(1) : 0} unit={t('sr.admin.units.kmh')} />, icon: Clock, color: 'text-purple-600' },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <Card key={i} className="border-0 shadow-sm"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon className="h-4 w-4 text-gray-400" /><p className="text-xs text-gray-500">{s.label}</p></div>
              <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            </CardContent></Card>
          )
        })}
      </div>

      <Card className="border-0 shadow-sm"><CardContent className="p-3 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
          <Input placeholder={t('sr.admin.routes.analytics_search_placeholder')} value={search} onChange={e => setSearch(e.target.value)} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
        </div>
      </CardContent></Card>

      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-gray-50/50">
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.sales_rep')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.date')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.nav.visits')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.common.completed')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.routes.th_distance')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.routes.th_speed')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.routes.th_efficiency')}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow><TableCell colSpan={7}><EmptyState icon={BarChart3} title={t('sr.admin.routes.analytics_empty')} /></TableCell></TableRow>
            ) : paginated.map(a => (
              <TableRow key={a.name} className="hover:bg-gray-50/50">
                <TableCell className="text-sm font-medium">{a.sales_person}</TableCell>
                <TableCell className="text-sm text-gray-600">{formatDateShort(a.date, lang)}</TableCell>
                <TableCell className="text-sm">{a.total_visits}</TableCell>
                <TableCell className="text-sm">{a.completed_visits}</TableCell>
                <TableCell className="text-sm text-gray-600"><ValueUnit value={a.total_distance_km?.toFixed(1) || '0'} unit={t('sr.admin.units.km')} /></TableCell>
                <TableCell className="text-sm text-gray-600"><ValueUnit value={a.average_speed_kmh?.toFixed(1) || '0'} unit={t('sr.admin.units.kmh')} /></TableCell>
                <TableCell>
                  <Badge className={cn('text-[10px] font-bold', getScoreColor(a.route_efficiency_score || 0))}>
                    {a.route_efficiency_score?.toFixed(0) || '0'}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{filtered.length} {t('sr.admin.routes.records_unit')}</span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage===1}>{t('sr.admin.common.previous')}</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages}>{t('sr.admin.common.next')}</Button>
          </div>
        </div>
      )}
    </div>
  )
}
