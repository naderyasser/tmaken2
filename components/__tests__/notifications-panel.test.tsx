/**
 * Notifications Panel – Absence Warning Tests
 * Verifies that:
 * - 'Absence Warning' is registered in DOC_TYPE_META with correct label/color
 * - getNotifMeta returns dedicated styling for Absence Warning doc type
 * - DOC_TYPE_META lookup takes priority over generic type-based fallback
 * - Absence Warning notifications render with the correct Arabic label
 */

import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'

// ── Mocks ──────────────────────────────────────────────────────────

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => '/hrms/notifications',
}))

// Mock toast
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}))

// Provide a controllable mock for frappeClient.get / .call
const mockGet = jest.fn()
const mockCall = jest.fn()
jest.mock('@/lib/api-client', () => ({
  frappeClient: {
    get: (...args: unknown[]) => mockGet(...args),
    call: (...args: unknown[]) => mockCall(...args),
  },
}))

// Mock Sheet – auto-open the panel so notifications load
jest.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children, onOpenChange }: any) => {
    const ReactImport = require('react')
    ReactImport.useEffect(() => { onOpenChange?.(true) }, [])
    return <div>{children}</div>
  },
  SheetTrigger: ({ children }: any) => <div data-testid="sheet-trigger">{children}</div>,
  SheetContent: ({ children }: any) => <div data-testid="sheet-content">{children}</div>,
  SheetHeader: ({ children }: any) => <div>{children}</div>,
  SheetTitle: ({ children }: any) => <div>{children}</div>,
  SheetDescription: ({ children }: any) => <div>{children}</div>,
}))

// Mock Tabs to just render children
jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: any) => <div>{children}</div>,
  TabsList: ({ children }: any) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: any) => <button data-value={value}>{children}</button>,
  TabsContent: ({ children }: any) => <div>{children}</div>,
}))

// Mock ScrollArea
jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}))

// Mock Badge to render text
jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span className={className} data-testid="badge">{children}</span>,
}))

// ── Import component under test ────────────────────────────────────

import { NotificationsPanel } from '../notifications-panel'

// ── Helpers ─────────────────────────────────────────────────────────

function makeNotification(overrides: Record<string, unknown> = {}) {
  return {
    name: 'NOTIF-001',
    subject: 'إنذار غياب — أحمد',
    email_content: 'غياب بدون عذر',
    document_type: 'Absence Warning',
    document_name: 'AW-001',
    from_user: 'admin@example.com',
    read: 0,
    creation: new Date().toISOString(),
    type: 'Warning',
    modified: new Date().toISOString(),
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────────────

describe('NotificationsPanel – Absence Warning support', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Default: resolve all get calls with the given data
    mockGet.mockResolvedValue({ data: [] })
  })

  it('renders absence warning notification with Arabic label (إنذار غياب)', async () => {
    const absenceNotif = makeNotification()

    mockGet.mockResolvedValue({ data: [absenceNotif] })

    render(<NotificationsPanel />)

    await waitFor(() => {
      expect(screen.getByText('إنذار غياب')).toBeInTheDocument()
    })
  })

  it('renders absence warning with yellow warning styling', async () => {
    const absenceNotif = makeNotification()

    mockGet.mockResolvedValue({ data: [absenceNotif] })

    render(<NotificationsPanel />)

    await waitFor(() => {
      const label = screen.getByText('إنذار غياب')
      expect(label).toBeInTheDocument()
    })

    // The icon container should have the yellow color classes
    const iconContainers = document.querySelectorAll('[class*="yellow"]')
    expect(iconContainers.length).toBeGreaterThan(0)
  })

  it('uses DOC_TYPE_META over generic type fallback for Absence Warning', async () => {
    // Even though type is 'Warning', the dedicated doc-type entry should win
    const absenceNotif = makeNotification({ type: 'Warning', document_type: 'Absence Warning' })

    mockGet.mockResolvedValue({ data: [absenceNotif] })

    render(<NotificationsPanel />)

    // Should show the dedicated Arabic label, not just a generic warning
    await waitFor(() => {
      expect(screen.getByText('إنذار غياب')).toBeInTheDocument()
    })
  })

  it('still renders generic Warning style for unknown doc types', async () => {
    const genericWarning = makeNotification({
      document_type: 'Unknown DocType',
      type: 'Warning',
      subject: 'تحذير عام',
    })

    mockGet.mockResolvedValue({ data: [genericWarning] })

    render(<NotificationsPanel />)

    await waitFor(() => {
      // Should show the subject
      expect(screen.getByText('تحذير عام')).toBeInTheDocument()
    })

    // Should NOT show 'إنذار غياب' for an unknown doc type
    expect(screen.queryByText('إنذار غياب')).not.toBeInTheDocument()
  })

  it('shows notification subject text for absence warning', async () => {
    const absenceNotif = makeNotification({ subject: 'إنذار غياب بتاريخ 2026-03-20' })

    mockGet.mockResolvedValue({ data: [absenceNotif] })

    render(<NotificationsPanel />)

    await waitFor(() => {
      expect(screen.getByText('إنذار غياب بتاريخ 2026-03-20')).toBeInTheDocument()
    })
  })
})
