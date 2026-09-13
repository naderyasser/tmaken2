"use client"

import React, { useEffect, useState } from "react"
import { Timer } from "./Timer"
import { TimerCreationCard } from "./TimerCreationCard"
import type { TimerData } from "../types/TimerData"
import { TimeProvider } from "../contexts/TimeContext"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { EditTaskForm } from "./EditTaskForm"
import { useToast } from "@/components/ui/use-toast"
import { useSearchParams, useRouter } from "next/navigation"
import {
  sendWhatsAppNotification,
  areWhatsAppNotificationsEnabled,
  toggleWhatsAppNotifications,
  createTaskMessage,
  getLocalNotifications,
} from "../utils/webhook"
import { Switch } from "@/components/ui/switch"
import { Bell, BellOff, Info, FileText, Link2, Wrench } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"

// Check if we're in a development or preview environment
const isDevOrPreview =
  (typeof window !== "undefined" && window.location.hostname === "localhost") ||
  (typeof window !== "undefined" && window.location.hostname.includes("vercel.app"))

export function Dashboard() {
  const [timers, setTimers] = React.useState<TimerData[]>([])
  const [editingTimer, setEditingTimer] = useState<TimerData | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const router = useRouter()
  const taskId = searchParams?.get("task")
  const editId = searchParams?.get("edit")
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [localNotificationCount, setLocalNotificationCount] = useState(0)

  useEffect(() => {
    const storedTimers = localStorage.getItem("timers")
    if (storedTimers) {
      try {
        // تحويل البيانات المخزنة مع معالجة التواريخ بشكل صحيح
        const parsedTimers = JSON.parse(storedTimers, (key, value) => {
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

        // إضافة تاريخ الإنشاء والمهام الفرعية للمهام القديمة
        const updatedTimers = parsedTimers.map((timer: TimerData) => {
          if (!timer.createdAt) {
            timer.createdAt = new Date()
          }
          if (!timer.subTasks) {
            timer.subTasks = []
          }
          return timer
        })

        setTimers(updatedTimers)
        localStorage.setItem("timers", JSON.stringify(updatedTimers))
      } catch (error) {
        console.error("Error parsing stored timers:", error)
        setDefaultTimers()
      }
    } else {
      setDefaultTimers()
    }

    // التحقق من حالة الإشعارات
    setNotificationsEnabled(areWhatsAppNotificationsEnabled())

    // تحديث عدد الإشعارات المحلية
    updateLocalNotificationCount()

    // Enable View Transitions API
    document.documentElement.classList.add("view-transition")
  }, [])

  // Update local notification count periodically
  useEffect(() => {
    const interval = setInterval(() => {
      updateLocalNotificationCount()
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const updateLocalNotificationCount = () => {
    const notifications = getLocalNotifications()
    setLocalNotificationCount(notifications.length)
  }

  // Handle edit mode from URL parameter
  useEffect(() => {
    if (editId && timers.length > 0) {
      const timerToEdit = timers.find((timer) => timer.id === editId)
      if (timerToEdit) {
        setEditingTimer(timerToEdit)
        setIsDialogOpen(true)
      }
    }
  }, [editId, timers])

  // Close dialog and clear URL parameter when dialog is closed
  useEffect(() => {
    if (!isDialogOpen && editId) {
      // Remove the edit parameter from URL
      const url = new URL(window.location.href)
      url.searchParams.delete("edit")
      router.replace(url.pathname + url.search)
    }
  }, [isDialogOpen, editId, router])

  const setDefaultTimers = () => {
    // Default timers as tasks
    const defaultTimers: TimerData[] = [
      {
        id: "1",
        name: "إكمال تقرير المشروع",
        endDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day from now
        type: "till",
        completed: false,
        createdAt: new Date(),
        subTasks: [],
      },
      {
        id: "2",
        name: "منذ بدء المشروع",
        endDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        type: "from",
        completed: false,
        createdAt: new Date(),
        subTasks: [],
      },
    ]
    setTimers(defaultTimers)
    localStorage.setItem("timers", JSON.stringify(defaultTimers))
  }

  // Handle task highlighting when accessed via link
  useEffect(() => {
    if (taskId) {
      setTimeout(() => {
        const taskElement = document.getElementById(`task-${taskId}`)
        if (taskElement) {
          taskElement.scrollIntoView({ behavior: "smooth", block: "center" })
          // Highlight the task
          taskElement.classList.add("highlight-task")
          setTimeout(() => {
            taskElement.classList.remove("highlight-task")
          }, 2000)
        } else {
          toast({
            title: "المهمة غير موجودة",
            description: "لم يتم العثور على المهمة المطلوبة",
            variant: "destructive",
          })
        }
      }, 500)
    }
  }, [taskId, timers, toast])

  useEffect(() => {
    localStorage.setItem("timers", JSON.stringify(timers))
  }, [timers])

  const handleCreateTimer = (newTimer: Omit<TimerData, "id">) => {
    const timerWithId: TimerData = {
      ...newTimer,
      id: Date.now().toString(),
      completed: false,
      createdAt: new Date(),
      subTasks: [],
    }
    setTimers((prevTimers) => {
      const updatedTimers = [...prevTimers, timerWithId]
      localStorage.setItem("timers", JSON.stringify(updatedTimers))
      return updatedTimers
    })

    return timerWithId.id
  }

  const handleDeleteTimer = async (id: string) => {
    // Find the timer before deleting it
    const timerToDelete = timers.find((timer) => timer.id === id)

    setTimers((prevTimers) => {
      const updatedTimers = prevTimers.filter((timer) => timer.id !== id)
      localStorage.setItem("timers", JSON.stringify(updatedTimers))
      return updatedTimers
    })

    // إرسال إشعار بحذف المهمة
    if (timerToDelete && notificationsEnabled) {
      try {
        const message = createTaskMessage("تم حذف المهمة:", timerToDelete.name, id)
        await sendWhatsAppNotification(message)
        updateLocalNotificationCount()
      } catch (error) {
        console.error("Error sending deletion notification:", error)
      }
    }
  }

  const handleCompleteTask = async (id: string, isCompleted: boolean) => {
    try {
      // Find the task before updating it
      const taskToUpdate = timers.find((timer) => timer.id === id)

      setTimers((prevTimers) => {
        const updatedTimers = prevTimers.map((timer) =>
          timer.id === id ? { ...timer, completed: isCompleted } : timer,
        )
        localStorage.setItem("timers", JSON.stringify(updatedTimers))
        return updatedTimers
      })

      // إرسال إشعار بتغيير حالة الإكمال
      if (taskToUpdate && notificationsEnabled) {
        try {
          const action = isCompleted ? "تم إكمال المهمة:" : "تم التراجع عن إكمال المهمة:"
          const message = createTaskMessage(action, taskToUpdate.name, id)
          await sendWhatsAppNotification(message)
          updateLocalNotificationCount()
        } catch (error) {
          console.error("Error sending completion notification:", error)
        }
      }
    } catch (error) {
      console.error("Error in task completion process:", error)
    }
  }

  const handleEditTask = (id: string) => {
    const timerToEdit = timers.find((timer) => timer.id === id)
    if (timerToEdit) {
      setEditingTimer(timerToEdit)
      setIsDialogOpen(true)
    }
  }

  const handleSaveEdit = async (editedTimer: TimerData) => {
    // Find the original timer before updating
    const originalTimer = timers.find((timer) => timer.id === editedTimer.id)

    setTimers((prevTimers) => {
      const updatedTimers = prevTimers.map((timer) => (timer.id === editedTimer.id ? editedTimer : timer))
      localStorage.setItem("timers", JSON.stringify(updatedTimers))
      return updatedTimers
    })

    // Show success toast
    toast({
      title: "تم حفظ التغييرات",
      description: "تم تحديث المهمة بنجاح",
    })

    // إرسال إشعار بتعديل المهمة
    if (originalTimer && notificationsEnabled) {
      try {
        const message = createTaskMessage("تم تعديل المهمة:", editedTimer.name, editedTimer.id)
        await sendWhatsAppNotification(message)
        updateLocalNotificationCount()
      } catch (error) {
        console.error("Error sending edit notification:", error)
      }
    }

    // Close the dialog and reset editing state
    setIsDialogOpen(false)
    setEditingTimer(null)
  }

  const handleCancelEdit = () => {
    setIsDialogOpen(false)
    setEditingTimer(null)
  }

  const handleToggleNotifications = (enabled: boolean) => {
    setNotificationsEnabled(enabled)
    toggleWhatsAppNotifications(enabled)

    toast({
      title: enabled ? "تم تفعيل الإشعارات" : "تم إيقاف الإشعارات",
      description: enabled ? "سيتم حفظ الإشعارات" : "لن يتم حفظ الإشعارات",
      variant: "default",
    })
  }

  return (
    <TimeProvider>
      <div className="min-h-screen bg-background flex flex-col items-center justify-center py-20">
        {/* زر تبديل الإشعارات */}
        <div className="mb-8 p-3 bg-card rounded-lg border border-border flex items-center justify-between w-full max-w-xs">
          <div className="flex items-center">
            {notificationsEnabled ? (
              <Bell className="h-5 w-5 ml-2 text-green-500" />
            ) : (
              <BellOff className="h-5 w-5 ml-2 text-gray-400" />
            )}
            <span>إشعارات واتساب</span>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="mr-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <Info className="h-4 w-4 text-gray-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    يتم إرسال الإشعارات عبر واتساب. عدد الإشعارات المحفوظة محليًا: {localNotificationCount}
                    <br />
                    ملاحظة: يوجد حد أقصى لعدد الرسائل (5 ثوانٍ بين كل رسالة)
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* رابط لصفحة سجل الإشعارات */}
            <Link href="/notification-log" className="mr-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
              <FileText className="h-4 w-4 text-gray-500" />
            </Link>
            <Link href="/url-test" className="mr-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
              <Link2 className="h-4 w-4 text-gray-500" />
            </Link>
            {/* أضف هذا الرابط في قسم الإشعارات */}
            <Link href="/api-test" className="mr-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
              <Wrench className="h-4 w-4 text-gray-500" />
            </Link>
          </div>
          <Switch
            checked={notificationsEnabled}
            onCheckedChange={handleToggleNotifications}
            aria-label="تفعيل إشعارات الواتساب"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 justify-items-center content-center">
          {timers.map((timer) => (
            <div key={timer.id} className="timer-item opacity-0 scale-95 animate-fade-in">
              <Timer
                {...timer}
                onDelete={handleDeleteTimer}
                onComplete={handleCompleteTask}
                onEdit={handleEditTask}
                completed={timer.completed}
              />
            </div>
          ))}
          <div className="timer-item opacity-0 scale-95 animate-fade-in" style={{ animationDelay: "300ms" }}>
            <TimerCreationCard onCreateTimer={handleCreateTimer} />
          </div>
        </div>
      </div>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open)
          if (!open) setEditingTimer(null)
        }}
      >
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
          <DialogHeader className="bg-card border-b p-4">
            <DialogTitle>تعديل المهمة</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            {editingTimer && <EditTaskForm timer={editingTimer} onSave={handleSaveEdit} onCancel={handleCancelEdit} />}
          </div>
        </DialogContent>
      </Dialog>
    </TimeProvider>
  )
}
