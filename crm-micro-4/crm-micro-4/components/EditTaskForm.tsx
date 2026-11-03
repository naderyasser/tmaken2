"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import type { TimerData } from "../types/TimerData"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { EnhancedTimePicker } from "./EnhancedTimePicker"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { CalendarIcon, Clock } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SubTasksList } from "./SubTasksList"

interface EditTaskFormProps {
  timer: TimerData
  onSave: (editedTimer: TimerData) => void
  onCancel: () => void
}

export function EditTaskForm({ timer, onSave, onCancel }: EditTaskFormProps) {
  const [name, setName] = useState(timer.name)
  const [date, setDate] = useState<Date>(new Date(timer.endDate))
  const [type, setType] = useState<"till" | "from">(timer.type)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [description, setDescription] = useState(timer.description || "")
  const [subTasks, setSubTasks] = useState(timer.subTasks || [])
  const [activeTab, setActiveTab] = useState("details")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    try {
      onSave({
        ...timer,
        name,
        endDate: date,
        type,
        description,
        subTasks,
      })
    } catch (error) {
      console.error("Error saving task:", error)
    }
  }

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      // Preserve the time from the current date
      const newDate = new Date(selectedDate)
      newDate.setHours(date.getHours(), date.getMinutes(), 0, 0)
      setDate(newDate)
    }
  }

  const handleTimeChange = (hours: number, minutes: number) => {
    const newDate = new Date(date)
    newDate.setHours(hours)
    newDate.setMinutes(minutes)
    setDate(newDate)
  }

  const handleAddSubTask = (name: string) => {
    const newSubTask = {
      id: Date.now().toString(),
      name,
      completed: false,
      createdAt: new Date(),
    }
    setSubTasks([...subTasks, newSubTask])
  }

  const handleToggleSubTaskComplete = (id: string, completed: boolean) => {
    setSubTasks(subTasks.map((subTask) => (subTask.id === id ? { ...subTask, completed } : subTask)))
  }

  const handleDeleteSubTask = (id: string) => {
    setSubTasks(subTasks.filter((subTask) => subTask.id !== id))
  }

  const handleEditSubTask = (id: string, name: string) => {
    setSubTasks(subTasks.map((subTask) => (subTask.id === id ? { ...subTask, name } : subTask)))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="details">التفاصيل</TabsTrigger>
          <TabsTrigger value="subtasks">
            المهام الفرعية{" "}
            {subTasks.length > 0 && `(${subTasks.filter((st) => st.completed).length}/${subTasks.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">اسم المهمة</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المهمة" required />
          </div>

          <div className="space-y-2">
            <Label>نوع المهمة</Label>
            <RadioGroup
              value={type}
              onValueChange={(value) => setType(value as "till" | "from")}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="till" id="till" />
                <Label htmlFor="till">حتى (مهمة قادمة)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="from" id="from" />
                <Label htmlFor="from">منذ (مهمة سابقة)</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label>التاريخ والوقت</Label>
            <div className="flex flex-col space-y-2">
              <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-right">
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {format(date, "PPP", { locale: ar })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(date) => {
                      handleDateSelect(date)
                      setIsCalendarOpen(false)
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <div className="flex items-center justify-center mt-2">
                <Clock className="ml-2 h-4 w-4" />
                <EnhancedTimePicker hours={date.getHours()} minutes={date.getMinutes()} onChange={handleTimeChange} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">وصف المهمة</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="أضف وصفاً للمهمة (اختياري)"
              rows={4}
            />
          </div>
        </TabsContent>

        <TabsContent value="subtasks">
          <div className="space-y-4">
            <SubTasksList
              subTasks={subTasks}
              onAddSubTask={handleAddSubTask}
              onToggleComplete={handleToggleSubTaskComplete}
              onDeleteSubTask={handleDeleteSubTask}
              onEditSubTask={handleEditSubTask}
            />
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          إلغاء
        </Button>
        <Button type="submit">حفظ التغييرات</Button>
      </div>
    </form>
  )
}
