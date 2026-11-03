import { getBrandSync } from '@/hooks/use-brand'
import { injectLetterhead } from '@/lib/print-letterhead'

// Open a self-contained HTML document in a new window and trigger the print
// dialog — the same technique the properties list «طباعة» already uses inline.
// Used by the كشف حساب / سجل الحركات dialogs (buildStatementHtml / buildLedgerHtml).
export function printHtmlContent(html: string): void {
  html = injectLetterhead(html, getBrandSync())
  const w = window.open('', '_blank')
  if (!w) return
  w.document.open()
  w.document.write(html)
  w.document.close()
  // Give the new document a tick to parse before printing.
  setTimeout(() => {
    try { w.focus(); w.print() } catch { /* popup blocked mid-flight */ }
  }, 300)
}
