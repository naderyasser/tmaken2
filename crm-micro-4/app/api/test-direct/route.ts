import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { phone, apiKey, message } = await request.json()

    if (!phone || !apiKey || !message) {
      return NextResponse.json({ success: false, error: "Phone, API key, and message are required" }, { status: 400 })
    }

    console.log("Testing direct API call with:")
    console.log("- Phone:", phone)
    console.log("- API Key:", apiKey)
    console.log("- Message:", message)

    try {
      // تشفير الرسالة
      const encodedMessage = encodeURIComponent(message)
      const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodedMessage}&apikey=${apiKey}`

      console.log("Request URL:", url)

      // إرسال الطلب مع تحديد مهلة زمنية
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 ثوانٍ كحد أقصى

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

      console.log("API Response Status:", response.status)
      console.log("API Response:", responseText)

      if (!response.ok) {
        return NextResponse.json({
          success: false,
          error: responseText,
          status: response.status,
          url,
        })
      }

      return NextResponse.json({
        success: true,
        message: responseText,
        status: response.status,
        url,
      })
    } catch (error) {
      console.error("Error calling API:", error)
      return NextResponse.json({
        success: false,
        error: String(error),
        url: `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${apiKey}`,
      })
    }
  } catch (error) {
    console.error("Error processing request:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: String(error),
      },
      { status: 500 },
    )
  }
}
