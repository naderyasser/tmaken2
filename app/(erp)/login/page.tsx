import { Suspense } from 'react'
import { RealLoginForm } from '@/components/hr-shell/real-login-form'

// The one real login screen in this build (see lib/public-access.ts and
// components/hr-shell/real-login-form.tsx) — everywhere else still opens the
// walkthrough session automatically. This route exists so a real account
// (e.g. `admin`, created for client handover) can actually sign in.
export default function LoginRoute() {
  return (
    <Suspense fallback={null}>
      <RealLoginForm />
    </Suspense>
  )
}
