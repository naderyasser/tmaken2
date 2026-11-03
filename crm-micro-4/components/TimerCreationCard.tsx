"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import type { TimerData } from "../types/TimerData"
import { Plus } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ar } from "date-fns/locale"
import { CalendarIcon, Clock } from "lucide-react"
import { EnhancedTimePicker } from "./EnhancedTimePicker"
import { sendWhatsAppNotification, areWhatsAppNotificationsEnabled, createTaskMessage } from "../utils/webhook"
import { useToast } from "@/components/ui/use-toast"

// Check if we're in a development or preview environment
const isDevOrPreview =
  (typeof window !== "undefined" && window.location.hostname === "localhost") ||
  (typeof window !== "undefined" && window.location.hostname.includes("vercel.app"))

interface TimerCreationCardProps {
  onCreateTimer: (timer: Omit<TimerData, "id">) => string
}

export function TimerCreationCard({ onCreateTimer }: TimerCreationCardProps) {
  const [isActive, setIsActive] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [timerName, setTimerName] = useState("")
  const [step, setStep] = useState<"initial" | "date" | "name">("initial")
  const inputRef = useRef<HTMLInputElement>(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(areWhatsAppNotificationsEnabled())
  const { toast } = useToast()
  const [isSendingNotification, setIsSendingNotification] = useState(false)

  useEffect(() => {
    if (step === "name" && inputRef.current) {
      inputRef.current.focus()
    }

    // تحديث حالة الإشعارات
    setNotificationsEnabled(areWhatsAppNotificationsEnabled())
  }, [step])

  const handleClick = () => {
    if (step === "initial") {
      setStep("date")
      setIsActive(true)
      // Initialize with current date and time
      setSelectedDate(new Date())
    }
  }

  const handleCancel = () => {
    setStep("initial")
    setIsActive(false)
    setSelectedDate(undefined)
    setTimerName("")
  }

  const handleConfirm = async () => {
    if (step === "date" && selectedDate) {
      setStep("name")
    } else if (step === "name" && timerName && selectedDate) {
      const now = new Date()
      const timerType = selectedDate > now ? "till" : "from"

      // Create the timer
      const newTimer = {
        name: timerName,
        endDate: selectedDate,
        type: timerType,
        completed: false,
        createdAt: new Date(), // تاريخ إنشاء المهمة
        subTasks: [], // مصفوفة فارغة للمهام الفرعية
      }

      const newTimerId = onCreateTimer(newTimer)

      // عرض رسالة نجاح
      toast({
        title: "تم إنشاء المهمة",
        description: "تم إنشاء المهمة الجديدة بنجاح",
      })

      // إرسال إشعار بتفاصيل المهمة إذا كانت الإشعارات مفعلة
      if (notificationsEnabled) {
        try {
          setIsSendingNotification(true)

          // استخدام دالة إنشاء الرسائل الموحدة
          const message = createTaskMessage("تم إنشاء مهمة جديدة:", timerName, newTimerId)

          // إرسال الإشعار
          await sendWhatsAppNotification(message)

          setIsSendingNotification(false)

          // Show notification status based on environment
          if (isDevOrPreview) {
            toast({
              title: "تم حفظ الإشعار",
              description: "تم حفظ الإشعار محليًا (بيئة تطوير/معاينة)",
              variant: "default",
            })
          }
        } catch (error) {
          setIsSendingNotification(false)
          console.error("Error in notification process:", error)
          toast({
            title: "تنبيه",
            description: "تم إنشاء المهمة ولكن فشل إرسال الإشعار",
            variant: "destructive",
          })
        }
      }

      handleCancel()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && timerName && selectedDate) {
      handleConfirm()
    }
  }

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // If we already have a selected date, preserve the time
      if (selectedDate) {
        date.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0)
      } else {
        // Default to current time
        const now = new Date()
        date.setHours(now.getHours(), now.getMinutes(), 0, 0)
      }
      setSelectedDate(date)
    }
  }

  const handleTimeChange = (hours: number, minutes: number) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate)
      newDate.setHours(hours)
      newDate.setMinutes(minutes)
      setSelectedDate(newDate)
    }
  }

  return (
    <Card
      className={`w-[280px] h-[280px] rounded-3xl overflow-visible transition-all duration-200 
        ${step === "initial" ? "bg-transparent hover:bg-card/10 border border-dashed border-muted-foreground/30" : "bg-card"}
        ${step === "initial" ? "hover:opacity-100 cursor-pointer" : ""}
      `}
      onClick={handleClick}
    >
      <CardContent className="p-4 h-full flex flex-col items-center justify-center relative">
        {step === "initial" && (
          <>
            <Plus className="w-12 h-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground mt-2">إضافة مهمة جديدة</p>
          </>
        )}
        {step === "date" && (
          <div className="flex flex-col items-center space-y-4 w-full">
            <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-right font-normal",
                    !selectedDate && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="ml-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP", { locale: ar }) : "اختر تاريخ"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    handleDateSelect(date)
                    setIsCalendarOpen(false)
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {selectedDate && (
              <div className="flex flex-col space-y-2 w-full">
                <div className="flex items-center">
                  <Clock className="ml-2 h-4 w-4" />
                  <span className="text-sm">اختر الوقت</span>
                </div>
                <div className="flex justify-center">
                  <EnhancedTimePicker
                    hours={selectedDate.getHours()}
                    minutes={selectedDate.getMinutes()}
                    onChange={handleTimeChange}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between w-full absolute -bottom-6 left-0 right-0 px-4">
              <Button variant="outline" onClick={handleCancel}>
                إلغاء
              </Button>
              <Button onClick={handleConfirm} disabled={!selectedDate}>
                تأكيد
              </Button>
            </div>
          </div>
        )}
        {step === "name" && (
          <>
            {selectedDate && (
              <p className="text-xs text-muted-foreground text-center mb-4 font-mono">
                {format(selectedDate, "PPpp", { locale: ar })}
              </p>
            )}
            <Input
              ref={inputRef}
              type="text"
              placeholder="وصف المهمة"
              value={timerName}
              onChange={(e) => setTimerName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="mb-4 w-full font-mono"
            />
            <div className="flex justify-between w-full absolute -bottom-6 left-0 right-0 px-4">
              <Button variant="outline" onClick={handleCancel}>
                إلغاء
              </Button>
              <Button onClick={handleConfirm} disabled={!timerName || isSendingNotification}>
                {isSendingNotification ? "جاري الإنشاء..." : "إنشاء مهمة"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
