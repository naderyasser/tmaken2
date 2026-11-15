jest.mock('@/lib/api-client', () => ({ frappeClient: { call: jest.fn(), getList: jest.fn() } }))

import { frappeClient } from '@/lib/api-client'
import {
  buildPayload, leaveDays, money, payslipMonthLabel, requestsSelf, statusInfo, validateRequest,
} from '@/lib/m/selfservice'

describe('m selfservice helpers', () => {
  it('labels payslip month in Arabic from the period end', () => {
    expect(payslipMonthLabel({ start_date: '2026-10-01', end_date: '2026-10-31' })).toBe('أكتوبر 2026')
  })
  it('formats money with Latin digits and tolerates null', () => {
    expect(money(12345.5)).toBe('12,345.50')
    expect(money(null)).toBe('0.00')
  })
  it('counts inclusive leave days and rejects reversed ranges', () => {
    expect(leaveDays('2026-11-01', '2026-11-03')).toBe(3)
    expect(leaveDays('2026-11-03', '2026-11-01')).toBe(0)
    expect(leaveDays(undefined, '2026-11-01')).toBe(0)
  })
  it('maps statuses', () => {
    expect(statusInfo('Pending')).toEqual({ label: 'قيد المراجعة', tone: 'wait' })
    expect(statusInfo('Rejected').tone).toBe('no')
    expect(statusInfo('Weird').label).toBe('Weird')
  })
  it('validates each request kind', () => {
    expect(validateRequest('leave', {})).toMatch(/نوع الإجازة/)
    expect(validateRequest('leave', { leave_type: 'A', from_date: '2026-11-05', to_date: '2026-11-04' })).toMatch(/قبل/)
    expect(validateRequest('leave', { leave_type: 'A', from_date: '2026-11-04', to_date: '2026-11-05' })).toBe('')
    expect(validateRequest('permission', { permission_date: '2026-11-04', from_time: '10:00', to_time: '09:00' })).toMatch(/بعد/)
    expect(validateRequest('letter', { letter_type: 'Custom' })).toBe('')
    expect(validateRequest('punch', { requested_time: '2026-11-04T08:00' })).toMatch(/سبب/)
  })
  it('builds backend payloads with only the kind\'s fields', () => {
    expect(buildPayload('leave', { leave_type: 'A', from_date: 'd1', to_date: 'd2', description: '  ', reason: 'x' })).toEqual({
      leave_type: 'A', from_date: 'd1', to_date: 'd2', description: undefined,
    })
    expect(buildPayload('punch', { requested_time: '2026-11-04T08:00', reason: 'r' })).toMatchObject({
      requested_time: '2026-11-04 08:00', log_type: 'IN', correction_type: 'Missing Punch',
    })
  })
})

describe('requestsSelf', () => {
  beforeEach(() => jest.clearAllMocks())
  it('creates the request for the given employee with a JSON payload', async () => {
    ;(frappeClient.call as jest.Mock).mockResolvedValue({ message: { ok: true } })
    await requestsSelf.create('letter', 'EMP-1', { letter_type: 'Custom', purpose: 'p' })
    const [method, args] = (frappeClient.call as jest.Mock).mock.calls[0]
    expect(method).toBe('base_meena.hr_requests.approvals_api.create_request')
    expect(args.request_type).toBe('letter')
    expect(args.employee).toBe('EMP-1')
    expect(JSON.parse(args.payload)).toEqual({ letter_type: 'Custom', purpose: 'p' })
  })
  it('reads balances from get_employee_leave', async () => {
    ;(frappeClient.call as jest.Mock).mockResolvedValue({ message: { balances: [{ leave_type: 'A', allocated: 5, used: 1, balance: 4 }] } })
    expect(await requestsSelf.balances('EMP-1')).toHaveLength(1)
  })
})
