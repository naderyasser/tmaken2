'use client'

import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X, Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type ApexDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** lg = 960px (2 columns of 410px), sm = 480px (1 column). */
  size?: 'lg' | 'sm'
  primary?: { label: string; onClick: () => void; disabled?: boolean; loading?: boolean }
  secondary?: ReactNode
  children: ReactNode
}

/**
 * Apex generic dialog frame — width 960/480, radius 10, ✕ at the TOP-LEFT
 * corner, bold centered title, body grid (2×410px on `lg`), footer: ONE
 * green button at the bottom-LEFT (no cancel button — Esc / ✕ close).
 *
 * Built directly on `@radix-ui/react-dialog` (not the shared
 * `components/ui/dialog.tsx`) because that shared primitive hard-codes its
 * own top-RIGHT close button — reusing it would either duplicate the X or
 * require editing a primitive other verticals also depend on.
 */
export function ApexDialog({ open, onOpenChange, title, size = 'lg', primary, secondary, children }: ApexDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          dir="rtl"
          className={cn(
            'theme-hr fixed left-1/2 top-1/2 z-50 max-h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto bg-white text-[var(--apex-text)] shadow-lg outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            size === 'lg' ? 'max-w-[960px]' : 'max-w-[480px]',
          )}
          style={{ borderRadius: 10 }}
        >
          <div style={{ padding: 25 }}>
            <div className="relative mb-5 flex min-h-[26px] items-center justify-center">
              <DialogPrimitive.Close
                aria-label="اغلاق"
                className="absolute left-0 top-0 rounded p-0.5 text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--apex-blue)]"
              >
                <X className="h-5 w-5" />
              </DialogPrimitive.Close>
              <DialogPrimitive.Title className="text-center text-[18px] font-bold text-[var(--apex-text)]">
                {title}
              </DialogPrimitive.Title>
            </div>

            <div className="-mx-1 px-1">
              <div
                className="grid gap-x-6 gap-y-4"
                style={size === 'lg' ? { gridTemplateColumns: 'repeat(2, minmax(0, 410px))', justifyContent: 'space-between' } : { gridTemplateColumns: '1fr' }}
              >
                {children}
              </div>
            </div>

            {(primary || secondary) && (
              <div className="mt-6 flex items-center justify-end gap-3">
                {primary && (
                  <button
                    type="button"
                    onClick={primary.onClick}
                    disabled={primary.disabled || primary.loading}
                    style={{ width: 139, height: 42 }}
                    className="flex items-center justify-center gap-2 rounded-[4px] bg-[var(--apex-green)] text-[15px] text-white hover:bg-[var(--apex-green-dark)] disabled:opacity-50"
                  >
                    {primary.loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    {primary.loading ? 'جاري الحفظ…' : primary.label}
                  </button>
                )}
                {secondary}
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
