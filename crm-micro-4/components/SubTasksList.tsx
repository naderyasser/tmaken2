"use client"

import { useState } from "react"
import { SubTaskItem } from "./SubTaskItem"
import { AddSubTask } from "./AddSubTask"
import type { SubTaskData } from "../types/TimerData"
import { Badge } from "@/components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

interface SubTasksListProps {
  subTasks: SubTaskData[]
  onAddSubTask: (name: string) => void
  onToggleComplete: (id: string, completed: boolean) => void
  onDeleteSubTask: (id: string) => void
  onEditSubTask: (id: string, name: string) => void
}

type FilterType = "all" | "active" | "completed"

export function SubTasksList({
  subTasks,
  onAddSubTask,
  onToggleComplete,
  onDeleteSubTask,
  onEditSubTask,
}: SubTasksListProps) {
  const [filter, setFilter] = useState<FilterType>("all")

  const filteredSubTasks = subTasks.filter((task) => {
    if (filter === "all") return true
    if (filter === "active") return !task.completed
    if (filter === "completed") return task.completed
    return true
  })

  const completedCount = subTasks.filter((task) => task.completed).length
  const totalCount = subTasks.length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">المهام الفرعية</h3>
          <Badge variant="outline">
            {completedCount}/{totalCount}
          </Badge>
        </div>

        <ToggleGroup type="single" value={filter} onValueChange={(value) => value && setFilter(value as FilterType)}>
          <ToggleGroupItem value="all" aria-label="عرض جميع المهام" size="sm">
            الكل
          </ToggleGroupItem>
          <ToggleGroupItem value="active" aria-label="عرض المهام النشطة" size="sm">
            النشطة
          </ToggleGroupItem>
          <ToggleGroupItem value="completed" aria-label="عرض المهام المكتملة" size="sm">
            المكتملة
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="space-y-2">
        {filteredSubTasks.length > 0 ? (
          filteredSubTasks.map((subTask) => (
            <SubTaskItem
              key={subTask.id}
              subTask={subTask}
              onToggleComplete={onToggleComplete}
              onDelete={onDeleteSubTask}
              onEdit={onEditSubTask}
            />
          ))
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            {filter === "all"
              ? "لا توجد مهام فرعية"
              : filter === "active"
                ? "لا توجد مهام فرعية نشطة"
                : "لا توجد مهام فرعية مكتملة"}
          </div>
        )}
      </div>

      <AddSubTask onAdd={onAddSubTask} />
    </div>
  )
}
