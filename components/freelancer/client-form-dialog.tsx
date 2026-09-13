'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { translateEnum } from '@/lib/enums'
import { useToast } from '@/hooks/use-toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export type ClientKind = 'customer' | 'lead'

export interface ClientFormSeed {
  kind: ClientKind
  docname: string
  name: string
  phone: string
  territory: string
  email: string
}

interface ClientFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, the dialog edits this record; otherwise it creates a new one. */
  editing?: ClientFormSeed | null
  /** Quick-add lead: only a name is required; enrich later via edit. */
  quickAdd?: boolean
  onSaved: () => void
}

export function ClientFormDialog({ open, onOpenChange, editing, quickAdd = false, onSaved }: ClientFormDialogProps) {
  const { isRTL, lang } = useI18n()
  const { toast } = useToast()
  const msg = (en: string, ar: string) => (isRTL ? ar : en)
  const isEdit = !!editing?.docname

  const [territories, setTerritories] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const schema = useMemo(
    () =>
      z
        .object({
          kind: z.enum(['customer', 'lead']),
          name: z.string().min(1, msg('Client name is required.', 'اسم العميل مطلوب.')),
          phone: z.string().optional().default(''),
          territory: z.string().optional().default(''),
          email: z
            .union([z.string().email(msg('Invalid email address.', 'بريد إلكتروني غير صالح.')), z.literal('')])
            .optional(),
        })
        // Full form requires phone + region; quick-add needs only a name.
        .superRefine((val, ctx) => {
          if (quickAdd) return
          if (!val.phone || !val.phone.trim())
            ctx.addIssue({ path: ['phone'], code: z.ZodIssueCode.custom, message: msg('Phone is required.', 'رقم الهاتف مطلوب.') })
          if (!val.territory || !val.territory.trim())
            ctx.addIssue({ path: ['territory'], code: z.ZodIssueCode.custom, message: msg('Region is required.', 'المنطقة مطلوبة.') })
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isRTL, quickAdd],
  )

  type FormValues = z.infer<typeof schema>

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { kind: quickAdd ? 'lead' : 'customer', name: '', phone: '', territory: '', email: '' },
  })

  // Load territories once the dialog opens (Customer/Lead.territory is a Link field).
  useEffect(() => {
    if (!open) return
    frappeClient
      .getList<{ name: string }>('Territory', { fields: ['name'], limit_page_length: 0, order_by: 'name asc' })
      .then((rows) => setTerritories(rows.map((r) => r.name)))
      .catch(() => setTerritories([]))
  }, [open])

  // Seed the form whenever we (re)open.
  useEffect(() => {
    if (!open) return
    form.reset(
      editing
        ? {
            kind: editing.kind,
            name: editing.name || '',
            phone: editing.phone || '',
            territory: editing.territory || '',
            email: editing.email || '',
          }
        : { kind: quickAdd ? 'lead' : 'customer', name: '', phone: '', territory: '', email: '' },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, quickAdd])

  const onSubmit = async (v: FormValues) => {
    setSaving(true)
    const phone = (v.phone || '').trim()
    const territory = (v.territory || '').trim()
    const email = (v.email || '').trim()
    try {
      if (isEdit && editing) {
        const doctype = v.kind === 'customer' ? 'Customer' : 'Lead'
        const patch: Record<string, any> =
          v.kind === 'customer'
            ? { customer_name: v.name.trim(), mobile_no: phone || undefined, territory: territory || undefined }
            : {
                lead_name: v.name.trim(),
                mobile_no: phone || undefined,
                territory: territory || undefined,
                email_id: email || undefined,
              }
        await frappeClient.put(doctype, editing.docname, patch)
      } else {
        const doc: Record<string, any> =
          v.kind === 'customer'
            ? {
                doctype: 'Customer',
                customer_name: v.name.trim(),
                mobile_no: phone || undefined,
                territory: territory || 'All Territories',
                customer_group: 'All Customer Groups',
              }
            : {
                doctype: 'Lead',
                lead_name: v.name.trim(),
                mobile_no: phone || undefined,
                territory: territory || undefined,
                email_id: email || undefined,
                status: 'Lead',
              }
        await frappeClient.call('frappe.client.insert', { doc })
      }
      toast({
        title: msg('Saved', 'تم الحفظ'),
        description: isEdit ? msg('Client updated.', 'تم تحديث العميل.') : msg('Client created.', 'تم إنشاء العميل.'),
      })
      onSaved()
      onOpenChange(false)
    } catch (e: any) {
      toast({
        title: msg('Error', 'خطأ'),
        description: e?.message || msg('Failed to save client.', 'فشل حفظ العميل.'),
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-w-md" dir={isRTL ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? msg('Edit Client', 'تعديل العميل')
              : quickAdd
                ? msg('Quick add lead', 'إضافة عميل محتمل سريعة')
                : msg('New Client', 'عميل جديد')}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? msg('Update this client’s details.', 'تحديث بيانات هذا العميل.')
              : quickAdd
                ? msg('Just a name — enrich the details later.', 'اكتب الاسم فقط — أكمل التفاصيل لاحقاً.')
                : msg('Add a new customer or lead to your workspace.', 'أضف عميلاً أو عميلاً محتملاً إلى مساحتك.')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
            {/* Type */}
            {!quickAdd && (
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{msg('Type', 'النوع')} *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={isEdit}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="customer">{msg('Customer', 'عميل')}</SelectItem>
                      <SelectItem value="lead">{msg('Lead', 'عميل محتمل')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            )}

            {/* Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{msg('Client Name', 'اسم العميل')} *</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder={msg('e.g. Acme Co.', 'مثال: شركة كذا')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!quickAdd && (
            <>
            {/* Phone */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{msg('Phone', 'الهاتف')} *</FormLabel>
                  <FormControl>
                    <Input {...field} dir="ltr" inputMode="tel" placeholder="05XXXXXXXX" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Territory / Region */}
            <FormField
              control={form.control}
              name="territory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{msg('Region', 'المنطقة')} *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={msg('Select region', 'اختر المنطقة')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {territories.map((tr) => (
                        <SelectItem key={tr} value={tr}>{translateEnum('territory', tr, lang)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email (optional) */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{msg('Email', 'البريد الإلكتروني')}</FormLabel>
                  <FormControl>
                    <Input {...field} dir="ltr" type="email" placeholder={msg('Optional', 'اختياري')} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            </>
            )}

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                {msg('Cancel', 'إلغاء')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className={isRTL ? 'ml-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4 animate-spin'} />}
                {isEdit ? msg('Save', 'حفظ') : msg('Create', 'إنشاء')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
