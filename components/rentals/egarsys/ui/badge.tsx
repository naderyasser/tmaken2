// Ported from egarsys src/components/ui/badge.tsx (Tailwind v4 → v3 adapted).
// The platform's own Badge lacks egarsys's semantic colour variants
// (success/warning/danger/info/neutral/…) that the dashboard relies on.
import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-semibold w-fit whitespace-nowrap shrink-0 gap-1 [&>svg]:size-3 [&>svg]:pointer-events-none transition-colors overflow-hidden',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        destructive: 'border-transparent bg-destructive text-white',
        outline: 'text-foreground',
        gold: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        success:
          'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        warning:
          'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        danger:
          'border-transparent bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        info: 'border-transparent bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
        neutral:
          'border-transparent bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400',
        purple:
          'border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
        teal: 'border-transparent bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
        lime: 'border-transparent bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-400',
        indigo:
          'border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
        orange:
          'border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
        stone:
          'border-transparent bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span'
  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
