'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { useBrand } from '@/hooks/use-brand'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { RAIL_SECTIONS, BOTTOM_ITEMS, FINGERPRINT_RAIL_ITEM_IDS } from './routes'

/**
 * Mobile navigation drawer (<lg). Opens from the inline-START edge (where the
 * hamburger sits): side 'left' in LTR, 'right' in RTL. Full labeled sections.
 * Reads `?module=` → render inside a Suspense boundary (the shell provides one).
 */
export function MobileNav({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, isRTL } = useI18n()
  const { logout, myEmployee, hrFingerprintOnly } = useAuth()
  const brand = useBrand()  // same per-tenant lockup as the desktop topbar
  // Fingerprint-only plan: trim the mobile menu to the same biometric/attendance
  // bundle as the desktop rail. No-op unless the hr_fingerprint_only flag is set;
  // every other module the tenant has stays untouched.
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const moduleParam = searchParams.get('module')
  const close = () => onOpenChange(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isRTL ? 'right' : 'left'} className="w-[280px] sm:max-w-[280px] p-0 flex flex-col bg-sidebar text-sidebar-foreground">
        <SheetHeader className="h-14 px-4 flex-row items-center gap-2.5 border-b border-border text-start">
          <Image src={brand.logo || '/logo.jpeg'} alt={brand.appName || 'Tamkeen'} width={32} height={32} className="rounded-lg object-cover flex-shrink-0" />
          <div className="leading-tight">
            <SheetTitle className="text-base font-bold text-foreground">{brand.appName || t(hrFingerprintOnly ? 'app.attendance_name' : 'app.name')}</SheetTitle>
            <p className="text-[10px] text-muted-foreground">{brand.tagline || t(hrFingerprintOnly ? 'app.attendance_subtitle' : 'app.subtitle')}</p>
          </div>
        </SheetHeader>
        <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin space-y-1">
          {RAIL_SECTIONS.map((section) => {
            // Drop items that need a linked Employee (e.g. My Profile) for users
            // without one — same dead-end gate as the desktop rail (Ticket 1).
            // On a fingerprint-only tenant, additionally keep only the bundle items.
            const items = section.items.filter((i) =>
              (myEmployee || !i.requiresEmployee) && (!hrFingerprintOnly || FINGERPRINT_RAIL_ITEM_IDS.has(i.id)))
            if (items.length === 0) return null
            return (
            <div key={section.id} className="pt-2 first:pt-0">
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t(section.labelKey)}</p>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = item.match(pathname, moduleParam)
                  const ItemIcon = item.icon
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={close}
                      className={cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
                        active ? 'bg-accent text-primary font-semibold' : 'text-sidebar-foreground/80 hover:bg-accent/60 hover:text-foreground font-medium',
                      )}
                    >
                      {ItemIcon && <ItemIcon className={cn('h-4 w-4 flex-shrink-0', active ? 'text-primary' : 'text-muted-foreground/70')} />}
                      {t(item.labelKey)}
                    </Link>
                  )
                })}
              </div>
            </div>
            )
          })}
        </nav>
        <div className="border-t border-border p-2 space-y-0.5">
          {/* Attendance-only package hides Settings + "Back to hub" (out of bundle). */}
          {(hrFingerprintOnly ? [] : BOTTOM_ITEMS).map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={close}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
              >
                <Icon className="h-[18px] w-[18px]" />{t(item.labelKey)}
              </Link>
            )
          })}
          <button
            onClick={() => { close(); logout() }}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="h-[18px] w-[18px]" />{t('nav.logout')}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
