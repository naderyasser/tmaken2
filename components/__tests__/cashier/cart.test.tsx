/**
 * Cart Component — Unit Tests
 * Covers: action grid buttons (Pay, Quick Pay Cash, Hold, Clear, Discount),
 *         empty state, totals display, quantity controls, and translations.
 */

import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Cart } from '../../cashier/cart'

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

// Mock i18n to return the key suffix as readable text
jest.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    lang: 'en',
    setLang: jest.fn(),
    dir: 'ltr',
    isRTL: false,
    t: (key: string) => {
      const map: Record<string, string> = {
        'cashier.cart_empty':      'Cart is empty',
        'cashier.cart_empty_hint': 'Add items from the product grid',
        'cashier.subtotal':        'Subtotal',
        'cashier.item_discounts':  'Item Discounts',
        'cashier.cart_discount':   'Cart Discount',
        'cashier.vat':             'VAT (15%)',
        'cashier.total':           'Total',
        'cashier.pay':             'Pay',
        'cashier.cash':            'Cash',
        'cashier.hold':            'Hold',
        'cashier.cancel':          'Cancel',
        'cashier.discount':        'Discount',
      }
      // Unmapped keys fall back to the SUFFIX, not the raw key: returning
      // "cashier.quantity" put the substring "cash" into a button's accessible name,
      // so getByRole(/cash/i) matched the qty steppers as well as the Cash button.
      return map[key] ?? key.replace(/^cashier\./, '')
    },
  }),
}))

jest.mock('@/lib/cashier-utils', () => ({
  fmtCurrency: (n: number) => `SAR ${n.toFixed(2)}`,
  NEW_BADGE_CLASS: 'new-badge',
  // Cart calls both of these on every render. Leaving them out of the mock made the
  // component throw before it rendered anything, failing all 30 assertions here.
  setCashierCurrency: jest.fn(),
  setCashierLocale: jest.fn(),
}))

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const sampleItems = [
  { item_code: 'ITEM-001', item_name: 'Coffee', qty: 2, rate: 15, discount_percentage: 0 },
  { item_code: 'ITEM-002', item_name: 'Tea',    qty: 1, rate: 10, discount_percentage: 0 },
]

const defaultProps = {
  items: sampleItems,
  customer: 'cust-001',
  customerName: 'John Doe',
  subtotal: 40,
  itemDiscountAmt: 0,
  cartDiscountAmt: 0,
  taxAmount: 6,
  net: 46,
  cartDiscountPct: 0,
  onCartDiscountChange: jest.fn(),
  onUpdateQty: jest.fn(),
  onRemove: jest.fn(),
  onCheckout: jest.fn(),
  onQuickPay: jest.fn(),
  onHold: jest.fn(),
  onClearCart: jest.fn(),
  checkoutDisabled: false,
}

beforeEach(() => jest.clearAllMocks())

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('Empty cart state', () => {
  it('shows the empty message when no items', () => {
    render(<Cart {...defaultProps} items={[]} />)
    expect(screen.getByText('Cart is empty')).toBeInTheDocument()
    expect(screen.getByText('Add items from the product grid')).toBeInTheDocument()
  })

  it('does not render the totals section when cart is empty', () => {
    render(<Cart {...defaultProps} items={[]} />)
    expect(screen.queryByText('Subtotal')).not.toBeInTheDocument()
  })
})

// ─── Line items ───────────────────────────────────────────────────────────────

describe('Cart line items', () => {
  it('renders all items by name', () => {
    render(<Cart {...defaultProps} />)
    expect(screen.getByText('Coffee')).toBeInTheDocument()
    expect(screen.getByText('Tea')).toBeInTheDocument()
  })

  it('calls onRemove when the trash button for an item is clicked', async () => {
    const user = userEvent.setup()
    render(<Cart {...defaultProps} />)
    // The remove buttons are the last icon button per row — click the first one
    const trashButtons = screen.getAllByRole('button').filter(
      btn => btn.className.includes('text-red')
    )
    await user.click(trashButtons[0])
    // Removal is guarded by a confirmation step, so the click alone must NOT remove.
    expect(defaultProps.onRemove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'remove' }))
    expect(defaultProps.onRemove).toHaveBeenCalledWith('ITEM-001')
  })

  it('calls onUpdateQty with qty - 1 when Minus button is clicked', async () => {
    render(<Cart {...defaultProps} />)
    // Button order per item row: Minus(0), qty-display(1), Plus(2), Remove(3)
    // allButtons[0] is the Minus for Coffee (qty=2) → decrement to 1
    const allButtons = screen.getAllByRole('button')
    fireEvent.click(allButtons[0])
    expect(defaultProps.onUpdateQty).toHaveBeenCalledWith('ITEM-001', 1)
  })
})

// ─── Totals section ──────────────────────────────────────────────────────────

describe('Totals display', () => {
  it('renders the Subtotal label and value', () => {
    render(<Cart {...defaultProps} />)
    expect(screen.getByText('Subtotal')).toBeInTheDocument()
    expect(screen.getByText('SAR 40.00')).toBeInTheDocument()
  })

  it('renders the Total label and net value', () => {
    render(<Cart {...defaultProps} />)
    expect(screen.getByText('Total')).toBeInTheDocument()
    // Shown in the summary bar AND on the Pay button — both are intentional.
    expect(screen.getAllByText('SAR 46.00').length).toBeGreaterThan(0)
  })

  it('renders VAT line when taxAmount > 0', () => {
    render(<Cart {...defaultProps} taxAmount={6} />)
    expect(screen.getByText(/VAT \(15%\)/)).toBeInTheDocument()
    expect(screen.getByText('SAR 6.00')).toBeInTheDocument()
  })

  it('does not render VAT line when taxAmount is 0', () => {
    render(<Cart {...defaultProps} taxAmount={0} />)
    expect(screen.queryByText(/VAT/)).not.toBeInTheDocument()
  })

  it('renders item discount when itemDiscountAmt > 0', () => {
    render(<Cart {...defaultProps} itemDiscountAmt={5} />)
    expect(screen.getByText('Item Discounts')).toBeInTheDocument()
    expect(screen.getByText('-SAR 5.00')).toBeInTheDocument()
  })

  it('does not render item discount row when zero', () => {
    render(<Cart {...defaultProps} itemDiscountAmt={0} />)
    expect(screen.queryByText('Item Discounts')).not.toBeInTheDocument()
  })

  it('shows the customer name in the header bar', () => {
    render(<Cart {...defaultProps} />)
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })
})

// ─── Action grid buttons ──────────────────────────────────────────────────────

describe('Action grid — Pay button', () => {
  it('renders the Pay button', () => {
    render(<Cart {...defaultProps} />)
    expect(screen.getByRole('button', { name: /pay/i })).toBeInTheDocument()
  })

  it('calls onCheckout when Pay is clicked', async () => {
    const user = userEvent.setup()
    render(<Cart {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /^pay\b/i }))
    expect(defaultProps.onCheckout).toHaveBeenCalledTimes(1)
  })

  it('disables the Pay button when checkoutDisabled is true', () => {
    render(<Cart {...defaultProps} checkoutDisabled />)
    expect(screen.getByRole('button', { name: /^pay\b/i })).toBeDisabled()
  })
})

describe('Action grid — Quick Pay Cash button', () => {
  it('renders the Cash button', () => {
    render(<Cart {...defaultProps} />)
    expect(screen.getByRole('button', { name: /cash/i })).toBeInTheDocument()
  })

  it('calls onQuickPay when Cash is clicked', async () => {
    const user = userEvent.setup()
    render(<Cart {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /cash/i }))
    expect(defaultProps.onQuickPay).toHaveBeenCalledTimes(1)
  })

  it('disables the Cash button when checkoutDisabled is true', () => {
    render(<Cart {...defaultProps} checkoutDisabled />)
    expect(screen.getByRole('button', { name: /cash/i })).toBeDisabled()
  })
})

describe('Action grid — Hold button', () => {
  it('renders the Hold button', () => {
    render(<Cart {...defaultProps} />)
    expect(screen.getByRole('button', { name: /hold/i })).toBeInTheDocument()
  })

  it('calls onHold when Hold is clicked', async () => {
    const user = userEvent.setup()
    render(<Cart {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /hold/i }))
    expect(defaultProps.onHold).toHaveBeenCalledTimes(1)
  })

  it('disables the Hold button when checkoutDisabled is true', () => {
    render(<Cart {...defaultProps} checkoutDisabled />)
    expect(screen.getByRole('button', { name: /hold/i })).toBeDisabled()
  })
})

describe('Action grid — Clear Cart button', () => {
  it('renders the Cancel/Clear button', () => {
    render(<Cart {...defaultProps} />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('calls onClearCart when Cancel is clicked', async () => {
    const user = userEvent.setup()
    render(<Cart {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(defaultProps.onClearCart).toHaveBeenCalledTimes(1)
  })

  it('disables the Cancel button when checkoutDisabled is true', () => {
    render(<Cart {...defaultProps} checkoutDisabled />)
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })
})

describe('Action grid — Discount button', () => {
  // The action grid button has text "Discount" exactly.
  // The totals-row toggle has text "Cart Discount NEW" — use exact regex to distinguish.
  const getDiscountBtn = () =>
    screen.getAllByRole('button').find(btn => btn.textContent?.trim() === 'Discount')!

  it('renders the Discount button', () => {
    render(<Cart {...defaultProps} />)
    expect(getDiscountBtn()).toBeInTheDocument()
  })

  it('reveals the discount input when Discount button is clicked', async () => {
    const user = userEvent.setup()
    render(<Cart {...defaultProps} />)
    expect(screen.queryByPlaceholderText('0')).not.toBeInTheDocument()
    await user.click(getDiscountBtn())
    expect(screen.getByPlaceholderText('0')).toBeInTheDocument()
  })

  it('toggles the discount input off when clicked again', async () => {
    const user = userEvent.setup()
    render(<Cart {...defaultProps} />)
    await user.click(getDiscountBtn()) // open
    await user.click(getDiscountBtn()) // close
    expect(screen.queryByPlaceholderText('0')).not.toBeInTheDocument()
  })

  it('calls onCartDiscountChange when a discount value is entered', async () => {
    const user = userEvent.setup()
    render(<Cart {...defaultProps} />)
    await user.click(getDiscountBtn())
    const input = screen.getByPlaceholderText('0')
    // Use fireEvent.change to set the value atomically, avoiding per-keystroke noise
    fireEvent.change(input, { target: { value: '10' } })
    expect(defaultProps.onCartDiscountChange).toHaveBeenLastCalledWith(10)
  })
})

// ─── All action buttons disabled together ────────────────────────────────────

describe('Disabled state (empty cart)', () => {
  it('disables Pay, Cash, Hold, and Cancel when checkoutDisabled', () => {
    render(<Cart {...defaultProps} checkoutDisabled />)
    expect(screen.getByRole('button', { name: /^pay\b/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cash/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /hold/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('Discount button stays enabled even when cart is disabled', () => {
    render(<Cart {...defaultProps} checkoutDisabled />)
    const discountBtn = screen.getAllByRole('button').find(
      btn => btn.textContent?.trim() === 'Discount'
    )
    expect(discountBtn).toBeInTheDocument()
    expect(discountBtn).not.toBeDisabled()
  })
})
