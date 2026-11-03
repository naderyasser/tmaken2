'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { frappeClient } from '@/lib/api-client'
import { useCompany } from '@/hooks/use-company'
import { useI18n } from '@/lib/i18n'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { getStatusClass } from '@/lib/status-config'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface SalaryStructure {
  name: string
  company?: string
  /** Salary Structure.is_active is a Select — the strings "Yes"/"No", not a flag. */
  is_active?: string
  payroll_frequency?: string
}

export function SalaryStructuresList() {
  const { t } = useI18n()
  const { toast } = useToast()
  const { company } = useCompany()
  const [structures, setStructures] = useState<SalaryStructure[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ name: '', company: '' })
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await frappeClient.getSalaryStructures()
      setStructures(data)
    } catch {
      toast({ title: t('pay.struct.load_fail'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const create = async () => {
    if (!form.name) {
      toast({ title: t('pay.struct.required_fields'), variant: 'destructive' })
      return
    }
    try {
      const effectiveCompany = form.company || company || ''
      if (!effectiveCompany) {
        toast({ title: t('pay.struct.required_fields'), variant: 'destructive' })
        return
      }
      // `currency` was being handed the company NAME, and `name` is ignored on
      // insert (Frappe wants `__newname`), so this create never produced a usable
      // structure. Take the real currency from the company, as the assignment tab does.
      const currency = await frappeClient.get('Company', effectiveCompany, { fields: ['default_currency'] })
        .then((r) => (r.data as any)?.default_currency || 'SAR')
        .catch(() => 'SAR')
      await frappeClient.createSalaryStructure({
        __newname: form.name,
        company: effectiveCompany,
        is_active: 'Yes',
        payroll_frequency: 'Monthly',
        currency,
      })
      toast({ title: t('pay.struct.created') })
      setDialogOpen(false)
      setForm({ name: '', company: '' })
      load()
    } catch (error) {
      toast({ title: t('pay.struct.create_fail'), description: String(error), variant: 'destructive' })
    }
  }

  const remove = async (name: string) => {
    try {
      await frappeClient.deleteSalaryStructure(name)
      toast({ title: t('pay.struct.deleted') })
      load()
    } catch (error) {
      toast({ title: t('pay.struct.delete_fail'), description: String(error), variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('pay.struct.title')}</h2>
        <Button onClick={() => setDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> {t('pay.struct.add')}
        </Button>
      </div>

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('pay.struct.name')}</TableHead>
              <TableHead>{t('pay.struct.company')}</TableHead>
              <TableHead>{t('pay.struct.status')}</TableHead>
              <TableHead className="text-right">{t('pay.comp.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : structures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  {t('pay.struct.no_found')}
                </TableCell>
              </TableRow>
            ) : (
              structures.map((s) => (
                <TableRow key={s.name}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.company || '—'}</TableCell>
                  <TableCell>
                    <Badge className={getStatusClass(s.is_active === 'Yes' ? 'is_active_true' : 'is_active_false')}>
                      {s.is_active === 'Yes' ? t('pay.struct.active') : t('pay.struct.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setPendingDelete(s.name)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('pay.struct.create_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>{t('pay.struct.name')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t('pay.struct.name_placeholder')}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('pay.struct.company')}</Label>
              <Input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Company Name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('pay.struct.cancel')}</Button>
            <Button onClick={create}>{t('pay.struct.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('pay.struct.delete_confirm')}
        onConfirm={() => { if (pendingDelete) { remove(pendingDelete); setPendingDelete(null) } }}
      />
    </div>
  )
}
