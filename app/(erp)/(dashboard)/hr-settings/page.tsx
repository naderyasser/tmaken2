"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Redirect to the main settings module
export default function HRSettingsPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/hr?module=settings')
  }, [router])

  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-muted-foreground/70">Redirecting...</p>
    </div>
  )
}
