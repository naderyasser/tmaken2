/**
 * QA round: data-correctness guards.
 * #1 — dashboard KPI and reps list must share ONE source: getSalesPersons
 *      always excludes tree group nodes and scopes by company the same way.
 * #2 — wallet titles must be derived from the LIVE linked rep, because the
 *      stored wallet_name goes stale when a Sales Person is renamed.
 */
import { walletDisplayName } from '@/lib/wallet-api'

jest.mock('@/lib/api-client', () => ({
  frappeClient: {
    getList: jest.fn(),
    call: jest.fn(),
  },
}))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { frappeClient } = require('@/lib/api-client')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { salesApi } = require('@/lib/sales-api')

describe('getSalesPersons shared source (#1)', () => {
  beforeEach(() => jest.clearAllMocks())

  it('always filters out group nodes (the "Sales Team" row)', async () => {
    frappeClient.getList.mockResolvedValueOnce([])
    await salesApi.getSalesPersons({ limit_page_length: 500 })
    const opts = frappeClient.getList.mock.calls[0][1]
    expect(opts.filters).toContainEqual(['Sales Person', 'is_group', '=', 0])
  })

  it('keeps the is_group filter when callers merge their own filters', async () => {
    frappeClient.getList.mockResolvedValueOnce([])
    await salesApi.getSalesPersons({ filters: [['Sales Person', 'enabled', '=', 1]] })
    const opts = frappeClient.getList.mock.calls[0][1]
    expect(opts.filters).toContainEqual(['Sales Person', 'is_group', '=', 0])
    expect(opts.filters).toContainEqual(['Sales Person', 'enabled', '=', 1])
  })

  it('company scoping resolves through Employee and never a Sales Person company field', async () => {
    frappeClient.getList
      .mockResolvedValueOnce([{ name: 'HR-EMP-00001' }]) // employees of company
      .mockResolvedValueOnce([]) // sales persons
    await salesApi.getSalesPersons({ company: 'mandoob' })
    const [empCall, spCall] = frappeClient.getList.mock.calls
    expect(empCall[0]).toBe('Employee')
    expect(spCall[1].filters).toContainEqual(['Sales Person', 'employee', 'in', ['HR-EMP-00001']])
    expect(spCall[1].filters).toContainEqual(['Sales Person', 'is_group', '=', 0])
    expect(JSON.stringify(spCall[1].fields)).not.toContain('"company"')
  })
})

describe('walletDisplayName (#2)', () => {
  const t = (key: string) => (key === 'sr.admin.wallets.wallet_of' ? 'محفظة {rep}' : key)

  it('derives the title from the live linked rep, ignoring the stale stored name', () => {
    const stale = { wallet_name: 'محفظة مندوب سالم', linked_sales_person: 'مندوب محمود' }
    expect(walletDisplayName(t, stale)).toBe('محفظة مندوب محمود')
  })

  it('falls back to the stored name for wallets without a linked rep (company wallets)', () => {
    expect(walletDisplayName(t, { wallet_name: 'محفظة الشركة' })).toBe('محفظة الشركة')
  })

  it('degrades gracefully when the translation key is unregistered', () => {
    const rawT = (key: string) => key
    const w = { wallet_name: 'x', linked_sales_person: 'مندوب ماجد' }
    expect(walletDisplayName(rawT, w)).toContain('مندوب ماجد')
  })
})
