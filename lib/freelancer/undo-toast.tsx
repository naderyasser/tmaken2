'use client'

/**
 * showUndoToast — a success toast with an "Undo" action button.
 * Used after bulk/single mutations (stage change, status change, delete) so the
 * user can revert. `onUndo` should reverse the mutation (e.g. re-apply previous
 * status, or re-create a deleted doc from a snapshot).
 */

import { ToastAction } from '@/components/ui/toast'
import type { useToast } from '@/hooks/use-toast'

type ToastFn = ReturnType<typeof useToast>['toast']

export function showUndoToast(
  toast: ToastFn,
  opts: { title: string; description?: string; undoLabel: string; onUndo: () => void },
): void {
  toast({
    title: opts.title,
    description: opts.description,
    action: (
      <ToastAction altText={opts.undoLabel} onClick={opts.onUndo}>
        {opts.undoLabel}
      </ToastAction>
    ),
  })
}
