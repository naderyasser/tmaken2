/**
 * Frappe error decoding — THE one place that turns a failed Frappe response body
 * into the sentence an admin should read.
 *
 * Frappe never returns `{ error: "..." }`. A `frappe.throw()` arrives as
 * `_server_messages` (a JSON string holding a JSON array of JSON strings), with
 * `exception` / `exc` as the raw traceback-ish fallbacks. Reading `.error` — as
 * lib/api.ts used to — silently discarded every validation message the backend
 * produced and showed "API request failed: 417" instead.
 */

/** Drop the `frappe.exceptions.ValidationError: ` prefix and any <br> padding. */
export function stripExceptionClass(raw: string): string {
    const line = raw.split('\n')[0].replace(/<br>/g, '').trim()
    const colonIdx = line.indexOf(': ')
    if (colonIdx !== -1 && /^[\w.]+$/.test(line.slice(0, colonIdx))) {
        return line.slice(colonIdx + 2).trim()
    }
    return line
}

/**
 * Pull the user-facing message out of a parsed Frappe error body.
 * Returns `fallback` when the body carries nothing readable.
 */
export function parseFrappeError(errorData: any, fallback: string): string {
    if (!errorData || typeof errorData !== 'object') return fallback

    if (errorData._server_messages) {
        try {
            const msgs = JSON.parse(errorData._server_messages)
            const parsed = JSON.parse(msgs[0])
            if (parsed?.message) return stripExceptionClass(String(parsed.message))
        } catch { /* fall through to the other fields */ }
    }
    if (errorData._error_message) return stripExceptionClass(String(errorData._error_message))
    if (errorData.exception) return stripExceptionClass(String(errorData.exception))
    if (errorData.exc) return stripExceptionClass(String(errorData.exc))
    if (typeof errorData.error === 'string' && errorData.error) return stripExceptionClass(errorData.error)
    if (typeof errorData.message === 'string' && errorData.message) return stripExceptionClass(errorData.message)

    return fallback
}

/** Frappe's own English messages → Arabic, and never show raw HTML tags
 *  (client QA 2026-09-27: «Location <strong>x</strong> already exists» reached users). */
export function arabizeError(raw: string): string {
  const text = String(raw || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
  const DT = '(?:Location|Employee Group|Holiday List|Leave Type|Country|Task|Role|Department|Designation|Branch|Project|Shift Type|Employee) '
  let m: RegExpMatchArray | null
  if ((m = text.match(new RegExp(`^(?:${DT})?(.+?) already exists\\.?$`)))) return `«${m[1].trim()}» موجود بالفعل`
  if (/Duplicate entry/i.test(text)) return 'هذا الاسم موجود بالفعل'
  if ((m = text.match(new RegExp(`^(?:${DT})?(.+?) not found\\.?$`)))) return `العنصر «${m[1].trim()}» غير موجود — ربما حُذف أو تغيّر اسمه، أعد تحميل الصفحة`
  if (/not allowed to be renamed/i.test(text)) return 'لا يمكن تغيير اسم هذا العنصر — يمكنك تعديل الحقول الأخرى فقط'
  if (/Cannot delete or cancel because .* is linked with/i.test(text)) return 'لا يمكن الحذف لأن هذا العنصر مستخدم في سجلات أخرى'
  if (/Insufficient Permission|Not permitted/i.test(text)) return 'ليس لديك صلاحية لهذه العملية'
  if (/Value missing for/i.test(text)) return 'يوجد حقل مطلوب لم يُملأ'
  return text
}
