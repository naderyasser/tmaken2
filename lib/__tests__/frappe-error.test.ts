import { parseFrappeError, stripExceptionClass } from '../frappe-error'

describe('stripExceptionClass', () => {
    it('drops the Python exception class prefix', () => {
        expect(stripExceptionClass('frappe.exceptions.ValidationError: Branch is required'))
            .toBe('Branch is required')
    })

    it('keeps a plain sentence untouched, even when it contains a colon', () => {
        expect(stripExceptionClass('Cannot delete branch: 3 employees assigned'))
            .toBe('Cannot delete branch: 3 employees assigned')
    })

    it('takes only the first line and strips <br> padding', () => {
        expect(stripExceptionClass('Branch number taken<br>\nstack trace here'))
            .toBe('Branch number taken')
    })
})

describe('parseFrappeError', () => {
    const fallback = 'API request failed: 417'

    it('reads the message frappe.throw() puts in _server_messages', () => {
        const body = {
            _server_messages: JSON.stringify([
                JSON.stringify({ message: "Branch number '07' is already used by branch 'Riyadh'." }),
            ]),
        }
        expect(parseFrappeError(body, fallback))
            .toBe("Branch number '07' is already used by branch 'Riyadh'.")
    })

    it('falls back to exception when there are no server messages', () => {
        expect(parseFrappeError({ exception: 'frappe.exceptions.ValidationError: Company is required' }, fallback))
            .toBe('Company is required')
    })

    it('prefers _server_messages over exception', () => {
        const body = {
            _server_messages: JSON.stringify([JSON.stringify({ message: 'friendly' })]),
            exception: 'frappe.exceptions.ValidationError: raw',
        }
        expect(parseFrappeError(body, fallback)).toBe('friendly')
    })

    it('survives malformed _server_messages and keeps looking', () => {
        expect(parseFrappeError({ _server_messages: 'not json', exception: 'boom' }, fallback)).toBe('boom')
    })

    it('returns the fallback for a body with nothing readable', () => {
        expect(parseFrappeError({}, fallback)).toBe(fallback)
        expect(parseFrappeError(null, fallback)).toBe(fallback)
    })
})
