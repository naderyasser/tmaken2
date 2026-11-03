'use client'

import { useEffect, useState } from 'react'
import {
  Phone, Mail, MapPin, CalendarDays, FileText, Receipt, Loader2, UserCheck, UserPlus,
  CreditCard, History,
} from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useI18n } from '@/lib/i18n'
import { formatCurrency, formatDateShort } from '@/lib/format'
import { translateEnum } from '@/lib/enums'
import {
  type LeadStage, LEAD_STAGES, LEAD_STAGE_BADGE, leadStageLabel, leadStageToStatus,
} from '@/lib/freelancer/lead-pipeline'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// Shared row shape — owned here so clients-list can import it without a cycle.
export interface ClientRow {
  id: string
  docname: string
  kind: 'customer' | 'lead'
  name: string
  territory: string
  phone: string
  email: string
  leadStatus?: string
  stage: LeadStage
  created?: string
}

interface RelatedProposal {
  name: string
  title?: string
  status?: string
  grand_total?: number
  party_name?: string
  party_display_name?: string
  transaction_date?: string
  creation?: string
}

interface RelatedInvoice {
  name: string
  grand_total?: number
  outstanding_amount?: number
  status?: string
  posting_date?: string
}

interface PaymentRow {
  name: string
  posting_date?: string
  mode_of_payment?: string
  paid_amount?: number
  reference_name?: string
}

type TimelineKind = 'proposal' | 'invoice' | 'payment'
interface TimelineItem {
  kind: TimelineKind
  date?: string
  title: string
  sub?: string
  amount?: number
  status?: string
}

interface ClientDetailSheetProps {
  client: ClientRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a mutation (stage change) so the parent reloads. */
  onChanged: () => void
}

export function ClientDetailSheet({ client, open, onOpenChange, onChanged }: ClientDetailSheetProps) {
  const { isRTL, lang } = useI18n()
  const msg = (en: string, ar: string) => (isRTL ? ar : en)

  const [loading, setLoading] = useState(false)
  const [proposals, setProposals] = useState<RelatedProposal[]>([])
  const [invoices, setInvoices] = useState<RelatedInvoice[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [savingStage, setSavingStage] = useState(false)

  const money = (v?: number) => formatCurrency(v ?? 0, { locale: lang, currency: 'SAR' })

  useEffect(() => {
    if (!open || !client) return
    let cancelled = false
    setLoading(true)
    setProposals([])
    setInvoices([])
    setPayments([])

    const run = async () => {
      try {
        const propsRes = await frappeClient
          .call<RelatedProposal[]>('base_meena.sales_proposal.api.get_proposals', { filters: {} })
          .then((r) => r?.message || [])
          .catch(() => [])
        const related = propsRes.filter(
          (p) => p.party_name === client.docname || (client.name && p.party_display_name === client.name),
        )

        let invs: RelatedInvoice[] = []
        let pays: PaymentRow[] = []
        if (client.kind === 'customer') {
          invs = await frappeClient
            .getList<RelatedInvoice>('Sales Invoice', {
              filters: [['customer', '=', client.docname]] as any,
              fields: ['name', 'grand_total', 'outstanding_amount', 'status', 'posting_date'],
              order_by: 'modified desc',
              limit_page_length: 0,
            })
            .catch(() => [])

          // Payments allocated to this customer's invoices (Payment Entry Reference → Payment Entry)
          const invNames = invs.map((i) => i.name)
          if (invNames.length) {
            const refs = await frappeClient
              .getList<{ parent: string; reference_name: string; allocated_amount: number }>('Payment Entry Reference', {
                filters: [['reference_name', 'in', invNames]] as any,
                fields: ['parent', 'reference_name', 'allocated_amount' as any],
                limit_page_length: 0,
              })
              .catch(() => [])
            const peNames = [...new Set(refs.map((r) => r.parent))]
            const peMap = new Map<string, { posting_date?: string; mode_of_payment?: string }>()
            if (peNames.length) {
              const pes = await frappeClient
                .getList<{ name: string; posting_date?: string; mode_of_payment?: string }>('Payment Entry', {
                  filters: [['name', 'in', peNames]] as any,
                  fields: ['name', 'posting_date', 'mode_of_payment' as any],
                  limit_page_length: 0,
                })
                .catch(() => [])
              pes.forEach((p) => peMap.set(p.name, { posting_date: p.posting_date, mode_of_payment: p.mode_of_payment }))
            }
            pays = refs.map((r) => ({
              name: r.parent,
              posting_date: peMap.get(r.parent)?.posting_date,
              mode_of_payment: peMap.get(r.parent)?.mode_of_payment,
              paid_amount: r.allocated_amount,
              reference_name: r.reference_name,
            }))
          }
        }

        if (!cancelled) {
          setProposals(related)
          setInvoices(invs)
          setPayments(pays)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [open, client])

  // Headline stats + merged timeline
  const lifetimeValue = client?.kind === 'customer'
    ? invoices.reduce((s, i) => s + (i.grand_total || 0), 0)
    : proposals.filter((p) => p.status === 'Accepted').reduce((s, p) => s + (p.grand_total || 0), 0)
  const outstanding = invoices.reduce((s, i) => s + (i.outstanding_amount || 0), 0)

  const timeline: TimelineItem[] = [
    ...proposals.map((p): TimelineItem => ({
      kind: 'proposal', date: p.transaction_date || p.creation, title: p.title || p.name,
      sub: p.name, amount: p.grand_total, status: p.status,
    })),
    ...invoices.map((i): TimelineItem => ({
      kind: 'invoice', date: i.posting_date, title: i.name, amount: i.grand_total, status: i.status,
    })),
    ...payments.map((p): TimelineItem => ({
      kind: 'payment', date: p.posting_date,
      title: p.mode_of_payment || msg('Payment', 'دفعة'), sub: p.reference_name, amount: p.paid_amount,
    })),
  ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))

  const handleStageChange = async (stage: LeadStage) => {
    if (!client) return
    setSavingStage(true)
    try {
      await frappeClient.put('Lead', client.docname, { status: leadStageToStatus(stage) })
      onChanged()
    } catch {
      /* surfaced by parent reload / non-fatal */
    } finally {
      setSavingStage(false)
    }
  }

  const KindIcon = client?.kind === 'customer' ? UserCheck : UserPlus

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRTL ? 'left' : 'right'}
        dir={isRTL ? 'rtl' : 'ltr'}
        className="w-full overflow-y-auto sm:max-w-md"
      >
        {client && (
          <>
            <SheetHeader className="text-start">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-accent p-2 text-primary"><KindIcon className="h-5 w-5" /></span>
                <SheetTitle className="text-xl">{client.name}</SheetTitle>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Badge className={client.kind === 'customer' ? 'bg-primary/10 text-primary' : 'bg-amber-100 text-amber-800'}>
                  {client.kind === 'customer' ? msg('Customer', 'عميل') : msg('Lead', 'عميل محتمل')}
                </Badge>
                {client.kind === 'lead' && (
                  <Badge className={LEAD_STAGE_BADGE[client.stage]}>{leadStageLabel(client.stage, isRTL)}</Badge>
                )}
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-6">
              {/* Headline stats — lifetime value & outstanding */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground">{msg('Lifetime value', 'القيمة الإجمالية')}</p>
                  <p className="text-lg font-bold text-foreground">{money(lifetimeValue)}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-[11px] text-muted-foreground">{msg('Outstanding', 'المستحق')}</p>
                  <p className={cn('text-lg font-bold', outstanding > 0 ? 'text-red-600' : 'text-success')}>{money(outstanding)}</p>
                </div>
              </div>

              {/* Contact info */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {msg('Contact', 'معلومات الاتصال')}
                </h3>
                <InfoRow icon={Phone} label={msg('Phone', 'الهاتف')} value={client.phone} ltr />
                <InfoRow icon={Mail} label={msg('Email', 'البريد')} value={client.email} ltr />
                <InfoRow icon={MapPin} label={msg('Region', 'المنطقة')} value={translateEnum('territory', client.territory, lang)} />
                <InfoRow icon={CalendarDays} label={msg('Created', 'تاريخ الإنشاء')} value={formatDateShort(client.created)} />
              </section>

              {/* Lead stage control */}
              {client.kind === 'lead' && (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {msg('Pipeline stage', 'مرحلة المسار')}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Select value={client.stage} onValueChange={(v) => handleStageChange(v as LeadStage)} disabled={savingStage}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_STAGES.map((s) => (
                          <SelectItem key={s} value={s}>{leadStageLabel(s, isRTL)}</SelectItem>
                        ))}
                        <SelectItem value="lost">{leadStageLabel('lost', isRTL)}</SelectItem>
                      </SelectContent>
                    </Select>
                    {savingStage && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  </div>
                </section>
              )}

              {/* Timeline — proposals + invoices + payments, newest first */}
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <History className="h-3.5 w-3.5" />
                  {msg('Timeline', 'السجل الزمني')}
                </h3>
                {loading ? (
                  <Skeleton className="h-20 w-full" />
                ) : timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground/70">{msg('No activity yet.', 'لا يوجد نشاط بعد.')}</p>
                ) : (
                  <ol className="relative space-y-3 ps-4">
                    {timeline.map((item, i) => {
                      const Icon = item.kind === 'payment' ? CreditCard : item.kind === 'invoice' ? Receipt : FileText
                      const tint = item.kind === 'payment' ? 'text-success' : item.kind === 'invoice' ? 'text-primary' : 'text-muted-foreground'
                      return (
                        <li key={`${item.kind}-${item.title}-${i}`} className="relative ps-5">
                          <span className={cn('absolute start-0 top-0.5', tint)}><Icon className="h-3.5 w-3.5" /></span>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{item.title}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatDateShort(item.date) || '—'}
                                {item.kind === 'payment' && ` · ${msg('Payment', 'دفعة')}`}
                                {item.kind === 'proposal' && ` · ${msg('Proposal', 'عرض')}`}
                                {item.kind === 'invoice' && ` · ${msg('Invoice', 'فاتورة')}`}
                              </p>
                            </div>
                            <div className="shrink-0 text-end">
                              {item.amount != null && <span className="text-xs font-semibold">{money(item.amount)}</span>}
                              {item.status && (
                                <p className="text-[10px] text-muted-foreground">
                                  {translateEnum(item.kind === 'invoice' ? 'invoiceStatus' : 'proposalStatus', item.status, lang)}
                                </p>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </section>

              {/* Related proposals */}
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  {msg('Proposals', 'العروض')} {!loading && `(${proposals.length})`}
                </h3>
                {loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : proposals.length === 0 ? (
                  <p className="text-sm text-muted-foreground/70">{msg('No proposals yet.', 'لا توجد عروض بعد.')}</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {proposals.map((p) => (
                      <li key={p.name} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{p.title || p.name}</p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">{p.name}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs font-semibold">{money(p.grand_total)}</span>
                          {p.status && (
                            <Badge className="bg-muted text-[10px] text-muted-foreground">
                              {translateEnum('proposalStatus', p.status, lang)}
                            </Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* Related invoices (customers) */}
              {client.kind === 'customer' && (
                <section className="space-y-2">
                  <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Receipt className="h-3.5 w-3.5" />
                    {msg('Invoices', 'الفواتير')} {!loading && `(${invoices.length})`}
                  </h3>
                  {loading ? (
                    <Skeleton className="h-16 w-full" />
                  ) : invoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground/70">{msg('No invoices yet.', 'لا توجد فواتير بعد.')}</p>
                  ) : (
                    <ul className="divide-y rounded-lg border">
                      {invoices.map((inv) => {
                        const paid = (inv.outstanding_amount || 0) === 0
                        return (
                          <li key={inv.name} className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate font-mono text-xs">{inv.name}</p>
                              <p className="text-[10px] text-muted-foreground">{formatDateShort(inv.posting_date)}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-xs font-semibold">{money(inv.grand_total)}</span>
                              <span className={cn('text-[10px] font-medium', paid ? 'text-success' : 'text-red-600')}>
                                {paid
                                  ? translateEnum('invoiceStatus', 'Paid', lang)
                                  : `${money(inv.outstanding_amount)} ${msg('due', 'مستحق')}`}
                              </span>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function InfoRow({
  icon: Icon, label, value, ltr,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value?: string
  ltr?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className="font-medium" dir={ltr ? 'ltr' : undefined}>
        {value ? value : <span className="text-muted-foreground/50">—</span>}
      </span>
    </div>
  )
}
