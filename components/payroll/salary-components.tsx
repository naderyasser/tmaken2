'use client'

import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { getStatusClass } from '@/lib/status-config'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

interface SalaryComponent {
  name: string
  type: 'Earning' | 'Deduction'
  description?: string
  amount?: number
}

export function SalaryComponentsList() {
  const { t } = useI18n()
  const { toast } = useToast()
  const [components, setComponents] = useState<SalaryComponent[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingComponent, setEditingComponent] = useState<SalaryComponent | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', type: 'Earning' as 'Earning' | 'Deduction', description: '', amount: 0 })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const data = await frappeClient.getSalaryComponents()
      setComponents(data)
    } catch {
      toast({ title: t('pay.comp.load_fail'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditingComponent(null)
    setForm({ name: '', type: 'Earning', description: '', amount: 0 })
    setDialogOpen(true)
  }

  const openEdit = (comp: SalaryComponent) => {
    setEditingComponent(comp)
    setForm({ name: comp.name, type: comp.type, description: comp.description || '', amount: comp.amount || 0 })
    setDialogOpen(true)
  }

  const save = async () => {
    if (!form.name || !form.type) {
      toast({ title: t('pay.comp.required_fields'), variant: 'destructive' })
      return
    }
    try {
      if (editingComponent) {
        await frappeClient.updateSalaryComponent(editingComponent.name, {
          type: form.type, description: form.description, amount: form.amount,
        })
        toast({ title: t('pay.comp.updated') })
      } else {
        await frappeClient.createSalaryComponent(form)
        toast({ title: t('pay.comp.created') })
      }
      setDialogOpen(false)
      load()
    } catch (error) {
      toast({ title: editingComponent ? t('pay.comp.update_fail') : t('pay.comp.create_fail'), description: String(error), variant: 'destructive' })
    }
  }

  const remove = async (name: string) => {
    try {
      await frappeClient.deleteSalaryComponent(name)
      toast({ title: t('pay.comp.deleted') })
      load()
    } catch (error) {
      toast({ title: t('pay.comp.delete_fail'), description: String(error), variant: 'destructive' })
    }
  }

  const filtered = components.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('pay.comp.title')}</h2>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> {t('pay.comp.add')}
        </Button>
      </div>

      <Input
        placeholder={t('pay.comp.search')}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="max-w-sm"
      />

      <div className="border rounded-lg bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('pay.comp.name')}</TableHead>
              <TableHead>{t('pay.comp.type')}</TableHead>
              <TableHead>{t('pay.comp.amount')}</TableHead>
              <TableHead>{t('pay.comp.description')}</TableHead>
              <TableHead className="text-right">{t('pay.comp.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {t('pay.comp.no_found')}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((comp) => (
                <TableRow key={comp.name}>
                  <TableCell className="font-medium">{comp.name}</TableCell>
                  <TableCell>
                    <Badge className={getStatusClass(comp.type)}>
                      {comp.type === 'Earning' ? t('pay.comp.earning') : t('pay.comp.deduction')}
                    </Badge>
                  </TableCell>
                  <TableCell>{comp.amount || '—'}</TableCell>
                  <TableCell className="max-w-xs truncate">{comp.description || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(comp)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setPendingDelete(comp.name)}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
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
            <DialogTitle>
              {editingComponent ? t('pay.comp.edit_title') : t('pay.comp.create_title')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {!editingComponent && (
              <div className="space-y-1">
                <Label>{t('pay.comp.name')}</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t('pay.comp.name_placeholder')}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label>{t('pay.comp.type')}</Label>
              <Select value={form.type} onValueChange={(v: 'Earning' | 'Deduction') => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Earning">{t('pay.comp.earning')}</SelectItem>
                  <SelectItem value="Deduction">{t('pay.comp.deduction')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('pay.comp.amount')}</Label>
              <Input
                type="number"
                value={form.amount || ''}
                onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1">
              <Label>{t('pay.comp.description')}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('pay.comp.description_placeholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('pay.comp.cancel')}</Button>
            <Button onClick={save}>{editingComponent ? t('pay.comp.save') : t('pay.comp.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t('pay.comp.delete_confirm')}
        onConfirm={() => { if (pendingDelete) { remove(pendingDelete); setPendingDelete(null) } }}
      />
    </div>
  )
}
