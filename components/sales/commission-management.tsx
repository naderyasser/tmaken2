'use client'

/**
 * Back-office commission screen.
 *
 * Three tabs mirroring the three questions an operator actually has:
 *   Statement — what did each rep earn this period, and approve it
 *   Rules     — what are they on
 *   Payouts   — what have we actually handed over
 *
 * Everything is scoped server-side, so this component never filters by rep for
 * security reasons — only for convenience.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useI18n } from '@/lib/i18n'
import { useCompany } from '@/hooks/use-company'
import { useToast } from '@/hooks/use-toast'
import { salesApi } from '@/lib/sales-api'
import { stockApi } from '@/lib/stock-api'
import {
  commissionApi,
  type CommissionRule,
  type CommissionEntry,
  type CommissionSummary,
  type CommissionPayout,
  type CommissionItemGroupRate,
} from '@/lib/commission-api'
import { formatSAR, formatDateShort, defaultReportDateRange } from '@/lib/sales-format'
import {
  Percent, RefreshCw, Loader2, Plus, X, CheckCircle2, XCircle,
  Wallet, Clock, TrendingUp, AlertCircle, Trash2, Pencil, Receipt, Ban,
} from 'lucide-react'

type Tab = 'statement' | 'rules' | 'payouts'

const EMPTY_RULE: Partial<CommissionRule> = {
  rule_name: '',
  enabled: 1,
  sales_person: '',
  valid_from: new Date().toISOString().slice(0, 10),
  valid_upto: '',
  commission_basis: 'On Invoice',
  calculation_type: 'Flat Percentage',
  commission_percent: 2.5,
  default_percent: 0,
  base_amount_type: 'Net Amount (excluding VAT)',
  max_discount_percent: 0,
  min_invoice_amount: 0,
  item_group_rates: [],
  notes: '',
}

const STATUS_TONE: Record<string, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  Approved: 'bg-blue-100 text-blue-700',
  Paid: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-gray-100 text-gray-500',
  Draft: 'bg-amber-100 text-amber-700',
}

export function CommissionManagement() {
  const { t, lang } = useI18n()
  const { company: activeCompany } = useCompany()
  const { toast } = useToast()

  const [tab, setTab] = useState<Tab>('statement')
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)
  // defaultReportDateRange() speaks {from,to}; the commission API speaks
  // {from_date,to_date}. Translate once here rather than at every call site.
  const [range, setRange] = useState(() => {
    const r = defaultReportDateRange()
    return { from_date: r.from, to_date: r.to }
  })

  const [summary, setSummary] = useState<CommissionSummary | null>(null)
  const [entries, setEntries] = useState<CommissionEntry[]>([])
  const [rules, setRules] = useState<CommissionRule[]>([])
  const [payouts, setPayouts] = useState<CommissionPayout[]>([])
  const [reps, setReps] = useState<Array<{ name: string; sales_person_name: string }>>([])
  const [itemGroups, setItemGroups] = useState<string[]>([])

  const [repFilter, setRepFilter] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const [editing, setEditing] = useState<Partial<CommissionRule> | null>(null)
  const [payoutFor, setPayoutFor] = useState<string | null>(null)
  const [payoutMethod, setPayoutMethod] = useState('Bank Transfer')
  const [payoutRef, setPayoutRef] = useState('')

  const fmt = (v: number | undefined | null) => formatSAR(v || 0, lang)
  const fmtDate = (v?: string | null) => formatDateShort(v, lang)

  const err = (e: unknown) =>
    toast({
      title: t('sr.admin.common.error_title'),
      description: String((e as Error)?.message || e),
      variant: 'destructive',
    })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // Settings first, and bail if the tenant has commission switched off. The
      // Commission tables only exist on sites that have run the migration, so
      // firing the list endpoints at a tenant that never enabled the feature
      // would 500 rather than render an empty screen.
      const conf = await commissionApi.getSettings()
      setEnabled(conf.enabled)
      if (!conf.enabled) {
        setLoading(false)
        return
      }

      const company = activeCompany || undefined
      const [sum, ent, rl, po] = await Promise.all([
        commissionApi.getSummary({ ...range, company }),
        commissionApi.getEntries({ ...range, company, limit: 500 }),
        commissionApi.getRules(company),
        commissionApi.getPayouts({ limit: 100 }),
      ])
      setSummary(sum)
      setEntries(ent)
      setRules(rl)
      setPayouts(po)
      setSelected(new Set())
    } catch (e) {
      err(e)
    }
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany, range.from_date, range.to_date])

  useEffect(() => {
    load()
  }, [load])

  // Reference data for the rule form. Loaded once — it does not change with the
  // date range and refetching it on every filter change is pure noise.
  useEffect(() => {
    ;(async () => {
      try {
        const repList = await salesApi.getSalesPersons()
        if (Array.isArray(repList)) {
          setReps(repList.map((r) => ({ name: r.name, sales_person_name: r.sales_person_name })))
        }
      } catch {
        /* the rep dropdown just stays empty; a company-wide rule still works */
      }
      try {
        const groups = await stockApi.getItemGroups()
        if (Array.isArray(groups)) setItemGroups(groups.map((g) => g.name))
      } catch {
        /* per-item-group rates fall back to a free-text field */
      }
    })()
  }, [])

  const visibleEntries = useMemo(
    () => (repFilter ? entries.filter((e) => e.sales_person === repFilter) : entries),
    [entries, repFilter]
  )

  const pendingVisible = useMemo(
    () => visibleEntries.filter((e) => e.status === 'Pending'),
    [visibleEntries]
  )

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const act = async (fn: () => Promise<unknown>, successKey: string) => {
    setBusy(true)
    try {
      await fn()
      toast({ title: t(successKey) })
      await load()
    } catch (e) {
      err(e)
    }
    setBusy(false)
  }

  const saveRule = async () => {
    if (!editing) return
    if (!editing.rule_name?.trim()) {
      return err(new Error(t('sr.admin.commission.err_rule_name')))
    }
    await act(
      () =>
        commissionApi.saveRule({
          ...editing,
          company: editing.company || activeCompany || '',
          sales_person: editing.sales_person || null,
          valid_upto: editing.valid_upto || null,
        }),
      'sr.admin.commission.rule_saved'
    )
    setEditing(null)
  }

  const removeRule = async (rule: CommissionRule) => {
    await act(async () => {
      const res = await commissionApi.deleteRule(rule.name!)
      if (res.disabled) {
        toast({
          title: t('sr.admin.commission.rule_disabled_title'),
          description: t('sr.admin.commission.rule_disabled_hint'),
        })
      }
    }, 'sr.admin.commission.rule_removed')
  }

  const doPayout = async () => {
    if (!payoutFor) return
    await act(
      () =>
        commissionApi.createPayout({
          sales_person: payoutFor,
          from_date: range.from_date!,
          to_date: range.to_date!,
          payment_method: payoutMethod,
          reference_no: payoutRef || undefined,
        }),
      'sr.admin.commission.payout_created'
    )
    setPayoutFor(null)
    setPayoutRef('')
  }

  // ── render ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!enabled) {
    return (
      <EmptyState
        icon={Percent}
        title={t('sr.admin.commission.off_title')}
        hint={t('sr.admin.commission.off_hint')}
      />
    )
  }

  const totals = summary?.totals

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('sr.admin.commission.title')}</h2>
          <p className="text-xs text-gray-400">{t('sr.admin.commission.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={range.from_date}
            onChange={(e) => setRange((r) => ({ ...r, from_date: e.target.value }))}
            className="border rounded-lg px-2 py-1.5 text-sm"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="date"
            value={range.to_date}
            onChange={(e) => setRange((r) => ({ ...r, to_date: e.target.value }))}
            className="border rounded-lg px-2 py-1.5 text-sm"
          />
          <button
            onClick={load}
            className="h-9 w-9 flex items-center justify-center border border-gray-200 text-gray-500 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Totals */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: t('sr.admin.commission.stat_pending'), value: fmt(totals.pending), dot: 'bg-amber-500', bg: 'bg-amber-50', Icon: Clock },
            { label: t('sr.admin.commission.stat_approved'), value: fmt(totals.approved), dot: 'bg-blue-500', bg: 'bg-blue-50', Icon: CheckCircle2 },
            { label: t('sr.admin.commission.stat_paid'), value: fmt(totals.paid), dot: 'bg-emerald-500', bg: 'bg-emerald-50', Icon: Wallet },
            { label: t('sr.admin.commission.stat_base'), value: fmt(totals.base_total), dot: 'bg-purple-500', bg: 'bg-purple-50', Icon: TrendingUp },
          ].map((s, i) => (
            <div key={i} className={`rounded-xl border-0 shadow-sm p-4 ${s.bg}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                <p className="text-[10px] font-semibold text-gray-500 truncate">{s.label}</p>
              </div>
              <p className="text-xl font-extrabold text-gray-900 truncate">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {rules.length === 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">{t('sr.admin.commission.no_rules_warning')}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
        {(['statement', 'rules', 'payouts'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t(`sr.admin.commission.tab_${key}`)}
          </button>
        ))}
      </div>

      {/* ── Statement ── */}
      {tab === 'statement' && (
        <div className="space-y-4">
          {summary && summary.rows.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-start px-4 py-2.5 font-semibold">{t('sr.admin.commission.col_rep')}</th>
                    <th className="text-end px-4 py-2.5 font-semibold">{t('sr.admin.commission.col_base')}</th>
                    <th className="text-end px-4 py-2.5 font-semibold">{t('sr.admin.commission.stat_pending')}</th>
                    <th className="text-end px-4 py-2.5 font-semibold">{t('sr.admin.commission.stat_approved')}</th>
                    <th className="text-end px-4 py-2.5 font-semibold">{t('sr.admin.commission.stat_paid')}</th>
                    <th className="text-end px-4 py-2.5 font-semibold">{t('sr.admin.commission.col_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.rows.map((row) => (
                    <tr key={row.sales_person} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => setRepFilter(repFilter === row.sales_person ? '' : row.sales_person)}
                          className={`font-medium ${repFilter === row.sales_person ? 'text-emerald-600' : 'text-gray-900'}`}
                        >
                          {row.sales_person_name || row.sales_person}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-end text-gray-500">{fmt(row.base_total)}</td>
                      <td className="px-4 py-2.5 text-end text-amber-600">{fmt(row.pending)}</td>
                      <td className="px-4 py-2.5 text-end text-blue-600">{fmt(row.approved)}</td>
                      <td className="px-4 py-2.5 text-end text-emerald-600">{fmt(row.paid)}</td>
                      <td className="px-4 py-2.5 text-end">
                        <button
                          disabled={busy || row.approved <= 0}
                          onClick={() => setPayoutFor(row.sales_person)}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:text-gray-300"
                        >
                          {t('sr.admin.commission.pay')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bulk approve bar */}
          <div className="flex items-center gap-2 flex-wrap">
            {repFilter && (
              <button
                onClick={() => setRepFilter('')}
                className="flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-lg"
              >
                {reps.find((r) => r.name === repFilter)?.sales_person_name || repFilter}
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              disabled={busy || pendingVisible.length === 0}
              onClick={() => setSelected(new Set(pendingVisible.map((e) => e.name)))}
              className="text-xs border border-gray-200 px-2.5 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50 disabled:text-gray-300"
            >
              {t('sr.admin.commission.select_all_pending')}
            </button>
            <button
              disabled={busy || selected.size === 0}
              onClick={() => act(() => commissionApi.approve([...selected]), 'sr.admin.commission.approved')}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 font-medium disabled:bg-gray-300"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t('sr.admin.commission.approve_selected')} ({selected.size})
            </button>
            <button
              disabled={busy || selected.size === 0}
              onClick={() => act(() => commissionApi.reject([...selected]), 'sr.admin.commission.rejected')}
              className="flex items-center gap-1.5 text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 font-medium disabled:text-gray-300 disabled:border-gray-200"
            >
              <XCircle className="w-3.5 h-3.5" />
              {t('sr.admin.commission.reject_selected')}
            </button>
          </div>

          {/* Entry list */}
          {visibleEntries.length === 0 ? (
            <EmptyState icon={Percent} title={t('sr.admin.commission.empty')} hint={t('sr.admin.commission.empty_hint')} />
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="w-9 px-3 py-2.5" />
                    <th className="text-start px-3 py-2.5 font-semibold">{t('sr.admin.commission.col_date')}</th>
                    <th className="text-start px-3 py-2.5 font-semibold">{t('sr.admin.commission.col_rep')}</th>
                    <th className="text-start px-3 py-2.5 font-semibold">{t('sr.admin.commission.col_source')}</th>
                    <th className="text-start px-3 py-2.5 font-semibold">{t('sr.admin.commission.col_customer')}</th>
                    <th className="text-end px-3 py-2.5 font-semibold">{t('sr.admin.commission.col_base')}</th>
                    <th className="text-end px-3 py-2.5 font-semibold">{t('sr.admin.commission.col_rate')}</th>
                    <th className="text-end px-3 py-2.5 font-semibold">{t('sr.admin.commission.col_amount')}</th>
                    <th className="text-start px-3 py-2.5 font-semibold">{t('sr.admin.commission.col_status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visibleEntries.map((e) => (
                    <tr key={e.name} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          disabled={e.status !== 'Pending'}
                          checked={selected.has(e.name)}
                          onChange={() => toggle(e.name)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{fmtDate(e.posting_date)}</td>
                      <td className="px-3 py-2.5">{e.sales_person_name || e.sales_person}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-gray-900">{e.sales_invoice || e.reference_name}</span>
                        {e.entry_type === 'Reversal' && (
                          <span className="ms-1.5 text-[10px] font-semibold text-red-600">
                            {t('sr.admin.commission.reversal')}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">{e.customer_name || e.customer}</td>
                      <td className="px-3 py-2.5 text-end text-gray-500">{fmt(e.base_amount)}</td>
                      <td className="px-3 py-2.5 text-end text-gray-500">{e.commission_percent}%</td>
                      <td
                        className={`px-3 py-2.5 text-end font-semibold ${
                          e.commission_amount < 0 ? 'text-red-600' : 'text-gray-900'
                        }`}
                      >
                        {fmt(e.commission_amount)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_TONE[e.status]}`}>
                          {t(`sr.admin.commission.status_${e.status.toLowerCase()}`)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Rules ── */}
      {tab === 'rules' && (
        <div className="space-y-3">
          <button
            onClick={() => setEditing({ ...EMPTY_RULE, company: activeCompany || '' })}
            className="flex items-center gap-1.5 text-sm bg-emerald-600 text-white px-3 py-2 h-9 rounded-lg hover:bg-emerald-700 font-medium shadow-sm shadow-emerald-200"
          >
            <Plus className="w-4 h-4" />
            {t('sr.admin.commission.new_rule')}
          </button>

          {rules.length === 0 ? (
            <EmptyState icon={Percent} title={t('sr.admin.commission.no_rules')} hint={t('sr.admin.commission.no_rules_hint')} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {rules.map((rule) => (
                <div key={rule.name} className="bg-white rounded-xl shadow-sm p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{rule.rule_name}</p>
                      <p className="text-xs text-gray-400">
                        {rule.sales_person
                          ? rule.sales_person_name || rule.sales_person
                          : t('sr.admin.commission.all_reps')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {!rule.enabled && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {t('sr.admin.commission.disabled')}
                        </span>
                      )}
                      <button
                        onClick={() => setEditing({ ...rule })}
                        className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-gray-700 rounded"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeRule(rule)}
                        className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <Chip>{t(`sr.admin.commission.basis_${rule.commission_basis === 'On Invoice' ? 'invoice' : 'collection'}`)}</Chip>
                    <Chip>
                      {rule.calculation_type === 'Flat Percentage'
                        ? `${rule.commission_percent}%`
                        : t('sr.admin.commission.by_item_group')}
                    </Chip>
                    {!!rule.max_discount_percent && (
                      <Chip>{t('sr.admin.commission.max_discount_chip').replace('{n}', String(rule.max_discount_percent))}</Chip>
                    )}
                    {!!rule.min_invoice_amount && <Chip>{t('sr.admin.commission.min_chip')} {fmt(rule.min_invoice_amount)}</Chip>}
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {fmtDate(rule.valid_from)} → {rule.valid_upto ? fmtDate(rule.valid_upto) : t('sr.admin.commission.open_ended')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Payouts ── */}
      {tab === 'payouts' && (
        <div>
          {payouts.length === 0 ? (
            <EmptyState icon={Receipt} title={t('sr.admin.commission.no_payouts')} hint={t('sr.admin.commission.no_payouts_hint')} />
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-start px-4 py-2.5 font-semibold">{t('sr.admin.commission.col_payout')}</th>
                    <th className="text-start px-4 py-2.5 font-semibold">{t('sr.admin.commission.col_rep')}</th>
                    <th className="text-start px-4 py-2.5 font-semibold">{t('sr.admin.commission.col_period')}</th>
                    <th className="text-end px-4 py-2.5 font-semibold">{t('sr.admin.commission.col_amount')}</th>
                    <th className="text-start px-4 py-2.5 font-semibold">{t('sr.admin.commission.col_status')}</th>
                    <th className="text-end px-4 py-2.5 font-semibold">{t('sr.admin.commission.col_actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payouts.map((p) => (
                    <tr key={p.name} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-2.5">{p.sales_person_name || p.sales_person}</td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                        {fmtDate(p.from_date)} → {fmtDate(p.to_date)}
                      </td>
                      <td className="px-4 py-2.5 text-end font-semibold">{fmt(p.total_amount)}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_TONE[p.status]}`}>
                          {t(`sr.admin.commission.status_${p.status.toLowerCase()}`)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-end">
                        {p.status === 'Draft' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              disabled={busy}
                              onClick={() => act(() => commissionApi.markPayoutPaid(p.name), 'sr.admin.commission.payout_paid')}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                            >
                              {t('sr.admin.commission.mark_paid')}
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => act(() => commissionApi.cancelPayout(p.name), 'sr.admin.commission.payout_cancelled')}
                              className="text-xs font-semibold text-gray-400 hover:text-red-600"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rule dialog */}
      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.name ? t('sr.admin.commission.edit_rule') : t('sr.admin.commission.new_rule')}>
          <div className="space-y-3">
            <Field label={t('sr.admin.commission.f_rule_name')}>
              <input
                value={editing.rule_name || ''}
                onChange={(e) => setEditing({ ...editing, rule_name: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </Field>

            <Field label={t('sr.admin.commission.f_rep')} hint={t('sr.admin.commission.f_rep_hint')}>
              <select
                value={editing.sales_person || ''}
                onChange={(e) => setEditing({ ...editing, sales_person: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">{t('sr.admin.commission.all_reps')}</option>
                {reps.map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.sales_person_name || r.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('sr.admin.commission.f_valid_from')}>
                <input
                  type="date"
                  value={editing.valid_from || ''}
                  onChange={(e) => setEditing({ ...editing, valid_from: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </Field>
              <Field label={t('sr.admin.commission.f_valid_upto')}>
                <input
                  type="date"
                  value={editing.valid_upto || ''}
                  onChange={(e) => setEditing({ ...editing, valid_upto: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <Field label={t('sr.admin.commission.f_basis')} hint={t('sr.admin.commission.f_basis_hint')}>
              <select
                value={editing.commission_basis}
                onChange={(e) =>
                  setEditing({ ...editing, commission_basis: e.target.value as CommissionRule['commission_basis'] })
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="On Invoice">{t('sr.admin.commission.basis_invoice')}</option>
                <option value="On Collection">{t('sr.admin.commission.basis_collection')}</option>
              </select>
            </Field>

            <Field label={t('sr.admin.commission.f_calc')}>
              <select
                value={editing.calculation_type}
                onChange={(e) =>
                  setEditing({ ...editing, calculation_type: e.target.value as CommissionRule['calculation_type'] })
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="Flat Percentage">{t('sr.admin.commission.calc_flat')}</option>
                <option value="By Item Group">{t('sr.admin.commission.by_item_group')}</option>
              </select>
            </Field>

            {editing.calculation_type === 'Flat Percentage' ? (
              <Field label={t('sr.admin.commission.f_percent')}>
                <input
                  type="number"
                  step="0.01"
                  value={editing.commission_percent ?? ''}
                  onChange={(e) => setEditing({ ...editing, commission_percent: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </Field>
            ) : (
              <ItemGroupRates
                rows={editing.item_group_rates || []}
                itemGroups={itemGroups}
                defaultPercent={editing.default_percent ?? 0}
                onDefaultChange={(v) => setEditing({ ...editing, default_percent: v })}
                onChange={(rows) => setEditing({ ...editing, item_group_rates: rows })}
                t={t}
              />
            )}

            <Field label={t('sr.admin.commission.f_base')} hint={t('sr.admin.commission.f_base_hint')}>
              <select
                value={editing.base_amount_type}
                onChange={(e) =>
                  setEditing({ ...editing, base_amount_type: e.target.value as CommissionRule['base_amount_type'] })
                }
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="Net Amount (excluding VAT)">{t('sr.admin.commission.base_net')}</option>
                <option value="Grand Total (including VAT)">{t('sr.admin.commission.base_gross')}</option>
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('sr.admin.commission.f_max_discount')} hint={t('sr.admin.commission.f_max_discount_hint')}>
                <input
                  type="number"
                  step="0.01"
                  value={editing.max_discount_percent ?? 0}
                  onChange={(e) => setEditing({ ...editing, max_discount_percent: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </Field>
              <Field label={t('sr.admin.commission.f_min_invoice')} hint={t('sr.admin.commission.f_min_invoice_hint')}>
                <input
                  type="number"
                  step="0.01"
                  value={editing.min_invoice_amount ?? 0}
                  onChange={(e) => setEditing({ ...editing, min_invoice_amount: parseFloat(e.target.value) || 0 })}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!editing.enabled}
                onChange={(e) => setEditing({ ...editing, enabled: e.target.checked ? 1 : 0 })}
                className="rounded"
              />
              {t('sr.admin.commission.f_enabled')}
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditing(null)} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
                {t('sr.admin.common.cancel')}
              </button>
              <button
                disabled={busy}
                onClick={saveRule}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:bg-gray-300"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('sr.admin.common.save')}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Payout dialog */}
      {payoutFor && (
        <Modal onClose={() => setPayoutFor(null)} title={t('sr.admin.commission.create_payout')}>
          <div className="space-y-3">
            <p className="text-xs text-gray-500">{t('sr.admin.commission.payout_hint')}</p>
            <Field label={t('sr.admin.commission.f_method')}>
              <select
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {['Bank Transfer', 'Cash', 'Payroll', 'Other'].map((m) => (
                  <option key={m} value={m}>
                    {t(`sr.admin.commission.method_${m.toLowerCase().replace(' ', '_')}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('sr.admin.commission.f_reference')}>
              <input
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPayoutFor(null)} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
                {t('sr.admin.common.cancel')}
              </button>
              <button
                disabled={busy}
                onClick={doPayout}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:bg-gray-300"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t('sr.admin.commission.create_payout')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── small presentational helpers ──────────────────────

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{children}</span>
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Percent
  title: string
  hint: string
}) {
  return (
    <div className="text-center py-16 bg-white rounded-xl shadow-sm">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
        <Icon className="w-7 h-7 text-gray-400" />
      </div>
      <p className="font-semibold text-gray-700">{title}</p>
      <p className="text-sm text-gray-400 mt-1">{hint}</p>
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b sticky top-0 bg-white">
          <h3 className="font-bold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

function ItemGroupRates({
  rows,
  itemGroups,
  defaultPercent,
  onDefaultChange,
  onChange,
  t,
}: {
  rows: CommissionItemGroupRate[]
  itemGroups: string[]
  defaultPercent: number
  onDefaultChange: (v: number) => void
  onChange: (rows: CommissionItemGroupRate[]) => void
  t: (key: string) => string
}) {
  const update = (i: number, patch: Partial<CommissionItemGroupRate>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  return (
    <div className="space-y-2">
      <Field label={t('sr.admin.commission.f_default_percent')} hint={t('sr.admin.commission.f_default_percent_hint')}>
        <input
          type="number"
          step="0.01"
          value={defaultPercent}
          onChange={(e) => onDefaultChange(parseFloat(e.target.value) || 0)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
      </Field>

      <label className="block text-xs font-semibold text-gray-600">{t('sr.admin.commission.f_group_rates')}</label>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          {itemGroups.length > 0 ? (
            <select
              value={row.item_group}
              onChange={(e) => update(i, { item_group: e.target.value })}
              className="flex-1 border rounded-lg px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {itemGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={row.item_group}
              onChange={(e) => update(i, { item_group: e.target.value })}
              className="flex-1 border rounded-lg px-2 py-1.5 text-sm"
            />
          )}
          <input
            type="number"
            step="0.01"
            value={row.commission_percent}
            onChange={(e) => update(i, { commission_percent: parseFloat(e.target.value) || 0 })}
            className="w-24 border rounded-lg px-2 py-1.5 text-sm"
          />
          <button
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            className="h-8 w-8 flex items-center justify-center text-gray-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...rows, { item_group: '', commission_percent: 0 }])}
        className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-semibold"
      >
        <Plus className="w-3.5 h-3.5" />
        {t('sr.admin.commission.add_group_rate')}
      </button>
    </div>
  )
}
