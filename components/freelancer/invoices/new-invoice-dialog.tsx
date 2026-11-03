'use client'

/**
 * New Invoice dialog — bill a client directly without a proposal.
 *
 * Creates a DRAFT ERPNext Sales Invoice via
 * base_meena.sales_proposal.api.create_direct_invoice, then calls onCreated so
 * the list refreshes (the new draft shows up and Record Payment works on it).
 */

import React, { useEffect, useState } from 'react'
import { useI18n } from '@/lib/i18n'
import { formatCurrency } from '@/lib/format'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { LocalizedDateInput } from '@/components/ui/localized-date-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react'

interface CustomerRow { name: string; customer_name?: string }
interface LineItem { item_name: string; description: string; qty: string; rate: string }

const emptyRow = (): LineItem => ({ item_name: '', description: '', qty: '1', rate: '' })
const today = () => new Date().toISOString().split('T')[0]

export function NewInvoiceDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: (invoiceName: string) => void
}) {
  const { isRTL, lang } = useI18n()
  const { toast } = useToast()
  const msg = (en: string, ar: string) => (isRTL ? ar : en)
  const fmt = (n: number) => formatCurrency(n || 0, { locale: lang, currency: 'SAR', decimals: 2 })

  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [customer, setCustomer] = useState('')
  const [posting, setPosting] = useState(today())
  const [due, setDue] = useState(today())
  const [remarks, setRemarks] = useState('')
  const [rows, setRows] = useState<LineItem[]>([emptyRow()])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Load customers each time the dialog opens (fresh list, cheap).
  useEffect(() => {
    if (!open) return
    setErr(null)
    frappeClient
      .getList<CustomerRow>('Customer', {
        fields: ['name', 'customer_name'],
        order_by: 'customer_name asc',
        limit_page_length: 500,
      })
      .then(setCustomers)
      .catch(() => setCustomers([]))
  }, [open])

  const reset = () => {
    setCustomer(''); setPosting(today()); setDue(today()); setRemarks('')
    setRows([emptyRow()]); setErr(null)
  }

  const setRow = (i: number, field: keyof LineItem, value: string) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  const addRow = () => setRows((rs) => [...rs, emptyRow()])
  const removeRow = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs))

  const rowAmount = (r: LineItem) => (parseFloat(r.qty) || 0) * (parseFloat(r.rate) || 0)
  const total = rows.reduce((s, r) => s + rowAmount(r), 0)

  const handleCreate = async () => {
    setErr(null)
    if (!customer) { setErr(msg('Please choose a client.', 'اختر العميل من فضلك.')); return }
    const items = rows
      .filter((r) => r.item_name.trim() || parseFloat(r.rate) > 0)
      .map((r) => ({
        item_name: r.item_name.trim(),
        description: r.description.trim(),
        qty: parseFloat(r.qty) || 1,
        rate: parseFloat(r.rate) || 0,
      }))
    if (!items.length) { setErr(msg('Add at least one line item.', 'أضِف بنداً واحداً على الأقل.')); return }

    setSaving(true)
    try {
      const res = await frappeClient.call('base_meena.sales_proposal.api.create_direct_invoice', {
        customer,
        items: JSON.stringify(items),
        posting_date: posting,
        due_date: due,
        remarks: remarks.trim() || undefined,
      })
      const invoiceName = res?.message?.invoice || ''
      toast({ title: msg('Invoice created', 'تم إنشاء الفاتورة'), description: invoiceName })
      onCreated(invoiceName)
      reset()
      onOpenChange(false)
    } catch (e: any) {
      setErr(e?.message || msg('Failed to create invoice.', 'فشل إنشاء الفاتورة.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) { if (!v) reset(); onOpenChange(v) } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>{msg('New Invoice', 'فاتورة جديدة')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {err && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{err}</AlertDescription>
            </Alert>
          )}

          {/* Client */}
          <div className="space-y-1.5">
            <Label>{msg('Client', 'العميل')}</Label>
            <Select value={customer} onValueChange={setCustomer}>
              <SelectTrigger>
                <SelectValue placeholder={msg('Choose a client…', 'اختر العميل…')} />
              </SelectTrigger>
              <SelectContent>
                {customers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    {msg('No clients yet — add one first.', 'لا يوجد عملاء — أضِف عميلاً أولاً.')}
                  </div>
                ) : (
                  customers.map((c) => (
                    <SelectItem key={c.name} value={c.name}>{c.customer_name || c.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{msg('Invoice date', 'تاريخ الفاتورة')}</Label>
              <LocalizedDateInput value={posting} onChange={setPosting} />
            </div>
            <div className="space-y-1.5">
              <Label>{msg('Due date', 'تاريخ الاستحقاق')}</Label>
              <LocalizedDateInput value={due} onChange={setDue} />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{msg('Items', 'البنود')}</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="h-3.5 w-3.5 mr-1" />{msg('Add item', 'إضافة بند')}
              </Button>
            </div>
            <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
              <div className="col-span-4">{msg('Item / Service', 'الصنف / الخدمة')}</div>
              <div className="col-span-3">{msg('Description', 'الوصف')}</div>
              <div className="col-span-2">{msg('Qty', 'الكمية')}</div>
              <div className="col-span-2">{msg('Price', 'السعر')}</div>
              <div className="col-span-1" />
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <Input className="col-span-12 md:col-span-4" placeholder={msg('e.g. Consulting', 'مثال: استشارة')}
                  value={r.item_name} onChange={(e) => setRow(i, 'item_name', e.target.value)} />
                <Input className="col-span-6 md:col-span-3" placeholder={msg('Optional', 'اختياري')}
                  value={r.description} onChange={(e) => setRow(i, 'description', e.target.value)} />
                <Input className="col-span-3 md:col-span-2" type="number" min="0" placeholder="1"
                  value={r.qty} onChange={(e) => setRow(i, 'qty', e.target.value)} />
                <Input className="col-span-3 md:col-span-2" type="number" min="0" placeholder="0"
                  value={r.rate} onChange={(e) => setRow(i, 'rate', e.target.value)} />
                <div className="col-span-12 md:col-span-1 flex justify-end">
                  {rows.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => removeRow(i)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <div className="flex justify-end pt-1 text-sm font-semibold">
              {msg('Total', 'الإجمالي')}: <span className="ml-2 rtl:mr-2">{fmt(total)}</span>
            </div>
          </div>

          {/* Remarks */}
          <div className="space-y-1.5">
            <Label>{msg('Notes', 'ملاحظات')}</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)}
              placeholder={msg('Optional note on the invoice', 'ملاحظة اختيارية على الفاتورة')} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false) }} disabled={saving}>
            {msg('Cancel', 'إلغاء')}
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? msg('Creating…', 'جاري الإنشاء…') : msg('Create invoice', 'إنشاء الفاتورة')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
