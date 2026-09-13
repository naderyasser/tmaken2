"use client"

import { Suspense, useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Toaster } from "@/components/ui/toaster"
import { Button } from "@/components/ui/button"
import { Check, Edit, Share2, ArrowLeft, Save, X, Bell, BellOff, Calendar, Clock } from 'lucide-react'
import type { TimerData, SubTaskData } from "../../../types/TimerData"
import { useToast } from "@/components/ui/use-toast"
import {
  sendWhatsAppNotification,
  areWhatsAppNotificationsEnabled,
  toggleWhatsAppNotifications,
} from "../../../utils/webhook"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { format, formatDistanceToNow } from "date-fns"
import { ar } from "date-fns/locale"
import { EnhancedTimePicker } from "../../../components/EnhancedTimePicker"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { SubTasksList } from "../../../components/SubTasksList"
import { Badge } from "@/components/ui/badge"

function TaskContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { id } = params
  const [task, setTask] = useState<TimerData | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [editedTask, setEditedTask] = useState<TimerData | null>(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [activeTab, setActiveTab] = useState(searchParams?.get("tab") || "details")
  const [isEditingDescription, setIsEditingDescription] = useState(false)

  useEffect(() => {
    // Load the specific task from localStorage
    const storedTimers = localStorage.getItem("timers")
    if (storedTimers) {
      try {
        const timers = JSON.parse(storedTimers, (key, value) => {
          // Handle date conversion properly
          if (key === "endDate" && typeof value === "string") {
            return new Date(value)
          }
          if (key === "createdAt" && typeof value === "string") {
            return new Date(value)
          }
          if (key === "subTasks" && Array.isArray(value)) {
            return value.map((subTask: any) => ({
              ...subTask,
              createdAt: subTask.createdAt ? new Date(subTask.createdAt) : new Date(),
            }))
          }
          return value
        })

        // Find the task by ID
        const foundTask = timers.find((t: TimerData) => t.id === id)

        if (foundTask) {
          // Ensure endDate is a Date object
          if (!(foundTask.endDate instanceof Date)) {
            foundTask.endDate = new Date(foundTask.endDate)
          }

          // Ensure createdAt is a Date object
          if (!foundTask.createdAt) {
            foundTask.createdAt = new Date()
          } else if (!(foundTask.createdAt instanceof Date)) {
            foundTask.createdAt = new Date(foundTask.createdAt)
          }

          // Ensure subTasks is an array
          if (!foundTask.subTasks) {
            foundTask.subTasks = []
          }

          setTask(foundTask)
          setEditedTask({ ...foundTask })
        }
      } catch (error) {
        console.error("Error loading task:", error)
      }
    }

    // التحقق من حالة الإشعارات
    setNotificationsEnabled(areWhatsAppNotificationsEnabled())
    setLoading(false)
  }, [id])

  // تحديث علامة التبويب النشطة عند تغيير معلمات البحث
  useEffect(() => {
    const tab = searchParams?.get("tab")
    if (tab) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const handleComplete = async () => {
    if (!task) return

    const newCompletionStatus = !task.completed

    // Update the task in localStorage
    const storedTimers = localStorage.getItem("timers")
    if (storedTimers) {
      try {
        const timers = JSON.parse(storedTimers, (key, value) => {
          if (key === "endDate" && typeof value === "string") {
            return new Date(value)
          }
          if (key === "createdAt" && typeof value === "string") {
            return new Date(value)
          }
          return value
        })

        const updatedTimers = timers.map((t: TimerData) => {
          if (t.id === id) {
            return { ...t, completed: newCompletionStatus }
          }
          return t
        })

        localStorage.setItem("timers", JSON.stringify(updatedTimers))

        // Update the local state
        setTask({ ...task, completed: newCompletionStatus })
        setEditedTask({ ...task, completed: newCompletionStatus })

        // Show toast notification
        toast({
          title: newCompletionStatus ? "تم إكمال المهمة" : "تم إلغاء إكمال المهمة",
          description: task.name,
        })

        // إرسال إشعار بتغيير حالة الإكمال
        if (notificationsEnabled) {
          try {
            const taskLink = `${window.location.origin}/task/${id}`
            let message = ""

            if (newCompletionStatus) {
              message = `✅ تم إكمال المهمة: ${task.name}\n\nرابط المهمة: ${taskLink}`
            } else {
              message = `⚠️ تم التراجع عن إكمال المهمة: ${task.name}\n\nرابط المهمة: ${taskLink}`
            }

            sendWhatsAppNotification(message).catch((error) => {
              console.error("Error sending notification:", error)
            })
          } catch (error) {
            console.error("Error preparing notification:", error)
          }
        }
      } catch (error) {
        console.error("Error updating task:", error)
      }
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedTask(task ? { ...task } : null)
  }

  const handleSaveEdit = async () => {
    if (!editedTask || !task) return

    // Update the task in localStorage
    const storedTimers = localStorage.getItem("timers")
    if (storedTimers) {
      try {
        const timers = JSON.parse(storedTimers, (key, value) => {
          if (key === "endDate" && typeof value === "string") {
            return new Date(value)
          }
          if (key === "createdAt" && typeof value === "string") {
            return new Date(value)
          }
          return value
        })

        const updatedTimers = timers.map((t: TimerData) => {
          if (t.id === id) {
            return editedTask
          }
          return t
        })

        localStorage.setItem("timers", JSON.stringify(updatedTimers))

        // Update the local state
        setTask({ ...editedTask })
        setIsEditing(false)

        // Show toast notification
        toast({
          title: "تم حفظ التغييرات",
          description: "تم تحديث المهمة بنجاح",
        })

        // إرسال إشعار بتعديل المهمة
        if (notificationsEnabled) {
          try {
            const taskLink = `${window.location.origin}/task/${id}`
            const message = `🔄 تم تعديل المهمة: ${editedTask.name}\n\nرابط المهمة: ${taskLink}`
            sendWhatsAppNotification(message).catch((error) => {
              console.error("Error sending notification:", error)
            })
          } catch (error) {
            console.error("Error preparing notification:", error)
          }
        }
      } catch (error) {
        console.error("Error updating task:", error)
        toast({
          title: "حدث خطأ",
          description: "لم يتم حفظ التغييرات",
          variant: "destructive",
        })
      }
    }
  }

  const handleShare = async () => {
    if (!task) return

    const taskLink = `${window.location.origin}/task/${id}`

    try {
      await navigator.clipboard.writeText(taskLink)
      toast({
        title: "تم نسخ الرابط",
        description: "تم نسخ رابط المهمة إلى الحافظة",
      })
    } catch (err) {
      console.error("Failed to copy link:", err)
      toast({
        title: "فشل نسخ الرابط",
        description: "يرجى المحاولة مرة أخرى",
        variant: "destructive",
      })
    }
  }

  const handleBack = () => {
    router.push("/")
  }

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (!editedTask || !selectedDate) return

    // Preserve the time from the current date
    const newDate = new Date(selectedDate)
    newDate.setHours(editedTask.endDate.getHours(), editedTask.endDate.getMinutes(), 0, 0)

    setEditedTask({
      ...editedTask,
      endDate: newDate,
    })
  }

  const handleTimeChange = (hours: number, minutes: number) => {
    if (!editedTask) return

    const newDate = new Date(editedTask.endDate)
    newDate.setHours(hours)
    newDate.setMinutes(minutes)

    setEditedTask({
      ...editedTask,
      endDate: newDate,
    })
  }

  const handleToggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled)
    toggleWhatsAppNotifications(enabled)

    toast({
      title: enabled ? "تم تفعيل الإشعارات" : "تم إيقاف الإشعارات",
      description: enabled ? "سيتم إرسال إشعارات الواتساب" : "لن يتم إرسال إشعارات الواتساب",
    })
  }

  const handleSaveDescription = () => {
    if (!editedTask || !task) return

    // Update the task in localStorage
    const storedTimers = localStorage.getItem("timers")
    if (storedTimers) {
      try {
        const timers = JSON.parse(storedTimers, (key, value) => {
          if (key === "endDate" && typeof value === "string") {
            return new Date(value)
          }
          if (key === "createdAt" && typeof value === "string") {
            return new Date(value)
          }
          return value
        })

        const updatedTimers = timers.map((t: TimerData) => {
          if (t.id === id) {
            return { ...t, description: editedTask.description }
          }
          return t
        })

        localStorage.setItem("timers", JSON.stringify(updatedTimers))

        // Update the local state
        setTask({ ...task, description: editedTask.description })
        setIsEditingDescription(false)

        // Show toast notification
        toast({
          title: "تم حفظ الوصف",
          description: "تم تحديث وصف المهمة بنجاح",
        })
      } catch (error) {
        console.error("Error updating task description:", error)
        toast({
          title: "حدث خطأ",
          description: "لم يتم حفظ الوصف",
          variant: "destructive",
        })
      }
    }
  }

  const handleAddSubTask = (name: string) => {
    if (!task) return

    const newSubTask: SubTaskData = {
      id: Date.now().toString(),
      name,
      completed: false,
      createdAt: new Date(),
    }

    const updatedSubTasks = [...(task.subTasks || []), newSubTask]

    // Update the task in localStorage
    const storedTimers = localStorage.getItem("timers")
    if (storedTimers) {
      try {
        const timers = JSON.parse(storedTimers, (key, value) => {
          if (key === "endDate" && typeof value === "string") {
            return new Date(value)
          }
          if (key === "createdAt" && typeof value === "string") {
            return new Date(value)
          }
          return value
        })

        const updatedTimers = timers.map((t: TimerData) => {
          if (t.id === id) {
            return { ...t, subTasks: updatedSubTasks }
          }
          return t
        })

        localStorage.setItem("timers", JSON.stringify(updatedTimers))

        // Update the local state
        setTask({ ...task, subTasks: updatedSubTasks })
        if (editedTask) {
          setEditedTask({ ...editedTask, subTasks: updatedSubTasks })
        }

        // Show toast notification
        toast({
          title: "تمت إضافة المهمة الفرعية",
          description: `تمت إضافة "${name}" بنجاح`,
        })

        // إرسال إشعار بإضافة مهمة فرعية
        if (notificationsEnabled) {
          try {
            const taskLink = `${window.location.origin}/task/${id}?tab=subtasks`
            const message = `➕ تمت إضافة مهمة فرعية: "${name}" للمهمة: ${task.name}\n\nرابط المهمة: ${taskLink}`
            sendWhatsAppNotification(message).catch((error) => {
              console.error("Error sending notification:", error)
            })
          } catch (error) {
            console.error("Error preparing notification:", error)
          }
        }
      } catch (error) {
        console.error("Error adding subtask:", error)
        toast({
          title: "حدث خطأ",
          description: "لم يتم إضافة المهمة الفرعية",
          variant: "destructive",
        })
      }
    }
  }

  const handleToggleSubTaskComplete = (subTaskId: string, completed: boolean) => {
    if (!task || !task.subTasks) return

    const updatedSubTasks = task.subTasks.map((subTask) =>
      subTask.id === subTaskId ? { ...subTask, completed } : subTask,
    )

    // Update the task in localStorage
    const storedTimers = localStorage.getItem("timers")
    if (storedTimers) {
      try {
        const timers = JSON.parse(storedTimers, (key, value) => {
          if (key === "endDate" && typeof value === "string") {
            return new Date(value)
          }
          if (key === "createdAt" && typeof value === "string") {
            return new Date(value)
          }
          return value
        })

        const updatedTimers = timers.map((t: TimerData) => {
          if (t.id === id) {
            return { ...t, subTasks: updatedSubTasks }
          }
          return t
        })

        localStorage.setItem("timers", JSON.stringify(updatedTimers))

        // Update the local state
        setTask({ ...task, subTasks: updatedSubTasks })
        if (editedTask) {
          setEditedTask({ ...editedTask, subTasks: updatedSubTasks })
        }

        // إرسال إشعار بتغيير حالة المهمة الفرعية
        if (notificationsEnabled) {
          try {
            const subTask = task.subTasks.find((st) => st.id === subTaskId)
            if (subTask) {
              const taskLink = `${window.location.origin}/task/${id}?tab=subtasks`
              const message = completed
                ? `✅ تم إكمال المهمة الفرعية: "${subTask.name}" للمهمة: ${task.name}\n\nرابط المهمة: ${taskLink}`
                : `⚠️ تم إلغاء إكمال المهمة الفرعية: "${subTask.name}" للمهمة: ${task.name}\n\nرابط المهمة: ${taskLink}`
              sendWhatsAppNotification(message).catch((error) => {
                console.error("Error sending notification:", error)
              })
            }
          } catch (error) {
            console.error("Error preparing notification:", error)
          }
        }
      } catch (error) {
        console.error("Error updating subtask:", error)
        toast({
          title: "حدث خطأ",
          description: "لم يتم تحديث المهمة الفرعية",
          variant: "destructive",
        })
      }
    }
  }

  const handleDeleteSubTask = (subTaskId: string) => {
    if (!task || !task.subTasks) return

    const subTaskToDelete = task.subTasks.find((st) => st.id === subTaskId)
    const updatedSubTasks = task.subTasks.filter((subTask) => subTask.id !== subTaskId)

    // Update the task in localStorage
    const storedTimers = localStorage.getItem("timers")
    if (storedTimers) {
      try {
        const timers = JSON.parse(storedTimers, (key, value) => {
          if (key === "endDate" && typeof value === "string") {
            return new Date(value)
          }
          if (key === "createdAt" && typeof value === "string") {
            return new Date(value)
          }
          return value
        })

        const updatedTimers = timers.map((t: TimerData) => {
          if (t.id === id) {
            return { ...t, subTasks: updatedSubTasks }
          }
          return t
        })

        localStorage.setItem("timers", JSON.stringify(updatedTimers))

        // Update the local state
        setTask({ ...task, subTasks: updatedSubTasks })
        if (editedTask) {
          setEditedTask({ ...editedTask, subTasks: updatedSubTasks })
        }

        // Show toast notification
        toast({
          title: "تم حذف المهمة الفرعية",
          description: "تم حذف المهمة الفرعية بنجاح",
        })

        // إرسال إشعار بحذف المهمة الفرعية
        if (notificationsEnabled && subTaskToDelete) {
          try {
            const taskLink = `${window.location.origin}/task/${id}?tab=subtasks`
            const message = `🗑️ تم حذف المهمة الفرعية: "${subTaskToDelete.name}" من المهمة: ${task.name}\n\nرابط المهمة: ${taskLink}`
            sendWhatsAppNotification(message).catch((error) => {
              console.error("Error sending notification:", error)
            })
          } catch (error) {
            console.error("Error preparing notification:", error)
          }
        }
      } catch (error) {
        console.error("Error deleting subtask:", error)
        toast({
          title: "حدث خطأ",
          description: "لم يتم حذف المهمة الفرعية",
          variant: "destructive",
        })
      }
    }
  }

  const handleEditSubTask = (subTaskId: string, name: string) => {
    if (!task || !task.subTasks) return

    const updatedSubTasks = task.subTasks.map((subTask) => (subTask.id === subTaskId ? { ...subTask, name } : subTask))

    // Update the task in localStorage
    const storedTimers = localStorage.getItem("timers")
    if (storedTimers) {
      try {
        const timers = JSON.parse(storedTimers, (key, value) => {
          if (key === "endDate" && typeof value === "string") {
            return new Date(value)
          }
          if (key === "createdAt" && typeof value === "string") {
            return new Date(value)
          }
          return value
        })

        const updatedTimers = timers.map((t: TimerData) => {
          if (t.id === id) {
            return { ...t, subTasks: updatedSubTasks }
          }
          return t
        })

        localStorage.setItem("timers", JSON.stringify(updatedTimers))

        // Update the local state
        setTask({ ...task, subTasks: updatedSubTasks })
        if (editedTask) {
          setEditedTask({ ...editedTask, subTasks: updatedSubTasks })
        }

        // إرسال إشعار بتعديل المهمة الفرعية
        if (notificationsEnabled) {
          try {
            const subTask = updatedSubTasks.find((st) => st.id === subTaskId)
            if (subTask) {
              const taskLink = `${window.location.origin}/task/${id}?tab=subtasks`
              const message = `✏️ تم تعديل المهمة الفرعية للمهمة: ${task.name}\n\nالاسم الجديد: "${subTask.name}"\n\nرابط المهمة: ${taskLink}`
              sendWhatsAppNotification(message).catch((error) => {
                console.error("Error sending notification:", error)
              })
            }
          } catch (error) {
            console.error("Error preparing notification:", error)
          }
        }
      } catch (error) {
        console.error("Error editing subtask:", error)
        toast({
          title: "حدث خطأ",
          description: "لم يتم تعديل المهمة الفرعية",
          variant: "destructive",
        })
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>جاري التحميل...</p>
      </div>
    )
  }

  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">المهمة غير موجودة</h1>
        <p>لم يتم العثور على المهمة المطلوبة</p>
        <Button onClick={handleBack} className="mt-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          العودة إلى الصفحة الرئيسية
        </Button>
      </div>
    )
  }

  const isExpired = task.type === "till" && new Date() > new Date(task.endDate)
  const createdTimeAgo = formatDistanceToNow(new Date(task.createdAt), {
    addSuffix: true,
    locale: ar,
  })

  // حساب عدد المهام الفرعية المكتملة وغير المكتملة
  const completedSubTasks = task.subTasks?.filter((task) => task.completed).length || 0
  const totalSubTasks = task.subTasks?.length || 0
  const hasSubTasks = totalSubTasks > 0

  return (
    <main>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">تفاصيل المهمة</h1>
        <div className="flex flex-col items-center justify-center">
          <div className="max-w-md w-full">
            {/* زر تبديل الإشعارات */}
            <div className="flex items-center justify-between mb-4 p-3 bg-card rounded-lg border border-border">
              <div className="flex items-center">
                {notificationsEnabled ? (
                  <Bell className="h-5 w-5 ml-2 text-green-500" />
                ) : (
                  <BellOff className="h-5 w-5 ml-2 text-gray-400" />
                )}
                <span>إشعارات الواتساب</span>
              </div>
              <Switch
                checked={notificationsEnabled}
                onCheckedChange={handleToggleNotifications}
                aria-label="تفعيل إشعارات الواتساب"
              />
            </div>

            {isEditing && editedTask ? (
              <div className="bg-card rounded-lg p-6 shadow-md border border-border">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">اسم المهمة</Label>
                    <Input
                      id="name"
                      value={editedTask.name}
                      onChange={(e) => setEditedTask({ ...editedTask, name: e.target.value })}
                      placeholder="اسم المهمة"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>نوع المهمة</Label>
                    <RadioGroup
                      value={editedTask.type}
                      onValueChange={(value) => setEditedTask({ ...editedTask, type: value as "till" | "from" })}
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
                            <Calendar className="ml-2 h-4 w-4" />
                            {format(editedTask.endDate, "PPP", { locale: ar })}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={editedTask.endDate}
                            onSelect={(date) => {
                              handleDateSelect(date)
                              setIsCalendarOpen(false)
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>

                      <div className="flex items-center space-x-2">
                        <Clock className="ml-2 h-4 w-4" />
                        <EnhancedTimePicker
                          hours={editedTask.endDate.getHours()}
                          minutes={editedTask.endDate.getMinutes()}
                          onChange={handleTimeChange}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">وصف المهمة</Label>
                    <Textarea
                      id="description"
                      value={editedTask.description || ""}
                      onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                      placeholder="أضف وصفاً للمهمة (اختياري)"
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div
                className={`bg-card rounded-lg p-6 shadow-md ${
                  task.completed
                    ? "border-green-500 border-2"
                    : isExpired
                      ? "border-red-500 border-2"
                      : "border border-border"
                }`}
              >
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold">{task.name}</h2>
                  {hasSubTasks && (
                    <Badge variant="outline" className="bg-background/80">
                      {completedSubTasks}/{totalSubTasks}
                    </Badge>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center text-muted-foreground">
                    <Calendar className="h-4 w-4 ml-2" />
                    <span>
                      {task.type === "till" ? "حتى: " : "منذ: "}
                      {new Date(task.endDate).toLocaleString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center text-muted-foreground">
                    <Clock className="h-4 w-4 ml-2" />
                    <span>أنشئت {createdTimeAgo}</span>
                  </div>

                  <div className="flex items-center">
                    <span className="ml-2">الحالة:</span>
                    <span
                      className={`font-bold ${
                        task.completed
                          ? "text-green-500"
                          : task.type === "till" && isExpired
                            ? "text-red-500"
                            : "text-yellow-500"
                      }`}
                    >
                      {task.completed ? "مكتملة" : task.type === "till" && isExpired ? "متأخرة" : "قيد التنفيذ"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* علامات التبويب */}
            <div className="mt-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-2 mb-4">
                  <TabsTrigger value="details">التفاصيل</TabsTrigger>
                  <TabsTrigger value="subtasks">
                    المهام الفرعية {hasSubTasks && `(${completedSubTasks}/${totalSubTasks})`}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4">
                  {/* وصف المهمة */}
                  <div className="bg-card rounded-lg p-4 border border-border">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-medium">وصف المهمة</h3>
                      {!isEditing && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingDescription(!isEditingDescription)}
                          className="h-8 px-2"
                        >
                          {isEditingDescription ? <X className="h-4 w-4" /> : <Edit className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>

                    {isEditingDescription && editedTask ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editedTask.description || ""}
                          onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                          placeholder="أضف وصفاً للمهمة (اختياري)"
                          rows={4}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setIsEditingDescription(false)
                              if (task) {
                                setEditedTask({ ...editedTask, description: task.description })
                              }
                            }}
                          >
                            إلغاء
                          </Button>
                          <Button size="sm" onClick={handleSaveDescription}>
                            حفظ
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        {task.description ? task.description : "لا يوجد وصف للمهمة"}
                      </p>
                    )}
                  </div>

                  {/* معلومات إضافية */}
                  <div className="bg-card rounded-lg p-4 border border-border">
                    <h3 className="text-lg font-medium mb-2">معلومات إضافية</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">تاريخ الإنشاء:</span>
                        <span>
                          {new Date(task.createdAt).toLocaleString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">نوع المهمة:</span>
                        <span>{task.type === "till" ? "حتى (مهمة قادمة)" : "منذ (مهمة سابقة)"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">المهام الفرعية:</span>
                        <span>
                          {completedSubTasks}/{totalSubTasks} مكتملة
                        </span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="subtasks">
                  <div className="bg-card rounded-lg p-4 border border-border">
                    <SubTasksList
                      subTasks={task.subTasks || []}
                      onAddSubTask={handleAddSubTask}
                      onToggleComplete={handleToggleSubTaskComplete}
                      onDeleteSubTask={handleDeleteSubTask}
                      onEditSubTask={handleEditSubTask}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Action buttons outside the card */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    className="rounded-full bg-green-100 hover:bg-green-200 border-green-300 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-800/50 dark:border-green-700 dark:text-green-400"
                    onClick={handleSaveEdit}
                  >
                    <Save className="h-5 w-5 ml-2" /> حفظ
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full bg-red-100 hover:bg-red-200 border-red-300 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-800/50 dark:border-red-700 dark:text-red-400"
                    onClick={handleCancelEdit}
                  >
                    <X className="h-5 w-5 ml-2" /> إلغاء
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-800/50 dark:border-purple-700 dark:text-purple-400"
                    onClick={handleShare}
                  >
                    <Share2 className="h-5 w-5 ml-2" /> مشاركة
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className={`rounded-full ${
                      task.completed
                        ? "bg-yellow-100 hover:bg-yellow-200 border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:hover:bg-yellow-800/50 dark:border-yellow-700 dark:text-yellow-400"
                        : "bg-green-100 hover:bg-green-200 border-green-300 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-800/50 dark:border-green-700 dark:text-green-400"
                    }`}
                    onClick={handleComplete}
                  >
                    <Check className="h-5 w-5 ml-2" /> {task.completed ? "تراجع" : "تم التنفيذ"}
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 dark:border-blue-700 dark:text-blue-400"
                    onClick={handleEdit}
                  >
                    <Edit className="h-5 w-5 ml-2" /> تعديل
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-800/50 dark:border-purple-700 dark:text-purple-400"
                    onClick={handleShare}
                  >
                    <Share2 className="h-5 w-5 ml-2" /> مشاركة
                  </Button>
                </>
              )}
            </div>

            <Button variant="ghost" className="mt-8 w-full" onClick={handleBack}>
              <ArrowLeft className="ml-2 h-4 w-4" />
              العودة إلى جميع المهام
            </Button>
          </div>
        </div>
      </div>
      <Toaster />
    </main>
  )
}

export default function TaskPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    }>
      <TaskContent />
    </Suspense>
  )
}
