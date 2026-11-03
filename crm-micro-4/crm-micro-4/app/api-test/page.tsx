"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Send, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ApiTestPage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [phone, setPhone] = useState("966550455010")
  const [apiKey, setApiKey] = useState("7787411")
  const [message, setMessage] = useState("اختبار الرسالة")
  const [directUrl, setDirectUrl] = useState("")
  const router = useRouter()
  const { toast } = useToast()

  // اختبار إرسال رسالة مباشرة عبر API
  const testDirectApi = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/test-direct", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, apiKey, message }),
      })

      const data = await response.json()
      setResults([{ timestamp: new Date().toISOString(), type: "direct", data }])

      toast({
        title: data.success ? "تم الإرسال بنجاح" : "فشل الإرسال",
        description: data.message || data.error || "تم تنفيذ الاختبار",
      })
    } catch (error) {
      console.error("Error testing API:", error)
      setResults([
        {
          timestamp: new Date().toISOString(),
          type: "direct",
          data: { success: false, error: String(error) },
        },
      ])

      toast({
        title: "خطأ في الاختبار",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // اختبار إرسال رسالة عبر API الداخلي
  const testInternalApi = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/send-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message }),
      })

      const data = await response.json()
      setResults([{ timestamp: new Date().toISOString(), type: "internal", data }])

      toast({
        title: data.success ? "تم الإرسال بنجاح" : "فشل الإرسال",
        description: data.message || data.error || "تم تنفيذ الاختبار",
      })
    } catch (error) {
      console.error("Error testing API:", error)
      setResults([
        {
          timestamp: new Date().toISOString(),
          type: "internal",
          data: { success: false, error: String(error) },
        },
      ])

      toast({
        title: "خطأ في الاختبار",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // اختبار إرسال رسالة عبر رابط مباشر
  const testDirectUrl = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/test-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: directUrl }),
      })

      const data = await response.json()
      setResults([{ timestamp: new Date().toISOString(), type: "url", data }])

      toast({
        title: data.success ? "تم الإرسال بنجاح" : "فشل الإرسال",
        description: data.message || data.error || "تم تنفيذ الاختبار",
      })
    } catch (error) {
      console.error("Error testing URL:", error)
      setResults([
        {
          timestamp: new Date().toISOString(),
          type: "url",
          data: { success: false, error: String(error) },
        },
      ])

      toast({
        title: "خطأ في الاختبار",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // اختبار رسائل مختلفة
  const runPredefinedTests = async () => {
    setLoading(true)
    const testMessages = [
      "Test message in English",
      "رسالة اختبار بالعربي",
      "رسالة مع رابط: https://example.com",
      "تم إنشاء مهمة جديدة: اختبار",
      "تم تعديل المهمة: اختبار",
    ]

    const results = []

    for (const testMessage of testMessages) {
      try {
        const response = await fetch("/api/send-notification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: testMessage }),
        })

        const data = await response.json()
        results.push({
          timestamp: new Date().toISOString(),
          type: "predefined",
          message: testMessage,
          data,
        })

        // إضافة تأخير بين الطلبات
        await new Promise((resolve) => setTimeout(resolve, 5000))
      } catch (error) {
        console.error(`Error testing message "${testMessage}":`, error)
        results.push({
          timestamp: new Date().toISOString(),
          type: "predefined",
          message: testMessage,
          data: { success: false, error: String(error) },
        })
      }
    }

    setResults(results)
    setLoading(false)

    toast({
      title: "تم تنفيذ الاختبارات",
      description: `تم اختبار ${testMessages.length} رسائل`,
    })
  }

  // إنشاء رابط مباشر
  const generateDirectUrl = () => {
    try {
      const encodedMessage = encodeURIComponent(message)
      const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${apiKey}`
      setDirectUrl(url)
    } catch (error) {
      console.error("Error generating URL:", error)
      toast({
        title: "خطأ في إنشاء الرابط",
        description: String(error),
        variant: "destructive",
      })
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">اختبار API</h1>
        <Button variant="outline" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          العودة
        </Button>
      </div>

      <Tabs defaultValue="direct">
        <TabsList className="mb-4">
          <TabsTrigger value="direct">اختبار مباشر</TabsTrigger>
          <TabsTrigger value="internal">اختبار API الداخلي</TabsTrigger>
          <TabsTrigger value="url">اختبار رابط مباشر</TabsTrigger>
          <TabsTrigger value="predefined">اختبارات محددة مسبقًا</TabsTrigger>
        </TabsList>

        <TabsContent value="direct">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>اختبار مباشر لـ CallMeBot API</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">رقم الهاتف</label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">مفتاح API</label>
                    <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">الرسالة</label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
                </div>

                <Button onClick={testDirectApi} disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  إرسال اختبار مباشر
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="internal">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>اختبار API الداخلي</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">الرسالة</label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
                </div>

                <Button onClick={testInternalApi} disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  إرسال عبر API الداخلي
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="url">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>اختبار رابط مباشر</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">رقم الهاتف</label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">مفتاح API</label>
                    <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">الرسالة</label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
                </div>

                <Button onClick={generateDirectUrl}>
                  <Send className="h-4 w-4 mr-2" />
                  إنشاء الرابط
                </Button>

                {directUrl && (
                  <div className="mt-4">
                    <label className="text-sm font-medium mb-1 block">الرابط المباشر</label>
                    <Textarea value={directUrl} readOnly rows={3} className="font-mono text-xs" />
                    <div className="flex justify-end mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(directUrl)
                          toast({ title: "تم نسخ الرابط" })
                        }}
                      >
                        نسخ الرابط
                      </Button>
                      <Button size="sm" className="mr-2" onClick={testDirectUrl} disabled={loading}>
                        {loading ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-2" />
                        )}
                        اختبار الرابط
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predefined">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>اختبارات محددة مسبقًا</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p>سيتم اختبار مجموعة من الرسائل المختلفة تلقائيًا:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>رسالة باللغة الإنجليزية</li>
                  <li>رسالة باللغة العربية</li>
                  <li>رسالة تحتوي على رابط</li>
                  <li>رسالة إنشاء مهمة</li>
                  <li>رسالة تعديل مهمة</li>
                </ul>

                <Button onClick={runPredefinedTests} disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                  تشغيل الاختبارات المحددة مسبقًا
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>نتائج الاختبار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">{new Date(result.timestamp).toLocaleString()}</span>
                    <span className={`text-sm font-medium ${result.data.success ? "text-green-500" : "text-red-500"}`}>
                      {result.data.success ? "نجاح" : "فشل"}
                    </span>
                  </div>

                  {result.message && (
                    <div className="mb-2">
                      <span className="text-sm font-medium">الرسالة:</span>
                      <p className="text-sm mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded">{result.message}</p>
                    </div>
                  )}

                  <div className="mb-2">
                    <span className="text-sm font-medium">النوع:</span>
                    <span className="text-sm mr-2">
                      {result.type === "direct"
                        ? "اختبار مباشر"
                        : result.type === "internal"
                          ? "API داخلي"
                          : result.type === "url"
                            ? "رابط مباشر"
                            : "اختبار محدد مسبقًا"}
                    </span>
                  </div>

                  <div>
                    <span className="text-sm font-medium">النتيجة:</span>
                    <pre className="text-xs mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
