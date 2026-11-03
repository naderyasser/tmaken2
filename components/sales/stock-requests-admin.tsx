/**
 * Stock Transfer Requests — Admin view
 * Lists all stock transfer requests from sales reps.
 * Admin can accept, partially accept, or reject requests.
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { stockApi, setupBaseMeenaPermissions, type StockTransferRequest, type Warehouse } from '@/lib/stock-api'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import {
  Search, RefreshCw, ArrowLeftRight, Package, Clock,
  CheckCircle2, XCircle, Loader2, Eye, AlertTriangle, ShieldAlert,
  Warehouse as WarehouseIcon, Pencil, Save,
} from 'lucide-react'

const STATUS_MAP: Record<string, { key: string; class: string }> = {
  Pending: { key: 'sr.admin.stockreq.status_pending', class: 'bg-amber-100 text-amber-700' },
  Accepted: { key: 'sr.admin.common.accepted', class: 'bg-emerald-100 text-emerald-700' },
  'Partially Accepted': { key: 'sr.admin.stockreq.status_partially_accepted', class: 'bg-blue-100 text-blue-700' },
  Rejected: { key: 'sr.admin.common.rejected', class: 'bg-red-100 text-red-700' },
  Completed: { key: 'sr.admin.common.completed', class: 'bg-gray-100 text-gray-600' },
}

export function StockRequestsAdmin() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()

  const [requests, setRequests] = useState<StockTransferRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Detail / action dialog
  const [selectedRequest, setSelectedRequest] = useState<StockTransferRequest | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [acceptedItems, setAcceptedItems] = useState<Map<string, number>>(new Map())
  const [permissionError, setPermissionError] = useState(false)
  const [settingUpPermissions, setSettingUpPermissions] = useState(false)

  // Warehouse editing
  const [availableWarehouses, setAvailableWarehouses] = useState<Warehouse[]>([])
  const [editFromWarehouse, setEditFromWarehouse] = useState('')
  const [editingWarehouse, setEditingWarehouse] = useState(false)
  const [savingWarehouse, setSavingWarehouse] = useState(false)

  const loadRequests = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      setPermissionError(false)
      const data = await stockApi.getTransferRequests({
        order_by: 'creation desc',
        limit_page_length: 500,
      })
      setRequests(data)
    } catch (e) {
      const errStr = String(e)
      if (errStr.includes('PermissionError') || errStr.includes('permission') || errStr.includes('403')) {
        setPermissionError(true)
      } else {
        toast({ title: t('sr.admin.common.error'), description: errStr, variant: 'destructive' })
      }
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [toast, t])

  useEffect(() => { loadRequests() }, [loadRequests])

  // Load available warehouses for editing
  useEffect(() => {
    stockApi.getWarehouses().then(whs => setAvailableWarehouses(whs)).catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    let result = requests
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.sales_person?.toLowerCase().includes(q) ||
        r.from_warehouse?.toLowerCase().includes(q) ||
        r.to_warehouse?.toLowerCase().includes(q)
      )
    }
    if (statusFilter !== 'all') result = result.filter(r => r.status === statusFilter)
    return result
  }, [requests, search, statusFilter])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  useEffect(() => { setCurrentPage(1) }, [search, statusFilter])

  const stats = useMemo(() => {
    const pending = requests.filter(r => r.status === 'Pending').length
    const accepted = requests.filter(r => r.status === 'Accepted' || r.status === 'Partially Accepted').length
    const rejected = requests.filter(r => r.status === 'Rejected').length
    const total = requests.length
    return { pending, accepted, rejected, total }
  }, [requests])

  // Open detail dialog
  const openDetail = async (req: StockTransferRequest) => {
    setDetailLoading(true)
    setRejectionReason('')
    setEditingWarehouse(false)
    try {
      const full = await stockApi.getTransferRequest(req.name)
      setSelectedRequest(full || req)
      setEditFromWarehouse(full?.from_warehouse || req.from_warehouse || '')
      // Initialize accepted quantities to requested quantities
      const map = new Map<string, number>()
      if (full?.items) {
        full.items.forEach(item => {
          map.set(item.item_code, item.accepted_qty ?? item.requested_qty)
        })
      }
      setAcceptedItems(map)
    } catch {
      setSelectedRequest(req)
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSaveWarehouse = async () => {
    if (!selectedRequest || !editFromWarehouse) return
    setSavingWarehouse(true)
    try {
      const updated = await stockApi.updateTransferRequest(selectedRequest.name, { from_warehouse: editFromWarehouse })
      setSelectedRequest({ ...selectedRequest, from_warehouse: updated.from_warehouse || editFromWarehouse })
      setEditingWarehouse(false)
      toast({ title: t('sr.admin.stockreq.saved'), description: t('sr.admin.stockreq.warehouse_updated') })
    } catch (err: any) {
      toast({ title: t('sr.admin.common.error'), description: err?.message || String(err), variant: 'destructive' })
    } finally {
      setSavingWarehouse(false)
    }
  }

  const handleAccept = async () => {
    if (!selectedRequest) return
    setActionLoading(true)
    try {
      // Save warehouse change first if it was modified
      if (editFromWarehouse && editFromWarehouse !== selectedRequest.from_warehouse) {
        await stockApi.updateTransferRequest(selectedRequest.name, { from_warehouse: editFromWarehouse })
      }
      const items = selectedRequest.items?.map(item => ({
        item_code: item.item_code,
        accepted_qty: acceptedItems.get(item.item_code) ?? item.requested_qty,
      }))
      await stockApi.acceptTransferRequest(selectedRequest.name, items)
      toast({ title: t('sr.admin.common.success'), description: t('sr.admin.stockreq.request_accepted') })
      setSelectedRequest(null)
      loadRequests(true)
    } catch (err: any) {
      toast({ title: t('sr.admin.common.error'), description: err?.message || String(err), variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async () => {
    if (!selectedRequest) return
    if (!rejectionReason.trim()) {
      toast({ title: t('sr.admin.common.error'), description: t('sr.admin.stockreq.enter_rejection_reason'), variant: 'destructive' })
      return
    }
    setActionLoading(true)
    try {
      await stockApi.rejectTransferRequest(selectedRequest.name, rejectionReason)
      toast({ title: t('sr.admin.common.success'), description: t('sr.admin.stockreq.request_rejected') })
      setSelectedRequest(null)
      loadRequests(true)
    } catch (err: any) {
      toast({ title: t('sr.admin.common.error'), description: err?.message || String(err), variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const s = STATUS_MAP[status]
    return { label: s ? t(s.key) : status, class: s?.class || 'bg-gray-100 text-gray-600' }
  }

  const handleSetupPermissions = async () => {
    setSettingUpPermissions(true)
    try {
      const result = await setupBaseMeenaPermissions()
      toast({
        title: t('sr.admin.stockreq.perms_setup_title'),
        description: t('sr.admin.stockreq.perms_setup_desc').replace('{count}', String(result.success.length)),
      })
      // Reload after permissions are set
      setPermissionError(false)
      loadRequests(true)
    } catch (err: any) {
      toast({
        title: t('sr.admin.common.error'),
        description: t('sr.admin.stockreq.perms_setup_failed'),
        variant: 'destructive',
      })
    } finally {
      setSettingUpPermissions(false)
    }
  }

  if (loading && requests.length === 0) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 rounded-lg" />)}
    </div>
  )

  if (permissionError) return (
    <div className="p-6">
      <Card className="border-0 shadow-sm max-w-lg mx-auto">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {t('sr.admin.stockreq.missing_permissions')}
          </h2>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            {t('sr.admin.stockreq.missing_permissions_body')}
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={handleSetupPermissions}
              disabled={settingUpPermissions}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {settingUpPermissions ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ShieldAlert className="h-4 w-4 mr-2" />
              )}
              {t('sr.admin.stockreq.setup_permissions_auto')}
            </Button>
            <p className="text-[11px] text-gray-400">
              {t('sr.admin.stockreq.setup_permissions_note')}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.stockreq.title')}</h1>
          <p className="text-sm text-gray-500">{t('sr.admin.stockreq.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadRequests(true)} disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: t('sr.admin.common.total'), value: stats.total, icon: ArrowLeftRight, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: t('sr.admin.stockreq.status_pending'), value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: t('sr.admin.common.accepted'), value: stats.accepted, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t('sr.admin.common.rejected'), value: stats.rejected, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((s, i) => {
          const Icon = s.icon
          return (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className={cn('p-4 rounded-lg', s.bg)}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-gray-400" />
                  <p className="text-[11px] text-gray-500 font-medium">{s.label}</p>
                </div>
                <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Search & Filter */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
              <Input
                placeholder={t('sr.admin.stockreq.search')}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('sr.admin.common.all')}</SelectItem>
                <SelectItem value="Pending">{t('sr.admin.stockreq.status_pending')}</SelectItem>
                <SelectItem value="Accepted">{t('sr.admin.common.accepted')}</SelectItem>
                <SelectItem value="Partially Accepted">{t('sr.admin.stockreq.status_partially_accepted')}</SelectItem>
                <SelectItem value="Rejected">{t('sr.admin.common.rejected')}</SelectItem>
                <SelectItem value="Completed">{t('sr.admin.common.completed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50/50">
              <TableHead className="text-xs font-semibold">{t('sr.admin.stockreq.request_no')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('sr.admin.common.date')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('sr.admin.common.sales_person')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('sr.admin.stockreq.from_warehouse')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('sr.admin.stockreq.to_warehouse')}</TableHead>
              <TableHead className="text-xs font-semibold text-center">{t('sr.admin.common.qty')}</TableHead>
              <TableHead className="text-xs font-semibold">{t('sr.admin.common.status')}</TableHead>
              <TableHead className="text-xs font-semibold w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-16 text-gray-400">
                  <Package className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  {t('sr.admin.stockreq.empty')}
                </TableCell>
              </TableRow>
            ) : paginated.map(req => {
              const badge = getStatusBadge(req.status)
              return (
                <TableRow key={req.name} className="hover:bg-gray-50/50">
                  <TableCell className="text-xs font-mono text-gray-500">{req.name}</TableCell>
                  <TableCell className="text-sm text-gray-600">{req.request_date || req.creation?.split(' ')[0]}</TableCell>
                  <TableCell className="text-sm font-medium">{req.sales_person || '—'}</TableCell>
                  <TableCell className="text-xs text-gray-500">{req.from_warehouse || '—'}</TableCell>
                  <TableCell className="text-xs text-gray-500">{req.to_warehouse || '—'}</TableCell>
                  <TableCell className="text-sm text-center font-medium">{req.total_quantity || '—'}</TableCell>
                  <TableCell>
                    <Badge className={cn('text-[10px]', badge.class)}>{badge.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => openDetail(req)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {t('sr.admin.common.pagination_range')
              .replace('{from}', String((currentPage - 1) * itemsPerPage + 1))
              .replace('{to}', String(Math.min(currentPage * itemsPerPage, filtered.length)))
              .replace('{total}', String(filtered.length))
            }
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>{t('sr.admin.common.prev')}</Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>{t('sr.admin.common.next')}</Button>
          </div>
        </div>
      )}

      {/* Detail / Action Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => { if (!open) setSelectedRequest(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-violet-600" />
              {t('sr.admin.stockreq.detail_title')}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
            </div>
          ) : selectedRequest && (
            <div className="space-y-4 py-2">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-400 text-xs">{t('sr.admin.stockreq.request_no')}</p>
                  <p className="font-mono text-gray-600">{selectedRequest.name}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{t('sr.admin.common.status')}</p>
                  <Badge className={cn('text-[10px] mt-0.5', getStatusBadge(selectedRequest.status).class)}>
                    {getStatusBadge(selectedRequest.status).label}
                  </Badge>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{t('sr.admin.common.sales_person')}</p>
                  <p className="font-medium">{selectedRequest.sales_person || '—'}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{t('sr.admin.common.date')}</p>
                  <p>{selectedRequest.request_date || selectedRequest.creation?.split(' ')[0]}</p>
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{t('sr.admin.common.from')}</p>
                  {selectedRequest.status === 'Pending' ? (
                    <div className="mt-1">
                      {editingWarehouse ? (
                        <div className="flex items-center gap-1.5">
                          <Select value={editFromWarehouse} onValueChange={setEditFromWarehouse}>
                            <SelectTrigger className="h-8 text-xs flex-1">
                              <SelectValue placeholder={t('sr.admin.stockreq.select_warehouse')} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableWarehouses.map(wh => (
                                <SelectItem key={wh.name} value={wh.name}>
                                  <span className="text-xs">{wh.warehouse_name || wh.name}</span>
                                  {wh.custom_warehouse_type && (
                                    <Badge variant="outline" className="text-[9px] py-0 px-1 mr-1">{wh.custom_warehouse_type}</Badge>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-emerald-600" onClick={handleSaveWarehouse} disabled={savingWarehouse}>
                            {savingWarehouse ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-gray-400" onClick={() => { setEditingWarehouse(false); setEditFromWarehouse(selectedRequest.from_warehouse || '') }}>
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs flex-1">{selectedRequest.from_warehouse || '—'}</p>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-violet-500 hover:text-violet-700" onClick={() => setEditingWarehouse(true)} title={t('sr.admin.stockreq.edit_warehouse')}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs">{selectedRequest.from_warehouse || '—'}</p>
                  )}
                </div>
                <div>
                  <p className="text-gray-400 text-xs">{t('sr.admin.common.to')}</p>
                  <p className="text-xs">{selectedRequest.to_warehouse || '—'}</p>
                </div>
              </div>

              {/* Items */}
              {selectedRequest.items && selectedRequest.items.length > 0 && (
                <div>
                  <p className="text-sm font-semibold mb-2">{t('sr.admin.stockreq.requested_items')}</p>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs">{t('sr.admin.stockreq.item')}</TableHead>
                          <TableHead className="text-xs text-center">{t('sr.admin.stockreq.requested')}</TableHead>
                          {selectedRequest.status === 'Pending' && (
                            <TableHead className="text-xs text-center">{t('sr.admin.stockreq.accept_qty')}</TableHead>
                          )}
                          {selectedRequest.status !== 'Pending' && (
                            <TableHead className="text-xs text-center">{t('sr.admin.stockreq.accepted_qty')}</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedRequest.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">
                              <p className="font-medium">{item.item_name || item.item_code}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{item.item_code}</p>
                            </TableCell>
                            <TableCell className="text-sm text-center font-bold">{item.requested_qty}</TableCell>
                            {selectedRequest.status === 'Pending' ? (
                              <TableCell className="text-center">
                                <Input
                                  type="number"
                                  min={0}
                                  max={item.requested_qty}
                                  value={acceptedItems.get(item.item_code) ?? item.requested_qty}
                                  onChange={e => {
                                    const v = Math.min(item.requested_qty, Math.max(0, Number(e.target.value) || 0))
                                    setAcceptedItems(prev => new Map(prev).set(item.item_code, v))
                                  }}
                                  className="w-20 h-8 text-center text-sm mx-auto"
                                  dir="ltr"
                                />
                              </TableCell>
                            ) : (
                              <TableCell className="text-sm text-center">{item.accepted_qty ?? '—'}</TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Rejection reason (for rejecting) */}
              {selectedRequest.status === 'Pending' && (
                <div>
                  <Label className="text-sm font-semibold">{t('sr.admin.stockreq.rejection_reason_optional')}</Label>
                  <Textarea
                    placeholder={t('sr.admin.stockreq.rejection_reason_placeholder')}
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    className="mt-1"
                    rows={2}
                  />
                </div>
              )}

              {/* Show rejection reason if already rejected */}
              {selectedRequest.rejection_reason && (
                <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                  <p className="text-xs font-semibold text-red-700 mb-1">{t('sr.admin.stockreq.rejection_reason')}</p>
                  <p className="text-sm text-red-600">{selectedRequest.rejection_reason}</p>
                </div>
              )}

              {/* Stock entry link */}
              {selectedRequest.stock_entry && (
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <p className="text-xs font-semibold text-emerald-700 mb-1">{t('sr.admin.stockreq.stock_entry')}</p>
                  <p className="text-sm font-mono text-emerald-600">{selectedRequest.stock_entry}</p>
                </div>
              )}
            </div>
          )}

          {selectedRequest?.status === 'Pending' && (
            <DialogFooter className="gap-2">
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                {t('sr.admin.stockreq.reject')}
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={handleAccept}
                disabled={actionLoading}
              >
                {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                {t('sr.admin.stockreq.accept')}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
