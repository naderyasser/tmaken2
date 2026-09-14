'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  LogOut, Home, LayoutDashboard, Users, Clock, Settings,
  Briefcase, Building2, UserX, FolderKanban, CheckSquare,
  MapPin, UsersRound, Globe, CalendarDays, Umbrella,
  Plus, Mail, Activity, RotateCcw, Send, BarChart3,
  ShieldCheck, Moon, SlidersHorizontal, Cpu, Building, CreditCard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { useBrand } from '@/hooks/use-brand'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { RAIL_SECTIONS, BOTTOM_ITEMS, FINGERPRINT_RAIL_ITEM_IDS } from './routes'

// Per-item icon map — same as icon-rail.tsx so both drawers look identical
const ITEM_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'dashboard-main': LayoutDashboard,
  'employees': Users,
  'jobs': Briefcase,
  'branches': Building2,
  'shift-management': Clock,
  'unregistered-employees': UserX,
  'projects': FolderKanban,
  'tasks': CheckSquare,
  'location-groups': MapPin,
  'employee-groups': UsersRound,
  'nationality': Globe,
  'official-holidays': CalendarDays,
  'leave-types': Umbrella,
  'add-leave': Plus,
  'add-permission': Mail,
  'attendance-transactions': Activity,
  'cancel-transactions': RotateCcw,
  'requests': Send,
  'attendance-reports': BarChart3,
  'company-users': Users,
  'permissions': ShieldCheck,
  'user-transactions': Activity,
  'ramadan-schedule': Moon,
  'attendance-settings': SlidersHorizontal,
  'locations': MapPin,
  'devices': Cpu,
  'general-settings': Settings,
  'requests-settings': Mail,
  'company-data': Building,
  'subscription-info': CreditCard,
}

/**
 * Mobile navigation drawer — identical look to the desktop IconRail.
 * White background, flat sections, gray labels, blue active state.
 * Opens from the right edge in RTL.
 */
export function MobileNav({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t, isRTL } = useI18n()
  const { logout, myEmployee, hrFingerprintOnly } = useAuth()
  const brand = useBrand()
  const pathname = usePathname() || ''
  const searchParams = useSearchParams()
  const moduleParam = searchParams.get('module')
  const close = () => onOpenChange(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRTL ? 'right' : 'left'}
        className="w-[260px] sm:max-w-[260px] p-0 flex flex-col bg-white text-gray-800 border-l border-gray-200"
        dir="rtl"
      >
        {/* Header */}
        <SheetHeader className="h-14 px-4 flex-row items-center gap-2.5 border-b border-gray-200 text-start shrink-0">
          <Image
            src={brand.logo || '/logo.jpeg'}
            alt={brand.appName || 'Tamkeen'}
            width={32}
            height={32}
            className="rounded-lg object-cover shrink-0"
          />
          <div className="leading-tight">
            <SheetTitle className="text-base font-bold text-gray-900">
              {brand.appName || t(hrFingerprintOnly ? 'app.attendance_name' : 'app.name')}
            </SheetTitle>
            <p className="text-[10px] text-gray-400">
              {brand.tagline || t(hrFingerprintOnly ? 'app.attendance_subtitle' : 'app.subtitle')}
            </p>
          </div>
        </SheetHeader>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2">

          {/* Dashboard single item */}
          {(() => {
            const dashSection = RAIL_SECTIONS.find((s) => s.id === 'dashboard')
            const dashItem = dashSection?.items[0]
            if (!dashItem) return null
            const active = dashItem.match(pathname, moduleParam)
            return (
              <div className="mb-2">
                <Link
                  href={dashItem.href}
                  onClick={close}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-2.5 text-[14px] font-bold transition-colors w-full',
                    active ? 'bg-[#1b5b9f] text-white' : 'text-gray-700 hover:bg-blue-50 hover:text-[#1b5b9f]'
                  )}
                >
                  <LayoutDashboard className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-[#1b5b9f]')} />
                  <span>{t('nav.dashboard_section')}</span>
                </Link>
              </div>
            )
          })()}

          {/* Sections */}
          {RAIL_SECTIONS
            .filter((s) => s.id !== 'dashboard')
            .map((section) => {
              const items = section.items.filter((i) =>
                (myEmployee || !i.requiresEmployee) &&
                (!hrFingerprintOnly || FINGERPRINT_RAIL_ITEM_IDS.has(i.id))
              )
              if (items.length === 0) return null
              return (
                <div key={section.id} className="mb-1">
                  {/* Section label */}
                  <p className="px-4 pt-3 pb-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    {t(section.labelKey)}
                  </p>
                  {/* Items */}
                  {items.map((item) => {
                    const active = item.match(pathname, moduleParam)
                    const Icon = ITEM_ICONS[item.id] || LayoutDashboard
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={close}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-4 py-2 text-[13.5px] font-medium transition-colors w-full mb-0.5',
                          active
                            ? 'bg-[#1b5b9f] text-white'
                            : 'text-gray-700 hover:bg-blue-50 hover:text-[#1b5b9f]'
                        )}
                      >
                        <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-white' : 'text-[#1b5b9f]')} />
                        <span>{t(item.labelKey)}</span>
                      </Link>
                    )
                  })}
                </div>
              )
            })}
        </nav>

        {/* Bottom */}
        <div className="border-t border-gray-200 px-3 py-3 shrink-0 space-y-1">
          {!hrFingerprintOnly && (
            <Link
              href="/"
              onClick={close}
              className="flex items-center gap-3 rounded-lg px-4 py-2 text-[13.5px] font-medium text-gray-700 hover:bg-blue-50 hover:text-[#1b5b9f] transition-colors w-full"
            >
              <Home className="h-4 w-4 shrink-0 text-[#1b5b9f]" />
              <span>{t('guard.back_home')}</span>
            </Link>
          )}
          <button
            onClick={() => { close(); logout() }}
            className="flex items-center gap-3 rounded-lg px-4 py-2 text-[13.5px] font-medium bg-[#1b5b9f] text-white hover:bg-[#154d8a] transition-colors w-full"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>{t('nav.logout')}</span>
          </button>
          <div className="px-2 pt-1 text-[10px] text-gray-400 text-center">
            Powered By Taif Alalmas v1.0.11
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
