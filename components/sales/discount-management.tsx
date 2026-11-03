/**
 * Discount Management - Profiles + Approval Queue
 */

'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { salesApi, type DiscountPermissionProfile, type DiscountApprovalRequest } from '@/lib/sales-api'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { Search, Plus, RefreshCw, Check, X, Loader2, Percent, ShieldCheck, MoreVertical, Edit } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function DiscountManagement() {
  const { t, isRTL } = useI18n()
  const { toast } = useToast()
  const [tab, setTab] = useState('profiles')
  const [profiles, setProfiles] = useState<DiscountPermissionProfile[]>([])
  const [approvals, setApprovals] = useState<DiscountApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    profile_name: '', max_discount_percentage: 10, is_active: 1,
    rules: [{ item_group: '', max_discount: 10 }] as { item_group: string, max_discount: number }[],
  })

  const loadData = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true); else setLoading(true)
      const [p, a] = await Promise.all([
        salesApi.getDiscountProfiles(),
        salesApi.getPendingApprovals().catch(() => []),
      ])
      setProfiles(p); setApprovals(a)
    } catch (e) { toast({ title: t('sr.admin.common.error_title'), description: String(e), variant: 'destructive' }) }
    finally { setLoading(false); setRefreshing(false) }
  }, [toast, t])

  useEffect(() => { loadData() }, [loadData])

  const filteredProfiles = useMemo(() => {
    if (!search) return profiles
    const q = search.toLowerCase()
    return profiles.filter(p => p.profile_name?.toLowerCase().includes(q))
  }, [profiles, search])

  const filteredApprovals = useMemo(() => {
    if (!search) return approvals
    const q = search.toLowerCase()
    return approvals.filter(a => a.sales_person?.toLowerCase().includes(q) || a.customer?.toLowerCase().includes(q))
  }, [approvals, search])

  const handleCreateProfile = async () => {
    if (!form.profile_name.trim()) return
    setSaving(true)
    try {
      await salesApi.createDiscountProfile({
        profile_name: form.profile_name,
        max_discount_percentage: form.max_discount_percentage,
        is_active: form.is_active,
        rules: form.rules.filter(r => r.item_group).map(r => ({ item_group: r.item_group, max_discount: r.max_discount })) as any,
      })
      toast({ title: t('sr.admin.common.created') })
      setShowCreate(false); loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
    finally { setSaving(false) }
  }

  const handleApprove = async (approval: DiscountApprovalRequest) => {
    try {
      await salesApi.approveDiscount(approval.name, '')
      toast({ title: t('sr.admin.discounts.approved') })
      loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
  }

  const handleReject = async (approval: DiscountApprovalRequest, reason: string = '') => {
    try {
      await salesApi.rejectDiscount(approval.name, reason || 'Rejected by manager')
      toast({ title: t('sr.admin.discounts.rejected_title') })
      loadData(true)
    } catch (e: any) { toast({ title: t('sr.admin.common.error_title'), description: e.message, variant: 'destructive' }) }
  }

  const addRule = () => setForm(f => ({ ...f, rules: [...f.rules, { item_group: '', max_discount: 10 }] }))
  const removeRule = (i: number) => setForm(f => ({ ...f, rules: f.rules.filter((_, idx) => idx !== i) }))

  if (loading) return <div className="p-6 space-y-4"><Skeleton className="h-10 w-64" />{[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sr.admin.discounts.title')}</h1>
          <p className="text-sm text-gray-500">
            {approvals.length > 0 && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 mr-2">{approvals.length} {t('sr.admin.discounts.pending_unit')}</Badge>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}><RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} /></Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-gray-100">
          <TabsTrigger value="profiles" className="gap-2"><Percent className="h-4 w-4" /> {t('sr.admin.discounts.profiles')}</TabsTrigger>
          <TabsTrigger value="approvals" className="gap-2">
            <ShieldCheck className="h-4 w-4" /> {t('sr.admin.discounts.approvals')}
            {approvals.length > 0 && <Badge className="bg-amber-500 text-white text-[10px] px-1.5">{approvals.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Profiles Tab */}
        <TabsContent value="profiles" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
              <Input placeholder={t('sr.admin.common.search')} value={search} onChange={e => setSearch(e.target.value)} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
            </div>
            <Button size="sm" onClick={() => { setForm({ profile_name: '', max_discount_percentage: 10, is_active: 1, rules: [{ item_group: '', max_discount: 10 }] }); setShowCreate(true) }} className="bg-violet-600 hover:bg-violet-700">
              <Plus className={cn('h-4 w-4', isRTL ? 'ml-2' : 'mr-2')} /> {t('sr.admin.discounts.new_profile')}
            </Button>
          </div>

          <Card className="border-0 shadow-sm overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-gray-50/50">
                <TableHead className="text-xs font-semibold">{t('sr.admin.discounts.profile_name_header')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.discounts.max_discount')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.discounts.rules')}</TableHead>
                <TableHead className="text-xs font-semibold">{t('sr.admin.common.status')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredProfiles.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-12 text-gray-400">{t('sr.admin.discounts.no_profiles')}</TableCell></TableRow>
                ) : filteredProfiles.map(p => (
                  <TableRow key={p.name} className="hover:bg-gray-50/50">
                    <TableCell className="font-medium">{p.profile_name}</TableCell>
                    <TableCell><Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100">{p.max_discount_percentage}%</Badge></TableCell>
                    <TableCell className="text-sm text-gray-500">{p.rules?.length || 0} {t('sr.admin.discounts.unit_rules')}</TableCell>
                    <TableCell>
                      <Badge className={cn('text-[10px]', p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600')}>
                        {p.is_active ? t('sr.admin.common.active') : t('sr.admin.discounts.inactive')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Approvals Tab */}
        <TabsContent value="approvals" className="mt-4 space-y-4">
          <Card className="border-0 shadow-sm"><CardContent className="p-3">
            <div className="relative">
              <Search className={cn('absolute top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400', isRTL ? 'right-3' : 'left-3')} />
              <Input placeholder={t('sr.admin.common.search')} value={search} onChange={e => setSearch(e.target.value)} className={cn('h-9 text-sm', isRTL ? 'pr-9' : 'pl-9')} />
            </div>
          </CardContent></Card>

          {filteredApprovals.length === 0 ? (
            <Card className="border-0 shadow-sm"><CardContent className="p-12 text-center text-gray-400">
              <ShieldCheck className="h-12 w-12 mx-auto mb-3 text-emerald-200" />
              <p className="text-lg font-medium text-gray-500">{t('sr.admin.discounts.no_pending')}</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {filteredApprovals.map(a => (
                <Card key={a.name} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{a.sales_person}</span>
                          <span className="text-gray-400">→</span>
                          <span className="text-gray-600">{a.customer}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span>{t('sr.admin.discounts.discount')}: <strong className="text-red-600">{a.requested_discount}%</strong></span>
                          {a.item_group && <span>{t('sr.admin.discounts.group')}: {a.item_group}</span>}
                          <span className="text-xs">{a.creation?.split(' ')[0]}</span>
                        </div>
                        {a.reason && <p className="text-sm text-gray-400 mt-1 italic">&ldquo;{a.reason}&rdquo;</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleReject(a)}>
                          <X className="h-4 w-4" />
                        </Button>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(a)}>
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Profile Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('sr.admin.discounts.new_discount_profile')}</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>{t('sr.admin.discounts.profile_name')} *</Label><Input value={form.profile_name} onChange={e => setForm(f => ({ ...f, profile_name: e.target.value }))} className="mt-1" /></div>
            <div>
              <Label>{t('sr.admin.discounts.max_discount_pct')}</Label>
              <Input type="number" min={0} max={100} value={form.max_discount_percentage} onChange={e => setForm(f => ({ ...f, max_discount_percentage: Number(e.target.value) }))} className="mt-1" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <Label>{t('sr.admin.common.active')}</Label>
              <Switch checked={!!form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v ? 1 : 0 }))} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{t('sr.admin.discounts.rules')}</Label>
                <Button variant="outline" size="sm" type="button" onClick={addRule}><Plus className="h-3 w-3 mr-1" /> {t('sr.admin.discounts.add_rule')}</Button>
              </div>
              {form.rules.map((r, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <Input placeholder={t('sr.admin.discounts.item_group')} value={r.item_group} onChange={e => { const rules = [...form.rules]; rules[i].item_group = e.target.value; setForm(f => ({ ...f, rules })) }} className="flex-1 h-9 text-sm" />
                  <Input type="number" placeholder="%" min={0} max={100} value={r.max_discount} onChange={e => { const rules = [...form.rules]; rules[i].max_discount = Number(e.target.value); setForm(f => ({ ...f, rules })) }} className="w-20 h-9 text-sm" />
                  {form.rules.length > 1 && <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400" onClick={() => removeRule(i)}><X className="h-4 w-4" /></Button>}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t('sr.admin.common.cancel')}</Button>
            <Button onClick={handleCreateProfile} disabled={saving} className="bg-violet-600 hover:bg-violet-700">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} {t('sr.admin.common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
