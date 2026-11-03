/**
 * Sales-vertical translations (sr.* keys) — Arabic, English, Urdu.
 *
 * Composed from four per-area modules under lib/sales-translations/ (generated
 * from the string inventories), then MERGED into lib/i18n.tsx's central t()
 * lookup — the sales vertical owns its strings, but there is no parallel i18n
 * system. Keys are namespaced `sr.*` (rep PWA) and `sr.admin.*` (back office).
 *
 * Urdu = professional business Urdu (کاروباری اردو), RTL like Arabic, rendered
 * in Noto Nastaliq Urdu (app/layout.tsx + globals.css html[lang="ur"]).
 *
 * Shared keys (sr.status.*, sr.priority.*, sr.admin.common.*) may be defined in
 * more than one module; the spread order below is the canonical winner
 * (admin definitions win — the most complete status/common sets), which
 * normalizes gender/article variants to one consistent form app-wide.
 */
import { pwaCore } from './sales-translations/pwa-core'
import { pwaSecondary } from './sales-translations/pwa-secondary'
import { adminA } from './sales-translations/admin-a'
import { adminB } from './sales-translations/admin-b'
import { features } from './sales-translations/features'
import { commission } from './sales-translations/commission'

export type SalesLanguage = 'en' | 'ar' | 'ur'

const LANG_NAMES: Record<SalesLanguage, Record<string, string>> = {
  en: { 'lang.name.ar': 'العربية', 'lang.name.en': 'English', 'lang.name.ur': 'اردو', 'sr.common.language': 'Language' },
  ar: { 'lang.name.ar': 'العربية', 'lang.name.en': 'English', 'lang.name.ur': 'اردو', 'sr.common.language': 'اللغة' },
  ur: { 'lang.name.ar': 'العربية', 'lang.name.en': 'English', 'lang.name.ur': 'اردو', 'sr.common.language': 'زبان' },
}

function compose(lang: SalesLanguage): Record<string, string> {
  return {
    ...LANG_NAMES[lang],
    ...pwaCore[lang],
    ...pwaSecondary[lang],
    ...adminA[lang],
    ...adminB[lang],
    ...features[lang],
    ...commission[lang],
  }
}

export const salesTranslations: Record<SalesLanguage, Record<string, string>> = {
  en: compose('en'),
  ar: compose('ar'),
  ur: compose('ur'),
}
