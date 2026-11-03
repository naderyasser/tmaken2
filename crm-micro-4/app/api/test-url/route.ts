import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ success: false, error: "URL is required" }, { status: 400 })
    }

    console.log("Testing direct URL:", url)

    try {
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
      console.error("Error calling URL:", error)
      return NextResponse.json({
        success: false,
        error: String(error),
        url,
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
