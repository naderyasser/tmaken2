'use client'

import React from "react"
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Calendar,
  Clock,
  FileText,
  DollarSign,
  Briefcase,
  Star,
  ChevronLeft,
  ChevronRight,
  Settings,
  LogOut,
  GraduationCap,
  CalendarDays,
  Car,
  Building,
  ArrowRightLeft,
  Sparkles,
  Search,
  MapPin,
  AlertTriangle,
  ClockIcon,
  Home,
  ClipboardCheck,
  Send,
  ShieldAlert,
  Megaphone,
  Fingerprint,
  GitBranch,
  Zap,
  FileSignature,
  ScrollText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'
import Image from 'next/image'
import Link from 'next/link'

export type ModuleType =
  | 'dashboard'
  | 'announcements'
  | 'requests'
  | 'discipline'
  | 'onboarding'
  | 'employees'
  | 'new-employee'
  | 'attendance'
  | 'attendance-report'
  | 'employee-report'
  | 'leaves'
  | 'salaries'
  | 'expenses'
  | 'shifts'
  | 'shift-management'
  | 'shift-calendar'
  | 'location-tracking'
  | 'radius-alerts'
  | 'leave-setup'
  | 'hr-settings'
  | 'settings'
  | 'team'
  | 'biometric'
  | 'branches'
  | 'auto-attendance'
  | 'custody'
  | 'contracts'
  | 'proposals'
  // ── New modules from the redesigned sidebar ──
  | 'jobs'
  | 'unregistered-employees'
  | 'projects'
  | 'tasks'
  | 'location-groups'
  | 'employee-groups'
  | 'nationality'
  | 'official-holidays'
  | 'leave-types'
  | 'add-leave'
  | 'add-permission'
  | 'cancel-transactions'
  | 'user-transactions'
  | 'ramadan-schedule'
  | 'attendance-settings'
  | 'requests-settings'
  | 'company-data'
  | 'subscription-info'
  | `report-${string}`
  | 'locations'

interface NavItem {
  labelKey: string
  id: ModuleType
  icon: React.ReactNode
  badge?: string
  href?: string
}

interface NavSection {
  titleKey: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    titleKey: '',
    items: [
      { labelKey: 'nav.dashboard', id: 'dashboard', icon: <LayoutDashboard className="h-[18px] w-[18px]" />, href: '/hr' },
      { labelKey: 'nav.announcements', id: 'announcements', icon: <Megaphone className="h-[18px] w-[18px]" />, href: '/hr?module=announcements' },
      { labelKey: 'nav.requests', id: 'requests', icon: <Send className="h-[18px] w-[18px]" />, href: '/hr?module=requests' },
      { labelKey: 'nav.discipline', id: 'discipline', icon: <ShieldAlert className="h-[18px] w-[18px]" />, href: '/hr?module=discipline' },
    ]
  },
  {
    titleKey: 'nav.employees',
    items: [
      { labelKey: 'nav.employees', id: 'employees', icon: <Users className="h-[18px] w-[18px]" />, href: '/employees' },
      { labelKey: 'nav.onboarding', id: 'onboarding', icon: <UserPlus className="h-[18px] w-[18px]" />, href: '/hr?module=onboarding' },
      { labelKey: 'nav.employee_report', id: 'employee-report', icon: <FileText className="h-[18px] w-[18px]" />, href: '/employee-report' },
      { labelKey: 'nav.contracts', id: 'contracts', icon: <FileSignature className="h-[18px] w-[18px]" />, href: '/hr?module=contracts' },
    ]
  },
  {
    // Attendance, Shifts and Leaves grouped under one collapsible menu.
    titleKey: 'nav.attendance_leave',
    items: [
      { labelKey: 'nav.attendance', id: 'attendance', icon: <Clock className="h-[18px] w-[18px]" />, href: '/attendance' },
      { labelKey: 'nav.attendance_report', id: 'attendance-report', icon: <FileText className="h-[18px] w-[18px]" />, href: '/hr?module=attendance-report' },
      {
        labelKey: 'nav.location_tracking',
        id: 'location-tracking',
        icon: <MapPin className="h-[18px] w-[18px]" />,
        href: '/hr?module=location-tracking',
      },
      {
        labelKey: 'nav.radius_alerts',
        id: 'radius-alerts',
        icon: <AlertTriangle className="h-[18px] w-[18px]" />,
        href: '/hr?module=radius-alerts',
      },
      {
        labelKey: 'nav.biometric',
        id: 'biometric',
        icon: <Fingerprint className="h-[18px] w-[18px]" />,
        href: '/biometric',
      },
      {
        labelKey: 'nav.branches',
        id: 'branches',
        icon: <GitBranch className="h-[18px] w-[18px]" />,
        href: '/branches',
      },
      {
        labelKey: 'nav.auto_attendance',
        id: 'auto-attendance',
        icon: <Zap className="h-[18px] w-[18px]" />,
        href: '/auto-attendance',
      },
      {
        // Canonical shift surface (the duplicate '/hr?module=shifts' entry was removed;
        // that path now redirects here).
        labelKey: 'nav.shift_management',
        id: 'shift-management',
        icon: <ClockIcon className="h-[18px] w-[18px]" />,
        href: '/shift-management'
      },
      { labelKey: 'nav.shift_calendar', id: 'shift-calendar', icon: <CalendarDays className="h-[18px] w-[18px]" />, href: '/hr?module=shift-calendar' },
      { labelKey: 'nav.leave_requests', id: 'leaves', icon: <Calendar className="h-[18px] w-[18px]" />, href: '/hr?module=leaves' },
      { labelKey: 'nav.leave_setup', id: 'leave-setup', icon: <CalendarDays className="h-[18px] w-[18px]" />, href: '/hr?module=leave-setup' },
    ]
  },
  {
    titleKey: 'nav.payroll',
    items: [
      { labelKey: 'nav.payroll', id: 'salaries', icon: <DollarSign className="h-[18px] w-[18px]" />, href: '/payroll' },
      { labelKey: 'nav.expenses', id: 'expenses', icon: <FileText className="h-[18px] w-[18px]" />, href: '/hr?module=expenses' },
    ]
  },
  {
    titleKey: 'nav.team',
    items: [
      { labelKey: 'nav.hr_team', id: 'team', icon: <Users className="h-[18px] w-[18px]" />, href: '/hr?module=team' },
    ]
  },
  {
    titleKey: 'nav.inventory',
    items: [
      { labelKey: 'nav.custody', id: 'custody', icon: <ClipboardCheck className="h-[18px] w-[18px]" />, href: '/hr?module=custody' },
    ]
  },
]

interface SidebarProps {
  activeModule: ModuleType
  onModuleChange: (module: ModuleType) => void
  isExpanded: boolean
  onToggle: () => void
  onLogout?: () => void
}

export function Sidebar({ activeModule, onModuleChange, isExpanded, onToggle, onLogout }: SidebarProps) {
  const { t, isRTL } = useI18n()

  return (
    <aside className={cn(
      'h-[calc(100vh-4rem)] bg-white border-gray-200/80 transition-all duration-300 ease-in-out flex flex-col relative group/sidebar',
      isRTL ? 'border-l' : 'border-r',
      isExpanded ? 'w-[240px]' : 'w-[68px]'
    )}>
      {/* Collapse toggle — floating pill on edge */}
      <button
        onClick={onToggle}
        aria-label={isExpanded ? 'طي القائمة الجانبية' : 'توسيع القائمة الجانبية'}
        className={cn(
          'absolute top-6 z-10 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:shadow-md hover:bg-gray-50 transition-all opacity-0 group-hover/sidebar:opacity-100',
          isRTL ? '-left-3' : '-right-3'
        )}
      >
        {isExpanded
          ? (isRTL ? <ChevronRight className="h-3 w-3 text-gray-500" /> : <ChevronLeft className="h-3 w-3 text-gray-500" />)
          : (isRTL ? <ChevronLeft className="h-3 w-3 text-gray-500" /> : <ChevronRight className="h-3 w-3 text-gray-500" />)
        }
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5 scrollbar-thin">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className={cn(sIdx > 0 && "mt-4")}>
            {/* Section title */}
            {section.titleKey && isExpanded && (
              <p className={cn(
                "text-[10px] font-semibold text-gray-400 uppercase tracking-[0.08em] px-3 mb-1.5",
                isRTL && "text-right"
              )}>
                {t(section.titleKey)}
              </p>
            )}
            {section.titleKey && !isExpanded && (
              <div className="h-px bg-gray-100 mx-2 my-2" />
            )}
            {/* Items */}
            {section.items.map((item) => {
              const isActive = activeModule === item.id
              const label = item.labelKey.startsWith('nav.') ? t(item.labelKey) : item.labelKey

              // If item has href, use Link component
              if (item.href) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={!isExpanded ? label : undefined}
                    className={cn(
                      'w-full flex items-center gap-3 rounded-lg transition-all duration-150 relative group/item',
                      isExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center',
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                    )}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className={cn(
                        "absolute top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-600",
                        isRTL ? "right-0 rounded-l-full" : "left-0 rounded-r-full"
                      )} />
                    )}
                    <span className={cn(
                      'flex-shrink-0 transition-transform duration-150',
                      isActive && 'scale-110'
                    )}>
                      {item.icon}
                    </span>
                    {isExpanded && (
                      <>
                        <span className={cn(
                          'text-[13px] truncate',
                          isActive ? 'font-semibold' : 'font-medium'
                        )}>
                          {label}
                        </span>
                      </>
                    )}
                    {/* Badge */}
                    {item.badge && isExpanded && (
                      <span className={cn(
                        "text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none font-medium",
                        isRTL ? "mr-auto" : "ml-auto"
                      )}>
                        {item.badge}
                      </span>
                    )}
                    {/* Tooltip for collapsed */}
                    {!isExpanded && (
                      <div className={cn(
                        "absolute px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-lg z-50",
                        isRTL ? "right-full mr-2" : "left-full ml-2"
                      )}>
                        {label}
                        <div className={cn(
                          "absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45 rounded-sm",
                          isRTL ? "right-0 translate-x-1" : "left-0 -translate-x-1"
                        )} />
                      </div>
                    )}
                  </Link>
                )
              }

              // Regular button for old items
              return (
                <button
                  key={item.id}
                  onClick={() => onModuleChange(item.id)}
                  title={!isExpanded ? label : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-lg transition-all duration-150 relative group/item',
                    isExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center',
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                  )}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div className={cn(
                      "absolute top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-600",
                      isRTL ? "right-0 rounded-l-full" : "left-0 rounded-r-full"
                    )} />
                  )}
                  <span className={cn(
                    'flex-shrink-0 transition-transform duration-150',
                    isActive && 'scale-110'
                  )}>
                    {item.icon}
                  </span>
                  {isExpanded && (
                    <span className={cn(
                      'text-[13px] truncate',
                      isActive ? 'font-semibold' : 'font-medium'
                    )}>
                      {label}
                    </span>
                  )}
                  {/* Badge */}
                  {item.badge && isExpanded && (
                    <span className={cn(
                      "text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none font-medium",
                      isRTL ? "mr-auto" : "ml-auto"
                    )}>
                      {item.badge}
                    </span>
                  )}
                  {/* Tooltip for collapsed */}
                  {!isExpanded && (
                    <div className={cn(
                      "absolute px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-lg z-50",
                      isRTL ? "right-full mr-2" : "left-full ml-2"
                    )}>
                      {label}
                      <div className={cn(
                        "absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45 rounded-sm",
                        isRTL ? "right-0 translate-x-1" : "left-0 -translate-x-1"
                      )} />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-100 p-2 space-y-0.5">
        <Link
          href="/"
          title={!isExpanded ? (t('guard.back_home')) : undefined}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg transition-all duration-150 relative group/item',
            isExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center',
            'text-blue-600 hover:bg-blue-50 hover:text-blue-700'
          )}
        >
          <Home className="h-[18px] w-[18px] flex-shrink-0" />
          {isExpanded && <span className="text-[13px] font-medium">{t('guard.back_home')}</span>}
          {!isExpanded && (
            <div className={cn(
              "absolute px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-lg z-50",
              isRTL ? "right-full mr-2" : "left-full ml-2"
            )}>
              {t('guard.back_home')}
              <div className={cn(
                "absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45 rounded-sm",
                isRTL ? "right-0 translate-x-1" : "left-0 -translate-x-1"
              )} />
            </div>
          )}
        </Link>

        <Link
          href="/hr?module=settings"
          title={!isExpanded ? t('nav.settings') : undefined}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg transition-all duration-150 relative group/item',
            isExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center',
            activeModule === 'settings'
              ? 'bg-blue-50 text-blue-700'
              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
          )}
        >
          {activeModule === 'settings' && (
            <div className={cn(
              "absolute top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-600",
              isRTL ? "right-0 rounded-l-full" : "left-0 rounded-r-full"
            )} />
          )}
          <Settings className="h-[18px] w-[18px] flex-shrink-0" />
          {isExpanded && <span className="text-[13px] font-medium">{t('nav.settings')}</span>}
          {!isExpanded && (
            <div className={cn(
              "absolute px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-lg z-50",
              isRTL ? "right-full mr-2" : "left-full ml-2"
            )}>
              {t('nav.settings')}
              <div className={cn(
                "absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45 rounded-sm",
                isRTL ? "right-0 translate-x-1" : "left-0 -translate-x-1"
              )} />
            </div>
          )}
        </Link>

        <button
          onClick={onLogout}
          title={!isExpanded ? t('nav.logout') : undefined}
          aria-label={t('nav.logout')}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg transition-all duration-150 text-gray-500 hover:bg-red-50 hover:text-red-600 group/item relative',
            isExpanded ? 'px-3 py-2' : 'px-0 py-2 justify-center',
          )}
          id="sidebar-logout-btn"
        >
          <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
          {isExpanded && <span className="text-[13px] font-medium">{t('nav.logout')}</span>}
          {!isExpanded && (
            <div className={cn(
              "absolute px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity shadow-lg z-50",
              isRTL ? "right-full mr-2" : "left-full ml-2"
            )}>
              {t('nav.logout')}
              <div className={cn(
                "absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45 rounded-sm",
                isRTL ? "right-0 translate-x-1" : "left-0 -translate-x-1"
              )} />
            </div>
          )}
        </button>
      </div>
    </aside>
  )
}
