import type React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "تفاصيل المهمة",
  description: "عرض تفاصيل المهمة والمهام الفرعية",
}

export default function TaskLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
