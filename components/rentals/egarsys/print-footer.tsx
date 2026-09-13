'use client'

// Ported from egarsys src/components/print-footer.tsx — the print-only footer at the
// bottom of the printable invoices report. Hidden on screen; shown when printing.
import { QRCodeSVG } from 'qrcode.react'

export default function PrintFooter() {
  return (
    <div className="hidden print:flex items-center justify-between border-t border-slate-300 pt-3 mt-6 text-xs text-slate-500">
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <p className="font-bold text-slate-700 text-[9px] leading-tight">عمل مينا</p>
          <QRCodeSVG value="https://basemena.com" size={44} level="M" />
          <p className="font-bold text-slate-700 text-[9px] leading-tight">لتقنية المعلومات</p>
        </div>
        <p className="text-slate-400 text-[9px]">basemena.com</p>
      </div>
      <div className="text-right">
        <p>برنامج موثّق</p>
        <p>{new Date().toLocaleDateString('ar-SA')}</p>
      </div>
    </div>
  )
}
