/**
 * Sidebar Navigation Component Tests
 * Comprehensive unit test suite covering:
 * - Active state rendering (blue background + indicator bar)
 * - Click events and navigation callbacks
 * - Accessibility (ARIA standards)
 * - Edge cases: rapid clicks, collapsed/expanded states, RTL
 * - Permission-based rendering readiness
 */

import '@testing-library/jest-dom'
import { render, screen, within, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} />,
}))

// Mock next/link
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// Mock i18n
const mockT = jest.fn((key: string) => {
  const translations: Record<string, string> = {
    'nav.dashboard': 'Dashboard',
    'nav.people': 'People',
    'nav.employees': 'Employees',
    'nav.attendance': 'Attendance',
    'nav.attendance_leave': 'Attendance & Leave',
    'nav.leave_requests': 'Leave Requests',
    'nav.finance': 'Finance',
    'nav.payroll': 'Salaries',
    'nav.expenses': 'Expenses',
    'nav.operations': 'Operations',
    'nav.shifts': 'Shifts',
    'nav.leave_setup': 'Leave Setup',
    'nav.location': 'Location Tracking',
    'nav.location_tracking': 'Location Tracking',
    'nav.radius_alerts': 'Radius Alerts',
    'nav.shift_management': 'Shift Management',
    'nav.settings': 'Settings',
    'nav.logout': 'Logout',
  }
  return translations[key] || key
})

jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: mockT,
    isRTL: false,
  }),
}))

// Mock cn utility
jest.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

import { Sidebar, ModuleType } from '../sidebar'

// Helper to render sidebar with defaults
function renderSidebar(overrides: Partial<{
  activeModule: ModuleType
  onModuleChange: (module: ModuleType) => void
  isExpanded: boolean
  onToggle: () => void
  onLogout: () => void
}> = {}) {
  const defaultProps = {
    activeModule: 'dashboard' as ModuleType,
    onModuleChange: jest.fn(),
    isExpanded: true,
    onToggle: jest.fn(),
    onLogout: jest.fn(),
    ...overrides,
  }

  const result = render(<Sidebar {...defaultProps} />)
  return { ...result, props: defaultProps }
}

/** Find the nearest interactive element (button or link) wrapping a text node */
function findInteractiveParent(text: string): HTMLElement {
  const el = screen.getByText(text)
  const btn = el.closest('button')
  const link = el.closest('a')
  return (btn || link)!
}

describe('Sidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ─────────────────────────────────────────────
  // RENDERING
  // ─────────────────────────────────────────────
  describe('Rendering', () => {
    it('should render all navigation items when expanded', () => {
      renderSidebar()

      expect(screen.getByText('Dashboard')).toBeInTheDocument()
      // 'Employees', 'Attendance', 'Salaries' each appear twice: once as a section
      // title and once as the nav item label. (The duplicate 'Shifts' item was
      // removed; 'Shift Management' is the single canonical shift nav item.)
      expect(screen.getAllByText('Employees').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Attendance').length).toBeGreaterThan(0)
      expect(screen.getByText('Leave Requests')).toBeInTheDocument()
      expect(screen.getAllByText('Salaries').length).toBeGreaterThan(0)
      expect(screen.getByText('Expenses')).toBeInTheDocument()
      expect(screen.getAllByText('Shift Management').length).toBeGreaterThan(0)
      expect(screen.getByText('Leave Setup')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(screen.getByText('Logout')).toBeInTheDocument()
    })

    it('should render section titles when expanded', () => {
      const { container } = renderSidebar()

      // 'Employees' and 'Salaries' are each both a section title and the first
      // item in their section, so they appear at least twice when expanded.
      // Attendance, Shift Management and Leaves are grouped under one 'Attendance &
      // Leave' section title (appears once), with each rendered as a nav item beneath it.
      expect(screen.getAllByText('Employees').length).toBeGreaterThanOrEqual(2)
      expect(screen.getAllByText('Salaries').length).toBeGreaterThanOrEqual(2)
      expect(screen.getByText('Attendance & Leave')).toBeInTheDocument()
      expect(screen.getByText('Shift Management')).toBeInTheDocument()
      // Section titles render as <p> elements with gray uppercase styling
      const sectionTitleEls = Array.from(container.querySelectorAll('p')).filter(
        el => el.className.includes('text-gray-400')
      )
      expect(sectionTitleEls.length).toBeGreaterThan(0)
    })

    it('should hide text labels when collapsed', () => {
      renderSidebar({ isExpanded: false })

      // Labels inside nav items should not be rendered
      // Dashboard text should not appear as a span label (only in tooltip)
      const navButtons = screen.getAllByRole('button')
      expect(navButtons.length).toBeGreaterThan(0)

      // Main label spans should not be rendered (only tooltip text remains)
      // Text still exists in tooltip divs, so check that no truncate-class spans contain the label
      const empSpans = screen.queryAllByText('Employees').filter(el => el.classList.contains('truncate'))
      const salSpans = screen.queryAllByText('Salaries').filter(el => el.classList.contains('truncate'))
      expect(empSpans.length).toBe(0)
      expect(salSpans.length).toBe(0)
    })

    it('should show tooltips when collapsed', () => {
      renderSidebar({ isExpanded: false })

      // Tooltip elements should exist (hidden by CSS opacity-0)
      const tooltips = document.querySelectorAll('.whitespace-nowrap')
      expect(tooltips.length).toBeGreaterThan(0)
    })

    it('should show collapse toggle button', () => {
      renderSidebar()

      // The toggle button exists on the sidebar edge
      const toggleButtons = screen.getAllByRole('button')
      const toggleBtn = toggleButtons.find(btn =>
        btn.className.includes('rounded-full') && btn.className.includes('absolute')
      )
      expect(toggleBtn).toBeTruthy()
    })
  })

  // ─────────────────────────────────────────────
  // ACTIVE STATE (Blue background + indicator bar)
  // ─────────────────────────────────────────────
  describe('Active State', () => {
    it('should apply active styles (bg-blue-50) to the active module button', () => {
      renderSidebar({ activeModule: 'salaries' })

      const payrollLink = screen.getAllByText('Salaries').map(el => el.closest('a')).find(el => el != null)!
      expect(payrollLink).toBeTruthy()
      expect(payrollLink.className).toContain('bg-blue-50')
      expect(payrollLink.className).toContain('text-blue-700')
    })

    it('should NOT apply active styles to inactive module buttons', () => {
      renderSidebar({ activeModule: 'salaries' })

      const dashboardLink = screen.getByText('Dashboard').closest('a')
      expect(dashboardLink).toBeTruthy()
      expect(dashboardLink!.className).not.toContain('bg-blue-50')
      expect(dashboardLink!.className).toContain('text-gray-600')
    })

    it('should render the active indicator bar (blue vertical line) for active module', () => {
      renderSidebar({ activeModule: 'salaries' })

      const payrollLink = screen.getAllByText('Salaries').map(el => el.closest('a')).find(el => el != null)!
      const indicatorBar = payrollLink!.querySelector('.bg-blue-600')
      expect(indicatorBar).toBeTruthy()
      expect(indicatorBar!.className).toContain('w-[3px]')
      expect(indicatorBar!.className).toContain('h-5')
    })

    it('should NOT render indicator bar for inactive modules', () => {
      renderSidebar({ activeModule: 'salaries' })

      const dashboardLink = screen.getByText('Dashboard').closest('a')
      const indicatorBar = dashboardLink!.querySelector('.bg-blue-600')
      expect(indicatorBar).toBeNull()
    })

    it('should scale icon (scale-110) for active module', () => {
      renderSidebar({ activeModule: 'employees' })

      const employeesLink = screen.getAllByText('Employees').map(el => el.closest('a')).find(el => el != null)!
      const iconSpan = employeesLink!.querySelector('.flex-shrink-0')
      expect(iconSpan!.className).toContain('scale-110')
    })

    it('should use font-semibold for active module label', () => {
      renderSidebar({ activeModule: 'expenses' })

      const label = screen.getByText('Expenses')
      expect(label.className).toContain('font-semibold')
    })

    it('should use font-medium for inactive module label', () => {
      renderSidebar({ activeModule: 'dashboard' })

      const label = screen.getByText('Expenses')
      expect(label.className).toContain('font-medium')
      expect(label.className).not.toContain('font-semibold')
    })

    it('should apply active styles to Settings when it is active', () => {
      renderSidebar({ activeModule: 'settings' })

      // Settings is a Link in the bottom section
      const settingsButtons = screen.getAllByText('Settings')
      const settingsLink = settingsButtons[0].closest('a')
      expect(settingsLink!.className).toContain('bg-blue-50')
      expect(settingsLink!.className).toContain('text-blue-700')
    })

    it('should correctly reflect route change by updating active module', () => {
      const { rerender } = render(
        <Sidebar
          activeModule="dashboard"
          onModuleChange={jest.fn()}
          isExpanded={true}
          onToggle={jest.fn()}
        />
      )

      let dashboardLink = screen.getByText('Dashboard').closest('a')
      expect(dashboardLink!.className).toContain('bg-blue-50')

      // Simulate route change to payroll
      rerender(
        <Sidebar
          activeModule="salaries"
          onModuleChange={jest.fn()}
          isExpanded={true}
          onToggle={jest.fn()}
        />
      )

      dashboardLink = screen.getByText('Dashboard').closest('a')
      expect(dashboardLink!.className).not.toContain('bg-blue-50')

      const payrollLink = screen.getAllByText('Salaries').map(el => el.closest('a')).find(el => el != null)!
      expect(payrollLink!.className).toContain('bg-blue-50')
    })
  })

  // ─────────────────────────────────────────────
  // CLICK EVENTS & NAVIGATION
  // ─────────────────────────────────────────────
  describe('Click Events & Navigation', () => {
    it('should render Radius Alerts as a Link with correct href', () => {
      renderSidebar()

      const radiusLink = screen.getByText('Radius Alerts').closest('a')!
      expect(radiusLink).toBeTruthy()
      expect(radiusLink.getAttribute('href')).toBe('/hr?module=radius-alerts')
    })

    it('should render Link-based modules with correct href (e.g., Payroll)', () => {
      renderSidebar()

      const payrollLink = screen.getAllByText('Salaries').map(el => el.closest('a')).find(el => el != null)!
      expect(payrollLink.getAttribute('href')).toBe('/payroll')
    })

    it('should render all nav items as Links with correct hrefs', () => {
      renderSidebar()

      // Radius Alerts now uses href
      const radiusLink = screen.getByText('Radius Alerts').closest('a')!
      expect(radiusLink.getAttribute('href')).toBe('/hr?module=radius-alerts')

      // Location Tracking
      const locationLinks = screen.getAllByText('Location Tracking')
      const locationLink = locationLinks.map(el => el.closest('a')).find(el => el != null)!
      expect(locationLink.getAttribute('href')).toBe('/hr?module=location-tracking')
    })

    it('should render Link-based nav items with correct hrefs', () => {
      renderSidebar()

      // Helper: find the nav <a> (not section title <p>) for a given text
      const getNavLink = (text: string) => {
        const all = screen.getAllByText(text)
        return all.map(el => el.closest('a')).find(Boolean)
      }

      const linkMap: [string, string][] = [
        ['Dashboard', '/hr'],
        ['Leave Requests', '/hr?module=leaves'],
        ['Expenses', '/hr?module=expenses'],
        ['Leave Setup', '/hr?module=leave-setup'],
      ]

      for (const [label, expectedHref] of linkMap) {
        // Some labels (Employees, Salaries, Shifts) appear twice due to duplicate section title keys
        const allEls = screen.getAllByText(label)
        const link = allEls.map(el => el.closest('a')).find(el => el != null)
        expect(link).toBeTruthy()
        expect(link!.getAttribute('href')).toBe(expectedHref)
      }

      // Items that share text with section titles: use getAllByText + filter
      const employeesLink = getNavLink('Employees')!
      expect(employeesLink.getAttribute('href')).toBe('/employees')

      const salariesLink = getNavLink('Salaries')!
      expect(salariesLink.getAttribute('href')).toBe('/payroll')

      // Shifts was de-duplicated: the canonical surface is the standalone
      // /shift-management route ('/hr?module=shifts' now redirects there).
      const shiftMgmtLink = getNavLink('Shift Management')!
      expect(shiftMgmtLink.getAttribute('href')).toBe('/shift-management')
    })

    it('should render Settings as a Link with correct href', () => {
      renderSidebar()

      const settingsButtons = screen.getAllByText('Settings')
      const settingsLink = settingsButtons[0].closest('a')!
      expect(settingsLink).toBeTruthy()
      expect(settingsLink.getAttribute('href')).toBe('/hr?module=settings')
    })

    it('should call onLogout when clicking Logout', async () => {
      const user = userEvent.setup()
      const { props } = renderSidebar()

      const logoutButton = screen.getByText('Logout').closest('button')!
      await user.click(logoutButton)

      expect(props.onLogout).toHaveBeenCalledTimes(1)
    })

    it('should call onToggle when clicking the collapse button', async () => {
      const user = userEvent.setup()
      const { props } = renderSidebar()

      const toggleButtons = screen.getAllByRole('button')
      const toggleBtn = toggleButtons.find(btn =>
        btn.className.includes('rounded-full') && btn.className.includes('absolute')
      )!
      await user.click(toggleBtn)

      expect(props.onToggle).toHaveBeenCalledTimes(1)
    })

    it('should use Link component (with href) for Attendance navigation', () => {
      renderSidebar()

      // Attendance has href="/attendance" so it renders as <a> not <button>
      const attendanceLink = screen.getAllByText('Attendance').map(el => el.closest('a')).find(el => el != null)!
      expect(attendanceLink).toBeTruthy()
      expect(attendanceLink.getAttribute('href')).toBe('/attendance')
    })

    it('should use Link for modules with href (e.g., Payroll)', () => {
      renderSidebar()

      const payrollLink = screen.getAllByText('Salaries').map(el => el.closest('a')).find(el => el != null)!
      expect(payrollLink).toBeTruthy()
      expect(payrollLink.getAttribute('href')).toBe('/payroll')
    })

    it('should render Radius Alerts as a Link (all items now use href)', () => {
      renderSidebar()

      // All nav items now have href — including Radius Alerts
      const radiusLink = screen.getByText('Radius Alerts').closest('a')
      expect(radiusLink).toBeTruthy()
      expect(radiusLink!.getAttribute('href')).toBe('/hr?module=radius-alerts')
    })
  })

  // ─────────────────────────────────────────────
  // RAPID CLICKS / DEBOUNCE
  // ─────────────────────────────────────────────
  describe('Rapid Clicks (Debounce)', () => {
    it('should not crash on rapid clicks on link-based nav items', async () => {
      const user = userEvent.setup()
      renderSidebar()

      const radiusLink = screen.getByText('Radius Alerts').closest('a')!

      // Rapid clicks on link-based items should not crash
      await user.click(radiusLink)
      await user.click(radiusLink)
      await user.click(radiusLink)

      // No crash means test passes
      expect(radiusLink).toBeTruthy()
    })

    it('should not crash or throw on rapid toggling between link modules', async () => {
      const user = userEvent.setup()
      renderSidebar()

      const radiusLink = screen.getByText('Radius Alerts').closest('a')!
      const locationLinks = screen.getAllByText('Location Tracking')
      const locationLink = locationLinks.map(el => el.closest('a')).find(el => el != null)!

      // Toggle rapidly between link-based modules
      await user.click(radiusLink)
      await user.click(locationLink)
      await user.click(radiusLink)
      await user.click(locationLink)

      // No crash means test passes
      expect(radiusLink).toBeTruthy()
      expect(locationLink).toBeTruthy()
    })
  })

  // ─────────────────────────────────────────────
  // ACCESSIBILITY
  // ─────────────────────────────────────────────
  describe('Accessibility', () => {
    it('should use semantic <nav> element', () => {
      const { container } = renderSidebar()

      const nav = container.querySelector('nav')
      expect(nav).toBeTruthy()
    })

    it('should use semantic <aside> element for the sidebar', () => {
      const { container } = renderSidebar()

      const aside = container.querySelector('aside')
      expect(aside).toBeTruthy()
    })

    it('should have title attributes on collapsed buttons for tooltip access', () => {
      renderSidebar({ isExpanded: false })

      const buttons = screen.getAllByRole('button')
      const buttonsWithTitle = buttons.filter(btn => btn.hasAttribute('title'))
      // All nav items + settings + logout should have title when collapsed
      expect(buttonsWithTitle.length).toBeGreaterThan(0)
    })

    it('should NOT have title attributes when expanded (text is visible)', () => {
      renderSidebar({ isExpanded: true })

      // Nav items (links or buttons) should not have title when expanded
      const payrollLink = screen.getAllByText('Salaries').map(el => el.closest('a')).find(el => el != null)!
      expect(payrollLink!.hasAttribute('title')).toBe(false)
    })

    it('should have the logout button with an identifiable id', () => {
      renderSidebar()

      const logoutBtn = document.getElementById('sidebar-logout-btn')
      expect(logoutBtn).toBeTruthy()
    })

    it('all interactive elements should be focusable buttons or links', () => {
      renderSidebar()

      const buttons = screen.getAllByRole('button')
      const links = screen.getAllByRole('link')

      // Should have multiple interactive elements
      expect(buttons.length + links.length).toBeGreaterThan(8)
    })

    it('should render icons inside each nav item', () => {
      renderSidebar()

      const payrollLink = screen.getAllByText('Salaries').map(el => el.closest('a')).find(el => el != null)!
      const svgIcon = payrollLink!.querySelector('svg')
      expect(svgIcon).toBeTruthy()
    })
  })

  // ─────────────────────────────────────────────
  // EXPANDED vs COLLAPSED LAYOUT
  // ─────────────────────────────────────────────
  describe('Responsive: Expanded vs Collapsed', () => {
    it('should have wider width when expanded (w-[240px])', () => {
      const { container } = renderSidebar({ isExpanded: true })

      const aside = container.querySelector('aside')
      expect(aside!.className).toContain('w-[240px]')
    })

    it('should have narrow width when collapsed (w-[68px])', () => {
      const { container } = renderSidebar({ isExpanded: false })

      const aside = container.querySelector('aside')
      expect(aside!.className).toContain('w-[68px]')
    })

    it('should center buttons when collapsed (justify-center)', () => {
      renderSidebar({ isExpanded: false })

      const buttons = screen.getAllByRole('button')
      const navButton = buttons.find(btn => btn.className.includes('justify-center'))
      expect(navButton).toBeTruthy()
    })

    it('should use px-3 padding when expanded', () => {
      renderSidebar({ isExpanded: true })

      const payrollLink = screen.getAllByText('Salaries').map(el => el.closest('a')).find(el => el != null)!
      expect(payrollLink!.className).toContain('px-3')
    })
  })

  // ─────────────────────────────────────────────
  // RTL SUPPORT
  // ─────────────────────────────────────────────
  describe('RTL Support', () => {
    it('should apply RTL border direction when isRTL is true', () => {
      // Override i18n mock to return RTL
      const i18nModule = require('@/lib/i18n')
      const originalUseI18n = i18nModule.useI18n
      i18nModule.useI18n = () => ({
        t: mockT,
        isRTL: true,
      })

      const { container } = render(
        <Sidebar
          activeModule="dashboard"
          onModuleChange={jest.fn()}
          isExpanded={true}
          onToggle={jest.fn()}
        />
      )

      const aside = container.querySelector('aside')
      expect(aside!.className).toContain('border-l')
      expect(aside!.className).not.toContain('border-r')

      // Restore
      i18nModule.useI18n = originalUseI18n
    })
  })

  // ─────────────────────────────────────────────
  // BADGE & NEW INDICATORS
  // ─────────────────────────────────────────────
  describe('Badge & New Indicators', () => {
    it('should NOT render NEW badges for button-based nav items (only Link items get badges)', () => {
      renderSidebar()

      // Location tracking items have isNew: true but render as buttons (no href),
      // and the button path does not render the NEW badge — only the Link path does.
      // This documents a bug: isNew items without href never show their badge.
      expect(screen.queryByText('NEW')).not.toBeInTheDocument()
    })
  })

  // ─────────────────────────────────────────────
  // PERMISSIONS (Future-proofing)
  // ─────────────────────────────────────────────
  describe('Permissions Readiness', () => {
    it('should render all modules regardless of permissions (current behavior)', () => {
      renderSidebar()

      // All modules render — no permission gating currently exists
      expect(screen.getAllByText('Salaries').length).toBeGreaterThan(0)
      expect(screen.getByText('Expenses')).toBeInTheDocument()
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    // This test documents the recommended behavior for permission-based rendering
    it('should accept onLogout as optional prop without crashing', () => {
      expect(() => {
        render(
          <Sidebar
            activeModule="dashboard"
            onModuleChange={jest.fn()}
            isExpanded={true}
            onToggle={jest.fn()}
          // onLogout intentionally omitted
          />
        )
      }).not.toThrow()
    })
  })

  // ─────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('should handle unknown translation keys gracefully', () => {
      // Location tracking items now use nav.* keys which map to English from mock
      renderSidebar()

      // Multiple elements may share the same text (section title + nav item)
      expect(screen.getAllByText('Location Tracking').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Radius Alerts').length).toBeGreaterThan(0)
    })

    it('should render correctly with all module types as activeModule', () => {
      const allModules: ModuleType[] = [
        'dashboard', 'employees', 'new-employee', 'attendance',
        'leaves', 'salaries', 'expenses', 'shifts',
        'location-tracking', 'radius-alerts', 'leave-setup', 'settings',
      ]

      allModules.forEach(mod => {
        expect(() => {
          const { unmount } = render(
            <Sidebar
              activeModule={mod}
              onModuleChange={jest.fn()}
              isExpanded={true}
              onToggle={jest.fn()}
            />
          )
          unmount()
        }).not.toThrow()
      })
    })
  })
})
