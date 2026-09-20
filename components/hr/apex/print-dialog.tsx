'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ApexDialog } from './dialog'

export type PrintTemplate = { key: string; label: string; isDefault?: boolean }

export type PrintDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: PrintTemplate[]
  onPrint: (o: { template: string; lang: 'ar' | 'en'; saveDefault: boolean }) => void
  onExport: (o: { template: string; lang: 'ar' | 'en'; saveDefault: boolean; format: 'excel' | 'pdf' }) => void
  /** localStorage namespace for persisting the chosen default template/lang per page. */
  storageKey?: string
}

/**
 * Apex «الطابعة» dialog — radios «اسم القالب» / «لغة التصميم», checkbox «حفظ
 * هذه التغيرات لتكون الافتراضية», buttons «طباعة» (green) + «تصدير ▾» (navy).
 */
export function PrintDialog({ open, onOpenChange, templates, onPrint, onExport, storageKey }: PrintDialogProps) {
  const fallback = templates.find((t) => t.isDefault)?.key || templates[0]?.key || ''
  const [template, setTemplate] = useState(fallback)
  const [lang, setLang] = useState<'ar' | 'en'>('ar')
  const [saveDefault, setSaveDefault] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setExportOpen(false)
    let restored = false
    if (storageKey && typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem(`apex-print:${storageKey}`)
        if (raw) {
          const saved = JSON.parse(raw)
          if (saved?.template) { setTemplate(saved.template); restored = true }
          if (saved?.lang) setLang(saved.lang)
        }
      } catch { /* ignore malformed storage */ }
    }
    if (!restored) setTemplate(fallback)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const persist = () => {
    if (!saveDefault || !storageKey || typeof window === 'undefined') return
    try { window.localStorage.setItem(`apex-print:${storageKey}`, JSON.stringify({ template, lang })) } catch { /* ignore quota errors */ }
  }

  return (
    <ApexDialog
      open={open}
      onOpenChange={onOpenChange}
      title="الطابعة"
      size="sm"
      primary={{ label: 'طباعة', onClick: () => { persist(); onPrint({ template, lang, saveDefault }) } }}
      secondary={
        <div className="relative">
          <button
            type="button"
            onClick={() => setExportOpen((v) => !v)}
            style={{ height: 42 }}
            className="flex items-center gap-1.5 rounded-[4px] bg-[var(--apex-navy)] px-4 text-[15px] text-white"
          >
            تصدير <ChevronDown className="h-4 w-4" />
          </button>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
              <div className="absolute bottom-full z-20 mb-1 w-32 rounded border border-slate-200 bg-white py-1 text-[14px] shadow-lg">
                <button type="button" className="block w-full px-3 py-1.5 text-right hover:bg-slate-50" onClick={() => { setExportOpen(false); persist(); onExport({ template, lang, saveDefault, format: 'excel' }) }}>Excel</button>
                <button type="button" className="block w-full px-3 py-1.5 text-right hover:bg-slate-50" onClick={() => { setExportOpen(false); persist(); onExport({ template, lang, saveDefault, format: 'pdf' }) }}>PDF</button>
              </div>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-2">
        <p className="text-[13px] font-bold text-slate-700">اسم القالب</p>
        <div className="flex flex-col gap-2">
          {templates.map((t) => (
            <label key={t.key} className="flex items-center gap-1.5 text-[14px] text-slate-700">
              <input type="radio" name="apex-print-template" checked={template === t.key} onChange={() => setTemplate(t.key)} className="h-4 w-4 accent-[var(--apex-blue)]" />
              {t.label}{t.isDefault ? ' (الافتراضي)' : ''}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[13px] font-bold text-slate-700">لغة التصميم</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-1.5 text-[14px] text-slate-700">
            <input type="radio" name="apex-print-lang" checked={lang === 'ar'} onChange={() => setLang('ar')} className="h-4 w-4 accent-[var(--apex-blue)]" />
            العربية
          </label>
          <label className="flex items-center gap-1.5 text-[14px] text-slate-700">
            <input type="radio" name="apex-print-lang" checked={lang === 'en'} onChange={() => setLang('en')} className="h-4 w-4 accent-[var(--apex-blue)]" />
            الانجليزية
          </label>
        </div>
      </div>

      <label className="flex items-center gap-2 text-[14px] text-slate-700">
        <input type="checkbox" checked={saveDefault} onChange={(e) => setSaveDefault(e.target.checked)} className="h-4 w-4 accent-[var(--apex-green)]" />
        حفظ هذه التغيرات لتكون الافتراضية
      </label>
    </ApexDialog>
  )
}
