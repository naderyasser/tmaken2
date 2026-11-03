import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { InventoryProvider } from "@/contexts/InventoryContext"

export const metadata: Metadata = {
  title: "نظام إدارة المناديب",
  description: "منصة شاملة لإدارة المبيعات الميدانية وتتبع العملاء",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="font-sans antialiased">
        <InventoryProvider>
          {children}
        </InventoryProvider>
      </body>
    </html>
  )
}
