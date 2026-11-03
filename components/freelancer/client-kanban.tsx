'use client'

/**
 * ClientKanban — drag-and-drop pipeline view for LEADS only (customers excluded).
 * Columns are the 4 active stages (new/contacted/qualified/converted). Dropping a
 * card calls `onMove`, which the parent persists (Lead.status) optimistically with
 * an undo toast. Mirrors the tasks kanban DnD pattern.
 */

import { useEffect, useState } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { Phone, MapPin, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { translateEnum } from '@/lib/enums'
import { LEAD_STAGES, leadStageLabel, type LeadStage } from '@/lib/freelancer/lead-pipeline'
import type { ClientRow } from '@/components/freelancer/client-detail-sheet'

const COLUMN_ACCENT: Record<LeadStage, string> = {
  new: 'border-t-slate-400',
  contacted: 'border-t-blue-500',
  qualified: 'border-t-violet-500',
  converted: 'border-t-primary',
  lost: 'border-t-gray-300',
}

interface ClientKanbanProps {
  leads: ClientRow[]
  isRTL: boolean
  lang: 'ar' | 'en'
  onCardClick: (row: ClientRow) => void
  onMove: (row: ClientRow, toStage: LeadStage) => void
  movingId?: string | null
}

function groupByStage(leads: ClientRow[]): Record<LeadStage, ClientRow[]> {
  const out: Record<LeadStage, ClientRow[]> = { new: [], contacted: [], qualified: [], converted: [], lost: [] }
  for (const l of leads) out[out[l.stage] ? l.stage : 'new'].push(l)
  return out
}

export function ClientKanban({ leads, isRTL, lang, onCardClick, onMove, movingId }: ClientKanbanProps) {
  // Local board for instant optimistic moves; reseed when leads change (parent reload).
  const [board, setBoard] = useState<Record<LeadStage, ClientRow[]>>(() => groupByStage(leads))
  useEffect(() => { setBoard(groupByStage(leads)) }, [leads])

  const handleDragEnd = (result: DropResult) => {
    const { draggableId, source, destination } = result
    if (!destination) return
    const toStage = destination.droppableId as LeadStage
    const fromStage = source.droppableId as LeadStage
    if (toStage === fromStage) return
    const row = (board[fromStage] || []).find((r) => r.id === draggableId)
    if (!row) return
    setBoard((prev) => {
      const next = { ...prev }
      next[fromStage] = (prev[fromStage] || []).filter((r) => r.id !== draggableId)
      next[toStage] = [{ ...row, stage: toStage }, ...(prev[toStage] || [])]
      return next
    })
    onMove(row, toStage)
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div
        className="grid gap-3 overflow-x-auto pb-2"
        style={{ gridTemplateColumns: `repeat(${LEAD_STAGES.length}, minmax(240px, 1fr))` }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {LEAD_STAGES.map((stage) => {
          const items = board[stage] || []
          return (
            <div key={stage} className={cn('flex min-h-[420px] flex-col rounded-lg border border-t-4 bg-muted/20', COLUMN_ACCENT[stage])}>
              <div className="flex items-center justify-between border-b px-3 py-2.5">
                <h3 className="text-sm font-semibold">{leadStageLabel(stage, isRTL)}</h3>
                <span className="rounded-full border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">{items.length}</span>
              </div>
              <Droppable droppableId={stage}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn('flex-1 space-y-2 overflow-y-auto p-2', snapshot.isDraggingOver && 'rounded-b-lg bg-primary/5 ring-1 ring-primary/20')}
                  >
                    {items.length === 0 && (
                      <p className="py-8 text-center text-xs text-muted-foreground">{isRTL ? 'لا يوجد' : 'Empty'}</p>
                    )}
                    {items.map((row, idx) => (
                      <Draggable key={row.id} draggableId={row.id} index={idx}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            onClick={() => onCardClick(row)}
                            className={cn(
                              'relative cursor-pointer rounded-lg border bg-background p-3 shadow-sm hover:border-primary/40',
                              snap.isDragging && 'rotate-1 opacity-90 shadow-md',
                            )}
                          >
                            {movingId === row.id && (
                              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/60">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              </div>
                            )}
                            <p className="truncate text-sm font-medium">{row.name}</p>
                            {row.phone && (
                              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground" dir="ltr">
                                <Phone className="h-3 w-3" />{row.phone}
                              </p>
                            )}
                            {row.territory && (
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />{translateEnum('territory', row.territory, lang)}
                              </p>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}
