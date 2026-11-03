"use client"

import React, { Suspense } from "react"
import { Dashboard } from "../components/Dashboard"
import { TimeProvider } from "../contexts/TimeContext"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Users } from 'lucide-react'

function DashboardWrapper() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    }>
      <Dashboard />
    </Suspense>
  )
}

export default function Home() {
  return (
    <TimeProvider>
      <div className="fixed top-4 left-4 z-50">
        <Link href="/sales-rep">
          <Button variant="default" size="lg" className="shadow-lg">
            <Users className="ml-2 h-5 w-5" />
            نظام المناديب
          </Button>
        </Link>
      </div>
      <main className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-5xl font-bold text-foreground mb-4">
              نظام الإدارة المتكامل
            </h1>
            <p className="text-xl text-muted-foreground">
              منصة شاملة لإدارة المهام والمبيعات الميدانية
            </p>
          </div>

          {/* Main Options */}
          <DashboardWrapper />
        </div>
      </main>
    </TimeProvider>
  )
}
