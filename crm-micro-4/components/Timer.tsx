"use client"

import React, { useState, useRef, useEffect } from "react"
import { formatTimeDifference } from "../utils/formatTimeDifference"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { X, Check, Edit, Clock, Share2, List, Info } from "lucide-react"
import type { TimerData } from "../types/TimerData"
import { useTime } from "../contexts/TimeContext"
import { sendWhatsAppNotification, areWhatsAppNotificationsEnabled, createTaskMessage } from "../utils/webhook"
import { useToast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { ar } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"

interface TimerProps extends Omit<TimerData, "id"> {
  id: string
  onDelete: (id: string) => void
  onComplete?: (id: string, isCompleted: boolean) => void
  onEdit?: (id: string) => void
  completed?: boolean
}

export function Timer({
  id,
  name,
  endDate,
  type,
  onDelete,
  onComplete,
  onEdit,
  completed = false,
  createdAt,
  subTasks = [],
}: TimerProps) {
  const { now } = useTime()
  const [showDelete, setShowDelete] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isClicked, setIsClicked] = useState(false)
  const [isCompleted, setIsCompleted] = useState(completed)
  const { toast } = useToast()
  const router = useRouter()
  const [notificationsEnabled, setNotificationsEnabled] = useState(areWhatsAppNotificationsEnabled())

  // Store the time when the task was completed
  const completedTimeRef = useRef<Date | null>(null)

  // Initialize completedTimeRef on mount if task is already completed
  useEffect(() => {
    if (completed && !completedTimeRef.current) {
      completedTimeRef.current = new Date()
    }

    // تحديث حالة الإشعارات
    setNotificationsEnabled(areWhatsAppNotificationsEnabled())
  }, [completed])

  // Use the completion status to freeze the timer
  const timeLeft = React.useMemo(() => {
    // If task is completed, use the completion time instead of current time
    const referenceTime = isCompleted && completedTimeRef.current ? completedTimeRef.current : now
    return formatTimeDifference(endDate, type, referenceTime)
  }, [endDate, type, now, isCompleted, completedTimeRef.current])

  const isExpired = type === "till" && timeLeft.total <= 0

  // Check if time has expired and send notification
  React.useEffect(() => {
    if (isExpired && !isCompleted && notificationsEnabled) {
      const sendNotification = async () => {
        try {
          const message = createTaskMessage("المهمة انتهى وقتها:", name, id)
          await sendWhatsAppNotification(message)
        } catch (error) {
          console.error("Failed to send expiration notification:", error)
        }
      }

      // Use a flag in localStorage to prevent sending multiple notifications
      const notificationKey = `notification-sent-${id}`
      if (!localStorage.getItem(notificationKey)) {
        sendNotification()
        localStorage.setItem(notificationKey, "true")
      }
    }
  }, [isExpired, isCompleted, name, id, notificationsEnabled])

  const handleTaskComplete = async () => {
    // Toggle completion status
    const newCompletionStatus = !isCompleted

    // If completing the task, store the current time
    if (newCompletionStatus) {
      completedTimeRef.current = new Date()
    } else {
      // If un-completing, clear the stored time
      completedTimeRef.current = null
    }

    setIsCompleted(newCompletionStatus)
    setIsClicked(false)

    if (onComplete) {
      onComplete(id, newCompletionStatus)
    }
  }

  const handleTaskEdit = () => {
    setIsClicked(false)
    if (onEdit) onEdit(id)
  }

  const handleShareTask = async () => {
    // Use the full origin for the task link
    const origin = window.location.origin
    const taskLink = `${origin}/task/${id}`

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

    setIsClicked(false)
  }

  const handleViewDetails = () => {
    router.push(`/task/${id}`)
    setIsClicked(false)
  }

  const handleViewSubTasks = () => {
    router.push(`/task/${id}?tab=subtasks`)
    setIsClicked(false)
  }

  const renderTimeUnit = (value: number, label: string) => {
    return (
      <div className="flex justify-center w-[160px]">
        <span className="flex-1 text-4xl font-bold tabular-nums text-right pr-1">
          {Math.abs(value).toString().padStart(2, "0")}
        </span>
        <span className="flex-1 text-sm font-medium text-left pl-1 self-end pb-1">{label}</span>
      </div>
    )
  }

  const renderTimeUnits = () => {
    // تحديد ما إذا كان الوقت سالبًا (تجاوز الموعد)
    const isTimeNegative = timeLeft.total < 0

    const units = [
      { value: timeLeft.years, label: "YEARS" },
      { value: timeLeft.months, label: "MONTHS" },
      { value: timeLeft.days, label: "DAYS" },
      { value: timeLeft.hours, label: "HOURS" },
      { value: timeLeft.minutes, label: "MINUTES" },
      { value: timeLeft.seconds, label: "SECONDS" },
    ]

    // تحديد الوحدات التي سيتم عرضها
    let startIndex = 0
    if (Math.abs(timeLeft.years) > 0) {
      startIndex = 0
    } else if (Math.abs(timeLeft.months) > 0) {
      startIndex = 1
    } else {
      startIndex = 2
    }

    const unitsToShow = units.slice(startIndex, startIndex + 4)

    return (
      <>
        {isTimeNegative && type === "till" && !isCompleted && (
          <div className="text-red-500 mb-2 text-center">تجاوز الموعد بـ</div>
        )}
        {unitsToShow.map((unit) => (
          <React.Fragment key={unit.label}>{renderTimeUnit(unit.value, unit.label)}</React.Fragment>
        ))}
      </>
    )
  }

  // حساب عدد المهام الفرعية المكتملة وغير المكتملة
  const completedSubTasks = subTasks?.filter((task) => task.completed).length || 0
  const totalSubTasks = subTasks?.length || 0
  const hasSubTasks = totalSubTasks > 0

  // تنسيق تاريخ إنشاء المهمة
  const createdTimeAgo = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
    locale: ar,
  })

  return (
    <div className="timer-card-wrapper transition-transform duration-300 hover:scale-102">
      <Card
        className={`w-[280px] h-[280px] rounded-3xl relative 
          ${isCompleted ? "opacity-50 bg-green-50 dark:bg-green-900/20" : ""} 
          ${isExpired && !isHovered && !isCompleted ? "opacity-70 bg-red-50 dark:bg-red-900/20" : ""} 
          transition-all duration-200 cursor-pointer`}
        onMouseEnter={() => {
          setShowDelete(true)
          setIsHovered(true)
        }}
        onMouseLeave={() => {
          setShowDelete(false)
          setIsHovered(false)
        }}
        onClick={() => setIsClicked(!isClicked)}
        style={{ viewTransitionName: `timer-${id}` }}
        id={`task-${id}`}
      >
        <CardContent className="p-4 h-full">
          <div className="absolute top-4 left-6 right-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div
                  className={`w-1.5 h-1.5 rounded-full mr-2 
                  ${
                    isCompleted
                      ? "bg-green-500"
                      : isExpired
                        ? "bg-red-500"
                        : type === "till"
                          ? "bg-yellow-500"
                          : "bg-blue-500"
                  }`}
                ></div>
                <h2 className="text-sm text-muted-foreground truncate font-mono uppercase">
                  {isCompleted ? "✓ " : ""}
                  {name}
                </h2>
              </div>
              {hasSubTasks && (
                <Badge variant="outline" className="ml-1 bg-background/80 hover:bg-background transition-colors">
                  {completedSubTasks}/{totalSubTasks}
                </Badge>
              )}
            </div>
            <div
              className={`text-xs text-muted-foreground mt-1 font-mono transition-opacity duration-200 ${
                isHovered ? "opacity-100" : "opacity-0"
              }`}
            >
              <div className="flex justify-between">
                <span>
                  {type === "till" ? "حتى: " : "منذ: "}
                  {endDate.toLocaleString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="mt-1">أنشئت {createdTimeAgo}</div>
            </div>
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            {isClicked ? (
              <div className="flex flex-col items-center justify-center gap-4 w-full px-8">
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Button
                    variant="outline"
                    className={`rounded-full ${
                      isCompleted
                        ? "bg-yellow-100 hover:bg-yellow-200 border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:hover:bg-yellow-800/50 dark:border-yellow-700 dark:text-yellow-400"
                        : "bg-green-100 hover:bg-green-200 border-green-300 text-green-700 dark:bg-green-900/30 dark:hover:bg-green-800/50 dark:border-green-700 dark:text-green-400"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleTaskComplete()
                    }}
                  >
                    <Check className="h-4 w-4 ml-1" /> {isCompleted ? "تراجع" : "تم"}
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-full bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:hover:bg-blue-800/50 dark:border-blue-700 dark:text-blue-400"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleTaskEdit()
                    }}
                  >
                    <Edit className="h-4 w-4 ml-1" /> تعديل
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2 w-full">
                  <Button
                    variant="outline"
                    className="rounded-full bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-800/50 dark:border-purple-700 dark:text-purple-400"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleViewDetails()
                    }}
                  >
                    <Info className="h-4 w-4 ml-1" /> تفاصيل
                  </Button>
                  <Button
                    variant="outline"
                    className={`rounded-full ${
                      hasSubTasks
                        ? "bg-teal-100 hover:bg-teal-200 border-teal-300 text-teal-700 dark:bg-teal-900/30 dark:hover:bg-teal-800/50 dark:border-teal-700 dark:text-teal-400"
                        : "bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-700 dark:bg-gray-900/30 dark:hover:bg-gray-800/50 dark:border-gray-700 dark:text-gray-400"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleViewSubTasks()
                    }}
                  >
                    <List className="h-4 w-4 ml-1" /> المهام
                    {hasSubTasks && (
                      <Badge variant="outline" className="mr-1 text-[10px] h-4">
                        {completedSubTasks}/{totalSubTasks}
                      </Badge>
                    )}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="rounded-full bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:hover:bg-amber-800/50 dark:border-amber-700 dark:text-amber-400 w-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleShareTask()
                  }}
                >
                  <Share2 className="h-4 w-4 ml-1" /> مشاركة
                </Button>
              </div>
            ) : (
              <div className="flex flex-col -space-y-1">
                {isExpired && !isCompleted && (
                  <div className="text-red-500 mb-2 flex items-center justify-center">
                    <Clock className="h-4 w-4 ml-1" />
                    <span className="text-xs font-medium">تجاوز الوقت</span>
                  </div>
                )}
                {renderTimeUnits()}
              </div>
            )}
          </div>
        </CardContent>

        {showDelete && !isClicked && (
          <div
            className="absolute -top-3 -left-3 z-10 opacity-0 animate-fade-in"
            style={{ animationFillMode: "forwards", animationDuration: "0.2s" }}
          >
            <Button
              variant="destructive"
              size="icon"
              className="rounded-full"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(id)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* عرض مؤشر للمهام الفرعية */}
        {hasSubTasks && !isClicked && (
          <div className="absolute bottom-3 right-3">
            <div className="flex items-center justify-center h-6 w-6 rounded-full bg-background/80 border">
              <List className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
