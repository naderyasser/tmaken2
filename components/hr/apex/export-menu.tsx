'use client'

import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { frappeClient } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'

/**
 * hr_reports.REPORTS keys that also have a base_meena.api.hr_print.TEMPLATES
 * entry — i.e. report_pdf() won't throw "not ready" for them. Callers (e.g.
 * report-page.tsx) must gate on this list themselves and fall back to the
 * plain «تصدير» button for every other report; keep this in sync with
 * hr_print.py's TEMPLATES dict as reports are added.
 */
export const SERVER_PRINTABLE_REPORTS = ['detailed'] as const

/** base64 (as returned by base_meena.api.hr_print.report_pdf) -> a same-origin Blob URL. */
function base64ToBlobUrl(base64: string, type = 'application/pdf'): string {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type }))
}

export interface ExportMenuProps {
  /** hr_reports.REPORTS key == hr_print.report_pdf's `report` arg (e.g. "detailed") */
  report: string
  /** exactly the filters object run_report/report_pdf expect (JSON-stringified server-side) */
  filters: Record<string, string>
  /** opens the existing «الطابعة» dialog unchanged — «طباعة متقدمة» */
  onAdvancedPrint: () => void
  /** button label — defaults to «تصدير» to match the button it replaces */
  label?: string
  disabled?: boolean
}

/**
 * Apex-style [تصدير ▾] replacement, shared by every report screen:
 *  - PDF            → downloads the server-rendered Apex-identical PDF
 *  - طباعة          → same PDF, straight to the browser's print dialog (hidden iframe)
 *  - طباعة متقدمة    → the existing on-screen «الطابعة» dialog (unchanged, via onAdvancedPrint)
 */
export function ExportMenu({ report, filters, onAdvancedPrint, label = 'تصدير', disabled }: ExportMenuProps) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const fetchPdf = async (): Promise<{ url: string; filename: string } | null> => {
    setLoading(true)
    try {
      const r: any = await frappeClient.call('base_meena.api.hr_print.report_pdf', {
        report, filters: JSON.stringify(filters),
      })
      const msg = r?.message
      if (!msg?.content) throw new Error('تعذّر إنشاء ملف PDF')
      return { url: base64ToBlobUrl(msg.content), filename: msg.filename || `${report}.pdf` }
    } catch (e: any) {
      toast({ title: 'خطأ', description: e?.message || 'تعذّر إنشاء ملف PDF', variant: 'destructive' })
      return null
    } finally {
      setLoading(false)
    }
  }

  const downloadPdf = async () => {
    const res = await fetchPdf()
    if (!res) return
    const a = document.createElement('a')
    a.href = res.url
    a.download = res.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(res.url), 10_000)
  }

  const printPdf = async () => {
    const res = await fetchPdf()
    if (!res) return
    let frame = iframeRef.current
    if (!frame) {
      frame = document.createElement('iframe')
      frame.style.position = 'fixed'
      frame.style.right = '0'
      frame.style.bottom = '0'
      frame.style.width = '0'
      frame.style.height = '0'
      frame.style.border = '0'
      document.body.appendChild(frame)
      iframeRef.current = frame
    }
    frame.onload = () => {
      try {
        frame!.contentWindow?.focus()
        frame!.contentWindow?.print()
      } catch {
        /* some browsers block cross-doc print from a blob iframe — PDF still downloadable */
      }
    }
    frame.src = res.url
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || loading}
        className="h-[38px] px-3 min-w-[120px] rounded border border-[var(--apex-blue-border)] bg-white text-[14px] text-[var(--apex-blue)] flex items-center justify-between gap-3 disabled:opacity-60"
      >
        <ChevronDown className="h-4 w-4" />
        <span>{label}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full z-20 mt-1 w-36 rounded border border-slate-200 bg-white py-1 text-[14px] shadow-lg">
            <button type="button" className="block w-full px-3 py-1.5 text-right hover:bg-slate-50" onClick={() => { setOpen(false); downloadPdf() }}>PDF</button>
            <button type="button" className="block w-full px-3 py-1.5 text-right hover:bg-slate-50" onClick={() => { setOpen(false); printPdf() }}>طباعة</button>
            <button type="button" className="block w-full px-3 py-1.5 text-right hover:bg-slate-50" onClick={() => { setOpen(false); onAdvancedPrint() }}>طباعة متقدمة</button>
          </div>
        </>
      )}
    </div>
  )
}
