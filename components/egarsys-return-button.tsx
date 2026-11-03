'use client'

// Floating «العودة» button back to the rentals system (egarsys / مينا العقارية).
// Shown ONLY when the session was opened FROM egarsys: the SSO consume endpoint
// (base_meena.aqar_bridge.egarsys_sso) drops a JS-readable `egarsys_return`
// cookie carrying the branded return URL. Direct platform logins never see it.
// Plain same-tab <a> on purpose — window.open is dead inside the mobile WebView.
// Inline styles on purpose (stale built-CSS can miss new-file utility classes).

import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useI18n } from '@/lib/i18n'

export function EgarsysReturnButton() {
    const { lang } = useI18n()
    const [url, setUrl] = useState<string | null>(null)

    useEffect(() => {
        try {
            const m = document.cookie.match(/(?:^|;\s*)egarsys_return=([^;]+)/)
            if (!m) return
            let v = m[1]
            // werkzeug may wrap cookie values in quotes
            if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1)
            v = decodeURIComponent(v)
            if (/^https:\/\/[a-z0-9.-]+\/(\?|$)/i.test(v)) setUrl(v)
        } catch { }
    }, [])

    if (!url) return null

    return (
        <a
            href={url}
            title={lang === 'ar' ? 'العودة إلى نظام العقارات' : 'Back to the rentals system'}
            style={{
                position: 'fixed',
                bottom: 18,
                insetInlineEnd: 18,
                zIndex: 90,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                borderRadius: 9999,
                background: '#0f172a',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(15,23,42,0.35)',
                border: '1px solid rgba(255,255,255,0.15)',
            }}
        >
            <ArrowRight style={{ width: 16, height: 16 }} />
            {lang === 'ar' ? 'العودة إلى نظام العقارات' : 'Back to Rentals'}
        </a>
    )
}
