// Rentals-native «المحاسبة» data layer — the SUBSET of the tenant's real Frappe
// accounting that belongs to the rentals vertical, and nothing else.
//
// What "rental accounting" means here (kept deliberately narrow):
//   • The 3 dedicated rental accounts the aqar_bridge journal feed auto-creates on
//     first use (see base_meena/aqar_bridge/journal_api.py → DEFAULT_ACCOUNTS):
//       ذمم عقود الإيجار (Asset · receivable) · إيرادات الإيجار (Income) ·
//       ض.ق.م الإيجار (Liability · Tax).
//   • The Journal Entries that feed came from rental invoices — identified by the
//     marker the feed stamps into `cheque_no`: MARKER = "EGARSYS::" → LIKE 'EGARSYS::%'.
//
// Everything reads the CURRENT tenant's own books through the shared accountingApi /
// frappeClient (host-scoped session). Read-only: this module never writes a ledger.

import { accountingApi, type JournalEntry, type JournalEntryAccount } from '@/lib/accounting-api'
import { frappeClient, type FrappeFilter } from '@/lib/api-client'

/** The marker the bridge stamps into Journal Entry `cheque_no` (journal_api.py). */
export const EGARSYS_JE_MARKER = 'EGARSYS::'

/** Filter selecting ONLY the rental قيود (cheque_no LIKE 'EGARSYS::%'). Shared by the
 *  list, the count, and the print/all fetch so they can never disagree. */
export const rentalJournalEntryFilters: FrappeFilter[] = [
  ['Journal Entry', 'cheque_no', 'like', `${EGARSYS_JE_MARKER}%`],
]

export type RentalAccountKey = 'receivable' | 'rentIncome' | 'vat'

export interface RentalAccountSpec {
  key: RentalAccountKey
  /** Exact Frappe `account_name` created by the bridge (DEFAULT_ACCOUNTS). */
  accountName: string
  /** Arabic display label for the summary card. */
  label: string
  rootType: 'Asset' | 'Income' | 'Liability'
  /** Income / Liability accounts carry a credit (negative) natural balance in ERPNext —
   *  show the magnitude so the card reads as a positive figure (same as the dashboard's
   *  revenue_ytd = Math.abs(...)). */
  displayAbs: boolean
}

/** The 3 dedicated rental accounts, names copied verbatim from journal_api.py. */
export const RENTAL_ACCOUNT_SPECS: RentalAccountSpec[] = [
  { key: 'receivable', accountName: 'ذمم عقود الإيجار', label: 'ذمم عقود الإيجار', rootType: 'Asset', displayAbs: false },
  { key: 'rentIncome', accountName: 'إيرادات الإيجار', label: 'إيرادات الإيجار', rootType: 'Income', displayAbs: true },
  { key: 'vat', accountName: 'ض.ق.م الإيجار', label: 'ضريبة القيمة المضافة على الإيجار', rootType: 'Liability', displayAbs: true },
]

export interface RentalAccountBalance extends RentalAccountSpec {
  /** Full Frappe account name (incl. company abbr, e.g. "ذمم عقود الإيجار - T"),
   *  or null when the account hasn't been auto-created on this tenant yet. */
  account: string | null
  balance: number
}

/**
 * Resolve the 3 rental accounts on the current tenant (by exact account_name) and
 * fetch each one's balance as of today. Missing accounts (not yet created because no
 * rental JE has posted) come back with account=null, balance=0.
 */
export async function getRentalAccountBalances(): Promise<RentalAccountBalance[]> {
  const names = RENTAL_ACCOUNT_SPECS.map((s) => s.accountName)
  const accounts = await frappeClient
    .getList<{ name: string; account_name: string }>('Account', {
      filters: [
        ['Account', 'account_name', 'in', names],
        ['Account', 'is_group', '=', 0],
      ],
      fields: ['name', 'account_name'],
      limit_page_length: 0,
    })
    .catch(() => [] as { name: string; account_name: string }[])

  return Promise.all(
    RENTAL_ACCOUNT_SPECS.map(async (spec): Promise<RentalAccountBalance> => {
      const acct = accounts.find((a) => a.account_name === spec.accountName)
      if (!acct) return { ...spec, account: null, balance: 0 }
      const raw = await accountingApi.getAccountBalance(acct.name)
      return { ...spec, account: acct.name, balance: spec.displayAbs ? Math.abs(raw) : raw }
    }),
  )
}

/** A rental Journal Entry with its legs (the accounts it touched) attached. */
export interface RentalJournalEntry extends JournalEntry {
  accounts: JournalEntryAccount[]
}

/** Attach each entry's legs (the accounts it touched). Child doctypes like
 *  `Journal Entry Account` CANNOT be listed directly over the REST API — Frappe
 *  raises a PermissionError on child-table list queries. The reliable, version-safe
 *  path is to fetch each JE's FULL document, which embeds its `accounts` child table
 *  (works for drafts too). Rental قيود are bounded (dozens–low hundreds) and pages
 *  are small, so N parallel doc GETs are fine. */
async function attachLegs(entries: JournalEntry[]): Promise<RentalJournalEntry[]> {
  if (!entries.length) return []
  return Promise.all(
    entries.map(async (e): Promise<RentalJournalEntry> => {
      try {
        const full = await accountingApi.getJournalEntry(e.name)
        return { ...e, accounts: full.accounts ?? [] }
      } catch {
        return { ...e, accounts: [] }
      }
    }),
  )
}

/**
 * One page of rental قيود (server-side pagination, same call shape as the platform's
 * journal-entries page) with each row's accounts-touched legs attached.
 */
export async function getRentalJournalEntries(opts?: {
  limit_start?: number
  limit_page_length?: number
}): Promise<RentalJournalEntry[]> {
  const entries = await accountingApi.getJournalEntries({
    filters: rentalJournalEntryFilters,
    limit_start: opts?.limit_start,
    limit_page_length: opts?.limit_page_length ?? 100,
  })
  return attachLegs(entries)
}

/** Total rental قيود — same filter builder as the list, so the pager can't disagree. */
export function countRentalJournalEntries(): Promise<number> {
  return accountingApi.countJournalEntries({ filters: rentalJournalEntryFilters })
}

export interface RentalJournalTotals {
  count: number
  /** Net gross rental value (incl. VAT): Σ total_debit of invoices MINUS credit notes,
   *  cancelled JEs excluded — mirrors the egarsys journal engine so the two agree. */
  totalDebit: number
  totalCredit: number
}

/** A رنtal JE is a credit note when the bridge stamped «إشعار دائن …» into its user_remark
 *  (journal_api.py doc_label) or it carries an explicit Credit Note voucher_type. Credit
 *  notes REVERSE their invoice: the feed posts them with swapped legs, so total_debit stays
 *  +gross — they must be NETTED OUT (−), not added, or the invoice + its reversal both count. */
function isCreditNoteEntry(e: JournalEntry): boolean {
  return e.voucher_type === 'Credit Note' || (e.user_remark ?? '').trimStart().startsWith('إشعار دائن')
}

/**
 * Header-only sweep of EVERY rental قيد for the summary aggregates (count + net gross total).
 * Cheap (headers, no legs) and capped; rental JEs are bounded to dozens–low-hundreds.
 *
 * ACCOUNTING CORRECTNESS: a plain Σ total_debit over-states, because (a) a cancelled JE
 * (docstatus=2) has no GL effect yet still carries the EGARSYS:: marker, and (b) credit
 * notes are reversals whose total_debit is a positive magnitude. We drop cancelled and
 * subtract credit notes — matching egarsys's engine (invoiceProducesEntry drops cancelled;
 * deriveEntry makes credit_note negative) so «إجمالي قيمة القيود» equals the egarsys total.
 */
export async function getRentalJournalTotals(): Promise<RentalJournalTotals> {
  const CHUNK = 500
  const MAX_PAGES = 20 // hard cap: 10k rows
  let start = 0
  let count = 0
  let totalDebit = 0
  let totalCredit = 0
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await accountingApi.getJournalEntries({
      filters: rentalJournalEntryFilters,
      fields: ['name', 'total_debit', 'total_credit', 'user_remark', 'voucher_type', 'docstatus'],
      limit_start: start,
      limit_page_length: CHUNK,
    })
    for (const e of page) {
      if (e.docstatus === 2) continue // cancelled JE — no GL effect, never count it
      count += 1
      const sign = isCreditNoteEntry(e) ? -1 : 1
      totalDebit += sign * (e.total_debit ?? 0)
      totalCredit += sign * (e.total_credit ?? 0)
    }
    if (page.length < CHUNK) break
    start += CHUNK
  }
  return { count, totalDebit, totalCredit }
}

/** Every rental قيد (with legs) — for the print report, which must cover ALL rows. Capped. */
export async function getAllRentalJournalEntries(cap = 5000): Promise<RentalJournalEntry[]> {
  const CHUNK = 500
  const all: RentalJournalEntry[] = []
  for (let start = 0; start < cap; start += CHUNK) {
    const chunk = await getRentalJournalEntries({ limit_start: start, limit_page_length: CHUNK })
    all.push(...chunk)
    if (chunk.length < CHUNK) break
  }
  return all
}

/** "ذمم عقود الإيجار - T" → "ذمم عقود الإيجار" (drop the trailing " - <company abbr>"). */
export function shortAccountName(account: string | undefined | null): string {
  if (!account) return '—'
  return account.replace(/\s+-\s+[^-]+$/, '').trim() || account
}
