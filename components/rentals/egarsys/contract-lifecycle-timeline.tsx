'use client'

// Ported 1:1 from egarsys src/components/contract-lifecycle.tsx (the سجل التأجير
// table). Imports swapped to the scoped format/types/badge + scoped derivation.
import { useMemo } from 'react'
import { AlertTriangle, RefreshCw, UserPlus } from 'lucide-react'
import { Badge } from './ui/badge'
import { formatDate, formatDurationAr } from './format'
import { ContractStatusLabels } from './types'
import { buildContractLifecycle, type LifecycleContract } from './engine/contract-lifecycle'

function statusBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
    active: 'success',
    expired: 'neutral',
    pending_renewal: 'warning',
    terminated: 'danger',
    moved_out: 'danger',
    draft: 'neutral',
  }
  return map[status] ?? 'neutral'
}

export function ContractLifecycleTimeline({
  contracts,
  onViewContract,
}: {
  contracts: LifecycleContract[]
  onViewContract?: (contract: LifecycleContract) => void
}) {
  const lifecycle = useMemo(() => buildContractLifecycle(contracts, new Date()), [contracts])

  if (!lifecycle.entries.length && !lifecycle.drafts.length) {
    return <p className="text-sm text-muted-foreground">لا توجد عقود مسجّلة</p>
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-right text-xs">
          <thead className="bg-slate-100 dark:bg-slate-800/60">
            <tr>
              <th className="p-2 font-semibold">رقم العقد</th>
              <th className="p-2 font-semibold">اسم المستأجر</th>
              <th className="p-2 font-semibold whitespace-nowrap">من</th>
              <th className="p-2 font-semibold whitespace-nowrap">إلى</th>
              <th className="p-2 font-semibold">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {lifecycle.entries.map((entry, i) =>
              entry.kind === 'gap' ? (
                <tr key={`gap-${i}`} className="bg-red-50 dark:bg-red-950/30">
                  <td colSpan={5} className="p-2">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
                      <span className="font-extrabold text-red-700 dark:text-red-300">فاضي لم يتم تأجيره</span>
                      <span className="font-bold text-red-600 dark:text-red-400">— {formatDurationAr(entry.days)}</span>
                      <span className="text-red-600/80 dark:text-red-400/80">
                        (من {formatDate(entry.fromDate)} {entry.ongoing ? 'حتى الآن' : `إلى ${formatDate(entry.toDate)}`})
                      </span>
                    </span>
                  </td>
                </tr>
              ) : (
                <tr
                  key={entry.contract.id}
                  onClick={onViewContract ? () => onViewContract(entry.contract) : undefined}
                  className={`border-t border-slate-100 dark:border-slate-800 ${onViewContract ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40' : ''} ${entry.contract.status === 'active' ? 'bg-emerald-50/40 dark:bg-emerald-950/15' : ''}`}
                >
                  <td className="p-2 font-mono font-semibold" dir="ltr">
                    {entry.contract.ejarContractNumber || entry.contract.contractNumber}
                    {entry.contract.internalId ? <span className="text-muted-foreground"> #{entry.contract.internalId}</span> : null}
                  </td>
                  <td className="p-2">
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="font-medium">{entry.contract.tenantName || entry.contract.tenant?.name || '—'}</span>
                      {entry.isRenewal && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" title="تجديد لنفس المستأجر">
                          <RefreshCw className="h-2.5 w-2.5" /> تجديد
                        </span>
                      )}
                      {entry.newTenant && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-purple-100 px-1 py-0.5 text-[9px] font-bold text-purple-700 dark:bg-purple-950/50 dark:text-purple-300" title="مستأجر جديد">
                          <UserPlus className="h-2.5 w-2.5" /> مستأجر جديد
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="p-2 whitespace-nowrap">{formatDate(entry.contract.startDate)}</td>
                  <td className="p-2 whitespace-nowrap">
                    {formatDate(entry.contract.endDate)}
                    {entry.contract.status === 'moved_out' && <span className="text-red-600 dark:text-red-400"> (خرج)</span>}
                  </td>
                  <td className="p-2">
                    <Badge variant={statusBadgeVariant(entry.contract.status)}>
                      {ContractStatusLabels[entry.contract.status]?.ar || entry.contract.status}
                    </Badge>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      {lifecycle.totalGapDays > 0 && (
        <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">
          إجمالي فترات الشغور بين العقود: {formatDurationAr(lifecycle.totalGapDays)}
        </p>
      )}

      {lifecycle.drafts.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-[11px] text-muted-foreground">مسودات (خارج السجل الزمني):</p>
          {lifecycle.drafts.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-dashed p-2 text-xs text-muted-foreground">
              <span className="font-mono" dir="ltr">{d.contractNumber}</span>
              <span>{formatDate(d.startDate)} — {formatDate(d.endDate)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
