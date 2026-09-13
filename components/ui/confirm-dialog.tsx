'use client'

import { Loader2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string
  /**
   * "destructive" renders the confirm button in red.
   * Defaults to "destructive" — most confirmations are for irreversible actions.
   */
  variant?: 'destructive' | 'default'
  /** Called when the user clicks the confirm button. */
  onConfirm: () => void
  /** When true, shows a spinner on the confirm button and disables both buttons. */
  loading?: boolean
  /** Optional Tailwind class override for the confirm button (e.g. a custom green). */
  confirmClassName?: string
}

/**
 * Single, reusable confirmation dialog.
 * Replaces all ad-hoc `window.confirm()` calls and one-off AlertDialog
 * implementations across the codebase.
 *
 * Usage:
 * ```tsx
 * <ConfirmDialog
 *   open={confirmOpen}
 *   onOpenChange={setConfirmOpen}
 *   title="Delete employee?"
 *   description="This cannot be undone."
 *   onConfirm={handleDelete}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  onConfirm,
  loading = false,
  confirmClassName,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            disabled={loading}
            className={cn(
              variant === 'destructive' && buttonVariants({ variant: 'destructive' }),
              confirmClassName,
            )}
            onClick={(e) => {
              e.preventDefault()
              onConfirm()
            }}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
