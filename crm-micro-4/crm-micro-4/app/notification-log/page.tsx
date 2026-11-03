"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getLocalNotifications, getNotificationLog, getQueueStatus, clearLocalNotifications } from "../../utils/webhook"
import { ArrowLeft, RefreshCw, Download, Copy, Check, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Progress } from "@/components/ui/progress"

export default function NotificationLogPage() {
  const [localNotifications, setLocalNotifications] = useState<Array<any>>([])
  const [notificationLog, setNotificationLog] = useState<Array<any>>([])
  const [apiLog, setApiLog] = useState<Array<any>>([])
  const [queueStatus, setQueueStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  const fetchData = async () => {
    setLoading(true)

    // الحصول على الإشعارات المحلية
    const local = getLocalNotifications()
    setLocalNotifications(local)

    // الحصول على سجل الإشعارات
    const log = getNotificationLog()
    setNotificationLog(log)

    // الحصول على حالة قائمة الانتظار
    const queue = getQueueStatus()
    setQueueStatus(queue)

    // الحصول على سجل API
    try {
      const response = await fetch("/api/send-notification")
      const data = await response.json()
      setApiLog(data.log || [])
    } catch (error) {
      console.error("Error fetching API log:", error)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()

    // تحديث البيانات كل 5 ثوانٍ
    const interval = setInterval(fetchData, 5000)

    return () => clearInterval(interval)
  }, [])

  // تحميل السجل كملف JSON
  const downloadLog = () => {
    try {
      const logData = {
        apiLog,
        notificationLog,
        localNotifications,
        queueStatus,
        timestamp: new Date().toISOString(),
      }

      const jsonString = JSON.stringify(logData, null, 2)
      const blob = new Blob([jsonString], { type: "application/json" })
      const url = URL.createObjectURL(blob)

      const a = document.createElement("a")
      a.href = url
      a.download = `notification-log-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: "تم تحميل السجل",
        description: "تم تحميل ملف السجل بنجاح",
      })
    } catch (error) {
      console.error("Error downloading log:", error)
      toast({
        title: "خطأ في تحميل السجل",
        description: "حدث خطأ أثناء تحميل ملف السجل",
        variant: "destructive",
      })
    }
  }

  // نسخ السجل إلى الحافظة
  const copyLog = () => {
    try {
      const logData = {
        apiLog,
        notificationLog,
        localNotifications,
        queueStatus,
        timestamp: new Date().toISOString(),
      }

      const jsonString = JSON.stringify(logData, null, 2)
      navigator.clipboard.writeText(jsonString)

      setCopied(true)
      setTimeout(() => setCopied(false), 2000)

      toast({
        title: "تم نسخ السجل",
        description: "تم نسخ السجل إلى الحافظة",
      })
    } catch (error) {
      console.error("Error copying log:", error)
      toast({
        title: "خطأ في نسخ السجل",
        description: "حدث خطأ أثناء نسخ السجل إلى الحافظة",
        variant: "destructive",
      })
    }
  }

  // مسح الإشعارات المحلية
  const handleClearLocalNotifications = () => {
    try {
      clearLocalNotifications()
      setLocalNotifications([])
      toast({
        title: "تم مسح الإشعارات",
        description: "تم مسح جميع الإشعارات المحفوظة محليًا",
      })
    } catch (error) {
      console.error("Error clearing notifications:", error)
      toast({
        title: "خطأ في مسح الإشعارات",
        description: "حدث خطأ أثناء مسح الإشعارات",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">سجل الإشعارات</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            تحديث
          </Button>
          <Button variant="outline" onClick={downloadLog}>
            <Download className="h-4 w-4 mr-2" />
            تحميل السجل
          </Button>
          <Button variant="outline" onClick={copyLog}>
            {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
            نسخ السجل
          </Button>
          <Button variant="outline" onClick={() => router.push("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            العودة
          </Button>
        </div>
      </div>

      {/* حالة قائمة الانتظار */}
      {queueStatus && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>حالة قائمة الانتظار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>عدد الإشعارات في الانتظار:</span>
                <span className="font-bold">{queueStatus.queueLength}</span>
              </div>

              <div className="flex justify-between items-center">
                <span>حالة المعالجة:</span>
                <span className={`font-bold ${queueStatus.isProcessing ? "text-green-500" : "text-gray-500"}`}>
                  {queueStatus.isProcessing ? "جاري المعالجة" : "في انتظار المعالجة"}
                </span>
              </div>

              {queueStatus.nextItem && (
                <>
                  <div className="border-t pt-4">
                    <h3 className="font-bold mb-2">الإشعار التالي:</h3>
                    <p className="text-sm mb-2 break-all">{queueStatus.nextItem.message}</p>
                    <div className="flex justify-between items-center">
                      <span>عدد المحاولات:</span>
                      <span>{queueStatus.nextItem.retryCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>الوقت المتبقي للمحاولة التالية:</span>
                      <span>{Math.ceil(queueStatus.nextItem.nextAttemptIn / 1000)} ثانية</span>
                    </div>
                    <Progress value={100 - (queueStatus.nextItem.nextAttemptIn / 5000) * 100} className="mt-2" />
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* سجل API */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>سجل طلبات API</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const text = JSON.stringify(apiLog, null, 2)
              navigator.clipboard.writeText(text)
              toast({ title: "تم نسخ سجل API" })
            }}
          >
            <Copy className="h-4 w-4 mr-2" /> نسخ
          </Button>
        </CardHeader>
        <CardContent>
          {apiLog.length === 0 ? (
            <p className="text-muted-foreground">لا توجد سجلات API</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2 px-4">الوقت</th>
                    <th className="text-right py-2 px-4">الرسالة</th>
                    <th className="text-right py-2 px-4">المحاولة</th>
                    <th className="text-right py-2 px-4">الحالة</th>
                    <th className="text-right py-2 px-4">الاستجابة</th>
                  </tr>
                </thead>
                <tbody>
                  {apiLog.map((log, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 px-4 text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="py-2 px-4 text-xs">
                        <div className="max-w-xs truncate">{log.originalMessage || log.message}</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-6 text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(log.originalMessage || log.message)
                            toast({ title: "تم نسخ الرسالة" })
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" /> نسخ
                        </Button>
                      </td>
                      <td className="py-2 px-4 text-xs">{log.retryCount || 0}</td>
                      <td className="py-2 px-4 text-xs">{log.status ? log.status : log.error ? "خطأ" : "غير معروف"}</td>
                      <td className="py-2 px-4 text-xs">
                        <details>
                          <summary>عرض</summary>
                          <pre className="text-xs mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
                            {log.response || log.error || "لا توجد استجابة"}
                          </pre>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-6 text-xs"
                            onClick={() => {
                              navigator.clipboard.writeText(log.response || log.error || "")
                              toast({ title: "تم نسخ الاستجابة" })
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" /> نسخ
                          </Button>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* سجل الإشعارات */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>سجل الإشعارات المحلي</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const text = JSON.stringify(notificationLog, null, 2)
              navigator.clipboard.writeText(text)
              toast({ title: "تم نسخ سجل الإشعارات" })
            }}
          >
            <Copy className="h-4 w-4 mr-2" /> نسخ
          </Button>
        </CardHeader>
        <CardContent>
          {notificationLog.length === 0 ? (
            <p className="text-muted-foreground">لا توجد سجلات إشعارات</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2 px-4">الوقت</th>
                    <th className="text-right py-2 px-4">الرسالة</th>
                    <th className="text-right py-2 px-4">المحاولة</th>
                    <th className="text-right py-2 px-4">الحالة</th>
                    <th className="text-right py-2 px-4">التفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {notificationLog.map((notification, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 px-4 text-xs">{new Date(notification.timestamp).toLocaleString()}</td>
                      <td className="py-2 px-4 text-xs">
                        <div className="max-w-xs truncate">{notification.message}</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-6 text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(notification.message)
                            toast({ title: "تم نسخ الرسالة" })
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" /> نسخ
                        </Button>
                      </td>
                      <td className="py-2 px-4 text-xs">{notification.retryCount || 0}</td>
                      <td className="py-2 px-4 text-xs">{notification.status}</td>
                      <td className="py-2 px-4 text-xs">
                        {notification.error || notification.apiResponse ? (
                          <details>
                            <summary>عرض</summary>
                            <pre className="text-xs mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
                              {notification.error || JSON.stringify(notification.apiResponse, null, 2)}
                            </pre>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="mt-1 h-6 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(
                                  notification.error || JSON.stringify(notification.apiResponse, null, 2),
                                )
                                toast({ title: "تم نسخ التفاصيل" })
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" /> نسخ
                            </Button>
                          </details>
                        ) : (
                          "لا توجد تفاصيل"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* الإشعارات المحفوظة محلياً */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>الإشعارات المحفوظة محلياً</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const text = JSON.stringify(localNotifications, null, 2)
                navigator.clipboard.writeText(text)
                toast({ title: "تم نسخ الإشعارات المحفوظة" })
              }}
            >
              <Copy className="h-4 w-4 mr-2" /> نسخ
            </Button>
            <Button variant="ghost" size="sm" onClick={handleClearLocalNotifications}>
              <Trash2 className="h-4 w-4 mr-2" /> مسح
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {localNotifications.length === 0 ? (
            <p className="text-muted-foreground">لا توجد إشعارات محفوظة</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2 px-4">الوقت</th>
                    <th className="text-right py-2 px-4">الرسالة</th>
                    <th className="text-right py-2 px-4">الحالة</th>
                    <th className="text-right py-2 px-4">الخطأ</th>
                  </tr>
                </thead>
                <tbody>
                  {localNotifications.map((notification, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 px-4 text-xs">{new Date(notification.timestamp).toLocaleString()}</td>
                      <td className="py-2 px-4 text-xs">
                        <div className="max-w-xs truncate">{notification.message}</div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-6 text-xs"
                          onClick={() => {
                            navigator.clipboard.writeText(notification.message)
                            toast({ title: "تم نسخ الرسالة" })
                          }}
                        >
                          <Copy className="h-3 w-3 mr-1" /> نسخ
                        </Button>
                      </td>
                      <td className="py-2 px-4 text-xs">{notification.status}</td>
                      <td className="py-2 px-4 text-xs">{notification.error || "لا يوجد"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
