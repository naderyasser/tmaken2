'use client'

import { useEffect, useRef, useState } from 'react'
import { Share2, Link2, Check, MessageCircle } from 'lucide-react'

/** Share a listing: native Web Share (where supported) + copy-link (with toast) + WhatsApp. */
export default function ShareButton({ title, className = '' }: { title: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [canNative, setCanNative] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setCanNative(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const url = () => (typeof window !== 'undefined' ? window.location.href : '')
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${title}\n${url()}`)}`

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2000) }

  const copy = async () => {
    setOpen(false)
    try {
      await navigator.clipboard.writeText(url())
      flash('تم نسخ الرابط ✅')
    } catch {
      flash('تعذّر النسخ')
    }
  }

  const nativeShare = async () => {
    setOpen(false)
    try { await navigator.share({ title, url: url() }) } catch { /* user cancelled */ }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => (canNative ? nativeShare() : setOpen((o) => !o))}
        aria-haspopup={!canNative}
        aria-expanded={!canNative ? open : undefined}
        aria-label="مشاركة الإعلان"
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--aqar-sand-2)] px-4 text-sm font-medium text-[var(--aqar-kohl)]/75 hover:border-[var(--aqar-green)]/40"
      >
        <Share2 className="h-4 w-4" />مشاركة
      </button>

      {/* Fallback menu when the native share sheet isn't available */}
      {open && !canNative && (
        <div role="menu" className="absolute z-40 mt-1 w-48 overflow-hidden rounded-xl border border-[var(--aqar-border)] bg-[var(--aqar-surface)] py-1 shadow-xl" style={{ insetInlineEnd: 0 }}>
          <button role="menuitem" onClick={copy} className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm text-[var(--aqar-kohl)] hover:bg-[var(--aqar-sand)]">
            <Link2 className="h-4 w-4 text-[var(--aqar-green)]" />نسخ الرابط
          </button>
          <a role="menuitem" href={waHref} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm text-[var(--aqar-kohl)] hover:bg-[var(--aqar-sand)]">
            <MessageCircle className="h-4 w-4 text-[#1FA855]" />مشاركة عبر واتساب
          </a>
        </div>
      )}

      {/* Copy confirmation toast */}
      {toast && (
        <span role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-[80] -translate-x-1/2 rounded-full bg-[var(--aqar-espresso-fill)] px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </span>
      )}
    </div>
  )
}
