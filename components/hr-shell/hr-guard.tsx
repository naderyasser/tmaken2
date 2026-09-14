'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'
import { LoginPage } from '@/components/login-page'
import { isHrDemoPath } from '@/lib/hr-demo'
import { PUBLIC_APP_NO_AUTH } from '@/lib/public-access'

/**
 * Access gate for the HR shell.
 * EXCEPTION: the public HR demo (bare `/hr` dashboard + every HR-shell surface the
 * sidebar links to) is open without login — the middleware also allows it
 * (see lib/hr-demo.ts). Any other route still requires auth.
 */
export function HrGuard({ requireHR = true, children }: { requireHR?: boolean; children: ReactNode }) {
  const { isAuthenticated, isLoading, isHRUser } = useAuth()
  const { isRTL } = useI18n()
  const router = useRouter()
  const pathname = usePathname() || ''

  // Public HR demo — no login wall
  const isPublicHr = isHrDemoPath(pathname)
  if (PUBLIC_APP_NO_AUTH || isPublicHr) return <>{children}</>

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return <LoginPage />

  if (requireHR && !isHRUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{isRTL ? 'غير مصرح' : 'Unauthorized'}</h2>
          <p className="text-muted-foreground mb-4">
            {isRTL ? 'ليس لديك صلاحية الوصول للموارد البشرية' : 'You do not have access to HR'}
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            {isRTL ? 'العودة للرئيسية' : 'Back to Home'}
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
