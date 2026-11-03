'use client'

// Non-dashboard rentals sections (contracts/invoices/properties/tenants) are
// separate follow-up tasks. Until they are ported, the shell renders this
// placeholder so navigation stays coherent.
import { Construction } from 'lucide-react'

export function SectionPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-muted-foreground gap-3" dir="rtl">
      <div className="size-16 rounded-2xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
        <Construction className="size-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <p className="font-semibold text-lg text-slate-700 dark:text-slate-200">{title}</p>
      <p className="text-sm">هذا القسم قيد الإنشاء</p>
    </div>
  )
}
