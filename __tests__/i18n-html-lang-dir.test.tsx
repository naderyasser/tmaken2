/**
 * Locks the Issue-2 behavior: the root <html> lang/dir is NOT static — it follows
 * the active UI locale (ar → rtl, en → ltr), flipping the whole layout direction.
 */
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// setLang() syncs to the Frappe backend in the background; keep that inert in tests.
jest.mock('@/lib/api-client', () => ({
  frappeClient: { call: jest.fn(() => Promise.resolve({ message: null })) },
}))
jest.mock('@/lib/api', () => ({
  getCurrentUser: jest.fn(() => Promise.resolve('Guest')),
}))

import { I18nProvider, useI18n } from '@/lib/i18n'

function LangToggle() {
  const { lang, setLang } = useI18n()
  return (
    <button onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
      toggle:{lang}
    </button>
  )
}

describe('root <html> lang/dir reacts to the active UI locale', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.lang = ''
    document.documentElement.dir = ''
  })

  it('defaults to Arabic (rtl), flips to English (ltr), and back', async () => {
    const user = userEvent.setup()
    render(
      <I18nProvider>
        <LangToggle />
      </I18nProvider>,
    )

    // Provider mount applies the Arabic-first default.
    await waitFor(() => expect(document.documentElement.lang).toBe('ar'))
    expect(document.documentElement.dir).toBe('rtl')

    // ar → en : lang + dir both flip.
    await user.click(screen.getByRole('button'))
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')

    // en → ar : flips back.
    await user.click(screen.getByRole('button'))
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
  })

  it('restores a persisted English choice as ltr on load', async () => {
    localStorage.setItem('meena-lang', 'en')
    render(
      <I18nProvider>
        <LangToggle />
      </I18nProvider>,
    )
    await waitFor(() => expect(document.documentElement.lang).toBe('en'))
    expect(document.documentElement.dir).toBe('ltr')
  })
})
