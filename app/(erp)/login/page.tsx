import { headers } from 'next/headers'
import { getClientConfig, getCurrentDomain } from '@/lib/client-config'
import { LoginPage as BaseMeenaLogin } from '@/components/login-page'

// Branding is resolved per-host on the server (pre-auth, no guest API): read the
// request Host header and look up clients.json (written by the operator-gated
// tenant_manager branding endpoints). Reads headers -> force dynamic rendering.
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const h = await headers()
  const host = getCurrentDomain(h)
  const cfg = getClientConfig(host)
  const branding = {
    appName: cfg?.branding?.appName || 'تمكين',
    logo: cfg?.branding?.logo || '/logo.jpeg',
    host,
    theme: cfg?.branding?.theme || '',
  }

  // The already-authenticated redirect + loading gate now live inside the (client)
  // LoginPage component so this route can stay a server component for branding.
  return <BaseMeenaLogin branding={branding} />
}
