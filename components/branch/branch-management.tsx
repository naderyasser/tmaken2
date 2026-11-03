'use client'

import { useState, useEffect, useCallback } from 'react'
import { useI18n } from '@/lib/i18n'
import { translateDepartment } from '@/lib/enums'
import { useCompany } from '@/hooks/use-company'
import { frappeClient } from '@/lib/api-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import {
  GitBranch,
  Users,
  Settings2,
  Search,
  Plus,
  Pencil,
  Trash2,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  Building2,
  Fingerprint,
  Camera,
  UserCheck,
  AlertCircle,
  Activity,
  MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getBranchGeofences } from '@/lib/mobile-attendance/geofence'
import { BranchGeofenceTab } from '@/components/branch/branch-geofence-tab'
import { BiometricLogsTab } from '@/components/biometric/biometric-logs-tab'

// ==================== Types ====================

interface BranchSettings {
  branch: string
  company: string
  is_active: number
  checkin_method: string
  allow_face_recognition: number
  allow_webauthn: number
  allow_adms: number
  enable_geofence: number
  /** Organisational number, stored on Branch itself — see BranchOption. */
  branch_number?: string
  geofence_latitude?: number
  geofence_longitude?: number
  geofence_radius_meters?: number
  employee_count?: number
}

interface EmployeeWithBranch {
  employee: string
  employee_name: string
  department?: string
  designation?: string
  branch?: string
  image?: string
  company?: string
}

interface BranchOption {
  name: string
  company: string
  /** `Branch.custom_branch_number` — the admin-entered organisational number. */
  custom_branch_number?: string | null
}

/** Branch pickers read better with the organisational number in front of the name. */
function branchLabel(b: BranchOption) {
  return b.custom_branch_number ? `${b.custom_branch_number} \u2014 ${b.name}` : b.name
}

const CHECKIN_METHODS = ['Manual', 'Photo', 'Biometric', 'Photo + Biometric'] as const

// ==================== Branch Settings Dialog ====================

function BranchSettingsDialog({
  open,
  onClose,
  onSaved,
  existing,
  branches,
  company,
  t,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  existing: BranchSettings | null
  branches: BranchOption[]
  company: string
  t: (k: string) => string
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [creatingBranch, setCreatingBranch] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')

  const [branch, setBranch] = useState('')
  // Lives on Branch, not on Biometric Branch Settings, so it is saved separately.
  const [branchNumber, setBranchNumber] = useState('')
  const [newBranchNumber, setNewBranchNumber] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [checkinMethod, setCheckinMethod] = useState('Manual')
  const [allowFace, setAllowFace] = useState(true)
  const [allowWebauthn, setAllowWebauthn] = useState(true)
  const [allowAdms, setAllowAdms] = useState(false)

  useEffect(() => {
    if (existing) {
      setBranch(existing.branch)
      setBranchNumber(existing.branch_number || '')
      setIsActive(existing.is_active === 1)
      setCheckinMethod(existing.checkin_method || 'Manual')
      setAllowFace(existing.allow_face_recognition === 1)
      setAllowWebauthn(existing.allow_webauthn === 1)
      setAllowAdms(existing.allow_adms === 1)
    } else {
      setBranch('')
      setBranchNumber('')
      setNewBranchNumber('')
      setIsActive(true)
      setCheckinMethod('Manual')
      setAllowFace(true)
      setAllowWebauthn(true)
      setAllowAdms(false)
    }
  }, [existing, open])

  const handleSave = async () => {
    if (!branch) {
      toast({ title: '⚠️', description: t('bbs.branch') + ' is required', variant: 'destructive' })
      return
    }
    try {
      setSaving(true)
      await frappeClient.call('hrms.api.biometric_branch_api.save_branch_settings', {
        branch,
        company: company || existing?.company || branches[0]?.company || '',
        is_active: isActive ? 1 : 0,
        checkin_method: checkinMethod,
        allow_face_recognition: allowFace ? 1 : 0,
        allow_webauthn: allowWebauthn ? 1 : 0,
        allow_adms: allowAdms ? 1 : 0,
        enable_geofence: 0,
        geofence_latitude: null,
        geofence_longitude: null,
        geofence_radius_meters: null,
      })
      // The number belongs to Branch, so it needs its own write. Frappe checks
      // Branch's DocPerms here (HR Manager / HR User), which is the whole access
      // rule for this field — the UI never bypasses it.
      const originalNumber = existing?.branch_number || ''
      if (branchNumber.trim() !== originalNumber) {
        await frappeClient.call('frappe.client.set_value', {
          doctype: 'Branch',
          name: branch,
          fieldname: 'custom_branch_number',
          value: branchNumber.trim(),
        })
      }
      toast({ title: '✅', description: t('bbs.saved') })
      onSaved()
      onClose()
    } catch (err: any) {
      toast({ title: '❌', description: err.message || 'Failed', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const isEdit = !!existing

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
            {isEdit ? t('bbs.edit') : t('bbs.add')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Branch */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">{t('bbs.branch')}</Label>
            {isEdit ? (
              <div className="flex gap-2">
                <Input value={branch} disabled className="bg-muted/40 flex-1" />
                <Input
                  value={branchNumber}
                  onChange={(e) => setBranchNumber(e.target.value)}
                  placeholder={t('bbs.branch_number') || 'Branch no.'}
                  className="w-28 shrink-0"
                  aria-label={t('bbs.branch_number') || 'Branch number'}
                />
              </div>
            ) : creatingBranch ? (
              <div className="flex gap-2">
                <Input
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder={t('bbs.new_branch_name') || 'Branch name...'}
                  className="flex-1"
                  autoFocus
                />
                <Input
                  value={newBranchNumber}
                  onChange={(e) => setNewBranchNumber(e.target.value)}
                  placeholder={t('bbs.branch_number') || 'Branch no.'}
                  className="w-28 shrink-0"
                  aria-label={t('bbs.branch_number') || 'Branch number'}
                />
                <Button aria-label="إضافة" title="إضافة"
                  size="sm"
                  disabled={!newBranchName.trim() || saving}
                  onClick={async () => {
                    const branchCompany = company || branches[0]?.company || ''
                    if (!branchCompany) {
                      toast({ title: '⚠️', description: 'Company is required', variant: 'destructive' })
                      return
                    }
                    try {
                      setSaving(true)
                      await frappeClient.call('frappe.client.insert', {
                        doc: {
                          doctype: 'Branch',
                          branch: newBranchName.trim(),
                          company: branchCompany,
                          custom_branch_number: newBranchNumber.trim() || undefined,
                        },
                      })
                      setBranch(newBranchName.trim())
                      setBranchNumber(newBranchNumber.trim())
                      setCreatingBranch(false)
                      setNewBranchName('')
                      setNewBranchNumber('')
                      onSaved() // reload branches list
                    } catch (err: any) {
                      toast({ title: '❌', description: err.message || 'Failed', variant: 'destructive' })
                    } finally {
                      setSaving(false)
                    }
                  }}
                  className="bg-primary hover:bg-primary/90"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                </Button>
                <Button aria-label="إلغاء" title="إلغاء" size="sm" variant="ghost" onClick={() => setCreatingBranch(false)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Select
                  value={branch}
                  onValueChange={(v) => {
                    setBranch(v)
                    // Show what this branch already carries, so saving the dialog
                    // cannot silently blank a number the admin set elsewhere.
                    setBranchNumber(branches.find((b) => b.name === v)?.custom_branch_number || '')
                  }}
                >
                  <SelectTrigger aria-label={t('bbs.select_branch')}>
                    <SelectValue placeholder={t('bbs.select_branch')} />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.name} value={b.name}>{branchLabel(b)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button aria-label="إضافة" title="إضافة"
                  type="button"
                  onClick={() => setCreatingBranch(true)}
                  className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  {t('bbs.create_new_branch') || 'Create new branch'}
                </button>
                {branch && (
                  <Input
                    value={branchNumber}
                    onChange={(e) => setBranchNumber(e.target.value)}
                    placeholder={t('bbs.branch_number') || 'Branch no.'}
                    aria-label={t('bbs.branch_number') || 'Branch number'}
                  />
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t('bbs.branch_number_hint')}</p>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-3 px-4 bg-muted/40 rounded-lg">
            <div>
              <Label className="text-sm font-semibold">{t('bbs.active')}</Label>
              <p className="text-xs text-muted-foreground">{isActive ? t('common.yes') || 'Yes' : t('common.no') || 'No'}</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Check-in method */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">{t('bbs.checkin_method')}</Label>
            <Select value={checkinMethod} onValueChange={setCheckinMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHECKIN_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Allowed biometric methods */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">{t('bbs.allowed_methods')}</Label>
            <div className="space-y-2">
              {[
                { key: 'face', label: t('bbs.allow_face'), value: allowFace, setter: setAllowFace },
                { key: 'webauthn', label: t('bbs.allow_webauthn'), value: allowWebauthn, setter: setAllowWebauthn },
                { key: 'adms', label: t('bbs.allow_adms'), value: allowAdms, setter: setAllowAdms },
              ].map(({ key, label, value, setter }) => (
                <div key={key} className="flex flex-col gap-1 py-2 px-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Switch checked={value} onCheckedChange={setter} />
                    <Label className="text-sm cursor-pointer">{label}</Label>
                  </div>
                  {key === 'face' && (
                    <p className="text-xs text-muted-foreground ps-11">
                      {t('bio.branch_face_exempt_note')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel') || 'Cancel'}</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {t('common.save') || 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ==================== Delete Confirm Dialog ====================

function DeleteConfirmDialog({
  open,
  onClose,
  onConfirm,
  branchName,
  t,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  branchName: string
  t: (k: string) => string
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            {t('bbs.delete')}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('bbs.delete_confirm')}</p>
        <p className="font-semibold text-foreground">{branchName}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel') || 'Cancel'}</Button>
          <Button aria-label="حذف" title="حذف" variant="destructive" onClick={onConfirm}>
            <Trash2 className="h-4 w-4 mr-2" />
            {t('bbs.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ==================== Branches Tab ====================

function BranchesTab({
  settings,
  loading,
  onRefresh,
  branches,
  company,
  t,
}: {
  settings: BranchSettings[]
  loading: boolean
  onRefresh: () => void
  branches: BranchOption[]
  company: string
  t: (k: string) => string
}) {
  const { toast } = useToast()
  const [editTarget, setEditTarget] = useState<BranchSettings | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BranchSettings | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await frappeClient.call('hrms.api.biometric_branch_api.delete_branch_settings', {
        branch: deleteTarget.branch,
      })
      toast({ title: '✅', description: t('bbs.deleted') })
      onRefresh()
    } catch (err: any) {
      toast({ title: '❌', description: err.message || 'Failed', variant: 'destructive' })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const methodBadgeColor = (m: string) => {
    if (m === 'Manual') return 'secondary'
    if (m === 'Photo') return 'outline'
    return 'default'
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (settings.length === 0) {
    return (
      <>
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <GitBranch className="h-8 w-8 text-muted-foreground/70" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">{t('bbs.no_settings')}</h3>
          <p className="text-sm text-muted-foreground mb-6">{t('bbs.no_settings_sub')}</p>
          <Button aria-label="إضافة" title="إضافة" onClick={() => setShowAdd(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            {t('bbs.add')}
          </Button>
        </div>
        <BranchSettingsDialog
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onSaved={onRefresh}
          existing={null}
          branches={branches}
          company={company}
          t={t}
        />
      </>
    )
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button aria-label="إضافة" title="إضافة" onClick={() => setShowAdd(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4 mr-2" />
          {t('bbs.add')}
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="font-semibold text-foreground/90">{t('bbs.branch')}</TableHead>
              <TableHead className="font-semibold text-foreground/90">{t('bbs.branch_number')}</TableHead>
              <TableHead className="font-semibold text-foreground/90">{t('bbs.company')}</TableHead>
              <TableHead className="font-semibold text-foreground/90">{t('bbs.checkin_method')}</TableHead>
              <TableHead className="font-semibold text-foreground/90">{t('bbs.allowed_methods')}</TableHead>
              <TableHead className="font-semibold text-foreground/90">{t('bbs.employees')}</TableHead>
              <TableHead className="font-semibold text-foreground/90">{t('bbs.active')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {settings.map((s) => (
              <TableRow key={s.branch} className="hover:bg-gray-50/60">
                <TableCell className="font-medium">{s.branch}</TableCell>
                <TableCell className="text-sm">
                  {s.branch_number ? (
                    <span dir="ltr" className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-md border border-primary/20 bg-primary/5 px-1.5 text-xs font-semibold tabular-nums text-primary">
                      {s.branch_number}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{s.company}</TableCell>
                <TableCell>
                  <Badge variant={methodBadgeColor(s.checkin_method) as any} className="text-xs">
                    {s.checkin_method}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {s.allow_face_recognition === 1 && (
                      <span title={t('bbs.allow_face')} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-600">
                        <Camera className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {s.allow_webauthn === 1 && (
                      <span title={t('bbs.allow_webauthn')} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent text-primary">
                        <Fingerprint className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {s.allow_adms === 1 && (
                      <span title={t('bbs.allow_adms')} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-100 text-orange-600">
                        <Settings2 className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {!s.allow_face_recognition && !s.allow_webauthn && !s.allow_adms && (
                      <span className="text-xs text-muted-foreground/70">—</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {s.employee_count ?? 0}
                  </span>
                </TableCell>
                <TableCell>
                  {s.is_active === 1
                    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                    : <XCircle className="h-4 w-4 text-muted-foreground/70" />
                  }
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    <Button aria-label="تعديل" title="تعديل" size="sm" variant="ghost" onClick={() => setEditTarget(s)} className="h-8 w-8 p-0">
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </Button>
                    <Button aria-label="حذف" title="حذف" size="sm" variant="ghost" onClick={() => setDeleteTarget(s)} className="h-8 w-8 p-0">
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <BranchSettingsDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={onRefresh}
        existing={null}
        branches={branches}
        company={company}
        t={t}
      />
      {editTarget && (
        <BranchSettingsDialog
          open={!!editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={onRefresh}
          existing={editTarget}
          branches={branches}
          company={company}
          t={t}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          branchName={deleteTarget.branch}
          t={t}
        />
      )}
    </>
  )
}

// ==================== Employee Assignment Tab ====================

function EmployeeAssignmentTab({
  employees,
  loading,
  onRefresh,
  branches,
  filterBranch,
  t,
}: {
  employees: EmployeeWithBranch[]
  loading: boolean
  onRefresh: () => void
  branches: BranchOption[]
  filterBranch: string
  t: (k: string) => string
}) {
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [assignTarget, setAssignTarget] = useState<string | null>(null)  // single employee
  const [bulkBranch, setBulkBranch] = useState('')
  const [saving, setSaving] = useState(false)

  const filtered = employees.filter((e) => {
    const matchSearch = !search || e.employee_name.toLowerCase().includes(search.toLowerCase()) || e.employee.toLowerCase().includes(search.toLowerCase())
    const matchBranch = !filterBranch || filterBranch === '__all__'
      ? true
      : filterBranch === '__none__'
        ? !e.branch
        : e.branch === filterBranch
    return matchSearch && matchBranch
  })

  const toggleSelect = (emp: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(emp)) next.delete(emp)
      else next.add(emp)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((e) => e.employee)))
    }
  }

  const handleSingleAssign = async (employee: string, branch: string) => {
    try {
      await frappeClient.call('hrms.api.biometric_branch_api.assign_employee_branch', { employee, branch })
      toast({ title: '✅', description: t('bbs.saved') })
      onRefresh()
    } catch (err: any) {
      toast({ title: '❌', description: err.message || 'Failed', variant: 'destructive' })
    }
  }

  const handleBulkAssign = async (branch: string) => {
    if (selected.size === 0) return
    setSaving(true)
    try {
      const resp = await frappeClient.call<{ success: number; failed: number }>(
        'hrms.api.biometric_branch_api.bulk_assign_employee_branch',
        { employees: Array.from(selected), branch }
      )
      const data = (resp.message || resp.data) as { success: number; failed: number }
      const msg = branch
        ? t('bbs.assigned_success').replace('{0}', String(data?.success ?? selected.size)).replace('{1}', branch)
        : t('bbs.unassigned_success').replace('{0}', String(data?.success ?? selected.size))
      toast({ title: '✅', description: msg })
      setSelected(new Set())
      onRefresh()
    } catch (err: any) {
      toast({ title: '❌', description: err.message || 'Failed', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search + bulk actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${t('bbs.employees')}...`}
            className="pl-9"
          />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">{selected.size} selected</Badge>
            <Select value={bulkBranch} onValueChange={(v) => setBulkBranch(v === '__none__' ? '' : v)}>
              <SelectTrigger aria-label={t('bbs.select_branch')} className="w-40">
                <SelectValue placeholder={t('bbs.select_branch')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t('bbs.unassigned')}</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.name} value={b.name}>{branchLabel(b)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={saving}
              onClick={() => handleBulkAssign(bulkBranch)}
              className="bg-primary hover:bg-primary/90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
              {bulkBranch ? t('bbs.bulk_assign') : t('bbs.bulk_unassign')}
            </Button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <AlertCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('bbs.no_employees')}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10">
                  <Checkbox
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="font-semibold text-foreground/90">{t('bbs.employees')}</TableHead>
                <TableHead className="font-semibold text-foreground/90">Department</TableHead>
                <TableHead className="font-semibold text-foreground/90">{t('bbs.current_branch')}</TableHead>
                <TableHead className="font-semibold text-foreground/90">{t('bbs.assign_branch')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((emp) => (
                <TableRow key={emp.employee} className="hover:bg-gray-50/60">
                  <TableCell>
                    <Checkbox
                      checked={selected.has(emp.employee)}
                      onCheckedChange={() => toggleSelect(emp.employee)}
                      aria-label={emp.employee_name || emp.employee}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {emp.image
                          ? <img src={emp.image} alt="" className="w-full h-full object-cover" />
                          : <span className="text-xs font-semibold text-primary">{emp.employee_name?.[0] || '?'}</span>
                        }
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{emp.employee_name}</p>
                        <p className="text-xs text-muted-foreground/70">{emp.employee}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{emp.department ? translateDepartment(emp.department, t('dir') === 'rtl' ? 'ar' : 'en') : '—'}</TableCell>
                  <TableCell>
                    {emp.branch
                      ? <Badge variant="outline" className="text-xs">{emp.branch}</Badge>
                      : <span className="text-xs text-muted-foreground/70">{t('bbs.unassigned')}</span>
                    }
                  </TableCell>
                  <TableCell>
                    <Select
                      value={emp.branch || '__none__'}
                      onValueChange={(v) => handleSingleAssign(emp.employee, v === '__none__' ? '' : v)}
                    >
                      <SelectTrigger className="h-8 text-xs w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{t('bbs.unassigned')}</SelectItem>
                        {branches.map((b) => (
                          <SelectItem key={b.name} value={b.name}>{branchLabel(b)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

// ==================== Main Component ====================

export function BranchManagement() {
  const { t, isRTL } = useI18n()
  const { company } = useCompany()
  const { toast } = useToast()

  const [settings, setSettings] = useState<BranchSettings[]>([])
  const [employees, setEmployees] = useState<EmployeeWithBranch[]>([])
  const [branches, setBranches] = useState<BranchOption[]>([])
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [loadingEmployees, setLoadingEmployees] = useState(true)
  const [filterBranch, setFilterBranch] = useState('__all__')
  const [activeTab, setActiveTab] = useState('branches')
  // Tenant gate — the geofence tab exists only where site_config.punch_geofence is on.
  const [geofenceOn, setGeofenceOn] = useState(false)

  const loadSettings = useCallback(async () => {
    setLoadingSettings(true)
    try {
      const resp = await frappeClient.call<BranchSettings[]>(
        'hrms.api.biometric_branch_api.get_branch_settings_list',
        company ? { company } : {}
      )
      setSettings((resp.message || resp.data || []) as BranchSettings[])
    } catch {
      setSettings([])
    } finally {
      setLoadingSettings(false)
    }
  }, [company])

  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true)
    try {
      const resp = await frappeClient.call<EmployeeWithBranch[]>(
        'hrms.api.biometric_branch_api.get_employees_with_branch',
        company ? { company } : {}
      )
      setEmployees((resp.message || resp.data || []) as EmployeeWithBranch[])
    } catch {
      setEmployees([])
    } finally {
      setLoadingEmployees(false)
    }
  }, [company])

  const loadBranches = useCallback(async () => {
    try {
      const resp = await frappeClient.call<BranchOption[]>(
        'hrms.api.biometric_branch_api.get_branches_for_company',
        company ? { company } : {}
      )
      setBranches((resp.message || resp.data || []) as BranchOption[])
    } catch {
      setBranches([])
    }
  }, [company])

  useEffect(() => {
    loadSettings()
    loadEmployees()
    loadBranches()
  }, [loadSettings, loadEmployees, loadBranches])

  useEffect(() => {
    let cancelled = false
    getBranchGeofences(company || undefined).then((r) => {
      if (!cancelled) setGeofenceOn(r.feature_enabled)
    })
    return () => { cancelled = true }
  }, [company])

  // Stats
  const configuredBranches = settings.length
  const employeesWithBranch = employees.filter((e) => !!e.branch).length
  const unassignedEmployees = employees.filter((e) => !e.branch).length

  const filteredEmployees = filterBranch === '__all__'
    ? employees
    : filterBranch === '__none__'
      ? employees.filter((e) => !e.branch)
      : employees.filter((e) => e.branch === filterBranch)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className={cn('text-2xl font-bold text-foreground', isRTL && 'text-right')}>{t('bbs.title')}</h1>
          <p className={cn('text-sm text-muted-foreground mt-1', isRTL && 'text-right')}>{t('bbs.subtitle')}</p>
        </div>
        {/* Branch filter */}
        <Select value={filterBranch} onValueChange={setFilterBranch}>
          <SelectTrigger aria-label={t('bbs.all_branches')} className="w-48">
            <SelectValue placeholder={t('bbs.all_branches')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">{t('bbs.all_branches')}</SelectItem>
            <SelectItem value="__none__">{t('bbs.unassigned')}</SelectItem>
            {branches.map((b) => (
              <SelectItem key={b.name} value={b.name}>{branchLabel(b)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{configuredBranches}</p>
                <p className="text-xs text-muted-foreground">{t('bbs.stats_configured')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{employeesWithBranch}</p>
                <p className="text-xs text-muted-foreground">{t('bbs.stats_employees')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{unassignedEmployees}</p>
                <p className="text-xs text-muted-foreground">{t('bbs.stats_unassigned')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-100/80 rounded-xl p-1 h-auto">
          <TabsTrigger value="branches" className="rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm px-5 py-2">
            <GitBranch className="h-4 w-4 mr-2" />
            {t('bbs.tab_branches')}
          </TabsTrigger>
          <TabsTrigger value="employees" className="rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm px-5 py-2">
            <Users className="h-4 w-4 mr-2" />
            {t('bbs.tab_employees')}
          </TabsTrigger>
          {geofenceOn && (
            <TabsTrigger value="geofence" className="rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm px-5 py-2">
              <MapPin className="h-4 w-4 mr-2" />
              {isRTL ? 'نطاق الحضور' : 'Check-in area'}
            </TabsTrigger>
          )}
          <TabsTrigger value="logs" className="rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm px-5 py-2">
            <Activity className="h-4 w-4 mr-2" />
            {t('blog.tab_title')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branches" className="mt-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <BranchesTab
                settings={settings}
                loading={loadingSettings}
                onRefresh={() => { loadSettings(); loadEmployees(); loadBranches() }}
                branches={branches}
                company={company || ''}
                t={t}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employees" className="mt-6">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-6">
              <EmployeeAssignmentTab
                employees={filteredEmployees}
                loading={loadingEmployees}
                onRefresh={loadEmployees}
                branches={branches}
                filterBranch={filterBranch}
                t={t}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {geofenceOn && (
          <TabsContent value="geofence" className="mt-6">
            <BranchGeofenceTab company={company || undefined} />
          </TabsContent>
        )}

        <TabsContent value="logs" className="mt-6">
          <BiometricLogsTab branches={branches} t={t} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
