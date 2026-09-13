'use client'

import { useI18n, type Language } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Sales-vertical language switcher (العربية / English / اردو).
 *
 * Drives the SHARED I18nProvider (same locale state, localStorage persistence
 * and User.language backend sync as the rest of the app) — it just exposes all
 * three languages, whereas the shared header/login toggles cycle ar/en only.
 * Mounted in the sales-rep PWA layout and the /sales-reps back office.
 */
const OPTIONS: { code: Language; label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'ur', label: 'اردو' },
]

export function SalesLangSwitcher({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { lang, setLang } = useI18n()
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-xl bg-slate-100 p-0.5 border border-slate-200',
        className
      )}
      role="group"
      aria-label="Language / اللغة / زبان"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.code}
          type="button"
          onClick={() => setLang(opt.code)}
          className={cn(
            'rounded-lg font-medium transition-all',
            compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
            lang === opt.code
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          )}
          // Each label renders in its own script regardless of active language
          lang={opt.code}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
