"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { testUrlFormatting } from "../../utils/webhook"

export default function UrlTestPage() {
  const [inputUrl, setInputUrl] = useState("")
  const [fixedUrl, setFixedUrl] = useState("")
  const [testResults, setTestResults] = useState<Array<{ original: string; fixed: string }>>([])
  const router = useRouter()

  const handleTest = () => {
    if (!inputUrl) return

    const fixed = testUrlFormatting(inputUrl)
    setFixedUrl(fixed)

    setTestResults((prev) => [...prev, { original: inputUrl, fixed }])
  }

  const predefinedTests = [
    "https:example.com/path",
    "https://example.ne/t/path",
    "https://kzmncyzbwk9pocrym5o4.lite.vusercontent.ne/t/task/1234567890",
    "https://example.co/m/path",
  ]

  const runPredefinedTests = () => {
    const results = predefinedTests.map((url) => ({
      original: url,
      fixed: testUrlFormatting(url),
    }))
    setTestResults(results)
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">اختبار تنسيق الروابط</h1>
        <Button variant="outline" onClick={() => router.push("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          العودة
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>اختبار رابط</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <div className="flex space-x-2">
              <Input
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="أدخل الرابط للاختبار"
                className="flex-1"
              />
              <Button onClick={handleTest}>اختبار</Button>
            </div>

            {fixedUrl && (
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
                <p className="font-bold mb-2">الرابط الأصلي:</p>
                <p className="text-sm mb-4 break-all">{inputUrl}</p>
                <p className="font-bold mb-2">الرابط بعد الإصلاح:</p>
                <p className="text-sm break-all">{fixedUrl}</p>
              </div>
            )}

            <Button variant="outline" onClick={runPredefinedTests}>
              تشغيل الاختبارات المحددة مسبقًا
            </Button>
          </div>
        </CardContent>
      </Card>

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>نتائج الاختبار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2 px-4">الرابط الأصلي</th>
                    <th className="text-right py-2 px-4">الرابط بعد الإصلاح</th>
                    <th className="text-right py-2 px-4">النتيجة</th>
                  </tr>
                </thead>
                <tbody>
                  {testResults.map((result, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 px-4 text-xs break-all">{result.original}</td>
                      <td className="py-2 px-4 text-xs break-all">{result.fixed}</td>
                      <td className="py-2 px-4 text-xs">
                        {result.original !== result.fixed ? (
                          <span className="text-green-500">تم الإصلاح</span>
                        ) : (
                          <span className="text-gray-500">لم يتغير</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
