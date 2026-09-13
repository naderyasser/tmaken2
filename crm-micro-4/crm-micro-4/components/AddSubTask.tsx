"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus } from "lucide-react"

interface AddSubTaskProps {
  onAdd: (name: string) => void
}

export function AddSubTask({ onAdd }: AddSubTaskProps) {
  const [name, setName] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name)
      setName("")
      setIsAdding(false)
    }
  }

  if (!isAdding) {
    return (
      <Button
        variant="ghost"
        className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground/50"
        onClick={() => setIsAdding(true)}
      >
        <Plus className="h-4 w-4" />
        <span>إضافة مهمة فرعية</span>
      </Button>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="اسم المهمة الفرعية"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd()
          if (e.key === "Escape") setIsAdding(false)
        }}
      />
      <Button onClick={handleAdd}>إضافة</Button>
      <Button variant="ghost" onClick={() => setIsAdding(false)}>
        إلغاء
      </Button>
    </div>
  )
}
