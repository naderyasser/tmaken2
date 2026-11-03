/**
 * Customer Groups Admin — CRUD management of Customer Group (leaf) records.
 * Docnames are the group names (autoname field:customer_group_name); the four
 * ERPNext defaults display localized via customerGroupLabel, client-created
 * groups show their own (typically Arabic) names as-is.
 * Writes go through role-guarded whitelisted APIs (tenant admins lack the
 * Sales Master Manager role the doctype normally requires).
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { salesApi, customerGroupLabel } from '@/lib/sales-api'
import { useI18n } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Plus, RefreshCw, Loader2, Users2, Pencil, Trash2, Tags } from 'lucide-react'

export function CustomerGroupsAdmin() {
  const { isRTL, t } = useI18n()
  const { toast } = useToast()

  const [groups, setGroups] = useState<string[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const [renameTarget, setRenameTarget] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const [groupList, countMap] = await Promise.all([
        salesApi.getCustomerGroups(),
        salesApi.getCustomerGroupCounts().catch(() => ({} as Record<string, number>)),
      ])
      setGroups(groupList)
      setCounts(countMap)
    } catch (e) {
      toast({ title: t('sr.admin.common.error_title'), description: String(e), variant: 'destructive' })
    } finally { setLoading(false); setRefreshing(false) }
  }, [toast, t])

  useEffect(() => { loadData() }, [loadData])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      await salesApi.createCustomerGroup(name)
      toast({ title: t('sr.admin.common.created_title'), description: t('sr.admin.cgroups.toast_created').replace('{name}', name) })
      setNewName('')
      loadData(true)
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e?.message || String(e), variant: 'destructive' })
    } finally { setCreating(false) }
  }

  const handleRename = async () => {
    if (!renameTarget) return
    const name = renameValue.trim()
    if (!name || name === renameTarget) { setRenameTarget(null); return }
    setRenaming(true)
    try {
      await salesApi.renameCustomerGroup(renameTarget, name)
      toast({ title: t('sr.admin.common.updated_title'), description: t('sr.admin.cgroups.toast_renamed').replace('{name}', name) })
      setRenameTarget(null)
      loadData(true)
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e?.message || String(e), variant: 'destructive' })
    } finally { setRenaming(false) }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await salesApi.deleteCustomerGroup(deleteTarget)
      toast({ title: t('sr.admin.common.deleted_title_alt'), description: t('sr.admin.cgroups.toast_deleted').replace('{name}', deleteTarget) })
      setDeleteTarget(null)
      loadData(true)
    } catch (e: any) {
      toast({ title: t('sr.admin.common.error_title'), description: e?.message || String(e), variant: 'destructive' })
    } finally { setDeleting(false) }
  }

  if (loading) return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-10 w-64" />
      {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12" />)}
    </div>
  )

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Tags className="h-6 w-6 text-emerald-600" />
            {t('sr.admin.cgroups.title')}
          </h1>
          <p className="text-sm text-gray-500">{t('sr.admin.cgroups.subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </Button>
      </div>

      {/* Create */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 flex items-center gap-2">
          <Input
            placeholder={t('sr.admin.cgroups.new_placeholder')}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            className="h-9 text-sm"
          />
          <Button size="sm" onClick={handleCreate} disabled={creating || !newName.trim()} className="bg-emerald-600 hover:bg-emerald-700 flex-shrink-0">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className={cn('h-4 w-4', isRTL ? 'ml-1' : 'mr-1')} />}
            {t('sr.admin.cgroups.add_btn')}
          </Button>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader><TableRow className="bg-gray-50/50">
            <TableHead className="text-xs font-semibold">{t('sr.admin.cgroups.th_group')}</TableHead>
            <TableHead className="text-xs font-semibold">{t('sr.admin.cgroups.th_customers')}</TableHead>
            <TableHead className="text-xs font-semibold w-24"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-12 text-gray-400">{t('sr.admin.cgroups.empty')}</TableCell></TableRow>
            ) : groups.map(g => {
              const label = customerGroupLabel(t, g)
              const isDefault = label !== g
              const count = counts[g] || 0
              return (
                <TableRow key={g} className="hover:bg-gray-50/50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{label}</span>
                      {isDefault && (
                        <Badge className="text-[10px] bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-100">
                          {g}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                      <Users2 className="h-3.5 w-3.5 text-gray-400" /> {count}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setRenameTarget(g); setRenameValue(g) }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-600 disabled:text-gray-300"
                        onClick={() => setDeleteTarget(g)}
                        disabled={count > 0}
                        title={count > 0 ? t('sr.admin.cgroups.err_has_customers').replace('{n}', String(count)) : undefined}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      <p className="text-[11px] text-gray-400">{t('sr.admin.cgroups.hint')}</p>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => { if (!o) setRenameTarget(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('sr.admin.cgroups.rename_title').replace('{name}', renameTarget || '')}</DialogTitle></DialogHeader>
          <div className="py-2">
            <Label className="text-xs">{t('sr.admin.cgroups.th_group')}</Label>
            <Input
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename() }}
              className="mt-1"
            />
            <p className="text-[11px] text-gray-400 mt-2">{t('sr.admin.cgroups.rename_hint')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>{t('sr.admin.common.cancel')}</Button>
            <Button onClick={handleRename} disabled={renaming || !renameValue.trim()} className="bg-emerald-600 hover:bg-emerald-700">
              {renaming && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('sr.admin.common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sr.admin.cgroups.confirm_delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('sr.admin.cgroups.confirm_delete_desc').replace('{name}', deleteTarget ?? '')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('sr.admin.common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('sr.admin.common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
