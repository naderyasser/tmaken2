'use client'

/**
 * Stepper — progress indicator for multi-step forms (add-employee, onboarding)
 * and approval chains. Numbered circles joined by connectors; done/current/todo
 * states. Horizontal (labels under circles) or vertical (labels beside). Circles
 * become buttons when `onStepClick` is provided. Token-only + RTL-safe (flows via
 * dir + logical props; no positional literals).
 */

import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type StepState = 'done' | 'current' | 'todo'

export interface StepperStep {
  id: string
  label: string
  description?: string
  state?: StepState
}

export interface StepperProps {
  steps: StepperStep[]
  orientation?: 'horizontal' | 'vertical'
  onStepClick?: (id: string) => void
  className?: string
}

function Circle({ state, index }: { state: StepState; index: number }) {
  return (
    <span
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors',
        state === 'done' && 'bg-primary text-primary-foreground',
        state === 'current' && 'border-2 border-primary bg-card text-primary',
        state === 'todo' && 'border border-border bg-card text-muted-foreground',
      )}
    >
      {state === 'done' ? <Check className="h-4 w-4" /> : index + 1}
    </span>
  )
}

function labelCls(state: StepState) {
  return cn('text-sm', state === 'current' ? 'font-medium text-foreground' : 'text-muted-foreground')
}

export function Stepper({ steps, orientation = 'horizontal', onStepClick, className }: StepperProps) {
  const state = (s: StepperStep): StepState => s.state ?? 'todo'
  const clickable = !!onStepClick

  if (orientation === 'vertical') {
    return (
      <ol className={cn('flex flex-col', className)}>
        {steps.map((s, i) => {
          const isLast = i === steps.length - 1
          const node = (
            <>
              <div className="flex flex-col items-center">
                <Circle state={state(s)} index={i} />
                {!isLast && <span className={cn('my-1 min-h-6 w-px flex-1', state(s) === 'done' ? 'bg-primary' : 'bg-border')} />}
              </div>
              <div className={cn('pb-6', isLast && 'pb-0')}>
                <p className={labelCls(state(s))}>{s.label}</p>
                {s.description && <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>}
              </div>
            </>
          )
          return (
            <li key={s.id} className="flex gap-3">
              {clickable ? (
                <button type="button" onClick={() => onStepClick!(s.id)} className="flex flex-1 gap-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
                  {node}
                </button>
              ) : (
                node
              )}
            </li>
          )
        })}
      </ol>
    )
  }

  // Horizontal
  return (
    <ol className={cn('flex items-start', className)}>
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1
        const inner = (
          <div className="flex flex-col items-center text-center">
            <Circle state={state(s)} index={i} />
            <p className={cn('mt-2 max-w-[8rem] leading-tight', labelCls(state(s)))}>{s.label}</p>
          </div>
        )
        return (
          <React.Fragment key={s.id}>
            {clickable ? (
              <li>
                <button type="button" onClick={() => onStepClick!(s.id)} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {inner}
                </button>
              </li>
            ) : (
              <li>{inner}</li>
            )}
            {!isLast && (
              <li aria-hidden className={cn('mt-4 h-px flex-1', state(s) === 'done' ? 'bg-primary' : 'bg-border')} />
            )}
          </React.Fragment>
        )
      })}
    </ol>
  )
}
