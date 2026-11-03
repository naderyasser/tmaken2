"use client"

import { useState } from "react"
import { Check, Trash, Edit, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { SubTaskData } from "../types/TimerData"
import { formatDistanceToNow } from "date-fns"
import { ar } from "date-fns/locale"

interface SubTaskItemProps {
  subTask: SubTaskData
  onToggleComplete: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
  onEdit: (id: string, name: string) => void
}

export function SubTaskItem({ subTask, onToggleComplete, onDelete, onEdit }: SubTaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(subTask.name)

  const handleToggleComplete = () => {
    onToggleComplete(subTask.id, !subTask.completed)
  }

  const handleSaveEdit = () => {
    if (editedName.trim()) {
      onEdit(subTask.id, editedName)
      setIsEditing(false)
    }
  }

  const handleCancelEdit = () => {
    setEditedName(subTask.name)
    setIsEditing(false)
  }

  const createdTimeAgo = formatDistanceToNow(new Date(subTask.createdAt), {
    addSuffix: true,
    locale: ar,
  })

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg mb-2 bg-background/50 hover:bg-background transition-colors">
      {isEditing ? (
        <div className="flex items-center gap-2 w-full">
          <Input
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            className="flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveEdit()
              if (e.key === "Escape") handleCancelEdit()
            }}
          />
          <Button size="icon" variant="ghost" onClick={handleSaveEdit} className="h-8 w-8">
            <Check className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={handleCancelEdit} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 rounded-full ${
                subTask.completed
                  ? "bg-green-100 text-green-700 hover:bg-green-200 hover:text-green-800"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
              onClick={handleToggleComplete}
            >
              {subTask.completed && <Check className="h-3 w-3" />}
            </Button>
            <div className="flex flex-col">
              <span className={`text-sm ${subTask.completed ? "line-through text-muted-foreground" : ""}`}>
                {subTask.name}
              </span>
              <span className="text-xs text-muted-foreground">{createdTimeAgo}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:text-red-800 hover:bg-red-100"
              onClick={() => onDelete(subTask.id)}
            >
              <Trash className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
