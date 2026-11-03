"use client"

import { WifiOff, CloudOff } from "lucide-react"
import { useCashier } from "@/contexts/CashierContext"
import { cn } from "@/lib/utils"
import {} from "@/lib/cashier-utils"

interface OfflineIndicatorProps {
  className?: string
}

export function OfflineIndicator({ className }: OfflineIndicatorProps) {
  const { isOnline, offlineQueueCount } = useCashier()

  if (isOnline && offlineQueueCount === 0) return null

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {!isOnline && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
          <WifiOff className="h-3.5 w-3.5" />
          <span>Offline Mode</span>
        </div>
      )}
      {offlineQueueCount > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
          <CloudOff className="h-3.5 w-3.5" />
          <span>{offlineQueueCount} queued</span>
        </div>
      )}
    </div>
  )
}
