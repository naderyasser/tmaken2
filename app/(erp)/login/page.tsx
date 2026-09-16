import { redirect } from 'next/navigation'
import { HOME_PATH } from '@/lib/public-access'

// No login screen in this build (see lib/public-access.ts): old bookmarks and
// deep links to /login land on the HR dashboard; the middleware opens the session.
export default function LoginRoute() {
  redirect(HOME_PATH)
}
