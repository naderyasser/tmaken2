'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  RefreshCw, Plus, Users, UserCheck, UserPlus, Eye, Pencil, Trash2, ArrowRightLeft,
  Table2, LayoutGrid, Wand2, GitMerge, Layers, Zap, Loader2,
} from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { translateEnum } from '@/lib/enums'
import { formatDateShort } from '@/lib/format'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  DataTable, emptyDash,
  type DataTableColumn, type DataTableFilter, type DataTableRowAction, type DataTableBulkAction,
} from '@/components/freelancer/shared/data-table'
import { DataQualityFlags, missingFlags } from '@/components/freelancer/shared/data-quality-flags'
import { type DateRange } from '@/components/freelancer/shared/date-range-filter'
import { usePersistedState } from '@/lib/freelancer/use-table-prefs'
import { showUndoToast } from '@/lib/freelancer/undo-toast'
import { ClientFormDialog, type ClientFormSeed } from '@/components/freelancer/client-form-dialog'
import { ClientDetailSheet, type ClientRow } from '@/components/freelancer/client-detail-sheet'
import { ClientKanban } from '@/components/freelancer/client-kanban'
import { ClientMergeDialog } from '@/components/freelancer/client-merge-dialog'
import {
  LEAD_STAGES, LEAD_STAGE_BADGE, leadStageLabel, leadStatusToStage, leadStageToStatus, type LeadStage,
} from '@/lib/freelancer/lead-pipeline'

interface CustomerRecord {
  name: string
  customer_name?: string
  territory?: string
  mobile_no?: string
  creation?: string
}

interface LeadRecord {
  name: string
  lead_name?: string
  company_name?: string
  territory?: string
  mobile_no?: string
  phone?: string
  email_id?: string
  status?: string
  creation?: string
}

const normalizeName = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

export function ClientsList() {
  const { t, isRTL, lang } = useI18n()
  const { toast } = useToast()
  const msg = (en: string, ar: string) => (isRTL ? ar : en)

  const [rows, setRows] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [view, setView] = useState<'table' | 'pipeline'>('table')

  // Persisted filters / date range (item 2)
  const [typeFilter, setTypeFilter] = usePersistedState('fl-clients:type', 'all')
  const [stageFilter, setStageFilter] = usePersistedState('fl-clients:stage', 'all')
  const [dateRange, setDateRange] = usePersistedState<DateRange>('fl-clients:dates', { from: '', to: '' })

  // Create / edit / quick-add dialog
  const [formOpen, setFormOpen] = useState(false)
  const [formQuickAdd, setFormQuickAdd] = useState(false)
  const [editingSeed, setEditingSeed] = useState<ClientFormSeed | null>(null)

  // Detail sheet
  const [detailClient, setDetailClient] = useState<ClientRow | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  // Delete confirmation (single + bulk)
  const [deleteTargets, setDeleteTargets] = useState<ClientRow[] | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Bulk stage assignment
  const [stageTargets, setStageTargets] = useState<ClientRow[] | null>(null)
  const [stagePick, setStagePick] = useState<LeadStage>('contacted')
  const [assigning, setAssigning] = useState(false)

  // Pipeline single-move spinner + merge dialog
  const [movingId, setMovingId] = useState<string | null>(null)
  const [mergeOpen, setMergeOpen] = useState(false)

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------

  const load = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const [customers, leads] = await Promise.all([
        frappeClient.getList<CustomerRecord>('Customer', {
          fields: ['name', 'customer_name', 'territory', 'mobile_no' as any, 'creation'],
          limit_page_length: 0,
          order_by: 'modified desc',
        }),
        frappeClient.getList<LeadRecord>('Lead', {
          fields: ['name', 'lead_name', 'company_name', 'territory', 'mobile_no' as any, 'phone' as any, 'email_id' as any, 'status', 'creation'],
          limit_page_length: 0,
          order_by: 'modified desc',
        }).catch(() => [] as LeadRecord[]),
      ])

      const customerRows: ClientRow[] = (customers || []).map((c) => ({
        id: `customer:${c.name}`,
        docname: c.name,
        kind: 'customer',
        name: c.customer_name || c.name,
        territory: c.territory || '',
        phone: c.mobile_no || '',
        email: '',
        stage: 'converted',
        created: c.creation,
      }))

      const leadRows: ClientRow[] = (leads || []).map((l) => ({
        id: `lead:${l.name}`,
        docname: l.name,
        kind: 'lead',
        name: l.lead_name || l.company_name || l.name,
        territory: l.territory || '',
        phone: l.mobile_no || l.phone || '',
        email: l.email_id || '',
        leadStatus: l.status,
        stage: leadStatusToStage(l.status),
        created: l.creation,
      }))

      setRows([...customerRows, ...leadRows])
    } catch (err: any) {
      console.error('Failed to load clients:', err)
      setError(err?.message || t('fl.clients.load_fail'))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [t])

  useEffect(() => { load() }, [load])

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------

  const stats = useMemo(() => ({
    total: rows.length,
    customers: rows.filter((r) => r.kind === 'customer').length,
    leads: rows.filter((r) => r.kind === 'lead').length,
  }), [rows])

  const leadRows = useMemo(() => rows.filter((r) => r.kind === 'lead'), [rows])

  // Likely-duplicate groups: same kind + same normalized name, 2+ members (item 11)
  const duplicateGroups = useMemo(() => {
    const map = new Map<string, ClientRow[]>()
    for (const r of rows) {
      const norm = normalizeName(r.name)
      if (!norm) continue
      const key = `${r.kind}::${norm}`
      const arr = map.get(key) || []
      arr.push(r)
      map.set(key, arr)
    }
    return [...map.values()].filter((g) => g.length > 1)
  }, [rows])

  const rowFlags = useCallback((r: ClientRow) => missingFlags([
    { key: 'phone', label: msg('Phone', 'هاتف'), missing: !r.phone },
    { key: 'territory', label: msg('Region', 'المنطقة'), missing: !r.territory },
    { key: 'stage', label: msg('Stage', 'المرحلة'), missing: r.kind === 'lead' && !r.leadStatus },
  ]), [isRTL]) // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const openCreate = () => { setEditingSeed(null); setFormQuickAdd(false); setFormOpen(true) }
  const openQuickAdd = () => { setEditingSeed(null); setFormQuickAdd(true); setFormOpen(true) }

  const openEdit = (row: ClientRow) => {
    setEditingSeed({ kind: row.kind, docname: row.docname, name: row.name, phone: row.phone, territory: row.territory, email: row.email })
    setFormQuickAdd(false)
    setFormOpen(true)
  }

  const openDetail = (row: ClientRow) => { setDetailClient(row); setDetailOpen(true) }

  const convertToCustomer = async (row: ClientRow) => {
    try {
      await frappeClient.call('frappe.client.insert', {
        doc: {
          doctype: 'Customer',
          customer_name: row.name,
          mobile_no: row.phone || undefined,
          territory: row.territory || 'All Territories',
          customer_group: 'All Customer Groups',
        },
      })
      await frappeClient.put('Lead', row.docname, { status: 'Converted' })
      toast({ title: msg('Converted', 'تم التحويل'), description: msg('Lead converted to customer.', 'تم تحويل العميل المحتمل إلى عميل.') })
      await load(true)
    } catch (e: any) {
      toast({ title: msg('Error', 'خطأ'), description: e?.message || msg('Conversion failed.', 'فشل التحويل.'), variant: 'destructive' })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTargets) return
    setDeleting(true)
    const ids = new Set(deleteTargets.map((r) => r.id))
    const snapshot = rows
    setRows((p) => p.filter((r) => !ids.has(r.id))) // optimistic
    try {
      for (const row of deleteTargets) {
        await frappeClient.delete(row.kind === 'customer' ? 'Customer' : 'Lead', row.docname)
      }
      toast({
        title: msg('Deleted', 'تم الحذف'),
        description: deleteTargets.length > 1
          ? msg(`${deleteTargets.length} clients deleted.`, `تم حذف ${deleteTargets.length} عميل.`)
          : msg('Client deleted.', 'تم حذف العميل.'),
      })
      setDeleteTargets(null)
      await load(true)
    } catch (e: any) {
      setRows(snapshot) // rollback
      toast({ title: msg('Error', 'خطأ'), description: e?.message || msg('Delete failed.', 'فشل الحذف.'), variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // Single lead stage move (used by the kanban) — optimistic + undo
  const moveLeadStage = useCallback(async (row: ClientRow, toStage: LeadStage) => {
    const prevStatus = row.leadStatus
    if (leadStatusToStage(prevStatus) === toStage) return
    setMovingId(row.id)
    setRows((p) => p.map((r) => (r.id === row.id ? { ...r, stage: toStage, leadStatus: leadStageToStatus(toStage) } : r)))
    try {
      await frappeClient.put('Lead', row.docname, { status: leadStageToStatus(toStage) })
      showUndoToast(toast, {
        title: msg('Stage updated', 'تم تحديث المرحلة'),
        description: `${row.name} → ${leadStageLabel(toStage, isRTL)}`,
        undoLabel: msg('Undo', 'تراجع'),
        onUndo: async () => {
          setRows((p) => p.map((r) => (r.id === row.id ? { ...r, leadStatus: prevStatus, stage: leadStatusToStage(prevStatus) } : r)))
          try { await frappeClient.put('Lead', row.docname, { status: prevStatus || 'Lead' }) } catch { /* reload reconciles */ }
          load(true)
        },
      })
    } catch (e: any) {
      setRows((p) => p.map((r) => (r.id === row.id ? { ...r, leadStatus: prevStatus, stage: leadStatusToStage(prevStatus) } : r)))
      toast({ title: msg('Error', 'خطأ'), description: e?.message || msg('Update failed.', 'فشل التحديث.'), variant: 'destructive' })
    } finally {
      setMovingId(null)
    }
  }, [isRTL]) // eslint-disable-line react-hooks/exhaustive-deps

  // Bulk assign-stage (leads only) — optimistic + undo
  const applyBulkStage = async () => {
    if (!stageTargets) return
    const leads = stageTargets.filter((r) => r.kind === 'lead')
    if (leads.length === 0) {
      toast({ title: msg('No leads selected', 'لا عملاء محتملون'), description: msg('Stage applies to leads only.', 'المرحلة تنطبق على العملاء المحتملين فقط.'), variant: 'destructive' })
      setStageTargets(null)
      return
    }
    const prev = leads.map((r) => ({ id: r.id, docname: r.docname, status: r.leadStatus }))
    const ids = new Set(leads.map((r) => r.id))
    setAssigning(true)
    setRows((p) => p.map((r) => (ids.has(r.id) ? { ...r, stage: stagePick, leadStatus: leadStageToStatus(stagePick) } : r)))
    try {
      for (const r of leads) await frappeClient.put('Lead', r.docname, { status: leadStageToStatus(stagePick) })
      setStageTargets(null)
      showUndoToast(toast, {
        title: msg('Stage updated', 'تم تحديث المرحلة'),
        description: msg(`${leads.length} leads → ${leadStageLabel(stagePick, isRTL)}`, `${leads.length} عميل → ${leadStageLabel(stagePick, isRTL)}`),
        undoLabel: msg('Undo', 'تراجع'),
        onUndo: async () => {
          setRows((p) => p.map((r) => {
            const f = prev.find((x) => x.id === r.id)
            return f ? { ...r, leadStatus: f.status, stage: leadStatusToStage(f.status) } : r
          }))
          try { for (const x of prev) await frappeClient.put('Lead', x.docname, { status: x.status || 'Lead' }) } catch { /* reload reconciles */ }
          load(true)
        },
      })
    } catch (e: any) {
      setRows((p) => p.map((r) => {
        const f = prev.find((x) => x.id === r.id)
        return f ? { ...r, leadStatus: f.status, stage: leadStatusToStage(f.status) } : r
      }))
      toast({ title: msg('Error', 'خطأ'), description: e?.message || msg('Update failed.', 'فشل التحديث.'), variant: 'destructive' })
    } finally {
      setAssigning(false)
    }
  }

  // -------------------------------------------------------------------------
  // DataTable config
  // -------------------------------------------------------------------------

  const typeLabel = (kind: ClientRow['kind']) => (kind === 'customer' ? msg('Customer', 'عميل') : msg('Lead', 'عميل محتمل'))

  const columns: DataTableColumn<ClientRow>[] = [
    {
      id: 'name', header: msg('Name', 'الاسم'), sortable: true,
      sortAccessor: (r) => r.name.toLowerCase(), exportAccessor: (r) => r.name,
      cell: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      id: 'type', header: msg('Type', 'النوع'), exportAccessor: (r) => typeLabel(r.kind),
      cell: (r) => (
        <Badge className={r.kind === 'customer' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-800'}>{typeLabel(r.kind)}</Badge>
      ),
    },
    {
      id: 'stage', header: msg('Stage', 'المرحلة'),
      exportAccessor: (r) => (r.kind === 'lead' ? leadStageLabel(r.stage, isRTL) : ''),
      cell: (r) => (r.kind === 'lead'
        ? <Badge className={LEAD_STAGE_BADGE[r.stage]}>{leadStageLabel(r.stage, isRTL)}</Badge>
        : emptyDash('')),
    },
    {
      id: 'territory', header: msg('Region', 'المنطقة'), hideOnMobile: true,
      exportAccessor: (r) => translateEnum('territory', r.territory, lang),
      cell: (r) => <span className="text-sm text-muted-foreground">{emptyDash(translateEnum('territory', r.territory, lang))}</span>,
    },
    {
      id: 'phone', header: msg('Phone', 'الهاتف'), exportAccessor: (r) => r.phone,
      cell: (r) => <span className="text-sm text-muted-foreground" dir="ltr">{emptyDash(r.phone)}</span>,
    },
    {
      id: 'data', header: msg('Data', 'البيانات'),
      exportAccessor: (r) => rowFlags(r).map((f) => f.label).join(' / '),
      cell: (r) => <DataQualityFlags flags={rowFlags(r)} isRTL={isRTL} />,
    },
    {
      id: 'created', header: msg('Created', 'تاريخ الإنشاء'), hideOnMobile: true, sortable: true,
      sortAccessor: (r) => r.created || '', exportAccessor: (r) => formatDateShort(r.created),
      cell: (r) => <span className="text-sm text-muted-foreground">{emptyDash(formatDateShort(r.created))}</span>,
    },
  ]

  const filters: DataTableFilter[] = [
    {
      id: 'type', label: msg('Type', 'النوع'), value: typeFilter, onChange: setTypeFilter,
      options: [
        { value: 'all', label: msg('All types', 'كل الأنواع') },
        { value: 'customer', label: msg('Customers', 'العملاء') },
        { value: 'lead', label: msg('Leads', 'العملاء المحتملون') },
      ],
      predicate: (r: ClientRow, v) => r.kind === v,
    },
    {
      id: 'stage', label: msg('Stage', 'المرحلة'), value: stageFilter, onChange: setStageFilter, width: 'w-[150px]',
      options: [
        { value: 'all', label: msg('All stages', 'كل المراحل') },
        ...LEAD_STAGES.map((s) => ({ value: s, label: leadStageLabel(s, isRTL) })),
        { value: 'lost', label: leadStageLabel('lost', isRTL) },
      ],
      predicate: (r: ClientRow, v) => r.kind === 'lead' && r.stage === v,
    },
  ]

  const rowActions: DataTableRowAction<ClientRow>[] = [
    { id: 'view', label: msg('View details', 'عرض التفاصيل'), icon: Eye, onSelect: openDetail },
    { id: 'edit', label: msg('Edit', 'تعديل'), icon: Pencil, onSelect: openEdit },
    {
      id: 'complete', label: msg('Complete data', 'استكمال البيانات'), icon: Wand2,
      onSelect: openEdit, hidden: (r) => rowFlags(r).length === 0,
    },
    {
      id: 'convert', label: msg('Convert to customer', 'تحويل إلى عميل'), icon: ArrowRightLeft,
      onSelect: convertToCustomer, hidden: (r) => r.kind !== 'lead',
    },
    {
      id: 'delete', label: msg('Delete', 'حذف'), icon: Trash2, destructive: true, separatorBefore: true,
      onSelect: (r) => setDeleteTargets([r]),
    },
  ]

  const bulkActions: DataTableBulkAction<ClientRow>[] = [
    {
      id: 'bulk-stage', label: msg('Assign stage', 'تعيين مرحلة'), icon: Layers,
      onSelect: (rs) => { setStagePick('contacted'); setStageTargets(rs) },
    },
    {
      id: 'bulk-delete', label: msg('Delete', 'حذف'), icon: Trash2, destructive: true,
      onSelect: (rs) => setDeleteTargets(rs),
    },
  ]

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const statCards = [
    { label: t('fl.clients.all'), value: stats.total, icon: Users, bg: 'bg-accent', fg: 'text-primary' },
    { label: t('fl.clients.customers'), value: stats.customers, icon: UserCheck, bg: 'bg-primary/10', fg: 'text-primary' },
    { label: msg('Potential clients', 'العملاء المحتملون'), value: stats.leads, icon: UserPlus, bg: 'bg-amber-50', fg: 'text-amber-600' },
  ]

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{t('fl.clients.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('fl.clients.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg border p-0.5">
            <Button variant={view === 'table' ? 'secondary' : 'ghost'} size="sm" className="h-8" onClick={() => setView('table')}>
              <Table2 className={`h-4 w-4 ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />{msg('Table', 'جدول')}
            </Button>
            <Button variant={view === 'pipeline' ? 'secondary' : 'ghost'} size="sm" className="h-8" onClick={() => setView('pipeline')}>
              <LayoutGrid className={`h-4 w-4 ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />{msg('Pipeline', 'المسار')}
            </Button>
          </div>
          {duplicateGroups.length > 0 && (
            <Button variant="outline" size="sm" className="h-8 border-amber-300 text-amber-700" onClick={() => setMergeOpen(true)}>
              <GitMerge className={`h-4 w-4 ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />
              {msg(`Merge duplicates (${duplicateGroups.length})`, `دمج المكرر (${duplicateGroups.length})`)}
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-8" onClick={openQuickAdd}>
            <Zap className={`h-4 w-4 ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />{msg('Quick add lead', 'إضافة سريعة')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {statCards.map(({ label, value, icon: Icon, bg, fg }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2.5 ${bg}`}><Icon className={`h-5 w-5 ${fg}`} /></div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-xl font-bold text-foreground">{value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table or Pipeline */}
      {view === 'table' ? (
        <DataTable<ClientRow>
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          isRTL={isRTL}
          loading={loading}
          error={error}
          onRetry={() => load()}
          searchable
          searchAccessor={(r) => `${r.name} ${r.phone} ${r.territory} ${r.email}`}
          searchPlaceholder={t('fl.clients.search')}
          filters={filters}
          dateFilter={{ value: dateRange, onChange: setDateRange, accessor: (r: ClientRow) => r.created, label: msg('Created', 'تاريخ الإنشاء'), lang }}
          rowActions={rowActions}
          bulkActions={bulkActions}
          onRowClick={openDetail}
          exportFilename="freelancer-clients"
          exportTitle={msg('Clients', 'العملاء')}
          persistKey="fl-clients"
          emptyMessage={t('fl.clients.none')}
          toolbarEnd={
            <>
              <Button variant="outline" size="sm" className="h-9" onClick={() => load(true)} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''} ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />
                {t('fl.common.refresh')}
              </Button>
              <Button size="sm" className="h-9" onClick={openCreate}>
                <Plus className={`h-4 w-4 ${isRTL ? 'ml-1.5' : 'mr-1.5'}`} />
                {t('fl.clients.new')}
              </Button>
            </>
          }
        />
      ) : (
        <ClientKanban
          leads={leadRows}
          isRTL={isRTL}
          lang={lang}
          onCardClick={openDetail}
          onMove={moveLeadStage}
          movingId={movingId}
        />
      )}

      {/* Create / edit / quick-add dialog */}
      <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editingSeed} quickAdd={formQuickAdd} onSaved={() => load(true)} />

      {/* Detail sheet */}
      <ClientDetailSheet client={detailClient} open={detailOpen} onOpenChange={setDetailOpen} onChanged={() => load(true)} />

      {/* Merge duplicates */}
      <ClientMergeDialog groups={duplicateGroups} open={mergeOpen} onOpenChange={setMergeOpen} onMerged={() => load(true)} />

      {/* Bulk stage assignment */}
      <Dialog open={!!stageTargets} onOpenChange={(o) => !assigning && !o && setStageTargets(null)}>
        <DialogContent className="max-w-sm" dir={isRTL ? 'rtl' : 'ltr'}>
          <DialogHeader>
            <DialogTitle>{msg('Assign stage', 'تعيين مرحلة')}</DialogTitle>
            <DialogDescription>
              {msg(`Move ${(stageTargets || []).filter((r) => r.kind === 'lead').length} lead(s) to a stage.`,
                   `نقل ${(stageTargets || []).filter((r) => r.kind === 'lead').length} عميل محتمل إلى مرحلة.`)}
            </DialogDescription>
          </DialogHeader>
          <Select value={stagePick} onValueChange={(v) => setStagePick(v as LeadStage)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEAD_STAGES.map((s) => <SelectItem key={s} value={s}>{leadStageLabel(s, isRTL)}</SelectItem>)}
              <SelectItem value="lost">{leadStageLabel('lost', isRTL)}</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setStageTargets(null)} disabled={assigning}>{msg('Cancel', 'إلغاء')}</Button>
            <Button onClick={applyBulkStage} disabled={assigning}>
              {assigning && <Loader2 className={isRTL ? 'ml-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4 animate-spin'} />}
              {msg('Apply', 'تطبيق')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTargets}
        onOpenChange={(o) => !o && setDeleteTargets(null)}
        title={(deleteTargets?.length || 0) > 1
          ? msg(`Delete ${deleteTargets?.length} clients?`, `حذف ${deleteTargets?.length} عميل؟`)
          : msg('Delete this client?', 'حذف هذا العميل؟')}
        description={msg('This action cannot be undone.', 'لا يمكن التراجع عن هذا الإجراء.')}
        confirmLabel={msg('Delete', 'حذف')}
        cancelLabel={msg('Cancel', 'إلغاء')}
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </div>
  )
}
