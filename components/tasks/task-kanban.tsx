'use client'

import { useState, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { TaskCard } from './task-card'
import type { WorkflowTask, KanbanData } from '@/lib/task-api'
import { taskApi } from '@/lib/task-api'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

const L = {
  en: {
    new: 'New', inProgress: 'In Progress', completed: 'Completed', overdue: 'Overdue',
    empty: 'No tasks',
  },
  ar: {
    new: 'جديد', inProgress: 'قيد التنفيذ', completed: 'مكتمل', overdue: 'متأخر',
    empty: 'لا توجد مهام',
  }
}

const columnConfig = [
  { key: 'New',         color: 'border-t-blue-500',   bg: 'bg-blue-50/50' },
  { key: 'In Progress', color: 'border-t-amber-500',  bg: 'bg-amber-50/50' },
  { key: 'Completed',   color: 'border-t-green-500',  bg: 'bg-green-50/50' },
  { key: 'Overdue',     color: 'border-t-red-500',    bg: 'bg-red-50/50' },
]

interface TaskKanbanProps {
  data: KanbanData
  lang: 'en' | 'ar'
  isRTL: boolean
  onTaskClick: (task: WorkflowTask) => void
  onRefresh: () => void
}

export function TaskKanban({ data, lang, isRTL, onTaskClick, onRefresh }: TaskKanbanProps) {
  const t = L[lang]
  const [updating, setUpdating] = useState<string | null>(null)

  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { draggableId, destination } = result
    if (!destination) return

    const newStatus = destination.droppableId
    const taskName = draggableId

    // Find the task in current data to check current status
    for (const tasks of Object.values(data)) {
      const task = tasks.find(t => t.name === taskName)
      if (task && task.status !== newStatus) {
        setUpdating(taskName)
        try {
          await taskApi.updateTaskStatus(taskName, newStatus)
          onRefresh()
        } catch {
          // Will refresh anyway
        } finally {
          setUpdating(null)
        }
        break
      }
    }
  }, [data, onRefresh])

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div
        className={cn('grid gap-4', isRTL ? 'grid-flow-col-dense' : '')}
        style={{ gridTemplateColumns: `repeat(${columnConfig.length}, minmax(260px, 1fr))` }}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        {columnConfig.map(col => {
          const tasks = data[col.key] || []
          const labelKey = col.key === 'In Progress' ? 'inProgress' : col.key.toLowerCase()
          const label = t[labelKey as keyof typeof t] || col.key

          return (
            <div
              key={col.key}
              className={cn(
                'rounded-lg border border-t-4 min-h-[400px] flex flex-col',
                col.color, col.bg
              )}
            >
              {/* Column header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm">{label}</h3>
                  <span className="bg-white border rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {tasks.length}
                  </span>
                </div>
              </div>

              {/* Droppable area */}
              <Droppable droppableId={col.key}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 p-2 space-y-2 overflow-y-auto',
                      snapshot.isDraggingOver && 'bg-primary/5 ring-1 ring-primary/20 rounded-b-lg'
                    )}
                  >
                    {tasks.length === 0 && (
                      <p className="text-center text-xs text-muted-foreground py-8">{t.empty}</p>
                    )}
                    {tasks.map((task, idx) => (
                      <Draggable
                        key={task.name}
                        draggableId={task.name}
                        index={idx}
                        isDragDisabled={col.key === 'Completed'}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn(
                              'relative',
                              snapshot.isDragging && 'opacity-80 rotate-1 scale-[1.02]'
                            )}
                          >
                            {updating === task.name && (
                              <div className="absolute inset-0 bg-white/60 z-10 flex items-center justify-center rounded-lg">
                                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                              </div>
                            )}
                            <TaskCard
                              task={task}
                              lang={lang}
                              onClick={() => onTaskClick(task)}
                            />
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
