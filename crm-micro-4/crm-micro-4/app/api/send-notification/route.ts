import { NextResponse } from "next/server"

// تتبع وقت آخر إرسال لتجنب الطلبات المتكررة
let lastSentTime = 0
const MIN_INTERVAL_MS = 5000 // 5 ثوانٍ على الأقل بين الرسائل

// سجل الطلبات والاستجابات للتشخيص
const requestLog: Array<{
  timestamp: string
  originalMessage: string
  message: string
  url: string
  retryCount?: number
  response?: string
  status?: number
  error?: string
}> = []

// وضع اختبار لتجنب إرسال الرسائل الفعلية
const TEST_MODE = false

export async function POST(request: Request) {
  try {
    const { message, retryCount = 0, originalMessage = "" } = await request.json()

    if (!message) {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 })
    }

    // تسجيل الرسالة الأصلية للتشخيص
    console.log("Original message:", originalMessage || message)
    console.log("Processed message:", message)
    console.log("Retry count:", retryCount)
    console.log("Message type:", typeof message)
    console.log("Message length:", message.length)

    // التحقق من الوقت المنقضي منذ آخر إرسال
    const now = Date.now()
    const timeSinceLastSent = now - lastSentTime

    if (timeSinceLastSent < MIN_INTERVAL_MS) {
      console.log(`Rate limiting: Must wait ${(MIN_INTERVAL_MS - timeSinceLastSent) / 1000} more seconds`)
      return NextResponse.json({
        success: true,
        method: "local",
        message: "Rate limited: Too soon since last message",
        log: requestLog.slice(-5), // إرسال آخر 5 سجلات للتشخيص
      })
    }

    // تحديث وقت آخر إرسال
    lastSentTime = now

    try {
      // تنظيف وتبسيط الرسالة
      const cleanedMessage = sanitizeMessage(message, retryCount)

      // استخدام الرابط المباشر
      const phone = "966550455010"
      const apiKey = "7787411"
      const encodedMessage = encodeURIComponent(cleanedMessage)
      const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${apiKey}`

      console.log("Sending WhatsApp notification with URL:", url)
      console.log("Cleaned message:", cleanedMessage)

      // إضافة إلى سجل الطلبات
      const logEntry = {
        timestamp: new Date().toISOString(),
        originalMessage: originalMessage || message,
        message: cleanedMessage,
        url: url,
        retryCount,
      }

      requestLog.push(logEntry)

      // الحفاظ على حجم السجل (الاحتفاظ بآخر 20 سجل فقط)
      if (requestLog.length > 20) {
        requestLog.shift()
      }

      // في وضع الاختبار، لا نرسل الرسالة فعليًا
      if (TEST_MODE) {
        console.log("TEST MODE: Not sending actual message")
        return NextResponse.json({
          success: true,
          method: "test",
          message: "Test mode: Message not sent",
          originalMessage: originalMessage || message,
          cleanedMessage: cleanedMessage,
          url: url,
          log: requestLog.slice(-5),
        })
      }

      // إضافة تأخير قبل الإرسال للمحاولات المتكررة
      if (retryCount > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount))
      }

      // إرسال الطلب مع تحديد مهلة زمنية
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 ثوانٍ كحد أقصى

      try {
        const response = await fetch(url, {
          method: "GET",
          cache: "no-store",
          headers: {
            "User-Agent": "Mozilla/5.0 Timer Dashboard App",
            Accept: "text/html,application/json,*/*",
            Connection: "keep-alive",
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)
        const responseText = await response.text()

        // تحديث السجل بالاستجابة
        const lastLogEntry = requestLog[requestLog.length - 1]
        if (lastLogEntry) {
          lastLogEntry.response = responseText.substring(0, 500) // تخزين أول 500 حرف فقط
          lastLogEntry.status = response.status
        }

        console.log("WhatsApp API response status:", response.status)
        console.log("WhatsApp API response:", responseText)

        if (!response.ok) {
          console.error("WhatsApp API error:", responseText)

          // تحليل نوع الخطأ
          if (response.status === 403) {
            return NextResponse.json({
              success: false,
              error: "Authentication error: API key or phone number might be incorrect",
              method: "local",
              log: requestLog.slice(-5),
            })
          }

          return NextResponse.json({
            success: false,
            error: responseText,
            method: "local",
            log: requestLog.slice(-5),
          })
        }

        // التحقق من محتوى الاستجابة للتأكد من نجاح الإرسال
        if (responseText.includes("Message queued") || responseText.includes("success")) {
          return NextResponse.json({
            success: true,
            method: "whatsapp",
            log: requestLog.slice(-5),
          })
        } else if (responseText.includes("Too many requests")) {
          console.log("Rate limiting from API: Too many requests")
          return NextResponse.json({
            success: false,
            error: "Too many requests",
            method: "local",
            log: requestLog.slice(-5),
          })
        } else {
          console.log("Unknown API response:", responseText)
          return NextResponse.json({
            success: false,
            error: "Unknown API response",
            method: "local",
            log: requestLog.slice(-5),
          })
        }
      } catch (fetchError) {
        clearTimeout(timeoutId)
        console.error("Fetch error:", fetchError)

        // تحديث السجل بالخطأ
        const lastLogEntry = requestLog[requestLog.length - 1]
        if (lastLogEntry) {
          lastLogEntry.error = fetchError instanceof Error ? fetchError.message : String(fetchError)
        }

        return NextResponse.json({
          success: false,
          error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          method: "local",
          log: requestLog.slice(-5),
        })
      }
    } catch (error) {
      console.error("Error sending notification:", error)

      // إضافة الخطأ إلى السجل
      if (requestLog.length > 0) {
        const lastLogEntry = requestLog[requestLog.length - 1]
        lastLogEntry.error = String(error)
      }

      return NextResponse.json({
        success: false,
        error: String(error),
        method: "local",
        log: requestLog.slice(-5),
      })
    }
  } catch (error) {
    console.error("Error processing notification request:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: String(error),
        log: requestLog.slice(-5),
      },
      { status: 500 },
    )
  }
}

// تنظيف وتبسيط الرسالة
function sanitizeMessage(message: string, retryCount = 0): string {
  try {
    // التأكد من أن الرسالة نص
    if (typeof message !== "string") {
      message = String(message)
    }

    // للمحاولات المتكررة، نبسط الرسالة أكثر
    if (retryCount > 1) {
      // إزالة الروابط تمامًا
      message = message.replace(/https?:\/\/[^\s]+/g, "[رابط]")

      // اقتصار الرسالة على 100 حرف كحد أقصى
      if (message.length > 100) {
        message = message.substring(0, 97) + "..."
      }
    } else {
      // إصلاح الروابط في الرسالة
      message = fixUrls(message)
    }

    // إزالة الرموز التعبيرية (Emojis)
    const noEmojis = message.replace(
      /[\u{1F600}-\u{1F64F}|\u{1F300}-\u{1F5FF}|\u{1F680}-\u{1F6FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}|\u{1F900}-\u{1F9FF}|\u{1F1E0}-\u{1F1FF}]/gu,
      "",
    )

    // استبدال الأسطر المتعددة بسطر واحد
    const singleLine = noEmojis.replace(/\n+/g, " - ")

    // استبدال الأحرف الخاصة التي قد تسبب مشاكل في URL
    const simplified = singleLine
      .replace(/[&]/g, "and")
      .replace(/[+]/g, "plus")
      .replace(/[#]/g, "hash")
      .replace(/[@]/g, "at")

    // إزالة أي أحرف خاصة أخرى قد تسبب مشاكل
    const cleaned = simplified.replace(/[^\w\s\u0600-\u06FF.,:/-]/g, "")

    // التأكد من أن الرسالة ليست فارغة
    if (!cleaned || cleaned.trim() === "") {
      return "Task notification"
    }

    return cleaned
  } catch (error) {
    console.error("Error sanitizing message:", error)
    return "Task notification" // رسالة افتراضية في حالة حدوث خطأ
  }
}

// إصلاح الروابط في الرسالة
function fixUrls(text: string): string {
  try {
    // تسجيل النص الأصلي للتشخيص
    console.log("Fixing URLs in text:", text)

    // البحث عن الروابط التي تبدأ بـ http: أو https: وتفتقر إلى //
    const httpRegex = /(https?:)([^/])/gi
    text = text.replace(httpRegex, "$1//$2")

    // البحث عن الروابط التي تحتوي على نطاق ولكن تفتقر إلى / بين النطاق والمسار
    const domainPathRegex = /(https?:\/\/[a-zA-Z0-9.-]+)([a-zA-Z0-9]\/)/gi
    text = text.replace(domainPathRegex, "$1/$2")

    // إصلاح مشكلة .ne/t
    const netDomainRegex = /(\.ne)\/t(\/)/gi
    text = text.replace(netDomainRegex, "$1t$2")

    // إصلاح مشكلة .co/m
    const comDomainRegex = /(\.co)\/m(\/)/gi
    text = text.replace(comDomainRegex, "$1m$2")

    // إصلاح مشكلة .or/g
    const orgDomainRegex = /(\.or)\/g(\/)/gi
    text = text.replace(orgDomainRegex, "$1g$2")

    // إصلاح مشكلة .i/o
    const ioDomainRegex = /(\.i)\/o(\/)/gi
    text = text.replace(ioDomainRegex, "$1o$2")

    // إصلاح مشكلة .a/pp
    const appDomainRegex = /(\.a)\/pp(\/)/gi
    text = text.replace(appDomainRegex, "$1pp$2")

    // إصلاح مشكلة .de/v
    const devDomainRegex = /(\.de)\/v(\/)/gi
    text = text.replace(devDomainRegex, "$1v$2")

    // إصلاح مشكلة .lite.vusercontent.ne/t
    const vUserContentRegex = /(lite\.vusercontent\.ne)\/t(\/)/gi
    text = text.replace(vUserContentRegex, "$1t$2")

    // تسجيل النص بعد الإصلاح للتشخيص
    console.log("Fixed URLs in text:", text)

    return text
  } catch (error) {
    console.error("Error fixing URLs:", error)
    return text
  }
}

// الحصول على سجل الطلبات للتشخيص
export async function GET() {
  return NextResponse.json({ log: requestLog })
}
