// Ported 1:1 from egarsys src/lib/contract-lifecycle.ts — pure derivation of a
// property's/unit's rental lifecycle (سجل التأجير): contracts ordered
// chronologically with the vacancy gaps between them surfaced in red. No DB, no
// writes. Renewal (same tenant) vs new-tenant transitions are tagged.

export interface LifecycleContract {
  id: string
  contractNumber: string
  internalId?: number | null
  ejarContractNumber?: string | null
  tenantName?: string | null
  tenant?: { name?: string | null } | null
  startDate: string
  endDate: string
  status: string
  rentAmount?: number | null
}

export type LifecycleEntry =
  | { kind: 'contract'; contract: LifecycleContract; isRenewal: boolean; newTenant: boolean }
  | { kind: 'gap'; fromDate: string; toDate: string; days: number; ongoing: boolean }

function tenantKey(c: LifecycleContract): string {
  return (c.tenantName || c.tenant?.name || '').trim().toLowerCase()
}

export interface ContractLifecycle {
  entries: LifecycleEntry[]
  drafts: LifecycleContract[]
  totalGapDays: number
  vacantNow: boolean
}

const DAY_MS = 86_400_000

function parse(d: string): Date | null {
  // Mirror datetimes are naive "YYYY-MM-DD HH:MM:SS"; anchor to UTC so gap-day
  // counts don't shift with the viewer timezone (same rule as the adapter's toDate).
  const s = String(d).replace(' ', 'T')
  const t = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z')
  return isNaN(t.getTime()) ? null : t
}

export function buildContractLifecycle(contracts: LifecycleContract[], now: Date): ContractLifecycle {
  const drafts = contracts.filter((c) => c.status === 'draft')
  const real = contracts
    .filter((c) => c.status !== 'draft' && parse(c.startDate) && parse(c.endDate))
    .sort((a, b) => parse(a.startDate)!.getTime() - parse(b.startDate)!.getTime())

  const entries: LifecycleEntry[] = []
  let coverageEnd: Date | null = null
  let totalGapDays = 0
  let prevKey: string | null = null

  for (const c of real) {
    const start = parse(c.startDate)!
    const end = parse(c.endDate)!
    if (coverageEnd && start > coverageEnd) {
      const days = Math.floor((start.getTime() - coverageEnd.getTime()) / DAY_MS)
      if (days >= 2) {
        entries.push({ kind: 'gap', fromDate: coverageEnd.toISOString(), toDate: start.toISOString(), days, ongoing: false })
        totalGapDays += days
      }
    }
    const key = tenantKey(c)
    const isRenewal = prevKey !== null && key !== '' && key === prevKey
    const newTenant = prevKey !== null && key !== prevKey
    entries.push({ kind: 'contract', contract: c, isRenewal, newTenant })
    if (!coverageEnd || end > coverageEnd) coverageEnd = end
    prevKey = key
  }

  let vacantNow = false
  if (coverageEnd && coverageEnd < now) {
    const days = Math.floor((now.getTime() - coverageEnd.getTime()) / DAY_MS)
    if (days >= 1) {
      entries.push({ kind: 'gap', fromDate: coverageEnd.toISOString(), toDate: now.toISOString(), days, ongoing: true })
      vacantNow = true
    }
  }

  return { entries, drafts, totalGapDays, vacantNow }
}
