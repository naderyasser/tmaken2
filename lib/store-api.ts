/**
 * Server-side calls to the HR store (site_creator.hr_store on the fc.local
 * control-plane site). The landing/subscribe pages live on the shared entry,
 * whose /api goes to a client's site — so the store is reached from the Next
 * server instead, straight to gunicorn with the control-plane site header.
 */
const BACKEND = process.env.FRAPPE_INTERNAL_URL || 'http://127.0.0.1:8000'
const STORE_SITE = 'fc.local'

export const STORE_METHODS = ['get_packages', 'check_code', 'start_order', 'order_status', 'support_options', 'request_call', 'chat_send', 'chat_poll', 'team_status', 'chat_typing'] as const
// (the help widget goes through /support-api, which works on every host)
export type StoreMethod = (typeof STORE_METHODS)[number]

export interface Package {
  label: string
  plan: string
  min: number
  max: number | null
  rate: number
  setup: number
}
export interface PackageInfo {
  packages: Record<string, Package>
  vat_included: boolean
  currency: string
  online_payment: boolean
  entry: string
}

export async function storeCall<T = unknown>(method: StoreMethod, args: Record<string, unknown> = {}, clientIp?: string) {
  const res = await fetch(`${BACKEND}/api/method/site_creator.hr_store.${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Frappe-Site-Name': STORE_SITE,
      ...(clientIp ? { 'X-Forwarded-For': clientIp } : {}),
    },
    body: JSON.stringify(args),
    cache: 'no-store',
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    let msg = 'حصل خطأ — جرّب تاني'
    try {
      msg = JSON.parse(JSON.parse(body._server_messages)[0]).message || msg
    } catch {
      /* keep the generic message */
    }
    return { ok: false as const, status: res.status, error: msg }
  }
  return { ok: true as const, data: body.message as T }
}

export const ORDER_BOOK_KEY = 'masar_orders'
