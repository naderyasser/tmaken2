import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

import ClientDemoKiosk from '@/components/client-demo-kiosk'

/**
 * Client demo kiosk — /client-demo (server entry).
 *
 * Validates the demo session server-side and, when it is missing OR stale,
 * hands off to /client-demo/session which performs the demo login and injects
 * a fresh `sid` cookie before this page renders again. Only once a *valid*
 * session exists do we mount the kiosk, so the embedded HRMS dashboard appears
 * immediately and no login form is ever shown.
 */

const DEMO_USER = 'demo@meena.sa'

async function hasValidDemoSession(): Promise<boolean> {
  const sid = (await cookies()).get('sid')?.value
  if (!sid || sid === 'Guest') return false

  try {
    const host = (await headers()).get('host') || ''
    const forwardedProto = (await headers()).get('x-forwarded-proto')
    const proto =
      forwardedProto ||
      (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')

    const res = await fetch(`${proto}://${host}/api/method/frappe.auth.get_logged_user`, {
      headers: { Cookie: `sid=${sid}` },
      cache: 'no-store',
    })
    if (!res.ok) return false
    const data = await res.json().catch(() => null)
    return data?.message === DEMO_USER
  } catch {
    return false
  }
}

export default async function ClientDemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const valid = await hasValidDemoSession()
  if (!valid) {
    // `/client-demo/session` injects a fresh sid and comes back here. `cd_retry`
    // stops a failed refresh from looping and still renders the shell.
    const retried = (await searchParams).cd_retry
    if (!retried) redirect('/client-demo/session')
  }

  return <ClientDemoKiosk />
}
