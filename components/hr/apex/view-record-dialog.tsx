import type { ReactNode } from 'react'
import { ApexDialog } from './dialog'

export type ViewRecordField = { label: string; value: ReactNode }

export type ViewRecordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  fields: ViewRecordField[]
  size?: 'lg' | 'sm'
}

/** Apex «عرض» — a read-only field grid of the row's doc, rendered in the same
 *  `ApexDialog` frame (no primary/secondary buttons — Esc/✕ only). */
export function ViewRecordDialog({ open, onOpenChange, title, fields, size = 'lg' }: ViewRecordDialogProps) {
  return (
    <ApexDialog open={open} onOpenChange={onOpenChange} title={title} size={size}>
      {fields.map((f, i) => (
        <div key={i} className="space-y-1">
          <p className="text-[13px] text-slate-500">{f.label}</p>
          <p className="min-h-[20px] text-[14px] font-medium text-slate-800">{f.value ?? '—'}</p>
        </div>
      ))}
    </ApexDialog>
  )
}
