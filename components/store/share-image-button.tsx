'use client'

import { useState } from 'react'
import { ImageDown, Loader2 } from 'lucide-react'

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** Generate a WhatsApp-ready property card image client-side (photo + title + price + license + QR).
 *  No backend. Falls back to a branded background if the photo can't be drawn (CORS/missing). */
export default function ShareImageButton({
  title, priceText, license, qrValue, imageUrl,
}: {
  title: string
  priceText: string
  license?: string
  qrValue?: string
  imageUrl?: string | null
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const generate = async () => {
    setBusy(true); setErr('')
    try {
      const QRCode = (await import('qrcode')).default
      try { await (document as any).fonts?.ready } catch { /* */ }

      const W = 1080, H = 1350, M = 64
      const canvas = document.createElement('canvas')
      canvas.width = W; canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no-canvas')

      ctx.fillStyle = '#FAF7F2'; ctx.fillRect(0, 0, W, H)

      // property photo (cover) or branded fallback
      const photoH = 740
      const img = imageUrl ? await loadImage(imageUrl) : null
      if (img && img.width) {
        const tar = W / photoH, ar = img.width / img.height
        let sw, sh, sx, sy
        if (ar > tar) { sh = img.height; sw = sh * tar; sx = (img.width - sw) / 2; sy = 0 }
        else { sw = img.width; sh = sw / tar; sx = 0; sy = (img.height - sh) / 2 }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, photoH)
      } else {
        ctx.fillStyle = '#3A2A21'; ctx.fillRect(0, 0, W, photoH)
        ctx.fillStyle = '#FAF7F2'; ctx.textAlign = 'center'; ctx.font = "bold 64px 'Tajawal','IBM Plex Sans Arabic',sans-serif"
        ctx.fillText('تمكين العقارية', W / 2, photoH / 2 + 20)
      }

      // RTL text panel
      ctx.direction = 'rtl' as CanvasDirection
      ctx.textAlign = 'right'
      const right = W - M
      let y = photoH + 96

      ctx.fillStyle = '#1F2421'; ctx.font = "bold 56px 'Tajawal','IBM Plex Sans Arabic',sans-serif"
      const words = (title || '').split(/\s+/); let line = ''
      for (const w of words) {
        const t = line ? `${line} ${w}` : w
        if (ctx.measureText(t).width > W - 2 * M && line) { ctx.fillText(line, right, y); y += 72; line = w }
        else line = t
      }
      if (line) { ctx.fillText(line, right, y); y += 72 }

      ctx.fillStyle = '#87672F'; ctx.font = "bold 68px 'Tajawal','IBM Plex Sans Arabic',sans-serif"
      ctx.fillText(priceText, right, y + 40); y += 120

      if (license) {
        ctx.fillStyle = '#166E4F'; ctx.font = "34px 'Tajawal','IBM Plex Sans Arabic',sans-serif"
        ctx.fillText(`✓ موثّق — ترخيص ${license}`, right, y); y += 56
      }

      // QR (bottom-start) + brand (bottom-end)
      const qrUrl = await QRCode.toDataURL(qrValue || (typeof window !== 'undefined' ? window.location.href : ''), {
        margin: 1, width: 200, color: { dark: '#3A2A21', light: '#FFFFFF' },
      })
      const qr = await loadImage(qrUrl)
      if (qr) {
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(M - 10, H - 250, 220, 220)
        ctx.drawImage(qr, M, H - 240, 200, 200)
      }
      ctx.fillStyle = '#3A2A21'; ctx.textAlign = 'right'; ctx.font = "bold 40px 'Tajawal','IBM Plex Sans Arabic',sans-serif"
      ctx.fillText('تمكين العقارية', right, H - 110)
      ctx.fillStyle = '#585D53'; ctx.font = "28px 'Tajawal','IBM Plex Sans Arabic',sans-serif"
      ctx.fillText('امسح الرمز لعرض الإعلان', right, H - 64)

      const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/png', 0.92))
      if (!blob) throw new Error('export-failed')
      const file = new File([blob], 'tamkeen-listing.png', { type: 'image/png' })

      const nav = navigator as Navigator & { canShare?: (d: any) => boolean }
      if (nav.canShare && nav.canShare({ files: [file] }) && typeof navigator.share === 'function') {
        await navigator.share({ files: [file], title })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a'); a.href = url; a.download = 'tamkeen-listing.png'; a.click()
        setTimeout(() => URL.revokeObjectURL(url), 4000)
      }
    } catch {
      setErr('تعذّر إنشاء الصورة، حاول مرة أخرى.')
      setTimeout(() => setErr(''), 3000)
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        aria-label="مشاركة الإعلان كصورة"
        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[var(--aqar-sand-2)] px-4 text-sm font-medium text-[var(--aqar-kohl)]/75 hover:border-[var(--aqar-green)]/40 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageDown className="h-4 w-4" />}صورة للمشاركة
      </button>
      {err && <span role="status" className="absolute bottom-full z-30 mb-1 w-max rounded-lg bg-[var(--aqar-clay)] px-2.5 py-1.5 text-[11px] text-white shadow-lg" style={{ insetInlineStart: 0 }}>{err}</span>}
    </span>
  )
}
