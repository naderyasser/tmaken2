// نظام إشعارات واتساب مع تسجيل تفصيلي للأخطاء وقائمة انتظار

// سجل الإشعارات المحلي
const notificationLog: Array<{
  timestamp: string
  message: string
  status: string
  error?: string
  apiResponse?: any
  retryCount?: number
}> = []

// قائمة انتظار الإشعارات
interface QueuedNotification {
  id: string
  message: string
  retryCount: number
  lastAttempt: number
  maxRetries: number
  backoffMs: number
}

const notificationQueue: QueuedNotification[] = []
let isProcessingQueue = false
const QUEUE_PROCESSING_INTERVAL = 3000 // 3 ثوانٍ

// التحقق مما إذا كانت الإشعارات مفعلة
export function areWhatsAppNotificationsEnabled(): boolean {
  return localStorage.getItem("whatsapp_notifications_enabled") !== "false"
}

// تبديل حالة الإشعارات
export function toggleWhatsAppNotifications(enabled: boolean): void {
  localStorage.setItem("whatsapp_notifications_enabled", enabled ? "true" : "false")
}

// حفظ الإشعارات محليًا
export function saveNotificationLocally(message: string, error?: string): void {
  try {
    const timestamp = new Date().toISOString()
    const notification = { timestamp, message, status: "local", error }

    // الحصول على الإشعارات المحفوظة سابقًا
    const storedNotifications = localStorage.getItem("local_notifications") || "[]"
    const notifications = JSON.parse(storedNotifications)

    // إضافة الإشعار الجديد
    notifications.push(notification)

    // الاحتفاظ بآخر 50 إشعار فقط
    if (notifications.length > 50) {
      notifications.shift() // إزالة أقدم إشعار
    }

    // حفظ الإشعارات المحدثة
    localStorage.setItem("local_notifications", JSON.stringify(notifications))

    // إضافة إلى سجل الإشعارات المحلي
    notificationLog.push(notification)
    if (notificationLog.length > 20) {
      notificationLog.shift()
    }

    console.log("Notification saved locally:", notification)
  } catch (error) {
    console.error("Error saving notification locally:", error)
  }
}

// تتبع وقت آخر إرسال محلياً لتجنب الطلبات المتكررة
let lastLocalSentTime = 0
const MIN_LOCAL_INTERVAL_MS = 5000 // 5 ثوانٍ على الأقل بين الرسائل

// إضافة إشعار إلى قائمة الانتظار
function addToQueue(message: string, priority = false): string {
  const id = Date.now().toString() + Math.random().toString(36).substring(2, 9)
  const notification: QueuedNotification = {
    id,
    message,
    retryCount: 0,
    lastAttempt: 0,
    maxRetries: 3,
    backoffMs: 5000, // تأخير أولي 5 ثوانٍ
  }

  if (priority) {
    notificationQueue.unshift(notification) // إضافة في بداية القائمة للأولوية
  } else {
    notificationQueue.push(notification) // إضافة في نهاية القائمة
  }

  // بدء معالجة القائمة إذا لم تكن قيد المعالجة بالفعل
  if (!isProcessingQueue) {
    processQueue()
  }

  return id
}

// معالجة قائمة الانتظار
async function processQueue(): Promise<void> {
  if (isProcessingQueue || notificationQueue.length === 0) {
    return
  }

  isProcessingQueue = true
  console.log(`Processing notification queue. Items: ${notificationQueue.length}`)

  try {
    const now = Date.now()
    const notification = notificationQueue[0]

    // التحقق مما إذا كان الوقت المناسب لإعادة المحاولة
    if (now - notification.lastAttempt < notification.backoffMs) {
      console.log(`Too soon to retry notification ${notification.id}. Waiting...`)
      setTimeout(processQueue, notification.backoffMs - (now - notification.lastAttempt))
      isProcessingQueue = false
      return
    }

    // تحديث وقت آخر محاولة
    notification.lastAttempt = now
    notification.retryCount++

    console.log(
      `Attempting to send notification ${notification.id}, attempt ${notification.retryCount}/${notification.maxRetries}`,
    )

    // محاولة إرسال الإشعار
    const success = await sendNotificationDirectly(notification.message, notification.retryCount)

    if (success) {
      // إزالة الإشعار من القائمة إذا نجح
      notificationQueue.shift()
      console.log(`Successfully sent notification ${notification.id}`)
    } else if (notification.retryCount >= notification.maxRetries) {
      // إزالة الإشعار من القائمة إذا تجاوز الحد الأقصى للمحاولات
      const failed = notificationQueue.shift()
      console.log(`Failed to send notification ${notification.id} after ${notification.maxRetries} attempts`)
      saveNotificationLocally(failed!.message, `Failed after ${failed!.maxRetries} attempts`)
    } else {
      // زيادة التأخير بشكل تصاعدي (exponential backoff)
      notification.backoffMs = Math.min(notification.backoffMs * 2, 60000) // بحد أقصى دقيقة واحدة
      console.log(`Will retry notification ${notification.id} in ${notification.backoffMs / 1000} seconds`)
    }
  } catch (error) {
    console.error("Error processing notification queue:", error)
  } finally {
    isProcessingQueue = false

    // جدولة المعالجة التالية إذا كانت هناك عناصر متبقية في القائمة
    if (notificationQueue.length > 0) {
      setTimeout(processQueue, QUEUE_PROCESSING_INTERVAL)
    }
  }
}

// إرسال إشعار واتساب (واجهة عامة)
export async function sendWhatsAppNotification(message: string, priority = false): Promise<boolean> {
  try {
    // التحقق مما إذا كانت الإشعارات مفعلة
    if (!areWhatsAppNotificationsEnabled()) {
      console.log("Notifications are disabled")
      return true
    }

    // تسجيل الرسالة الأصلية للتشخيص
    console.log("Queueing notification with message:", message)
    console.log("Message type:", typeof message)
    console.log("Message length:", message.length)

    // إضافة الإشعار إلى قائمة الانتظار
    const notificationId = addToQueue(message, priority)
    console.log(`Added notification to queue with ID: ${notificationId}`)

    return true
  } catch (error) {
    console.error("Error in notification process:", error)
    saveNotificationLocally(message, `Process error: ${String(error)}`)
    return false
  }
}

// إرسال إشعار مباشرة (للاستخدام الداخلي فقط)
async function sendNotificationDirectly(message: string, retryCount = 0): Promise<boolean> {
  try {
    // التحقق من الوقت المنقضي منذ آخر إرسال محلي
    const now = Date.now()
    const timeSinceLastSent = now - lastLocalSentTime

    if (timeSinceLastSent < MIN_LOCAL_INTERVAL_MS) {
      console.log(`Local rate limiting: Must wait ${(MIN_LOCAL_INTERVAL_MS - timeSinceLastSent) / 1000} more seconds`)
      return false
    }

    // تحديث وقت آخر إرسال محلي
    lastLocalSentTime = now

    // تبسيط الرسالة للمحاولات المتكررة
    const simplifiedMessage = retryCount > 1 ? simplifyMessage(message) : message

    try {
      // استدعاء API الخادم لإرسال الإشعار
      const response = await fetch("/api/send-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: simplifiedMessage,
          retryCount,
          originalMessage: message,
        }),
      })

      const data = await response.json()

      // تسجيل الاستجابة للتشخيص
      console.log("API response:", data)

      // إضافة إلى سجل الإشعارات المحلي
      notificationLog.push({
        timestamp: new Date().toISOString(),
        message,
        status: data.success ? "sent" : "failed",
        apiResponse: data,
        retryCount,
      })

      if (notificationLog.length > 20) {
        notificationLog.shift()
      }

      if (!response.ok) {
        console.error("Server API error:", data)
        return false
      }

      // التحقق من طريقة الإرسال
      if (data.method === "local" || data.method === "test") {
        console.log(`Using ${data.method} notification storage:`, data.message)
        saveNotificationLocally(message, data.message)
        return true
      }

      console.log("WhatsApp notification sent successfully")
      return true
    } catch (error) {
      console.error("Error sending notification via API:", error)
      return false
    }
  } catch (error) {
    console.error("Error in direct notification process:", error)
    return false
  }
}

// تبسيط الرسالة للمحاولات المتكررة
function simplifyMessage(message: string): string {
  try {
    // إزالة الروابط من الرسالة
    const withoutLinks = message.replace(/https?:\/\/[^\s]+/g, "[رابط]")

    // اقتصار الرسالة على 100 حرف كحد أقصى
    const shortened = withoutLinks.length > 100 ? withoutLinks.substring(0, 97) + "..." : withoutLinks

    return shortened
  } catch (error) {
    console.error("Error simplifying message:", error)
    return message
  }
}

// تعديل دالة createTaskMessage لاستخدام نصوص مختلفة حسب نوع العملية
export function createTaskMessage(action: string, taskName: string, taskId: string): string {
  try {
    // تحديد نوع الرسالة من النص الأصلي
    if (action.includes("إنشاء")) {
      // استخدام "تم تكوين مهمة" بدلاً من "تم إنشاء مهمة جديدة"
      return `تم تكوين المهمة: ${taskName}`
    } else {
      // الحفاظ على النص الأصلي للعمليات الأخرى
      return `${action} ${taskName}`
    }
  } catch (error) {
    console.error("Error creating task message:", error)
    // استخدام نص آمن في حالة الخطأ
    return `تم حذف المهمة: ${taskName}`
  }
}

// الحصول على الإشعارات المحفوظة محليًا
export function getLocalNotifications(): Array<{ timestamp: string; message: string; status: string; error?: string }> {
  try {
    const storedNotifications = localStorage.getItem("local_notifications") || "[]"
    return JSON.parse(storedNotifications)
  } catch (error) {
    console.error("Error getting local notifications:", error)
    return []
  }
}

// الحصول على سجل الإشعارات للتشخيص
export function getNotificationLog(): typeof notificationLog {
  return [...notificationLog]
}

// الحصول على حالة قائمة الانتظار
export function getQueueStatus(): {
  queueLength: number
  isProcessing: boolean
  nextItem?: {
    message: string
    retryCount: number
    nextAttemptIn: number
  }
} {
  const nextItem = notificationQueue[0]
  return {
    queueLength: notificationQueue.length,
    isProcessing: isProcessingQueue,
    nextItem: nextItem
      ? {
          message: nextItem.message,
          retryCount: nextItem.retryCount,
          nextAttemptIn: Math.max(0, nextItem.lastAttempt + nextItem.backoffMs - Date.now()),
        }
      : undefined,
  }
}

// حذف جميع الإشعارات المحفوظة محليًا
export function clearLocalNotifications(): void {
  localStorage.setItem("local_notifications", "[]")
}

// اختبار تنسيق الرابط
export function testUrlFormatting(url: string): string {
  // إصلاح الروابط
  const fixedUrl = fixUrl(url)
  return fixedUrl
}

// إصلاح رابط واحد
function fixUrl(url: string): string {
  try {
    // البحث عن الروابط التي تبدأ بـ http: أو https: وتفتقر إلى //
    if (url.match(/^https?:[^/]/i)) {
      url = url.replace(/^(https?:)([^/])/, "$1//$2")
    }

    // إصلاح مشكلة .ne/t
    url = url.replace(/(\.ne)\/t(\/)/gi, "$1t$2")

    // إصلاح مشكلة .co/m
    url = url.replace(/(\.co)\/m(\/)/gi, "$1m$2")

    // إصلاح مشكلة .lite.vusercontent.ne/t
    url = url.replace(/(lite\.vusercontent\.ne)\/t(\/)/gi, "$1t$2")

    return url
  } catch (error) {
    console.error("Error fixing URL:", error)
    return url
  }
}

// بدء معالجة القائمة عند تحميل الملف
setTimeout(() => {
  if (notificationQueue.length > 0 && !isProcessingQueue) {
    processQueue()
  }
}, 1000)
