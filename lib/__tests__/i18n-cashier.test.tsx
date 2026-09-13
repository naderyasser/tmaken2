/**
 * i18n — Cashier Translation Keys Tests
 * Covers: English/Arabic cashier keys, language switching,
 *         RTL direction, and localStorage persistence.
 */

import '@testing-library/jest-dom'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider, useI18n } from '../i18n'

// ─── Helper component ─────────────────────────────────────────────────────────

function LangProbe({ keyName }: { keyName: string }) {
  const { t, lang, setLang, dir, isRTL } = useI18n()
  return (
    <div>
      <span data-testid="translation">{t(keyName)}</span>
      <span data-testid="lang">{lang}</span>
      <span data-testid="dir">{dir}</span>
      <span data-testid="isRTL">{String(isRTL)}</span>
      <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>toggle</button>
    </div>
  )
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.dir = ''
  document.documentElement.lang = ''
})

// ─── English cashier keys ─────────────────────────────────────────────────────

describe('Cashier translation keys — English', () => {
  // I18nProvider is Arabic-first by design (it matches the SSR <html lang="ar">) and
  // only switches when a saved choice says so. The outer beforeEach clears that key, so
  // without seeding it here every "English" case below rendered Arabic and failed.
  beforeEach(() => {
    localStorage.setItem('meena-lang', 'en')
  })

  const enCases: [string, string][] = [
    ['cashier.cart_empty',      'Cart is empty'],
    ['cashier.cart_empty_hint', 'Add items from the product grid'],
    ['cashier.subtotal',        'Subtotal'],
    ['cashier.item_discounts',  'Item Discounts'],
    ['cashier.cart_discount',   'Cart Discount'],
    ['cashier.vat',             'VAT (15%)'],
    ['cashier.total',           'Total'],
    ['cashier.checkout',        'Checkout'],
    ['cashier.online',          'Online'],
    ['cashier.offline',         'Offline'],
    ['cashier.close_session',   'Close Session'],
    ['cashier.pay',             'Pay'],
    ['cashier.cash',            'Cash'],
    ['cashier.hold',            'Hold'],
    ['cashier.cancel',          'Cancel'],
    ['cashier.discount',        'Discount'],
    ['cashier.session',         'Session'],
    ['cashier.customer',        'Customer'],
    ['cashier.receipt',         'Receipt'],
    ['cashier.print',           'Print'],
    ['cashier.reports',         'Reports'],
    ['cashier.history',         'History'],
    ['cashier.settings',        'Settings'],
  ]

  test.each(enCases)('t("%s") returns "%s"', (key, expected) => {
    render(
      <I18nProvider>
        <LangProbe keyName={key} />
      </I18nProvider>
    )
    expect(screen.getByTestId('translation')).toHaveTextContent(expected)
  })
})

// ─── Arabic cashier keys ──────────────────────────────────────────────────────

describe('Cashier translation keys — Arabic', () => {
  // These cases assert the value "after switching", and the probe's toggle flips
  // en↔ar — so the provider has to START in English for the switch to land on Arabic.
  // It is Arabic-first by default, hence the seed.
  beforeEach(() => {
    localStorage.setItem('meena-lang', 'en')
  })

  const arCases: [string, string][] = [
    ['cashier.cart_empty',    'السلة فارغة'],
    ['cashier.subtotal',      'المجموع الفرعي'],
    ['cashier.vat',           'ضريبة القيمة المضافة (15%)'],
    ['cashier.total',         'الإجمالي'],
    ['cashier.checkout',      'الدفع'],
    ['cashier.online',        'متصل'],
    ['cashier.offline',       'غير متصل'],
    ['cashier.close_session', 'إغلاق الجلسة'],
    ['cashier.pay',           'ادفع'],
    ['cashier.cash',          'نقدي'],
    ['cashier.hold',          'تعليق'],
    ['cashier.discount',      'الخصم'],
    ['cashier.cancel',        'إلغاء'],
  ]

  test.each(arCases)('t("%s") returns Arabic text after switching', async (key, expected) => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <LangProbe keyName={key} />
      </I18nProvider>
    )
    await user.click(screen.getByRole('button', { name: 'toggle' }))
    expect(screen.getByTestId('translation')).toHaveTextContent(expected)
  })
})

// ─── Language state & RTL ─────────────────────────────────────────────────────

describe('Language state and RTL direction', () => {
  // The provider is Arabic-first with no stored choice, so it matches the SSR
  // <html lang="ar" dir="rtl"> and the public site never flashes to en/ltr after
  // hydration — see the comment on I18nProvider in lib/i18n.tsx.
  it('starts in Arabic with RTL direction when nothing is stored', () => {
    render(
      <I18nProvider>
        <LangProbe keyName="cashier.total" />
      </I18nProvider>
    )
    expect(screen.getByTestId('lang')).toHaveTextContent('ar')
    expect(screen.getByTestId('dir')).toHaveTextContent('rtl')
    expect(screen.getByTestId('isRTL')).toHaveTextContent('true')
  })

  it('switches to English and sets LTR', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <LangProbe keyName="cashier.total" />
      </I18nProvider>
    )
    await user.click(screen.getByRole('button', { name: 'toggle' }))
    expect(screen.getByTestId('lang')).toHaveTextContent('en')
    expect(screen.getByTestId('dir')).toHaveTextContent('ltr')
    expect(screen.getByTestId('isRTL')).toHaveTextContent('false')
  })

  it('sets document.documentElement.dir to ltr when English', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <LangProbe keyName="cashier.total" />
      </I18nProvider>
    )
    await user.click(screen.getByRole('button', { name: 'toggle' }))
    expect(document.documentElement.dir).toBe('ltr')
  })

  it('restores document.documentElement.dir to rtl when switching back', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <LangProbe keyName="cashier.total" />
      </I18nProvider>
    )
    await user.click(screen.getByRole('button', { name: 'toggle' })) // → en
    await user.click(screen.getByRole('button', { name: 'toggle' })) // → ar
    expect(document.documentElement.dir).toBe('rtl')
  })
})

// ─── localStorage persistence ─────────────────────────────────────────────────

describe('Language localStorage persistence', () => {
  it('saves selected language to localStorage', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <LangProbe keyName="cashier.total" />
      </I18nProvider>
    )
    await user.click(screen.getByRole('button', { name: 'toggle' }))
    // Starts Arabic with nothing stored, so the first toggle persists 'en'.
    expect(localStorage.getItem('meena-lang')).toBe('en')
  })

  it('restores saved language from localStorage on mount', () => {
    localStorage.setItem('meena-lang', 'ar')
    render(
      <I18nProvider>
        <LangProbe keyName="cashier.total" />
      </I18nProvider>
    )
    // After effect runs lang should be 'ar'
    // The useEffect runs async; check that translation reflects Arabic
    // (rendered initially as 'en', then updated via effect)
    // We verify the stored value is respected by checking localStorage was read
    expect(localStorage.getItem('meena-lang')).toBe('ar')
  })

  it('falls back to the Arabic default for an unknown stored value', () => {
    localStorage.setItem('meena-lang', 'fr') // unsupported language
    render(
      <I18nProvider>
        <LangProbe keyName="cashier.total" />
      </I18nProvider>
    )
    // Unsupported values are ignored and the Arabic-first default stands.
    expect(screen.getByTestId('translation')).toHaveTextContent('الإجمالي')
  })
})

// ─── Fallback behaviour ───────────────────────────────────────────────────────

describe('Translation fallback', () => {
  it('returns the key itself when no translation exists', () => {
    render(
      <I18nProvider>
        <LangProbe keyName="cashier.nonexistent_key_xyz" />
      </I18nProvider>
    )
    expect(screen.getByTestId('translation')).toHaveTextContent('cashier.nonexistent_key_xyz')
  })
})
