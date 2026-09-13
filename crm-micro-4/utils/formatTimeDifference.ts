import { differenceInSeconds } from "date-fns"

export function formatTimeDifference(endDate: Date, type: "till" | "from", now: Date) {
  // تحديد التواريخ المستخدمة في الحساب بناءً على نوع المهمة
  const [start, end] = type === "till" ? [now, endDate] : [endDate, now]

  // حساب الفرق الكلي بالثواني
  const totalSeconds = differenceInSeconds(end, start)

  // تحديد ما إذا كان الوقت سالبًا (تجاوز الموعد)
  const isNegative = totalSeconds < 0

  // استخدام القيمة المطلقة للحسابات
  const absSeconds = Math.abs(totalSeconds)

  // حساب الوحدات الزمنية بشكل صحيح
  const years = Math.floor(absSeconds / (365 * 24 * 60 * 60))
  const remainingAfterYears = absSeconds % (365 * 24 * 60 * 60)

  const months = Math.floor(remainingAfterYears / (30 * 24 * 60 * 60))
  const remainingAfterMonths = remainingAfterYears % (30 * 24 * 60 * 60)

  const days = Math.floor(remainingAfterMonths / (24 * 60 * 60))
  const remainingAfterDays = remainingAfterMonths % (24 * 60 * 60)

  const hours = Math.floor(remainingAfterDays / (60 * 60))
  const remainingAfterHours = remainingAfterDays % (60 * 60)

  const minutes = Math.floor(remainingAfterHours / 60)
  const seconds = remainingAfterHours % 60

  // إضافة الإشارة السالبة إذا كان الوقت سالبًا
  const sign = isNegative ? -1 : 1

  return {
    total: totalSeconds * 1000,
    years: years * sign,
    months: months * sign,
    days: days * sign,
    hours: hours * sign,
    minutes: minutes * sign,
    seconds: seconds * sign,
  }
}
