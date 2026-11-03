import { cookies, headers } from 'next/headers'

/**
 * Server-side helper to verify that the current request
 * belongs to an authenticated HR Manager user.
 *
 * Use in API routes:
 *   const auth = await verifyHRManager()
 *   if (!auth.authenticated) return NextResponse.json({ error: auth.error }, { status: 403 })
 */
export async function verifyHRManager(): Promise<{
  authenticated: boolean
  user?: string
  error?: string
}> {
  try {
    const cookieStore = await cookies()
    const headerStore = await headers()
    const sid = cookieStore.get('sid')

    if (!sid || sid.value === 'Guest') {
      return { authenticated: false, error: 'Not authenticated' }
    }

    // Use env var when available (required in dev where host ≠ backend)
    const host = headerStore.get('host') || headerStore.get('x-forwarded-host')
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const FRAPPE_URL = process.env.NEXT_PUBLIC_FRAPPE_URL || (host ? `${protocol}://${host}` : `${protocol}://localhost`)

    // Verify the session is valid in Frappe
    const userRes = await fetch(
      `${FRAPPE_URL}/api/method/frappe.auth.get_logged_user`,
      {
        headers: { Cookie: `sid=${sid.value}` },
      }
    )

    if (!userRes.ok) {
      return { authenticated: false, error: 'Invalid session' }
    }

    const userData = await userRes.json()
    const user = userData.message

    if (user === 'Guest') {
      return { authenticated: false, error: 'Guest user' }
    }

    // Verify user has HR Manager role
    const rolesRes = await fetch(
      `${FRAPPE_URL}/api/method/frappe.core.doctype.user.user.get_roles?uid=${encodeURIComponent(user)}`,
      {
        headers: { Cookie: `sid=${sid.value}` },
      }
    )

    if (!rolesRes.ok) {
      return { authenticated: false, error: 'Failed to get roles' }
    }

    const rolesData = await rolesRes.json()
    const roles: string[] = rolesData.message || []

    if (!roles.includes('HR Manager')) {
      return { authenticated: false, error: 'Not HR Manager' }
    }

    return { authenticated: true, user }
  } catch {
    return { authenticated: false, error: 'Server error' }
  }
}
